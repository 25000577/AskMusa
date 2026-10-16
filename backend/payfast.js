import crypto from 'node:crypto';
import { TIERS } from './config.js'; // Fixed path

const PAYFAST_SANDBOX = process.env.PAYFAST_SANDBOX !== 'false'; // default true until explicitly turned off
const PAYFAST_HOST = PAYFAST_SANDBOX ? 'sandbox.payfast.co.za' : 'www.payfast.co.za';

// CORRECT — reads named env vars, values come from your .env file
const MERCHANT_ID = process.env.PAYFAST_MERCHANT_ID;
const MERCHANT_KEY = process.env.PAYFAST_MERCHANT_KEY;
const PASSPHRASE = process.env.PAYFAST_PASSPHRASE || ''; // Added passphrase support

// PayFast wants spaces encoded as '+', which encodeURIComponent doesn't do
// by default (it produces %20). This matches PHP's urlencode() behaviour,
// which is what PayFast's own signature examples are written against.
function pfEncode(value) {
  return encodeURIComponent(String(value)).replace(/%20/g, '+');
}

function buildSignature(orderedEntries, passphrase) {
  let paramString = orderedEntries
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${pfEncode(value)}`)
    .join('&');
  if (passphrase) {
    paramString += `&passphrase=${pfEncode(passphrase)}`;
  }
  return crypto.createHash('md5').update(paramString).digest('hex');
}

// Builds the field set + signature for redirecting a user to PayFast.
// Returns { action, fields, mPaymentId } — `action` is the PayFast URL to
// POST `fields` to (e.g. via an auto-submitting form on the frontend).
export function buildPaymentFields({ user, tier, appUrl }) {
  if (!MERCHANT_ID || !MERCHANT_KEY) {
    throw new Error('PAYFAST_MERCHANT_ID / PAYFAST_MERCHANT_KEY are not configured.');
  }
  const plan = TIERS[tier];
  if (!plan) throw new Error(`Unknown tier "${tier}".`);

  const mPaymentId = crypto.randomUUID();
  const [firstName, ...rest] = String(user.name || 'Learner').trim().split(' ');

  // Order matters for the signature — keep this array as the single source
  // of truth for both the signature and the fields sent to the browser.
  const orderedEntries = [
    ['merchant_id', MERCHANT_ID],
    ['merchant_key', MERCHANT_KEY],
    ['return_url', `${appUrl}/payment-success.html`],
    ['cancel_url', `${appUrl}/payment-cancelled.html`],
    ['notify_url', `${appUrl}/api/payfast/notify`],
    ['name_first', firstName],
    ['name_last', rest.join(' ') || ''],
    ['email_address', user.email],
    ['m_payment_id', mPaymentId],
    ['amount', plan.price.toFixed(2)],
    ['item_name', plan.label],
    ['item_description', `${plan.label} subscription — Xcelerate MathsAcademy`],
    ['subscription_type', '1'], // 1 = recurring billing
    ['billing_date', new Date().toISOString().slice(0, 10)],
    ['recurring_amount', plan.price.toFixed(2)],
    ['frequency', '3'], // 3 = monthly, per PayFast's frequency codes
    ['cycles', '0'], // 0 = until cancelled
  ];

  const signature = buildSignature(orderedEntries, PASSPHRASE);
  const fields = Object.fromEntries(orderedEntries);
  fields.signature = signature;

  return {
    action: `https://${PAYFAST_HOST}/eng/process`, // Fixed to use dynamic host (Sandbox/Live)
    fields,
    mPaymentId,
  };
}

// Verifies the signature on an incoming ITN POST body. `body` should be the
// parsed x-www-form-urlencoded payload, in the order PayFast sent it.
export function verifyNotifySignature(body) {
  if (!body || !body.signature) return false;
  const entries = Object.entries(body).filter(([key]) => key !== 'signature');
  const expected = buildSignature(entries, PASSPHRASE);
  return expected === body.signature;
}

export const PAYFAST_CONFIGURED = Boolean(MERCHANT_ID && MERCHANT_KEY);
