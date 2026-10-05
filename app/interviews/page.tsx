import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { SessionActions } from '@/components/interviews/session-actions';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function InterviewsPage() {
  const authSession = await getServerSession(authOptions);
  if (!authSession?.user?.id) redirect('/login');

  const sessions = await prisma.interviewSession.findMany({
    where: { userId: authSession.user.id },
    select: { id: true, company: true, jobTitle: true, experience: true, status: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <DashboardShell>
      <div className="card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Interview Sessions</h1>
            <p className="mt-2 text-slate-300">Your saved interview practice sessions.</p>
          </div>
          <Link href="/interviews/create" className="btn-primary">Create Session</Link>
        </div>

        {sessions.length ? (
          <div className="mt-6 space-y-3">
            {sessions.map((interviewSession) => (
              <article key={interviewSession.id} className="grid gap-4 rounded-lg border border-slate-700 bg-slate-950/50 p-4 lg:grid-cols-[1fr_1fr_0.8fr_0.8fr_auto] lg:items-center">
                <div><p className="text-xs text-slate-400">Company</p><p className="mt-1 font-medium text-white">{interviewSession.company}</p></div>
                <div><p className="text-xs text-slate-400">Job title</p><p className="mt-1 text-slate-200">{interviewSession.jobTitle}</p></div>
                <div><p className="text-xs text-slate-400">Experience</p><p className="mt-1 text-slate-200">{interviewSession.experience || 'Not specified'}</p></div>
                <div><p className="text-xs text-slate-400">Status · Created</p><p className="mt-1 text-slate-200">{interviewSession.status} · {interviewSession.createdAt.toLocaleDateString()}</p></div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/interviews/${interviewSession.id}`} className="btn-secondary text-xs">Open</Link>
                  <SessionActions sessionId={interviewSession.id} status={interviewSession.status} showComplete={false} />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-dashed border-slate-600 bg-slate-950/50 p-8 text-center text-slate-400">
            <p>No interview sessions yet.</p>
            <Link href="/interviews/create" className="btn-secondary mt-4">Create Your First Session</Link>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
