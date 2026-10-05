import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { CreditWallet } from '@/components/billing/credit-wallet';
import { authOptions } from '@/lib/auth';

export default async function CreditsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');
  return <DashboardShell><div className="mx-auto max-w-4xl space-y-5"><div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-300">Genzz AI Wallet</p><h1 className="mt-2 text-3xl font-bold text-white">Credits &amp; session billing</h1><p className="mt-2 text-sm text-slate-400">Your balance is stored on your account. Payment details are handled by our hosted payment provider.</p></div><CreditWallet /></div></DashboardShell>;
}
