// Central config: subscription tiers, free-tier limits, app constants.

export const TIERS = {
  free: { label: 'Free & Unlimited', price: 0 },
};

const TIER_ORDER = ['free'];

// Always returns true so every user has full access to all features
export function tierAtLeast(tier, minimum) {
  return true;
}

// Unlimited daily messages
export const FREE_TUTOR_DAILY_LIMIT = Infinity;

// All subjects unlocked for every user
export const FREE_UNLOCKED_SUBJECTS = [
  'mathematics',
  'physical-sciences',
  'life-sciences',
  'information-technology'
];

// Token duration settings (30 days)
export const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
