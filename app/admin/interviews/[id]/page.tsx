import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminHeading, AdminStat, dateLabel } from '@/components/admin/admin-ui';
import { requireAdminPage } from '@/lib/admin/auth';
import { prisma } from '@/lib/prisma';

export default async function AdminInterviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireAdminPage();
  if (!access.authorized) return null;
  const session = await prisma.interviewSession.findUnique({ where: { id }, select: { id: true, company: true, jobTitle: true, experience: true, language: true, answerLength: true, answerFormat: true, tone: true, aiModel: true, technicalDepth: true, status: true, createdAt: true, user: { select: { id: true, name: true, email: true } }, _count: { select: { answers: true } } } });
  if (!session) notFound();
  return <><AdminHeading title={session.jobTitle} description={`${session.company} · ${session.user.name} (${session.user.email})`} action={<Link href="/admin/interviews" className="btn-secondary">All interviews</Link>} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><AdminStat label="Status" value={session.status} /><AdminStat label="Question / Answer Count" value={session._count.answers} /><AdminStat label="Created" value={dateLabel(session.createdAt)} /><AdminStat label="Experience" value={session.experience || 'Not specified'} /></div>
    <section className="card mt-6"><h2 className="text-lg font-semibold">Session configuration</h2><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><dt className="text-slate-400">Company</dt><dd>{session.company}</dd><dt className="text-slate-400">Job</dt><dd>{session.jobTitle}</dd><dt className="text-slate-400">AI provider / model</dt><dd>{session.aiModel}</dd><dt className="text-slate-400">Language</dt><dd>{session.language}</dd><dt className="text-slate-400">Answer length</dt><dd>{session.answerLength}</dd><dt className="text-slate-400">Answer format</dt><dd>{session.answerFormat}</dd><dt className="text-slate-400">Tone</dt><dd>{session.tone}</dd><dt className="text-slate-400">Technical depth</dt><dd>{session.technicalDepth}</dd><dt className="text-slate-400">Account</dt><dd><Link className="text-violet-300 hover:underline" href={`/admin/users/${session.user.id}`}>View user</Link></dd></dl><p className="mt-5 text-xs text-slate-500">Job descriptions, resume content, and answer text are omitted to limit exposure of personal data.</p></section>
  </>;
}
