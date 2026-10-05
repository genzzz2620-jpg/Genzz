import { prisma } from '@/lib/prisma';
import { isPremiumEntitled } from './plans';
import type { PlanName } from './plans';

export async function getCurrentSubscription(userId: string) {
  let subscription = await prisma.subscription.findFirst({ where: { userId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
  if (!subscription) {
    subscription = await prisma.subscription.create({ data: { userId, plan: 'FREE', status: 'ACTIVE' } });
  }

  const expiry = subscription.currentPeriodEnd || subscription.endDate;
  const expirationStatuses = ['ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED'];
  if (subscription.plan === 'PREMIUM' && expiry && expiry <= new Date() && expirationStatuses.includes(subscription.status)) {
    subscription = await prisma.subscription.update({ where: { id: subscription.id }, data: { status: 'EXPIRED', cancelAtPeriodEnd: false } });
  }
  const premium = isPremiumEntitled(subscription);
  const subscriptionType: PlanName = premium ? 'PREMIUM' : 'FREE';
  await prisma.user.updateMany({ where: { id: userId, subscriptionType: { not: subscriptionType } }, data: { subscriptionType } });
  return { subscription, plan: subscriptionType };
}
