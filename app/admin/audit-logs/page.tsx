import { AdminHeading, AdminTable, dateLabel, AdminEmpty, AdminPagination } from '@/components/admin/admin-ui';
import { requireAdminPage } from '@/lib/admin/auth';
import { prisma } from '@/lib/prisma';

export default async function AdminAuditLogsPage({ searchParams: searchParamsPromise }: { searchParams: Promise<{  action?: string; target?: string; page?: string  }> }) {
  const searchParams = await searchParamsPromise;
  const access = await requireAdminPage();
  if (!access.authorized) return null;
  const action = (searchParams?.action || '').trim().slice(0, 80);
  const target = (searchParams?.target || '').trim().slice(0, 100);
  const page = Math.max(1, Math.floor(Number(searchParams?.page) || 1));
  const pageSize = 25;
  const where = { ...(action ? { action: { contains: action, mode: 'insensitive' as const } } : {}), ...(target ? { OR: [{ targetId: { contains: target, mode: 'insensitive' as const } }, { targetType: { contains: target, mode: 'insensitive' as const } }] } : {}) };
  const [logs, total] = await Promise.all([prisma.adminAuditLog.findMany({
    where,
    select: { id: true, action: true, targetType: true, targetId: true, details: true, createdAt: true, actor: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
  }), prisma.adminAuditLog.count({ where })]);
  const query = new URLSearchParams(); if (action) query.set('action', action); if (target) query.set('target', target);
  return <>
    <AdminHeading title="Audit logs" description="Administrator actions are recorded with the acting account, affected resource, and safe change metadata." />
    <form method="get" className="mb-4 flex flex-wrap gap-2"><input name="action" defaultValue={action} placeholder="Action" className="input max-w-xs" /><input name="target" defaultValue={target} placeholder="Target type or ID" className="input max-w-xs" /><button className="btn-secondary">Filter</button></form>
    {logs.length ? <AdminTable headers={['Date', 'Actor', 'Action', 'Target', 'Details']}>
      {logs.map((log) => <tr key={log.id}><td className="whitespace-nowrap px-4 py-3 text-slate-400">{dateLabel(log.createdAt)}</td><td className="px-4 py-3">{log.actor ? <><span>{log.actor.name}</span><p className="text-xs text-slate-500">{log.actor.email}</p></> : <span className="text-slate-400">System provisioning</span>}</td><td className="px-4 py-3 font-medium text-white">{log.action}</td><td className="px-4 py-3 text-slate-300">{log.targetType}<p className="max-w-40 truncate font-mono text-xs text-slate-500">{log.targetId || '—'}</p></td><td className="max-w-sm px-4 py-3 font-mono text-xs text-slate-400">{log.details ? JSON.stringify(log.details) : '—'}</td></tr>)}
    </AdminTable> : <AdminEmpty>No audit events match these filters.</AdminEmpty>}
    <AdminPagination page={page} pageSize={pageSize} total={total} basePath="/admin/audit-logs" query={query.toString()} />
  </>;
}
