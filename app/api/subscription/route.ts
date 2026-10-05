import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCurrentSubscription } from '@/lib/billing/subscription';
import { PLAN_ENTITLEMENTS } from '@/lib/billing/plans';

export const runtime = 'nodejs';

export async function GET() {
  const auth = await getServerSession(authOptions);
  if (!auth?.user?.id) return NextResponse.json({ error: 'Please sign in to view your subscription.' }, { status: 401 });
  const { subscription, plan } = await getCurrentSubscription(auth.user.id);
  const [usedToday, usedThisMinute] = await Promise.all([
    prisma.aIUsage.count({ where: { userId: auth.user.id, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
    prisma.aIUsage.count({ where: { userId: auth.user.id, createdAt: { gte: new Date(Date.now() - 60_000) } } }),
  ]);
  return NextResponse.json({
    subscription: {
      plan, status: subscription.status,
      provider: subscription.provider,
      currentPeriodStart: subscription.currentPeriodStart?.toISOString() || null,
      currentPeriodEnd: (subscription.currentPeriodEnd || subscription.endDate)?.toISOString() || null,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      billingStatus: subscription.status === 'PAST_DUE' ? 'Payment needs attention' : subscription.status === 'CANCELED' ? 'Canceled' : subscription.status === 'EXPIRED' ? 'Expired' : plan === 'FREE' ? 'No payment required' : subscription.status === 'TRIALING' ? 'Trial' : 'Paid and active',
      canManageBilling: Boolean(subscription.providerCustomerId && subscription.provider === 'stripe'),
    },
    usage: { usedToday, dailyLimit: PLAN_ENTITLEMENTS[plan].requestsPerDay, usedThisMinute, minuteLimit: PLAN_ENTITLEMENTS[plan].requestsPerMinute, period: 'Rolling 24 hours' },
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
