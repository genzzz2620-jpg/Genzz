import { getServerSession } from 'next-auth';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { DesktopDemo } from '@/components/desktop-demo/desktop-demo';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Genzz AI Desktop' };

export default async function DesktopDemoPage({ searchParams: searchParamsPromise }: { searchParams: Promise<{  sessionId?: string  }> }) {
  const searchParams = await searchParamsPromise;
  const auth = await getServerSession(authOptions);
  if (!auth?.user?.id) redirect('/login?callbackUrl=%2Fdesktop-demo');
  const sessions = await prisma.interviewSession.findMany({
    where: { userId: auth.user.id },
    include: { resume: { select: { fileName: true } } },
    orderBy: { createdAt: 'desc' },
  });
  const selected = sessions.find((session) => session.id === searchParams.sessionId)
    || sessions.find((session) => session.status === 'ACTIVE')
    || sessions[0];
  const isDemoUser = process.env.NODE_ENV !== 'production'
    && auth.user.email?.toLowerCase() === (process.env.DEMO_USER_EMAIL || 'demo@genzz.ai').toLowerCase();

  return <DashboardShell>
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-300">Genzz AI Desktop</p><h1 className="mt-2 text-3xl font-bold text-white">Genzz AI Desktop</h1><p className="mt-2 text-sm font-medium text-slate-300">AI-powered interview practice workspace</p><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Genzz AI converts spoken questions into text, identifies the question type, uses your selected interview context, and generates a practice response.</p></div>
        <div className="flex flex-wrap gap-2"><span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-200">Interactive Demo</span><span className="rounded-full border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300">Credits not configured</span>{isDemoUser && <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-200">DEMO MODE</span>}</div>
      </header>

      {sessions.length ? <>
        <DesktopDemo sessions={sessions.map((session) => ({
          id: session.id, company: session.company, jobTitle: session.jobTitle, experience: session.experience || 'Not specified',
          resume: session.resume?.fileName || 'No Resume', aiModel: session.aiModel, answerLength: session.answerLength,
          answerFormat: session.answerFormat, tone: session.tone, technicalDepth: session.technicalDepth,
          status: session.status,
        }))} initialSessionId={selected.id} />
      </> : <section className="card"><h2 className="text-lg font-semibold text-white">Create a practice session to get started</h2><p className="mt-2 text-sm text-slate-400">The desktop preview uses your interview session for company, role, resume, provider, and answer preferences.</p><Link href="/interviews/create" className="btn-primary mt-4">Create Interview Session</Link></section>}

      <section className="grid gap-4 md:grid-cols-2">
        <article className="card"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Installed desktop application</p><div className="mt-3 flex items-center justify-between gap-3"><h2 className="text-lg font-semibold text-white">Genzz AI Desktop</h2><span className="rounded-full border border-slate-600 px-2.5 py-1 text-xs text-slate-300">Not Installed</span></div><p className="mt-2 text-sm text-slate-400">This page is a browser demo. The Windows desktop build exists for development, but a public installer download has not been distributed.</p><button type="button" disabled className="btn-secondary mt-4 cursor-not-allowed opacity-50">Download Desktop App · Unavailable</button></article>
        <article className="card"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Practice examples</p><h2 className="mt-3 text-lg font-semibold text-white">Interviewer Simulation</h2><p className="mt-2 text-sm leading-6 text-slate-400">Try HR, technical, behavioral, project, networking, and incident questions. These are practice examples and are not guaranteed interview questions.</p><p className="mt-3 text-xs text-slate-500">Microphone access is controlled by you. Simulation mode never activates it.</p></article>
      </section>
    </div>
  </DashboardShell>;
}
