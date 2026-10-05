import Link from 'next/link';
import { AdminHeading, AdminTable, dateLabel, AdminEmpty, AdminPagination } from '@/components/admin/admin-ui';
import { requireAdminPage } from '@/lib/admin/auth';
import { prisma } from '@/lib/prisma';

export default async function AdminInterviewsPage({ searchParams: searchParamsPromise }: { searchParams: Promise<{  from?: string; to?: string; company?: string; job?: string; status?: string; page?: string  }> }) {
  const searchParams = await searchParamsPromise;
  const access = await requireAdminPage();
  if (!access.authorized) return null;
  const company = (searchParams?.company || '').trim().slice(0, 100);
  const job = (searchParams?.job || '').trim().slice(0, 100);
  const status = ['DRAFT','ACTIVE','COMPLETED','CANCELLED'].includes(searchParams?.status || '') ? searchParams?.status as 'DRAFT'|'ACTIVE'|'COMPLETED'|'CANCELLED' : undefined;
  const from = searchParams?.from && !Number.isNaN(Date.parse(searchParams.from)) ? new Date(searchParams.from) : undefined;
  const to = searchParams?.to && !Number.isNaN(Date.parse(searchParams.to)) ? new Date(`${searchParams.to}T23:59:59.999`) : undefined;
  const page = Math.max(1, Math.floor(Number(searchParams?.page) || 1));
  const pageSize = 25;
  const where = { ...(company ? { company: { contains: company, mode: 'insensitive' as const } } : {}), ...(job ? { jobTitle: { contains: job, mode: 'insensitive' as const } } : {}), ...(status ? { status } : {}), ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}) };
  const [items, total] = await Promise.all([prisma.interviewSession.findMany({
    where,
    select: { id: true, company: true, jobTitle: true, experience: true, createdAt: true, status: true, user: { select: { id: true, name: true, email: true } }, _count: { select: { answers: true } } },
    orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
  }), prisma.interviewSession.count({ where })]);
  const query = new URLSearchParams(); if (company) query.set('company', company); if (job) query.set('job', job); if (status) query.set('status', status); if (searchParams?.from) query.set('from', searchParams.from); if (searchParams?.to) query.set('to', searchParams.to);
  return <>
    <AdminHeading title="Interview sessions" description="Session metadata and activity counts; resume contents and answer text are not shown." />
    <form method="get" className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5"><input type="date" name="from" defaultValue={searchParams?.from} aria-label="From date" className="input" /><input type="date" name="to" defaultValue={searchParams?.to} aria-label="To date" className="input" /><input name="company" defaultValue={company} placeholder="Company" className="input" /><input name="job" defaultValue={job} placeholder="Job" className="input" /><div className="flex gap-2"><select name="status" defaultValue={status || ''} className="input"><option value="">All statuses</option>{['DRAFT','ACTIVE','COMPLETED','CANCELLED'].map((s) => <option key={s}>{s}</option>)}</select><button className="btn-secondary">Filter</button></div></form>
    {items.length ? <AdminTable headers={['User', 'Company', 'Job', 'Experience', 'Created', 'Status', 'Questions / Answers']}>
      {items.map((item) => <tr key={item.id}><td className="px-4 py-3"><Link href={`/admin/users/${item.user.id}`} className="font-medium text-white hover:text-violet-200">{item.user.name}</Link><p className="text-xs text-slate-500">{item.user.email}</p></td><td className="px-4 py-3">{item.company}</td><td className="px-4 py-3"><Link href={`/admin/interviews/${item.id}`} className="text-violet-200 hover:underline">{item.jobTitle}</Link></td><td className="px-4 py-3 text-slate-400">{item.experience || '—'}</td><td className="whitespace-nowrap px-4 py-3 text-slate-400">{dateLabel(item.createdAt)}</td><td className="px-4 py-3">{item.status}</td><td className="px-4 py-3">{item._count.answers} answers</td></tr>)}
    </AdminTable> : <AdminEmpty>No sessions match these filters.</AdminEmpty>}
    <AdminPagination page={page} pageSize={pageSize} total={total} basePath="/admin/interviews" query={query.toString()} />
  </>;
}
