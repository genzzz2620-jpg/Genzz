import Link from 'next/link';
import { AdminHeading, AdminStat } from '@/components/admin/admin-ui';
import { requireAdminPage } from '@/lib/admin/auth';
import { prisma } from '@/lib/prisma';

export default async function AdminDashboardPage() {
  const access = await requireAdminPage();
  if (!access.authorized) return null;
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const now = new Date();
  const [users, activeUsers, premiumUsers, sessions, questions, answers, uploads, makerResumes, failedAi, recentUsage] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { accountStatus: 'ACTIVE', lastActiveAt: { gte: since } } }),
    prisma.subscription.count({ where: { plan: 'PREMIUM', status: { in: ['ACTIVE', 'TRIALING'] }, OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: now } }] } }),
    prisma.interviewSession.count(),
    prisma.questionBankItem.count(),
    prisma.interviewAnswer.count(),
    prisma.resume.count(),
    prisma.resumeDocument.count(),
    prisma.aIUsage.count({ where: { status: { not: { in: ['SUCCESS', 'COMPLETED', 'OK'] } }, createdAt: { gte: since } } }),
    prisma.aIUsage.count({ where: { createdAt: { gte: since } } }),
  ]);

  return <>
    <AdminHeading title="Admin dashboard" description="A live overview of Genzz AI activity and account health." action={<Link href="/admin/reports" className="btn-secondary">View reports</Link>} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <AdminStat label="Total Users" value={users} />
      <AdminStat label="Active Users" value={activeUsers} note="Active in the last 30 days" />
      <AdminStat label="Premium Users" value={premiumUsers} note="Current, unexpired subscriptions" />
      <AdminStat label="Interview Sessions" value={sessions} />
      <AdminStat label="Questions" value={questions} />
      <AdminStat label="AI Answers" value={answers} />
      <AdminStat label="Resumes" value={uploads + makerResumes} note={`${uploads} uploads · ${makerResumes} resume maker documents`} />
      <AdminStat label="AI Requests · 30 days" value={recentUsage} note={`${failedAi} requests recorded outside successful status`} />
    </div>
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <section className="card"><h2 className="text-lg font-semibold">Admin workspace</h2><p className="mt-2 text-sm text-slate-400">Review accounts, content, subscriptions, and provider usage from one place.</p><div className="mt-5 flex flex-wrap gap-2"><Link href="/admin/users" className="btn-primary">Manage users</Link><Link href="/admin/ai-usage" className="btn-secondary">Review AI usage</Link><Link href="/admin/system-health" className="btn-secondary">System health</Link></div></section>
      <section className="card"><h2 className="text-lg font-semibold">Data notes</h2><p className="mt-2 text-sm leading-6 text-slate-400">Active users reflect activity recorded in the last 30 days. AI request totals and answer totals come from separate request and interview-answer records.</p><p className="mt-2 text-xs text-slate-500">All cards query the current database; no sample values are used.</p></section>
    </div>
  </>;
}
