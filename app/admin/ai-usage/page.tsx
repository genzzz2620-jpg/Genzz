import Link from 'next/link';
import { AdminHeading, AdminStat, AdminTable, AdminEmpty, AdminPagination, dateLabel } from '@/components/admin/admin-ui';
import { estimateUsageCost, estimatedAiRates } from '@/lib/admin/ai-pricing';
import { requireAdminPage } from '@/lib/admin/auth';
import { prisma } from '@/lib/prisma';

export default async function AdminAiUsagePage({ searchParams: searchParamsPromise }: { searchParams: Promise<{  from?: string; to?: string; provider?: string; user?: string; status?: string; page?: string  }> }) {
  const searchParams = await searchParamsPromise;
  const access = await requireAdminPage();
  if (!access.authorized) return null;
  const provider = ['OPENAI', 'GEMINI'].includes(searchParams?.provider || '') ? searchParams?.provider : undefined;
  const status = ['SUCCESS', 'FAILED', 'PENDING'].includes(searchParams?.status || '') ? searchParams?.status : undefined;
  const user = (searchParams?.user || '').trim().slice(0, 100);
  const page = Math.max(1, Math.floor(Number(searchParams?.page) || 1));
  const pageSize = 25;
  const from = searchParams?.from && !Number.isNaN(Date.parse(searchParams.from)) ? new Date(searchParams.from) : undefined;
  const to = searchParams?.to && !Number.isNaN(Date.parse(searchParams.to)) ? new Date(`${searchParams.to}T23:59:59.999`) : undefined;
  const dateWhere = from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {};
  const providerWhere = provider === 'OPENAI' ? { OR: [{ provider: { contains: 'OPENAI', mode: 'insensitive' as const } }, { provider: { contains: 'ChatGPT', mode: 'insensitive' as const } }] } : provider === 'GEMINI' ? { OR: [{ provider: { contains: 'GEMINI', mode: 'insensitive' as const } }, { provider: { contains: 'Google', mode: 'insensitive' as const } }] } : {};
  const where = { ...dateWhere, ...providerWhere, ...(user ? { user: { OR: [{ name: { contains: user, mode: 'insensitive' as const } }, { email: { contains: user, mode: 'insensitive' as const } }] } } : {}), ...(status ? { status } : {}) };
  const [summary, successful, failed, providerGroups, records, total] = await Promise.all([
    prisma.aIUsage.aggregate({ where, _count: { _all: true }, _sum: { inputTokens: true, outputTokens: true } }),
    prisma.aIUsage.count({ where: { AND: [where, { status: 'SUCCESS' }] } }),
    prisma.aIUsage.count({ where: { AND: [where, { status: 'FAILED' }] } }),
    prisma.aIUsage.groupBy({ by: ['provider'], where, _sum: { inputTokens: true, outputTokens: true }, _count: { _all: true } }),
    prisma.aIUsage.findMany({ where, select: { id: true, provider: true, model: true, feature: true, status: true, inputTokens: true, outputTokens: true, createdAt: true, user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.aIUsage.count({ where }),
  ]);
  const providerCount = (needles: string[]) => providerGroups.filter((group) => needles.some((needle) => group.provider.toUpperCase().includes(needle.toUpperCase()))).reduce((sum, group) => sum + group._count._all, 0);
  const estimatedCost = providerGroups.reduce((sum, group) => sum + (estimateUsageCost(group.provider, group._sum.inputTokens, group._sum.outputTokens) || 0), 0);
  const hasRates = Object.values(estimatedAiRates).some((rates) => rates.inputPerMillionUsd !== null && rates.outputPerMillionUsd !== null);
  const query = new URLSearchParams(); if (searchParams?.from) query.set('from', searchParams.from); if (searchParams?.to) query.set('to', searchParams.to); if (provider) query.set('provider', provider); if (user) query.set('user', user); if (status) query.set('status', status);
  return <>
    <AdminHeading title="AI usage" description="Provider requests, outcomes, and recorded tokens. Prompts, API keys, and provider credentials are never displayed." />
    <form method="get" className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5"><input type="date" name="from" defaultValue={searchParams?.from} aria-label="From date" className="input" /><input type="date" name="to" defaultValue={searchParams?.to} aria-label="To date" className="input" /><select name="provider" defaultValue={provider || ''} className="input"><option value="">All providers</option><option value="OPENAI">OpenAI / ChatGPT</option><option value="GEMINI">Gemini</option></select><input name="user" defaultValue={user} placeholder="User name or email" className="input" /><div className="flex gap-2"><select name="status" defaultValue={status || ''} className="input"><option value="">All statuses</option><option>SUCCESS</option><option>FAILED</option><option>PENDING</option></select><button className="btn-secondary">Filter</button></div></form>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><AdminStat label="Total Requests" value={summary._count._all} /><AdminStat label="Successful Requests" value={successful} /><AdminStat label="Failed Requests" value={failed} /><AdminStat label="OpenAI Requests" value={providerCount(['OPENAI','CHATGPT'])} /><AdminStat label="Gemini Requests" value={providerCount(['GEMINI','GOOGLE'])} /><AdminStat label="Input Tokens" value={(summary._sum.inputTokens || 0).toLocaleString()} /><AdminStat label="Output Tokens" value={(summary._sum.outputTokens || 0).toLocaleString()} /><AdminStat label="Estimated Cost · USD" value={hasRates ? `$${estimatedCost.toFixed(4)}` : 'Not configured'} note={hasRates ? 'Estimate from recorded token counts and configured rates; not provider billing.' : 'Set both input and output rates per provider to estimate.'} /></div>
    {records.length ? <div className="mt-6"><AdminTable headers={['Date', 'User', 'Provider / Model', 'Feature', 'Status', 'Input Tokens', 'Output Tokens']}>
      {records.map((record) => <tr key={record.id}><td className="whitespace-nowrap px-4 py-3 text-slate-400">{dateLabel(record.createdAt)}</td><td className="px-4 py-3"><Link href={`/admin/users/${record.user.id}`} className="text-violet-200 hover:underline">{record.user.name}</Link><p className="text-xs text-slate-500">{record.user.email}</p></td><td className="px-4 py-3">{record.provider} / {record.model}</td><td className="px-4 py-3 text-slate-400">{record.feature}</td><td className="px-4 py-3">{record.status}</td><td className="px-4 py-3 text-slate-300">{record.inputTokens?.toLocaleString() ?? '—'}</td><td className="px-4 py-3 text-slate-300">{record.outputTokens?.toLocaleString() ?? '—'}</td></tr>)}
    </AdminTable><AdminPagination page={page} pageSize={pageSize} total={total} basePath="/admin/ai-usage" query={query.toString()} /></div> : <div className="mt-6"><AdminEmpty>No AI usage matches these filters.</AdminEmpty><AdminPagination page={page} pageSize={pageSize} total={total} basePath="/admin/ai-usage" query={query.toString()} /></div>}
  </>;
}
