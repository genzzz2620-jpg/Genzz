import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCurrentSubscription } from '@/lib/billing/subscription';
import { NotificationCenter } from '@/components/notifications/notification-center';
import { CreditWallet } from '@/components/billing/credit-wallet';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  const account = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, onboardingStatus: true },
  });
  if (!account) redirect('/login');
  if (account.onboardingStatus === 'NOT_STARTED') redirect('/welcome');
  if (account.onboardingStatus === 'IN_PROGRESS') redirect('/onboarding');

  const currentSubscription = await getCurrentSubscription(session.user.id);
  const subscriptionType = currentSubscription.plan;
  const isDemoUser = process.env.NODE_ENV !== 'production' && session.user.email?.toLowerCase() === (process.env.DEMO_USER_EMAIL || 'demo@genzz.ai').toLowerCase();
  const recentSessions = await prisma.interviewSession.findMany({
    where: { userId: session.user.id },
    select: { id: true, company: true, jobTitle: true, createdAt: true, status: true },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  const [resumeCount, answerCount, sessionCount, preparationPlan, companyResearch] = await Promise.all([
    prisma.resume.count({ where: { userId: session.user.id } }),
    prisma.interviewAnswer.count({ where: { session: { userId: session.user.id }, answer: { not: '' } } }),
    prisma.interviewSession.count({ where: { userId: session.user.id } }),
    prisma.preparationPlan.findFirst({ where: { userId: session.user.id, status: 'ACTIVE' }, include: { tasks: { orderBy: { scheduledDate: 'asc' } } }, orderBy: { updatedAt: 'desc' } }),
    prisma.companyResearch.findFirst({ where: { userId: session.user.id }, select: { id: true, companyName: true, targetRole: true, updatedAt: true }, orderBy: { updatedAt: 'desc' } }),
  ]);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-violet-300">{isDemoUser ? 'Demo Mode' : 'Overview'}</p>
            <h1 className="mt-2 text-3xl font-bold text-white">{isDemoUser ? 'Welcome to Genzz AI Demo' : `Welcome back, ${account.name}`}</h1>
          </div>

          <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-300">
            {subscriptionType} plan
          </div>
        </div>

        {isDemoUser && <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-violet-500/30 bg-violet-500/10 p-5"><div><p className="font-semibold text-violet-100">Your private practice workspace</p><p className="mt-1 text-sm text-violet-100/70">Sample sessions and resumes belong to this demo account.</p></div><Link href="/desktop-demo" className="btn-primary">Launch Desktop Demo</Link></div>}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Interview Sessions', sessionCount],
            ['Questions Practiced', answerCount],
            ['AI Answers', answerCount],
            ['Resumes', resumeCount],
          ].map(([label, value]) => <div className="card" key={label}><p className="text-sm text-slate-400">{label}</p><p className="mt-3 text-3xl font-bold text-white">{value}</p></div>)}
        </div>

        <section className="card flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-sm uppercase tracking-wider text-violet-300">Your Preparation</p>{preparationPlan ? <><h2 className="mt-2 text-xl font-semibold text-white">{preparationPlan.targetRole}</h2><p className="mt-1 text-sm text-slate-300">{preparationPlan.tasks.filter((task) => task.status === 'COMPLETED').length} of {preparationPlan.tasks.length} tasks completed</p><p className="mt-1 text-sm text-slate-400">Next: {preparationPlan.tasks.find((task) => task.status === 'NOT_STARTED' || task.status === 'IN_PROGRESS')?.title || 'All tasks complete'}</p></> : <p className="mt-2 text-sm text-slate-300">Build a focused plan for your target role.</p>}</div>
          <Link href="/preparation" className="btn-primary">{preparationPlan ? 'Continue Preparation' : 'Create Preparation Plan'}</Link>
        </section>
        <section className="card flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm uppercase tracking-wider text-violet-300">AI Interview Simulator</p><p className="mt-2 text-sm text-slate-300">Practice with a respectful AI interviewer and get structured feedback.</p></div><div className="flex gap-2"><Link href="/interview-simulator" className="btn-primary">Start Mock Interview</Link><Link href="/interview-simulator?history=1" className="btn-secondary">Recent Simulations</Link></div></section>
        <section className="card flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm uppercase tracking-wider text-violet-300">Interview Analytics</p><p className="mt-2 text-sm text-slate-300">Track your practice sessions, question history, AI feedback themes and preparation progress.</p></div><Link href="/analytics" className="btn-secondary">View Analytics</Link></section>
        <CreditWallet compact />
        <div className="flex flex-wrap gap-3"><Link href="/credits" className="btn-secondary">Credit history and wallet</Link><Link href="/interviews/create" className="btn-primary">Start Practice</Link></div>
        <NotificationCenter preview />
        <section className="card flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm uppercase tracking-wider text-violet-300">Company &amp; Role Preparation</p>{companyResearch?<><h2 className="mt-2 text-lg font-semibold text-white">{companyResearch.companyName||'Role research'} · {companyResearch.targetRole}</h2><p className="mt-1 text-sm text-slate-400">Updated {companyResearch.updatedAt.toLocaleDateString()}</p></>:<p className="mt-2 text-sm text-slate-300">Research a target role and prepare with source-grounded recommendations.</p>}</div><Link href="/company-intelligence" className="btn-primary">Prepare for an Interview</Link></section>

        {sessionCount === 0 && !isDemoUser && <section className="card border-violet-500/25 bg-gradient-to-br from-violet-500/10 to-slate-900">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">Your workspace is ready</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Start with one practice session</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Choose a target role and answer style. Add a resume if you want more personalized practice. You can update your choices anytime.</p>
          <div className="mt-5 flex flex-wrap gap-3"><Link href="/interviews/create" className="btn-primary">Create a practice session</Link><Link href="/resumes" className="btn-secondary">Add a resume</Link></div>
        </section>}

        <div className="card">
          <h2 className="text-xl font-semibold text-white">Recent activity</h2>
          <div className="mt-4 space-y-3 text-slate-300">
            <p>• {session.user.email} is authenticated and accessing the protected dashboard.</p>
            <p>• Your current plan is {subscriptionType}.</p>
            <p>• Interview session history is ready for the next phase of product features.</p>
          </div>
        </div>

        <div className="card">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-lg font-semibold text-white">Recent Interview Sessions</h3>
            <Link href="/interviews" className="text-sm text-violet-300 hover:text-violet-200">View all</Link>
          </div>
          {recentSessions.length ? (
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-700">
              <table className="min-w-full text-left text-sm text-slate-200">
                <thead className="bg-slate-800 text-slate-300">
                  <tr><th className="px-4 py-3">Company</th><th className="px-4 py-3">Job title</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Status</th></tr>
                </thead>
                <tbody>
                  {recentSessions.map((item) => (
                    <tr key={item.id} className="border-t border-slate-700 hover:bg-slate-800/40">
                      <td className="px-4 py-3"><Link href={`/interviews/${item.id}`} className="hover:text-violet-300">{item.company}</Link></td>
                      <td className="px-4 py-3"><Link href={`/interviews/${item.id}`} className="hover:text-violet-300">{item.jobTitle}</Link></td>
                      <td className="px-4 py-3 text-slate-300">{item.createdAt.toLocaleDateString()}</td>
                      <td className="px-4 py-3"><span className="rounded-full border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200">{item.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-slate-600 bg-slate-950/50 p-8 text-center text-slate-400">
              <p>No interview sessions yet.</p>
              <Link href="/interviews/create" className="btn-secondary mt-4">Create Your First Session</Link>
            </div>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="card">
            <h3 className="text-lg font-semibold text-white">Active desktop sessions</h3>
            <div className="mt-3 rounded-xl border border-dashed border-slate-600 bg-slate-950/40 p-6 text-center text-sm text-slate-400">
              No active desktop sessions.
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-white">Subscription</h3>
            <p className="mt-3 text-sm text-slate-300">{subscriptionType} · {currentSubscription.subscription.status}</p>
            {currentSubscription.subscription.currentPeriodEnd && <p className="mt-1 text-xs text-slate-400">Period ends {currentSubscription.subscription.currentPeriodEnd.toLocaleDateString()}</p>}
            <Link href="/subscription" className="btn-secondary mt-4 w-full">
              Manage Subscription
            </Link>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
