import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateQuestion } from '@/lib/simulator/ai';
import { simulatorErrorResponse } from '@/lib/simulator/errors';
import { CreditServiceError, refundCredits, startBilledSession } from '@/lib/billing/credits';

type State = { asked: number; skipped: number; startedAt: string | null; currentQuestion: unknown; coveredTopics: Record<string, number> };
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getServerSession(authOptions);
  if (!auth?.user?.id) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  const session = await prisma.interviewSession.findFirst({ where: { id: id, userId: auth.user.id, isSimulator: true }, include: { resume: { select: { userId: true, extractedText: true } } } });
  if (!session) return NextResponse.json({ error: 'Simulation not found.' }, { status: 404 });
  if (session.status === 'ACTIVE') return NextResponse.json({ success: true });
  if (session.status !== 'DRAFT') return NextResponse.json({ error: 'This simulation has ended.' }, { status: 409 });
  const state = session.simulatorState as unknown as State;
  try {
    const charge = await startBilledSession(auth.user.id, session.id);
    try {
      const question = await generateQuestion({ userId: auth.user.id, sessionId: session.id, model: session.aiModel, config: { role: session.jobTitle, company: session.company, experience: session.experience, interviewType: session.simulatorInterviewType, difficulty: session.simulatorDifficulty, jobDescription: session.jobDescription?.slice(0, 3000) }, resumeText: session.resume?.userId === auth.user.id ? session.resume.extractedText : null, previousQuestions: [], difficulty: session.simulatorDifficulty || 'Intermediate', questionNumber: 1 });
      await prisma.interviewSession.update({ where: { id: session.id }, data: { simulatorState: { ...state, asked: 1, startedAt: new Date().toISOString(), currentQuestion: question } } });
      return NextResponse.json({ question, billing: { free: charge.free, durationMinutes: charge.durationMinutes, creditsUsed: charge.units / 100 } });
    } catch (error) {
      await refundCredits(auth.user.id, session.id, 'The interviewer could not prepare the first question');
      return simulatorErrorResponse(error, 'The interviewer could not prepare a question. Retry to continue.');
    }
  } catch (error) {
    if (error instanceof CreditServiceError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    return NextResponse.json({ error: 'Unable to start this practice session.' }, { status: 500 });
  }
}
