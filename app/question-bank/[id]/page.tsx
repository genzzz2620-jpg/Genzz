import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { PracticeQuestionButton } from '@/components/question-bank/practice-question-button';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type QuestionDetailProps = { params: Promise<{ id: string }> };

export default async function QuestionDetailPage({ params }: QuestionDetailProps) {
  const { id } = await params;
  const authSession = await getServerSession(authOptions);
  if (!authSession?.user?.id) redirect('/login');

  const question = await prisma.questionBankItem.findFirst({
    where: { id, status: 'PUBLISHED', OR: [{ userId: null }, { userId: authSession.user.id }] },
    include: {
      favorites: { where: { userId: authSession.user.id }, select: { id: true } },
      answers: {
        where: { session: { userId: authSession.user.id } },
        select: { answer: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });
  if (!question) notFound();

  return (
    <DashboardShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <div><p className="text-sm uppercase tracking-[0.2em] text-violet-300">Genzz AI Question Bank</p><h1 className="mt-2 text-3xl font-bold text-white">Question Details</h1></div>
        <section className="card space-y-5">
          <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-300">Question</p><h2 className="mt-2 text-xl font-semibold leading-8 text-white">{question.question}</h2></div>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Detail label="Category" value={question.category} />
            <Detail label="Subcategory" value={question.subcategory || 'Not specified'} />
            <Detail label="Difficulty" value={question.difficulty || 'Not specified'} />
            <Detail label="Experience" value={question.experienceLevel || 'Any'} />
            <Detail label="Technology" value={question.technology || 'Not specified'} />
            <Detail label="Job role" value={question.jobRole || 'Any'} />
            <Detail label="Company" value={question.company ? 'Practice questions associated with this company/role' : 'General'} />
          </dl>
          {question.company && <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-100/80">Practice questions associated with this company/role. This is not a claim that the question is real, confidential, or guaranteed to appear.</p>}
          {question.isAiGenerated && <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-100/80">AI-generated practice question.</p>}
          <div><h3 className="text-base font-semibold text-white">Expected answer approach</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{question.explanation || 'Ask Genzz AI to classify this question and suggest an answer approach based on your practice-session context.'}</p></div>
          <div><h3 className="text-base font-semibold text-white">Practice answer</h3>{question.answers[0] ? <div className="mt-2 rounded-lg border border-slate-700 bg-slate-950/50 p-4"><p className="whitespace-pre-wrap text-sm leading-7 text-slate-200">{question.answers[0].answer}</p><p className="mt-3 text-xs text-slate-500">Saved {question.answers[0].createdAt.toLocaleString()}</p></div> : <p className="mt-2 rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-400">No practice answer saved for this question yet.</p>}</div>
          <div className="flex flex-wrap gap-3 border-t border-slate-800 pt-5"><PracticeQuestionButton questionId={question.id} /><Link href="/question-bank" className="btn-secondary">Back to Question Bank</Link></div>
        </section>
      </div>
    </DashboardShell>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs text-slate-400">{label}</dt><dd className="mt-1 text-sm text-slate-100">{value}</dd></div>;
}
