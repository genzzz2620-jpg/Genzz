import Link from 'next/link';
import { AdminHeading, AdminTable, dateLabel, AdminEmpty, shortId } from '@/components/admin/admin-ui';
import { requireAdminPage } from '@/lib/admin/auth';
import { prisma } from '@/lib/prisma';

export default async function AdminSubscriptionsPage({ searchParams: searchParamsPromise }: { searchParams: Promise<{  plan?: string; status?: string  }> }) {
  const searchParams = await searchParamsPromise;
  const access = await requireAdminPage();
  if (!access.authorized) return null;
  const planFilter = ['FREE', 'PREMIUM'].includes(searchParams?.plan || '') ? searchParams?.plan : undefined;
  const statusFilter = ['ACTIVE', 'CANCELED', 'EXPIRED', 'PAST_DUE', 'TRIALING'].includes(searchParams?.status || '') ? searchParams?.status : undefined;
  const users = await prisma.user.findMany({
    where: { AND: [ ...(planFilter ? [{ subscriptions: { some: { plan: planFilter as 'FREE' | 'PREMIUM' } } }] : []), ...(statusFilter ? [{ subscriptions: { some: { status: statusFilter } } }] : []) ] },
    select: { id: true, name: true, email: true, subscriptionType: true, subscriptions: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, plan: true, status: true, provider: true, providerSubscriptionId: true, startDate: true, currentPeriodStart: true, currentPeriodEnd: true, endDate: true, cancelAtPeriodEnd: true } } },
    orderBy: { createdAt: 'desc' }, take: 250,
  });
  const rows = users.map((user) => ({ user, subscription: user.subscriptions[0] }));
  const filtered = rows.filter(({ subscription }) => (!planFilter || (subscription?.plan ?? 'FREE') === planFilter) && (!statusFilter || (subscription?.status ?? 'ACTIVE') === statusFilter));
  return <>
    <AdminHeading title="Subscriptions" description="Billing state and safe provider references. Payment credentials are never shown here." />
    <form method="get" className="mb-4 flex flex-wrap gap-2"><select name="plan" defaultValue={planFilter || ''} className="input w-auto"><option value="">All plans</option><option value="FREE">Free</option><option value="PREMIUM">Premium</option></select><select name="status" defaultValue={statusFilter || ''} className="input w-auto"><option value="">All statuses</option>{['ACTIVE','CANCELED','EXPIRED','PAST_DUE','TRIALING'].map((s) => <option key={s}>{s}</option>)}</select><button className="btn-secondary">Filter</button></form>
    {filtered.length ? <AdminTable headers={['User', 'Plan', 'Status', 'Provider', 'Start Date', 'Renewal', 'Expiration', 'Cancellation', 'Provider Ref']}>
      {filtered.map(({ user, subscription }) => <tr key={user.id}><td className="px-4 py-3"><Link href={`/admin/users/${user.id}`} className="font-medium text-white hover:text-violet-200">{user.name}</Link><p className="text-xs text-slate-500">{user.email}</p></td><td className="px-4 py-3">{subscription?.plan || 'FREE'}</td><td className="px-4 py-3">{subscription?.status || 'ACTIVE'}</td><td className="px-4 py-3 text-slate-300">{subscription?.provider || '—'}</td><td className="whitespace-nowrap px-4 py-3 text-slate-400">{dateLabel(subscription?.startDate)}</td><td className="whitespace-nowrap px-4 py-3 text-slate-400">{dateLabel(subscription?.currentPeriodEnd)}</td><td className="whitespace-nowrap px-4 py-3 text-slate-400">{dateLabel(subscription?.endDate)}</td><td className="px-4 py-3 text-slate-300">{subscription?.cancelAtPeriodEnd ? 'At period end' : 'No'}</td><td className="px-4 py-3 font-mono text-xs text-slate-500">{shortId(subscription?.providerSubscriptionId)}</td></tr>)}
    </AdminTable> : <AdminEmpty>No subscriptions match these filters.</AdminEmpty>}
  </>;
}
