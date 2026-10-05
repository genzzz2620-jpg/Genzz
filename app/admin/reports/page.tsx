import { AdminHeading, AdminStat } from '@/components/admin/admin-ui';
import { requireAdminPage } from '@/lib/admin/auth';
import { prisma } from '@/lib/prisma';

export default async function AdminReportsPage({ searchParams: searchParamsPromise }: { searchParams: Promise<{  from?: string; to?: string  }> }) {
  const searchParams = await searchParamsPromise;
  const access = await requireAdminPage();
  if (!access.authorized) return null;
  const defaultFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const fromValue = searchParams?.from || defaultFrom;
  const toValue = searchParams?.to || new Date().toISOString().slice(0, 10);
  const from = Number.isNaN(Date.parse(fromValue)) ? new Date(defaultFrom) : new Date(fromValue);
  const to = Number.isNaN(Date.parse(toValue)) ? new Date() : new Date(`${toValue}T23:59:59.999`);
  const range = { gte: from, lte: to };
  const now = new Date();
  const [newUsers, sessions, completedSessions, aiRequests, successful, failed, tokens, uploads, makerDocs, subscriptions, questions, questionUsage, providers] = await Promise.all([
    prisma.user.count({ where: { createdAt: range } }),
    prisma.interviewSession.count({ where: { createdAt: range } }),
    prisma.interviewSession.count({ where: { createdAt: range, status: 'COMPLETED' } }),
    prisma.aIUsage.count({ where: { createdAt: range } }),
    prisma.aIUsage.count({ where: { createdAt: range, status: 'SUCCESS' } }),
    prisma.aIUsage.count({ where: { createdAt: range, status: 'FAILED' } }),
    prisma.aIUsage.aggregate({ where: { createdAt: range }, _sum: { inputTokens: true, outputTokens: true } }),
    prisma.resume.count({ where: { createdAt: range } }),
    prisma.resumeDocument.count({ where: { createdAt: range } }),
    prisma.subscription.count({ where: { plan: 'PREMIUM', status: { in: ['ACTIVE','TRIALING'] }, OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: now } }] } }),
    prisma.questionBankItem.count({ where: { status: 'PUBLISHED' } }),
    prisma.interviewAnswer.count({ where: { createdAt: range } }),
    prisma.aIUsage.groupBy({ by: ['provider'], where: { createdAt: range }, _count: { _all: true } }),
  ]);
  const maxProviderCount = Math.max(1, ...providers.map((item) => item._count._all));
  return <>
    <AdminHeading title="Reports" description="Usage and product activity from recorded database events. Choose a date range to update the report." />
    <form method="get" className="mb-5 flex flex-wrap items-end gap-3"><label className="text-xs text-slate-400">From<input type="date" name="from" defaultValue={fromValue} className="input mt-1" /></label><label className="text-xs text-slate-400">To<input type="date" name="to" defaultValue={toValue} className="input mt-1" /></label><button className="btn-secondary">Update report</button></form>
    <p className="mb-4 text-xs text-slate-500">Report window: {from.toLocaleDateString()}–{to.toLocaleDateString()}. Active Premium count and published question count are current totals.</p>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><AdminStat label="New Users" value={newUsers} /><AdminStat label="Interview Sessions" value={sessions} note={`${completedSessions} completed`} /><AdminStat label="AI Requests" value={aiRequests} note={`${successful} successful · ${failed} failed`} /><AdminStat label="Recorded Tokens" value={`${(tokens._sum.inputTokens || 0).toLocaleString()} in · ${(tokens._sum.outputTokens || 0).toLocaleString()} out`} /><AdminStat label="New Resumes" value={uploads + makerDocs} note={`${uploads} uploads · ${makerDocs} Resume Maker`} /><AdminStat label="Active Premium" value={subscriptions} /><AdminStat label="Published Questions" value={questions} /><AdminStat label="Question Usage" value={questionUsage} note="Interview answers recorded in range" /></div>
    <section className="card mt-6"><h2 className="text-lg font-semibold">AI requests by provider</h2>{providers.length ? <div className="mt-5 space-y-4">{providers.map((item) => <div key={item.provider}><div className="mb-1 flex justify-between text-sm"><span>{item.provider}</span><span className="text-slate-400">{item._count._all}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.max(2, item._count._all / maxProviderCount * 100)}%` }} /></div></div>)}</div> : <p className="mt-4 text-sm text-slate-400">No AI requests in this date range.</p>}</section>
  </>;
}
