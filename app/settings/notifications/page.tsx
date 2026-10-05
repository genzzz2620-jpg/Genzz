import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { NotificationPreferences } from '@/components/notifications/notification-preferences';
export default async function NotificationSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');
  return <DashboardShell><section className="card max-w-2xl"><h1 className="text-2xl font-bold text-white">Notification Preferences</h1><p className="mb-6 mt-2 text-sm text-slate-300">Choose which kinds of in-app updates you receive.</p><NotificationPreferences /></section></DashboardShell>;
}
