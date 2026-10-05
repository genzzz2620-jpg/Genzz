import { getCurrentSubscription } from '@/lib/billing/subscription';
import { prisma } from '@/lib/prisma';

export async function enforceSimulatorDailyLimit(userId: string) {
  const { plan } = await getCurrentSubscription(userId);
  const dailyLimit = plan === 'PREMIUM' ? 10 : 2;
  const since = new Date(); since.setHours(0, 0, 0, 0);
  const used = await prisma.interviewSession.count({ where: { userId, isSimulator: true, createdAt: { gte: since } } });
  if (used >= dailyLimit) throw new Error(`You have reached today's ${plan === 'FREE' ? 'Free' : 'Premium'} simulator limit (${dailyLimit}).`);
}

export async function enforceCompanyResearchLimit(userId: string) {
  const { plan } = await getCurrentSubscription(userId);
  const limit = plan === 'PREMIUM' ? 30 : 3;
  const count = await prisma.companyResearch.count({ where: { userId } });
  if (count >= limit) throw new Error(`You have reached the ${plan === 'FREE' ? 'Free' : 'Premium'} saved research limit (${limit}).`);
}
