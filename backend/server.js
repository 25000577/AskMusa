import 'dotenv/config';
import { mkdirSync } from 'node:fs';
import express       from 'express';
import cors          from 'cors';
import crypto        from 'node:crypto';
import path          from 'node:path';
import { fileURLToPath } from 'node:url';
import Database      from 'better-sqlite3';
import { GoogleGenAI } from '@google/genai';
import { readFormBody } from './http-utils.js';
import { buildPaymentFields, verifyNotifySignature } from './payfast.js';
import { FREE_TUTOR_DAILY_LIMIT, FREE_UNLOCKED_SUBJECTS, TIERS, tierAtLeast } from './config.js';

/* ------------------------------------------------------------------ */
/*  Config                                                            */
/* ------------------------------------------------------------------ */
const __dirname    = path.dirname(fileURLToPath(import.meta.url));
const PORT         = process.env.PORT || 3001;
const APP_URL      = process.env.APP_URL      || `http://localhost:3001`;
const JWT_SECRET   = process.env.JWT_SECRET   || 'xcelerate-dev-secret-change-in-prod';
const TOKEN_TTL    = 60 * 60 * 24 * 30; // 30 days

// Initialize Gemini SDK (picks up process.env.GEMINI_API_KEY automatically)
const ai = new GoogleGenAI();

/* ------------------------------------------------------------------ */
/*  Database  (create data/ dir FIRST so SQLite doesn't throw)        */
/* ------------------------------------------------------------------ */
mkdirSync(path.join(__dirname, 'data'), { recursive: true });

const db = new Database(path.join(__dirname, 'data', 'app.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    name                  TEXT NOT NULL,
    email                 TEXT NOT NULL UNIQUE,
    password_hash         TEXT NOT NULL,
    password_salt         TEXT NOT NULL,
    grade                 TEXT DEFAULT 'Grade 12',
    tier                  TEXT DEFAULT 'free',
    subscription_status   TEXT DEFAULT 'none',
    payfast_token         TEXT,
    is_admin              INTEGER DEFAULT 0,
    email_verified        INTEGER DEFAULT 0,
    verify_token          TEXT,
    verify_expires        TEXT,
    created_at            TEXT NOT NULL,
    last_active_at        TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS quiz_attempts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL,
    subject       TEXT NOT NULL,
    paper         TEXT NOT NULL,
    score         INTEGER NOT NULL,
    total         INTEGER NOT NULL,
    created_at    TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS tutor_messages (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL,
    subject       TEXT,
    created_at    TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS subscriptions (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id             INTEGER NOT NULL,
    tier                TEXT NOT NULL,
    m_payment_id        TEXT NOT NULL,
    amount_gross        REAL,
    status              TEXT DEFAULT 'pending',
    pf_payment_id       TEXT,
    raw_payload         TEXT,
    created_at          TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS activity_log (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL,
    event_type    TEXT NOT NULL,
    meta          TEXT,
    created_at    TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS session_pings (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL,
    view          TEXT,
    created_at    TEXT NOT NULL
  );
`);

/* ------------------------------------------------------------------ */
/*  Crypto helpers                                                    */
/* ------------------------------------------------------------------ */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { hash, salt };
}

function verifyPassword(password, salt, hash) {
  try {
    const candidate = crypto.scryptSync(String(password), salt, 64).toString('hex');
    return crypto.timingSafeEqual(
      Buffer.from(candidate, 'hex'),
      Buffer.from(hash, 'hex')
    );
  } catch { return false; }
}

function signToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body   = Buffer.from(JSON.stringify({
    ...payload,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL,
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verifyToken(token) {
  if (!token) return null;
  try {
    const [header, body, sig] = token.split('.');
    const expected = crypto.createHmac('sha256', JWT_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

/* ------------------------------------------------------------------ */
/*  HTTP helpers                                                      */
/* ------------------------------------------------------------------ */
function sendJSON(res, status, payload) {
  res.status(status).json(payload);
}

function requireAuth(req, res) {
  const header  = req.headers['authorization'] || '';
  const token   = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = verifyToken(token);
  if (!payload) { sendJSON(res, 401, { error: 'Not authenticated.' }); return null; }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
  if (!user)  { sendJSON(res, 401, { error: 'Account not found.' }); return null; }
  db.prepare('UPDATE users SET last_active_at = ? WHERE id = ?')
    .run(new Date().toISOString(), user.id);
  return user;
}

function requireAdmin(req, res) {
  const user = requireAuth(req, res);
  if (!user) return null;
  if (!user.is_admin) { sendJSON(res, 403, { error: 'Admin access required.' }); return null; }
  return user;
}

function publicUser(u) {
  return {
    id: u.id, name: u.name, email: u.email, grade: u.grade,
    tier: u.tier, subscription_status: u.subscription_status,
    email_verified: !!u.email_verified, is_admin: !!u.is_admin,
  };
}

function logActivity(userId, eventType, meta) {
  db.prepare('INSERT INTO activity_log (user_id,event_type,meta,created_at) VALUES (?,?,?,?)')
    .run(userId, eventType, meta ? JSON.stringify(meta) : null, new Date().toISOString());
}

/* ------------------------------------------------------------------ */
/*  Seed admin account (on every start if env vars are set)           */
/* ------------------------------------------------------------------ */
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASS  = process.env.ADMIN_PASSWORD;
if (ADMIN_EMAIL && ADMIN_PASS) {
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(ADMIN_EMAIL);
  if (!exists) {
    const { hash, salt } = hashPassword(ADMIN_PASS);
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO users (name,email,password_hash,password_salt,is_admin,email_verified,created_at,last_active_at)
       VALUES (?,?,?,?,1,1,?,?)`
    ).run('Admin', ADMIN_EMAIL, hash, salt, now, now);
    console.log('✓ Admin account created:', ADMIN_EMAIL);
  }
}

/* ------------------------------------------------------------------ */
/*  Email verification                                                */
/* ------------------------------------------------------------------ */
async function sendVerificationEmail(user, token) {
  const link = `${APP_URL}/api/auth/verify?token=${token}`;
  console.log('\n📧 Verify link for', user.email, '\n    ', link, '\n');

  if (process.env.SMTP_HOST) {
    try {
      const nodemailer = await import('nodemailer');
      const transport  = nodemailer.default.createTransport({
        host:   process.env.SMTP_HOST,
        port:   parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await transport.sendMail({
        from:   `"Xcelerate MathsAcademy" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to:      user.email,
        subject: 'Verify your Xcelerate MathsAcademy account',
        html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
          <h2>Hi ${user.name} 👋</h2>
          <p>Click below to verify your email address:</p>
          <a href="${link}" style="display:inline-block;margin:20px 0;padding:14px 28px;
             background:#ffb627;color:#0e1525;font-weight:700;border-radius:8px;
             text-decoration:none;">Verify my email</a>
          <p style="color:#888;font-size:0.83rem;">Expires in 24 hours.</p>
        </div>`,
      });
    } catch (err) {
      console.error('✗ Email send failed:', err.message);
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Express                                                           */
/* ------------------------------------------------------------------ */
const app = express();
app.use(cors());
app.use(express.json());

/* ---- Health ---- */
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', port: PORT, time: new Date().toISOString() });
});

/* ---- Auth ---- */
app.post('/api/auth/signup', (req, res) => {
  const { name, email, password, grade } = req.body;
  if (!name || !email || !password)
    return sendJSON(res, 400, { error: 'name, email and password are required.' });
  if (String(password).length < 6)
    return sendJSON(res, 400, { error: 'Password must be at least 6 characters.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return sendJSON(res, 400, { error: 'Please enter a valid email address.' });

  const normalizedEmail = String(email).trim().toLowerCase();
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail))
    return sendJSON(res, 409, { error: 'An account with that email already exists.' });

  const { hash, salt } = hashPassword(password);
  const vToken   = crypto.randomBytes(32).toString('hex');
  const vExpires = new Date(Date.now() + 86400000).toISOString();
  const now      = new Date().toISOString();

  const result = db.prepare(
    `INSERT INTO users
     (name,email,password_hash,password_salt,grade,verify_token,verify_expires,created_at,last_active_at)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(String(name).trim(), normalizedEmail, hash, salt,
        grade || 'Grade 12', vToken, vExpires, now, now);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  logActivity(user.id, 'signup', {});
  sendVerificationEmail(user, vToken); // fire-and-forget

  const token = signToken({ sub: user.id });
  return sendJSON(res, 201, { token, user: publicUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return sendJSON(res, 400, { error: 'email and password are required.' });

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);
  if (!user || !verifyPassword(password, user.password_salt, user.password_hash))
    return sendJSON(res, 401, { error: 'Incorrect email or password.' });

  db.prepare('UPDATE users SET last_active_at = ? WHERE id = ?')
    .run(new Date().toISOString(), user.id);
  logActivity(user.id, 'login', {});
  const token = signToken({ sub: user.id });
  return sendJSON(res, 200, { token, user: publicUser(user) });
});

app.get('/api/auth/me', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  return sendJSON(res, 200, { user: publicUser(user) });
});

app.post('/api/auth/resend-verify', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  if (user.email_verified) return sendJSON(res, 200, { ok: true });
  const token   = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 86400000).toISOString();
  db.prepare('UPDATE users SET verify_token = ?, verify_expires = ? WHERE id = ?')
    .run(token, expires, user.id);
  sendVerificationEmail(user, token);
  return sendJSON(res, 200, { ok: true });
});

app.get('/api/auth/verify', (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send('Missing token.');
  const user = db.prepare('SELECT * FROM users WHERE verify_token = ?').get(token);
  if (!user) return res.status(400).send('Invalid or already-used verification link.');
  if (new Date(user.verify_expires) < new Date())
    return res.status(400).send('Verification link has expired — request a new one.');
  db.prepare('UPDATE users SET email_verified = 1, verify_token = NULL, verify_expires = NULL WHERE id = ?')
    .run(user.id);
  logActivity(
