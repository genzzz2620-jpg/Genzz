import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');
  return <DashboardShell><AnalyticsDashboard /></DashboardShell>;
}
