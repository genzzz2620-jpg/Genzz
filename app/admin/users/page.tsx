import Link from 'next/link';
import { AdminHeading, AdminTable, dateLabel, AdminEmpty, AdminPagination } from '@/components/admin/admin-ui';
import { UserActions } from '@/components/admin/user-actions';
import { requireAdminPage } from '@/lib/admin/auth';
import { prisma } from '@/lib/prisma';

export default async function AdminUsersPage({ searchParams: searchParamsPromise }: { searchParams: Promise<{  q?: string; status?: string; role?: string; page?: string  }> }) {
  const searchParams = await searchParamsPromise;
  const access = await requireAdminPage();
  if (!access.authorized) return null;
  const q = (searchParams?.q || '').trim().slice(0, 100);
  const status = ['ACTIVE', 'SUSPENDED'].includes(searchParams?.status || '') ? searchParams?.status as 'ACTIVE' | 'SUSPENDED' : undefined;
  const role = ['USER', 'ADMIN'].includes(searchParams?.role || '') ? searchParams?.role as 'USER' | 'ADMIN' : undefined;
  const page = Math.max(1, Math.floor(Number(searchParams?.page) || 1));
  const pageSize = 25;
  const where = { ...(status ? { accountStatus: status } : {}), ...(role ? { role } : {}), ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' as const } }, { email: { contains: q, mode: 'insensitive' as const } }] } : {}) };
  const [users, total] = await Promise.all([prisma.user.findMany({
    where,
    select: { id: true, name: true, email: true, subscriptionType: true, role: true, accountStatus: true, createdAt: true, lastActiveAt: true },
    orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
  }), prisma.user.count({ where })]);
  const query = new URLSearchParams();
  if (q) query.set('q', q); if (status) query.set('status', status); if (role) query.set('role', role);
  return <>
    <AdminHeading title="Users" description="Review accounts, plans, access roles, and account status." />
    <form className="mb-4 flex flex-wrap gap-2" method="get">
      <input name="q" defaultValue={q} placeholder="Search name or email" className="input max-w-sm" />
      <select name="status" defaultValue={status || ''} className="input w-auto"><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option></select>
      <select name="role" defaultValue={role || ''} className="input w-auto"><option value="">All roles</option><option value="USER">User</option><option value="ADMIN">Admin</option></select>
      <button className="btn-secondary">Filter</button>
    </form>
    {users.length ? <AdminTable headers={['User', 'Plan', 'Role', 'Status', 'Created', 'Last Activity', 'Actions']}>
      {users.map((user) => <tr key={user.id} className="align-top"><td className="px-4 py-3"><Link href={`/admin/users/${user.id}`} className="font-medium text-white hover:text-violet-200">{user.name}</Link><p className="mt-1 text-xs text-slate-500">{user.email}</p></td><td className="px-4 py-3 text-slate-300">{user.subscriptionType}</td><td className="px-4 py-3 text-slate-300">{user.role}</td><td className="px-4 py-3"><span className={user.accountStatus === 'ACTIVE' ? 'text-emerald-300' : 'text-rose-300'}>{user.accountStatus}</span></td><td className="whitespace-nowrap px-4 py-3 text-slate-400">{dateLabel(user.createdAt)}</td><td className="whitespace-nowrap px-4 py-3 text-slate-400">{dateLabel(user.lastActiveAt)}</td><td className="min-w-56 px-4 py-3"><UserActions userId={user.id} name={user.name} role={user.role} accountStatus={user.accountStatus} /></td></tr>)}
    </AdminTable> : <AdminEmpty>No users match these filters.</AdminEmpty>}
    <AdminPagination page={page} pageSize={pageSize} total={total} basePath="/admin/users" query={query.toString()} />
  </>;
}
