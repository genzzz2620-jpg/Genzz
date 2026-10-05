import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PreparationClient } from '@/components/preparation/preparation-client';

export default async function PreparationPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');
  const [plans, account, resumes] = await Promise.all([
    prisma.preparationPlan.findMany({ where: { userId: session.user.id, status: 'ACTIVE' }, include: { tasks: { orderBy: [{ scheduledDate: 'asc' }, { createdAt: 'asc' }], include: { relatedQuestion: { select: { id: true } } } } }, orderBy: { updatedAt: 'desc' } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { targetRole: true, experienceLevel: true, preferredAIProvider: true } }),
    prisma.resume.findMany({ where: { userId: session.user.id, processingStatus: 'COMPLETED' }, select: { id: true, fileName: true }, orderBy: { createdAt: 'desc' } }),
  ]);
  const serializable = plans.map((plan) => ({ ...plan, createdAt: plan.createdAt.toISOString(), updatedAt: plan.updatedAt.toISOString(), tasks: plan.tasks.map((task) => ({ ...task, scheduledDate: task.scheduledDate.toISOString(), createdAt: task.createdAt.toISOString(), updatedAt: task.updatedAt.toISOString() })) }));
  return <DashboardShell><PreparationClient initialPlans={serializable} resumes={resumes} defaults={account || undefined} /></DashboardShell>;
}
