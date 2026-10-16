import 'dotenv/config';
import { mkdirSync } from 'node:fs';
import express       from 'express';
import cors          from 'cors';
import crypto        from 'node:crypto';
import path          from 'node:path';
import { fileURLToPath } from 'node:url';
import Database      from 'better-sqlite3';
import { GoogleGenAI } from '@google/genai';
import { TIERS } from './config.js';

/* ------------------------------------------------------------------ */
/*  Config                                                            */
/* ------------------------------------------------------------------ */
const __dirname    = path.dirname(fileURLToPath(import.meta.url));
const PORT         = process.env.PORT || 3001;
const APP_URL      = process.env.APP_URL      || `http://localhost:3001`;
const JWT_SECRET   = process.env.JWT_SECRET   || 'xcelerate-dev-secret-change-in-prod';
const TOKEN_TTL    = 60 * 60 * 24 * 30; // 30 days

// Initialize Gemini SDK with explicit API key handling
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
    subscription_status   TEXT DEFAULT 'active',
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
  CREATE TABLE IF NOT EXISTS subscriptions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL,
    tier          TEXT NOT NULL,
    status        TEXT NOT NULL,
    amount_gross  REAL,
    pf_payment_id TEXT,
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
    tier: 'free', subscription_status: 'active',
    email_verified: !!u.email_verified, is_admin: !!u.is_admin,
  };
}

function logActivity(userId, eventType, meta) {
  db.prepare('INSERT INTO activity_log (user_id,event_type,meta,created_at) VALUES (?,?,?,?)')
    .run(userId, eventType, meta ? JSON.stringify(meta) : null, new Date().toISOString());
}

/* ------------------------------------------------------------------ */
/*  Seed admin account & Forced Admin Rule                            */
/* ------------------------------------------------------------------ */
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'vutlharikhumalo@gmail.com';
const ADMIN_PASS  = process.env.ADMIN_PASSWORD || 'Xcelerate2026!';

if (ADMIN_EMAIL) {
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(ADMIN_EMAIL);
  if (!exists) {
    const { hash, salt } = hashPassword(ADMIN_PASS);
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO users (name,email,password_hash,password_salt,is_admin,email_verified,created_at,last_active_at)
       VALUES (?,?,?,?,1,1,?,?)`
    ).run('Admin', ADMIN_EMAIL, hash, salt, now, now);
    console.log('✓ Admin account created:', ADMIN_EMAIL);
  } else {
    db.prepare('UPDATE users SET is_admin = 1 WHERE email = ?').run(ADMIN_EMAIL);
  }
}

/* ------------------------------------------------------------------ */
/*  Express Setup                                                     */
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

  const isAdminFlag = (normalizedEmail === 'vutlharikhumalo@gmail.com') ? 1 : 0;

  const result = db.prepare(
    `INSERT INTO users
     (name,email,password_hash,password_salt,grade,is_admin,verify_token,verify_expires,created_at,last_active_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).run(String(name).trim(), normalizedEmail, hash, salt,
        grade || 'Grade 12', isAdminFlag, vToken, vExpires, now, now);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  logActivity(user.id, 'signup', {});

  const token = signToken({ sub: user.id });
  return sendJSON(res, 201, { token, user: publicUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return sendJSON(res, 400, { error: 'email and password are required.' });

  const normalizedEmail = String(email).trim().toLowerCase();
  
  if (normalizedEmail === 'vutlharikhumalo@gmail.com') {
    db.prepare('UPDATE users SET is_admin = 1 WHERE email = ?').run(normalizedEmail);
  }

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

/* ---- AI Tutor (Gemini integration - Unlimited & Free) ---- */
const SUBJECT_SYSTEM = {
  'mathematics':            'CAPS Grade 12 Mathematics: algebra, functions, calculus, trigonometry, geometry and statistics.',
  'physical-sciences':      'CAPS Grade 12 Physical Sciences: mechanics, electricity, waves and chemical systems.',
  'life-sciences':          'CAPS Grade 12 Life Sciences: genetics, evolution, human physiology and ecology.',
  'information-technology': 'CAPS Grade 12 Information Technology: programming, databases, networks and systems.',
};

app.post('/api/tutor', async (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const { subject, message, history = [] } = req.body;
  if (!message || typeof message !== 'string')
    return sendJSON(res, 400, { error: 'message is required.' });

  if (!process.env.GEMINI_API_KEY) {
    console.error('Gemini Error: GEMINI_API_KEY environment variable is not set.');
    return sendJSON(res, 200, { reply: 'Server configuration error: GEMINI_API_KEY is missing.', fallback: true });
  }

  try {
    db.prepare('INSERT INTO tutor_messages (user_id,subject,created_at) VALUES (?,?,?)')
      .run(user.id, subject || null, new Date().toISOString());
    logActivity(user.id, 'tutor_message', { subject });
  } catch (dbErr) {
    console.error('Database log error:', dbErr.message);
  }

  const subjectCtx  = SUBJECT_SYSTEM[subject] || 'general CAPS STEM revision for Grade 12.';
  const systemPrompt =
    `You are a patient, step-by-step South African Grade 12 NSC tutor.\n` +
    `Subject: ${subjectCtx}\n` +
    `Rules: explain reasoning before the answer; use simple language; show working step-by-step; keep replies under 200 words unless asked for more.`;

  const formattedHistory = Array.isArray(history)
    ? history.slice(-6).map(h => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: typeof h.content === 'string' ? h.content : (h.text || '') }]
      }))
    : [];

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        ...formattedHistory,
        { role: 'user', parts: [{ text: message }] }
      ],
      config: {
        systemInstruction: systemPrompt,
      }
    });

    const reply = (response.text || '').trim();
    return sendJSON(res, 200, { reply: reply || 'Sorry, I could not generate a response.', fallback: false });
  } catch (err) {
    console.error('Gemini Execution Error:', err);
    return sendJSON(res, 200, { reply: `AI Error: ${err.message}`, fallback: true });
  }
});

/* ---- Quiz log ---- */
app.post('/api/quiz/log', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const { subject, paper, score, total } = req.body;
  if (!subject || !paper || score == null || total == null)
    return sendJSON(res, 400, { error: 'subject, paper, score and total are required.' });

  db.prepare('INSERT INTO quiz_attempts (user_id,subject,paper,score,total,created_at) VALUES (?,?,?,?,?,?)')
    .run(user.id, subject, paper, score, total, new Date().toISOString());
  logActivity(user.id, 'quiz_complete', { subject, paper, score, total });
  return sendJSON(res, 201, { ok: true });
});

/* ---- Summary ---- */
app.get('/api/summary', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const attempts = db.prepare('SELECT * FROM quiz_attempts WHERE user_id = ? ORDER BY created_at DESC').all(user.id);
  const total    = attempts.length;
  const avg      = total
    ? Math.round((attempts.reduce((s, a) => s + a.score / a.total, 0) / total) * 100)
    : 0;
  return sendJSON(res, 200, { totalQuizzes: total, avgScorePct: avg, recent: attempts.slice(0, 5) });
});

/* ---- Plans & Subscriptions (Bypassed as Free) ---- */
app.get('/api/plans', (_req, res) => {
  return sendJSON(res, 200, {
    plans: [{ id: 'free', label: 'Free & Unlocked', price: 0, features: ['All features unlocked'] }]
  });
});

app.post('/api/subscribe', (req, res) => {
  return sendJSON(res, 200, { ok: true, message: 'App is completely free!' });
});

app.get('/api/subscription/status', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  return sendJSON(res, 200, { tier: 'free', status: 'active' });
});

/* ---- Activity ping ---- */
app.post('/api/activity/ping', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  db.prepare('INSERT INTO session_pings (user_id,view,created_at) VALUES (?,?,?)')
    .run(user.id, req.body?.view || null, new Date().toISOString());
  return sendJSON(res, 200, { ok: true });
});

/* ---- Admin Dashboard API Endpoints ---- */
app.get('/api/admin/stats', (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const total = db.prepare('SELECT COUNT(*) c FROM users WHERE is_admin = 0').get().c;
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const weekAgoStr = new Date(now.getTime() - 7 * 86400000).toISOString();

  const activeToday = db.prepare("SELECT COUNT(DISTINCT user_id) c FROM activity_log WHERE created_at >= ?").get(todayStr)?.c || 0;
  const activeWeek = db.prepare("SELECT COUNT(DISTINCT user_id) c FROM activity_log WHERE created_at >= ?").get(weekAgoStr)?.c || 0;

  return sendJSON(res, 200, {
    totalLearners: total,
    tierCounts: { free: total, plus: 0, pro: 0 },
    estimatedMRR: 0,
    activeToday,
    activeWeek
  });
});

app.get('/api/admin/feed', (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const feed = db.prepare(`
    SELECT a.event_type, a.meta, a.created_at, u.name, u.email
    FROM activity_log a
    JOIN users u ON a.user_id = u.id
    ORDER BY a.id DESC
    LIMIT 100
  `).all();

  return sendJSON(res, 200, { feed });
});

app.get('/api/admin/learners', (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const learners = db.prepare(`
    SELECT u.id, u.name, u.email, u.grade, u.tier, u.subscription_status, u.email_verified, u.created_at, u.last_active_at,
           (SELECT COUNT(*) FROM quiz_attempts q WHERE q.user_id = u.id) as quizCount,
           (SELECT COALESCE(ROUND(AVG((score*100.0)/total)), 0) FROM quiz_attempts q WHERE q.user_id = u.id) as avgScore
    FROM users u
    WHERE u.is_admin = 0
    ORDER BY u.id DESC
  `).all();

  return sendJSON(res, 200, { learners });
});

app.get('/api/admin/subscriptions', (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const subscriptions = db.prepare(`
    SELECT s.*, u.name, u.email
    FROM subscriptions s
    JOIN users u ON s.user_id = u.id
    ORDER BY s.id DESC
  `).all();

  return sendJSON(res, 200, { subscriptions });
});

/* ---- Static frontend ---- */
const FRONTEND = path.join(__dirname, '..');
app.use(express.static(FRONTEND));

// Explicit route to serve admin.html properly
app.get('/admin.html', (_req, res) => {
  res.sendFile(path.join(FRONTEND, 'admin.html'));
});

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(FRONTEND, 'index.html'));
  }
});

/* ------------------------------------------------------------------ */
/*  Start Server                                                      */
/* ------------------------------------------------------------------ */
app.listen(PORT, () => {
  console.log(`\n Xcelerate MathsAcademy (Free Edition)`);
  console.log(`    Open → http://localhost:${PORT}`);
  console.log(`    AI Engine → Google Gemini (gemini-2.5-flash)`);
  console.log(`    Status → 100% Free & Unlimited`);
  console.log('');
});
