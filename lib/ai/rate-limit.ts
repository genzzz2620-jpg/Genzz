import { prisma } from '@/lib/prisma';
import { PLAN_ENTITLEMENTS } from '@/lib/billing/plans';
import { getCurrentSubscription } from '@/lib/billing/subscription';
import { consumeRateLimit } from '@/lib/security/rate-limit';

export class AIRateLimitError extends Error {
  constructor(plan: 'FREE' | 'PREMIUM') {
    super(plan === 'FREE' ? 'You have reached the Free plan AI usage limit. Upgrade for a higher limit, or try again when usage resets.' : 'You have reached the Premium AI usage limit. Please wait for usage to reset.');
    this.name = 'AIRateLimitError';
  }
}

export async function enforceAIRateLimit(userId: string) {
  const { plan } = await getCurrentSubscription(userId);
  const limits = PLAN_ENTITLEMENTS[plan];
  const burst = consumeRateLimit(`ai-minute:${userId}`, limits.requestsPerMinute, 60_000);
  if (!burst.allowed) throw new AIRateLimitError(plan);
  const now = new Date();
  const minuteAgo = new Date(now.getTime() - 60_000);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [recentCount, dailyCount] = await Promise.all([
    prisma.aIUsage.count({ where: { userId, createdAt: { gte: minuteAgo } } }),
    prisma.aIUsage.count({ where: { userId, createdAt: { gte: dayAgo } } }),
  ]);

  if (recentCount >= limits.requestsPerMinute || dailyCount >= limits.requestsPerDay) {
    throw new AIRateLimitError(plan);
  }
}
