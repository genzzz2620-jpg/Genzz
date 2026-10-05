import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { authOptions } from '@/lib/auth';
import { getCurrentSubscription } from '@/lib/billing/subscription';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { ProfileSettingsForm } from '@/components/settings/profile-settings-form';

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }
  const [currentSubscription, profile] = await Promise.all([
    getCurrentSubscription(session.user.id),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true, targetRole: true, experienceLevel: true, preferredLanguage: true, preferredAnswerFormat: true, preferredAIProvider: true },
    }),
  ]);
  if (!profile) redirect('/login');
  const configuredProviders = [
    ...(process.env.OPENAI_API_KEY ? ['ChatGPT' as const] : []),
    ...(process.env.GEMINI_API_KEY ? ['Gemini' as const] : []),
  ];

  return (
    <DashboardShell>
      <div className="card max-w-3xl">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="mt-2 text-slate-300">Update your profile and the defaults used by interview preparation features.</p>

        <ProfileSettingsForm
          email={profile.email}
          configuredProviders={configuredProviders}
          initialSettings={{
            name: profile.name,
            targetRole: profile.targetRole || '',
            experienceLevel: profile.experienceLevel,
            preferredLanguage: profile.preferredLanguage,
            preferredAnswerFormat: profile.preferredAnswerFormat,
            preferredAIProvider: profile.preferredAIProvider === 'ChatGPT' || profile.preferredAIProvider === 'Gemini' ? profile.preferredAIProvider : null,
          }}
        />

        <div className="mt-6 rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm text-violet-200">
          Active subscription: {currentSubscription.plan} · {currentSubscription.subscription.status}
        </div>

        <Link href="/settings/notifications" className="btn-secondary mt-6 ml-3 inline-block">Notification preferences</Link>
      </div>
    </DashboardShell>
  );
}
