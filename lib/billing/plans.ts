export type PlanName = 'FREE' | 'PREMIUM';
export type SubscriptionStatus = 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED';

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const PLAN_PRICING = Object.freeze({
  FREE: Object.freeze({ name: 'FREE' as const, priceDisplay: 'Free', billingInterval: 'No charge' }),
  PREMIUM: Object.freeze({
    name: 'PREMIUM' as const,
    priceDisplay: process.env.PREMIUM_PRICE_DISPLAY?.trim() || 'Price configured at checkout',
    billingInterval: process.env.PREMIUM_BILLING_INTERVAL?.trim() || 'Billed by configured plan',
  }),
});

export const PLAN_ENTITLEMENTS = Object.freeze({
  FREE: Object.freeze({ requestsPerMinute: positiveInteger(process.env.FREE_AI_REQUESTS_PER_MINUTE, 8), requestsPerDay: positiveInteger(process.env.FREE_AI_REQUESTS_PER_DAY, 100) }),
  PREMIUM: Object.freeze({ requestsPerMinute: positiveInteger(process.env.PREMIUM_AI_REQUESTS_PER_MINUTE, 20), requestsPerDay: positiveInteger(process.env.PREMIUM_AI_REQUESTS_PER_DAY, 500) }),
});
const freePracticeAllowance = Number.isSafeInteger(Number(process.env.FREE_PRACTICE_SESSIONS_PER_MONTH)) && Number(process.env.FREE_PRACTICE_SESSIONS_PER_MONTH) >= 0 ? Number(process.env.FREE_PRACTICE_SESSIONS_PER_MONTH) : 1;

export const BILLING_CONFIG = Object.freeze({
  provider: process.env.PAYMENT_PROVIDER?.trim().toLowerCase() || 'stripe',
  premiumPriceId: process.env.STRIPE_PREMIUM_PRICE_ID?.trim() || '',
  paymentConfigured: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PREMIUM_PRICE_ID && process.env.STRIPE_WEBHOOK_SECRET),
});

export const PLAN_FEATURES = Object.freeze([
  { label: 'Interview practice', description: 'AI-generated mock interview sessions', free: `${freePracticeAllowance} free session${freePracticeAllowance === 1 ? '' : 's'} per month, then credits`, premium: `${freePracticeAllowance} free session${freePracticeAllowance === 1 ? '' : 's'} per month, then credits` },
  { label: 'AI-powered requests', description: 'Shared quota across current AI features', free: `${PLAN_ENTITLEMENTS.FREE.requestsPerDay} per day`, premium: `${PLAN_ENTITLEMENTS.PREMIUM.requestsPerDay} per day` },
  { label: 'Short-term request limit', description: 'Burst limit across current AI features', free: `${PLAN_ENTITLEMENTS.FREE.requestsPerMinute} per minute`, premium: `${PLAN_ENTITLEMENTS.PREMIUM.requestsPerMinute} per minute` },
  { label: 'Question Bank', description: 'Current Question Bank features', free: 'Included', premium: 'Included' },
  { label: 'Resume Maker', description: 'Current Resume Maker features', free: 'Included', premium: 'Included' },
  { label: 'Practice history', description: 'Current saved interview history', free: 'Included', premium: 'Included' },
]);

export function isPremiumEntitled(input: { plan: string; status: string; cancelAtPeriodEnd: boolean; currentPeriodEnd: Date | null; endDate: Date | null }, now = new Date()) {
  if (input.plan !== 'PREMIUM') return false;
  const end = input.currentPeriodEnd || input.endDate;
  if (end && end.getTime() <= now.getTime()) return false;
  if (input.status === 'ACTIVE' || input.status === 'TRIALING') return true;
  if (input.status === 'PAST_DUE') return Boolean(end && end.getTime() > now.getTime());
  return input.status === 'CANCELED' && input.cancelAtPeriodEnd && Boolean(end && end.getTime() > now.getTime());
}
