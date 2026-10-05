import { AdminHeading, AdminStat } from '@/components/admin/admin-ui';
import { requireAdminPage } from '@/lib/admin/auth';
import { BILLING_CONFIG } from '@/lib/billing/plans';
import { prisma } from '@/lib/prisma';

export default async function AdminSystemHealthPage() {
  const access = await requireAdminPage();
  if (!access.authorized) return null;
  let databaseStatus = 'Unavailable';
  try { await prisma.$queryRaw`SELECT 1`; databaseStatus = 'Connected'; } catch { databaseStatus = 'Unavailable'; }
  const openAiReady = Boolean(process.env.OPENAI_API_KEY?.trim());
  const geminiReady = Boolean(process.env.GEMINI_API_KEY?.trim());
  const authReady = Boolean(process.env.NEXTAUTH_SECRET?.trim());
  return <>
    <AdminHeading title="System health" description="Runtime checks report service readiness without revealing secrets or credential values." />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><AdminStat label="Database" value={databaseStatus} /><AdminStat label="OpenAI" value={openAiReady ? 'Configured' : 'Not configured'} /><AdminStat label="Gemini" value={geminiReady ? 'Configured' : 'Not configured'} /><AdminStat label="Authentication Secret" value={authReady ? 'Configured' : 'Not configured'} /><AdminStat label="Billing Provider" value={BILLING_CONFIG.provider} /><AdminStat label="Payment Checkout" value={BILLING_CONFIG.paymentConfigured ? 'Configured' : 'Disabled'} /><AdminStat label="Application Runtime" value={`${Math.floor(process.uptime() / 60)} min`} note="Current server process uptime" /></div>
    <section className="card mt-6"><h2 className="text-lg font-semibold">Operational checks</h2><ul className="mt-4 space-y-3 text-sm text-slate-300"><li className="flex justify-between gap-4 border-b border-slate-800 pb-3"><span>Database query</span><span className={databaseStatus === 'Connected' ? 'text-emerald-300' : 'text-rose-300'}>{databaseStatus}</span></li><li className="flex justify-between gap-4 border-b border-slate-800 pb-3"><span>AI provider credentials</span><span>{[openAiReady && 'OpenAI', geminiReady && 'Gemini'].filter(Boolean).join(', ') || 'None configured'}</span></li><li className="flex justify-between gap-4"><span>Payment keys and premium price reference</span><span>{BILLING_CONFIG.paymentConfigured ? 'Ready' : 'Checkout remains disabled'}</span></li></ul><p className="mt-4 text-xs text-slate-500">This page checks configuration presence only; it does not make billable provider requests or verify external provider account status.</p></section>
  </>;
}
