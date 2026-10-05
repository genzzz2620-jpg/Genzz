import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { NotificationCenter } from '@/components/notifications/notification-center';
export default async function NotificationsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');
  return <DashboardShell><NotificationCenter /></DashboardShell>;
}
