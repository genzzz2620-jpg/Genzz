import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { SubscriptionManager } from '@/components/billing/subscription-manager';
import { authOptions } from '@/lib/auth';

export default async function SubscriptionPage({ searchParams: searchParamsPromise }: { searchParams: Promise<{  checkout?: string  }> }) {
  const searchParams = await searchParamsPromise;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');
  return <DashboardShell><SubscriptionManager checkoutResult={searchParams?.checkout} /></DashboardShell>;
}
