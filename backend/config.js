// Central config: subscription tiers, free-tier limits, app constants.
// payments.js, payfast.js, and server.js all import from here so pricing
// and limits live in exactly one place.

export const TIERS = {
  free: { label: 'Free', price: 0 },
  plus: { label: 'MatricLab Plus', price: 30 }, // ZAR / month
  pro: { label: 'MatricLab Pro', price: 50 }, // ZAR / month
};

const TIER_ORDER = ['free', 'plus', 'pro'];

// True if `tier` is at least as high as `minimum` in the free < plus < pro order.
export function tierAtLeast(tier, minimum) {
  const a = TIER_ORDER.indexOf(tier);
  const b = TIER_ORDER.indexOf(minimum);
  if (a === -1 || b === -1) return false;
  return a >= b;
}

// Free-tier AI Tutor messages allowed per calendar day (server-side UTC day).
export const FREE_TUTOR_DAILY_LIMIT = 5;

// Subjects/quizzes available to free-tier users without upgrading.
export const FREE_UNLOCKED_SUBJECTS = ['mathematics'];

// JWT-ish token settings (see auth.js — this app uses a small self-contained
// signed-token scheme, not a full JWT library, to keep dependencies light).
export const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
