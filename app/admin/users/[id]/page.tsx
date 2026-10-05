import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminHeading, AdminStat, AdminTable, dateLabel } from '@/components/admin/admin-ui';
import { UserActions } from '@/components/admin/user-actions';
import { requireAdminPage } from '@/lib/admin/auth';
import { prisma } from '@/lib/prisma';

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireAdminPage();
  if (!access.authorized) return null;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, name: true, email: true, role: true, accountStatus: true, subscriptionType: true, createdAt: true, updatedAt: true, lastActiveAt: true,
      subscriptions: { orderBy: { createdAt: 'desc' }, take: 1, select: { plan: true, status: true, provider: true, startDate: true, currentPeriodEnd: true, endDate: true, cancelAtPeriodEnd: true } },
      sessions: { orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, company: true, jobTitle: true, status: true, createdAt: true, _count: { select: { answers: true } } } },
      resumes: { orderBy: { updatedAt: 'desc' }, take: 10, select: { id: true, fileName: true, processingStatus: true, createdAt: true, updatedAt: true } },
      resumeDocuments: { orderBy: { updatedAt: 'desc' }, take: 10, select: { id: true, title: true, targetJobTitle: true, createdAt: true, updatedAt: true } },
      aiUsages: { orderBy: { createdAt: 'desc' }, take: 10, select: { provider: true, model: true, feature: true, status: true, inputTokens: true, outputTokens: true, createdAt: true } },
      _count: { select: { questionBankItems: true, questionFavorites: true } },
    },
  });
  if (!user) notFound();
  const [sessionCount, aiUsageCount] = await Promise.all([
    prisma.interviewSession.count({ where: { userId: user.id } }),
    prisma.aIUsage.count({ where: { userId: user.id } }),
  ]);
  const subscription = user.subscriptions[0];

  return <>
    <AdminHeading eyebrow="USER DETAILS" title={user.name} description={user.email} action={<Link href="/admin/users" className="btn-secondary">← All users</Link>} />
    <div className="mb-5 flex flex-wrap items-center gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4"><span className="text-sm text-slate-300">{user.role} · {user.accountStatus} · {user.subscriptionType}</span><UserActions userId={user.id} name={user.name} role={user.role} accountStatus={user.accountStatus} /></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><AdminStat label="Account Created" value={dateLabel(user.createdAt)} /><AdminStat label="Last Activity" value={dateLabel(user.lastActiveAt)} /><AdminStat label="Interview Sessions" value={sessionCount} /><AdminStat label="AI Requests" value={aiUsageCount} /></div>

    <div className="mt-6 grid gap-5 xl:grid-cols-2">
      <section className="card"><h2 className="text-lg font-semibold">User information</h2><dl className="mt-4 grid grid-cols-2 gap-y-3 text-sm"><dt className="text-slate-500">Name</dt><dd>{user.name}</dd><dt className="text-slate-500">Email</dt><dd className="break-all">{user.email}</dd><dt className="text-slate-500">Role</dt><dd>{user.role}</dd><dt className="text-slate-500">Account status</dt><dd>{user.accountStatus}</dd><dt className="text-slate-500">Created</dt><dd>{dateLabel(user.createdAt)}</dd><dt className="text-slate-500">Last activity</dt><dd>{dateLabel(user.lastActiveAt)}</dd></dl></section>
      <section className="card"><h2 className="text-lg font-semibold">Subscription</h2>{subscription ? <dl className="mt-4 grid grid-cols-2 gap-y-3 text-sm"><dt className="text-slate-500">Plan</dt><dd>{subscription.plan}</dd><dt className="text-slate-500">Status</dt><dd>{subscription.status}</dd><dt className="text-slate-500">Provider</dt><dd>{subscription.provider || '—'}</dd><dt className="text-slate-500">Start date</dt><dd>{dateLabel(subscription.startDate)}</dd><dt className="text-slate-500">Renewal</dt><dd>{dateLabel(subscription.currentPeriodEnd)}</dd><dt className="text-slate-500">Expiration</dt><dd>{dateLabel(subscription.endDate)}</dd><dt className="text-slate-500">Cancel at period end</dt><dd>{subscription.cancelAtPeriodEnd ? 'Yes' : 'No'}</dd></dl> : <p className="mt-4 text-sm text-slate-400">No billing record. Effective plan: {user.subscriptionType}.</p>}</section>
    </div>

    <section className="mt-6"><h2 className="mb-3 text-lg font-semibold">Interview sessions</h2><div className="card space-y-3">{user.sessions.length ? user.sessions.map((item) => <div key={item.id} className="flex flex-wrap justify-between gap-2 border-b border-slate-800 pb-3 last:border-0 last:pb-0"><div><Link className="font-medium text-violet-200 hover:underline" href={`/admin/interviews/${item.id}`}>{item.jobTitle}</Link><p className="text-xs text-slate-500">{item.company} · {item._count.answers} answers</p></div><span className="text-xs text-slate-400">{item.status} · {dateLabel(item.createdAt)}</span></div>) : <p className="text-sm text-slate-400">No interview sessions.</p>}</div></section>

    <div className="mt-6 grid gap-5 xl:grid-cols-2">
      <section><h2 className="mb-3 text-lg font-semibold">Resumes</h2><div className="card space-y-3">{[...user.resumes.map((item) => ({ id: item.id, title: item.fileName, subtitle: `Upload · ${item.processingStatus}`, updatedAt: item.updatedAt })), ...user.resumeDocuments.map((item) => ({ id: item.id, title: item.title, subtitle: `Resume Maker · Target: ${item.targetJobTitle || '—'}`, updatedAt: item.updatedAt }))].map((item) => <div key={item.id} className="flex justify-between gap-3 border-b border-slate-800 pb-3 last:border-0 last:pb-0"><div><p className="font-medium">{item.title}</p><p className="text-xs text-slate-500">{item.subtitle}</p></div><time className="shrink-0 text-xs text-slate-500">{dateLabel(item.updatedAt)}</time></div>)}{!user.resumes.length && !user.resumeDocuments.length && <p className="text-sm text-slate-400">No resumes.</p>}</div></section>
      <section><h2 className="mb-3 text-lg font-semibold">Question activity</h2><div className="card space-y-3 text-sm"><p>{user._count.questionFavorites} saved question favorites</p><p>{user._count.questionBankItems} user-created questions</p><p className="text-xs text-slate-500">Question text and full resume contents are omitted from this overview.</p></div></section>
    </div>

    <section className="mt-6"><h2 className="mb-3 text-lg font-semibold">Recent AI usage</h2>{user.aiUsages.length ? <AdminTable headers={['Date', 'Provider / Model', 'Feature', 'Status', 'Tokens']}>
      {user.aiUsages.map((item, index) => <tr key={`${item.createdAt.toISOString()}-${index}`}><td className="whitespace-nowrap px-4 py-3 text-slate-400">{dateLabel(item.createdAt)}</td><td className="px-4 py-3">{item.provider} / {item.model}</td><td className="px-4 py-3">{item.feature}</td><td className="px-4 py-3">{item.status}</td><td className="px-4 py-3 text-slate-400">{item.inputTokens ?? '—'} / {item.outputTokens ?? '—'}</td></tr>)}
    </AdminTable> : <p className="card text-sm text-slate-400">No AI usage recorded.</p>}</section>
  </>;
}
