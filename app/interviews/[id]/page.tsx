import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { notFound, redirect } from 'next/navigation';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { AIAnswerPanel } from '@/components/interviews/ai-answer-panel';
import { SessionActions } from '@/components/interviews/session-actions';
import { DesktopConnect } from '@/components/interviews/desktop-connect';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type SessionDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ questionId?: string; created?: string }>;
};

export default async function SessionDetailPage({ params: paramsPromise, searchParams: searchParamsPromise }: SessionDetailPageProps) {
  const [{ id }, searchParams] = await Promise.all([paramsPromise, searchParamsPromise]);
  const authSession = await getServerSession(authOptions);
  if (!authSession?.user?.id) redirect('/login');

  const interviewSession = await prisma.interviewSession.findFirst({
    where: { id, userId: authSession.user.id },
    include: {
      resume: { select: { id: true, fileName: true, fileType: true } },
      answers: {
        select: {
          id: true,
          question: true,
          answer: true,
          questionType: true,
          createdAt: true,
          versions: {
            select: {
              id: true,
              answer: true,
              provider: true,
              model: true,
              versionNumber: true,
              action: true,
              validationWarnings: true,
              createdAt: true,
            },
            orderBy: { versionNumber: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      },
    },
  });

  if (!interviewSession) notFound();

  const initialQuestion = searchParams?.questionId
    ? await prisma.questionBankItem.findFirst({
      where: { id: searchParams.questionId, OR: [{ userId: null }, { userId: authSession.user.id }] },
      select: { id: true, question: true },
    })
    : null;

  const details = [
    ['Company', interviewSession.company],
    ['Job title', interviewSession.jobTitle],
    ['Experience', interviewSession.experience || 'Not specified'],
    ['Resume', interviewSession.resume?.fileName || 'No Resume'],
    ['Language', interviewSession.language],
    ['Answer length', interviewSession.answerLength],
    ['Answer format', interviewSession.answerFormat],
    ['Tone', interviewSession.tone],
    ['Technical depth', interviewSession.technicalDepth],
    ['AI model', interviewSession.aiModel],
  ];
  const feedback = interviewSession.simulatorFeedback && typeof interviewSession.simulatorFeedback === 'object' && !Array.isArray(interviewSession.simulatorFeedback)
    ? interviewSession.simulatorFeedback as Record<string, unknown>
    : null;
  const feedbackList = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

  return (
    <DashboardShell>
      <div className="mx-auto max-w-5xl space-y-6">
        {searchParams?.created === '1' && <section className="card border-emerald-500/30 bg-emerald-500/5" role="status"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">Session created</p><h2 className="mt-2 text-xl font-semibold text-white">Your practice session is ready.</h2><p className="mt-2 text-sm text-slate-300">{interviewSession.jobTitle} · {interviewSession.company} · {interviewSession.experience || 'Experience not specified'}</p><p className="mt-1 text-xs text-slate-400">Resume: {interviewSession.resume?.fileName || 'No Resume'} · {interviewSession.answerFormat}, {interviewSession.answerLength} answers · {interviewSession.aiModel}</p><p className="mt-2 text-xs text-slate-400">Your selected job description and answer preferences are attached securely to this session.</p></section>}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-300">Genzz AI · Prepare Smarter. Interview Better.</p>
            <h1 className="mt-2 text-3xl font-bold text-white">{interviewSession.company} · {interviewSession.jobTitle}</h1>
            <p className="mt-2 text-sm text-slate-400">{interviewSession.experience || 'Experience not specified'} · {interviewSession.aiModel} · {interviewSession.resume?.fileName || 'No resume'} · {interviewSession.answerLength} · {interviewSession.tone} · {interviewSession.language}</p>
            <p className="mt-1 text-xs text-slate-500">Created {interviewSession.createdAt.toLocaleString()}</p>
          </div>
          <span className={`inline-flex rounded-full border px-3 py-1.5 text-sm ${interviewSession.status === 'ACTIVE' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-slate-600 bg-slate-800 text-slate-300'}`}>
            {interviewSession.status}
          </span>
        </div>

        <section className="card">
          <h2 className="text-xl font-semibold text-white">Session settings</h2>
          <dl className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {details.map(([label, value]) => (
              <div key={label}>
                <dt className="text-sm text-slate-400">{label}</dt>
                <dd className="mt-1 break-words text-slate-100">{value}</dd>
              </div>
            ))}
          </dl>
          {interviewSession.customInstructions && (
            <div className="mt-5 border-t border-slate-700 pt-5">
              <h3 className="text-sm font-medium text-slate-400">Custom instructions</h3>
              <p className="mt-2 whitespace-pre-wrap text-slate-100">{interviewSession.customInstructions}</p>
            </div>
          )}
          {interviewSession.jobDescription && (
            <div className="mt-5 border-t border-slate-700 pt-5">
              <h3 className="text-sm font-medium text-slate-400">Job description</h3>
              <p className="mt-2 whitespace-pre-wrap text-slate-200">{interviewSession.jobDescription}</p>
            </div>
          )}
        </section>

        {feedback && <section className="card" aria-labelledby="practice-feedback-title">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-300">AI-generated practice feedback</p>
          <h2 id="practice-feedback-title" className="mt-2 text-xl font-semibold text-white">Interview feedback</h2>
          {typeof feedback.overallSummary === 'string' && <p className="mt-3 text-sm leading-6 text-slate-300">{feedback.overallSummary}</p>}
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            {(['communication', 'technicalDepth', 'answerStructure', 'roleAlignment'] as const).map((key) => typeof feedback[key] === 'string' && <div key={key}><dt className="text-sm font-medium capitalize text-slate-400">{key === 'technicalDepth' ? 'Technical depth' : key === 'answerStructure' ? 'Answer structure' : key}</dt><dd className="mt-1 text-sm text-slate-200">{feedback[key] as string}</dd></div>)}
          </dl>
          {(['strengths', 'improvementAreas', 'recommendedPractice'] as const).map((key) => { const items = feedbackList(feedback[key]); return items.length ? <div key={key} className="mt-5"><h3 className="text-sm font-semibold capitalize text-white">{key === 'improvementAreas' ? 'Areas to improve' : key === 'recommendedPractice' ? 'Recommended practice' : key}</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">{items.map((item, index) => <li key={`${key}-${index}`}>{item}</li>)}</ul></div> : null; })}
        </section>}

        <div className="flex flex-wrap gap-3">
          <Link href="#desktop-connection" className="btn-primary">Connect Genzz AI Desktop</Link>
          <Link href={`/desktop-demo?sessionId=${interviewSession.id}`} className="btn-secondary">Continue in Browser</Link>
        </div>

        <div id="desktop-connection"><DesktopConnect sessionId={interviewSession.id} active={interviewSession.status === 'ACTIVE'} /></div>

        <AIAnswerPanel
          sessionId={interviewSession.id}
          status={interviewSession.status}
          model={interviewSession.aiModel}
          initialQuestion={initialQuestion?.question || ''}
          initialQuestionBankItemId={initialQuestion?.id || ''}
          initialAnswers={interviewSession.answers.map((answer) => ({
            ...answer,
            createdAt: answer.createdAt.toISOString(),
            versions: answer.versions.map((version) => ({
              ...version,
              createdAt: version.createdAt.toISOString(),
              validationWarnings: Array.isArray(version.validationWarnings) ? version.validationWarnings.filter((warning): warning is string => typeof warning === 'string') : [],
            })),
          }))}
        />

        <div className="flex flex-col gap-4 border-t border-slate-800 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/dashboard" className="btn-secondary">Back to Dashboard</Link>
          <SessionActions sessionId={interviewSession.id} status={interviewSession.status} />
        </div>
      </div>
    </DashboardShell>
  );
}
