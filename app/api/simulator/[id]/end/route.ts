import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateSummary } from '@/lib/simulator/ai';
import { createNotification } from '@/lib/notifications';
type State = { asked: number; skipped: number; startedAt: string | null; pausedAt?: string | null; pausedDurationSec?: number; currentQuestion: unknown; coveredTopics: Record<string, number> };
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getServerSession(authOptions);
  if (!auth?.user?.id) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  const session = await prisma.interviewSession.findFirst({ where: { id: id, userId: auth.user.id, isSimulator: true }, include: { answers: { select: { question: true, answer: true, analysisJson: true }, orderBy: { createdAt: 'asc' } } } });
  if (!session) return NextResponse.json({ error: 'Simulation not found.' }, { status: 404 });
  if (session.status === 'COMPLETED' && session.simulatorFeedback) return NextResponse.json({ feedback: session.simulatorFeedback });
  if (session.status !== 'ACTIVE') return NextResponse.json({ error: 'This simulation cannot be ended.' }, { status: 409 });
  const state = session.simulatorState as unknown as State;
  try {
    const feedback = await generateSummary({ userId: auth.user.id, sessionId: session.id, model: session.aiModel, config: { role: session.jobTitle, experience: session.experience, interviewType: session.simulatorInterviewType, difficulty: session.simulatorDifficulty, questionLimit: session.simulatorQuestionLimit }, answers: session.answers, skipped: state.skipped });
    const completedAt = new Date();
    const startTime = state.startedAt ? new Date(state.startedAt).getTime() : session.startedAt?.getTime();
    const stopTime = state.pausedAt ? new Date(state.pausedAt).getTime() : completedAt.getTime();
    const durationSeconds = Number.isFinite(startTime) ? Math.max(0, Math.floor((stopTime - (startTime as number)) / 1000) - (state.pausedDurationSec || 0)) : null;
    const result = await prisma.interviewSession.updateMany({ where: { id: session.id, userId: auth.user.id, status: 'ACTIVE' }, data: { status: 'COMPLETED', completedAt, durationSeconds, simulatorFeedback: feedback, simulatorState: { ...state, currentQuestion: null, endedAt: completedAt.toISOString() } } });
    if (result.count) {
      await createNotification({ userId: auth.user.id, type: 'INTERVIEW_COMPLETED', category: 'INTERVIEW', title: 'Practice session completed', message: 'Your mock interview is complete. Review your answers and next steps.', actionUrl: `/interviews/${session.id}`, eventKey: `simulator:${session.id}:completed` }).catch(() => undefined);
      await createNotification({ userId: auth.user.id, type: 'FEEDBACK_READY', category: 'INTERVIEW', title: 'Your AI feedback is ready', message: 'Structured feedback from your practice session is ready to review.', actionUrl: `/interviews/${session.id}`, eventKey: `simulator:${session.id}:feedback` }).catch(() => undefined);
    }
    return NextResponse.json({ feedback });
  } catch { return NextResponse.json({ error: 'Could not generate the interview summary right now. Retry ending the interview.' }, { status: 502 }); }
}
