import { NextResponse } from 'next/server';
import type { Prisma } from '@/prisma/generated/client';
import { authenticateDesktop } from '@/lib/desktop-auth';
import { prisma } from '@/lib/prisma';
import { generateSummary } from '@/lib/simulator/ai';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  const connection = await authenticateDesktop(request, { allowExpiredSession: true });
  if (!connection) return NextResponse.json({ error: 'Session expired. Reconnect from the web application.' }, { status: 401 });
  const active = connection.session;
  const endedAt = new Date();
  const startedAt = active.startedAt || connection.connectedAt || active.createdAt;
  const durationSeconds = Math.max(0, Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000));
  const [answers, update] = await Promise.all([
    prisma.interviewAnswer.findMany({ where: { sessionId: active.id }, select: { question: true, answer: true, analysisJson: true }, orderBy: { createdAt: 'asc' }, take: 100 }),
    prisma.$transaction(async (tx) => {
      const result = await tx.interviewSession.updateMany({ where: { id: active.id, userId: connection.userId, status: 'ACTIVE' }, data: { status: 'COMPLETED', completedAt: endedAt, durationSeconds } });
      if (result.count) await tx.desktopConnection.updateMany({ where: { id: connection.id, userId: connection.userId, revokedAt: null }, data: { revokedAt: endedAt, tokenHash: null, tokenExpiresAt: null } });
      return result.count;
    }),
  ]);
  if (!update && active.status !== 'COMPLETED') return NextResponse.json({ error: 'This practice session could not be ended.' }, { status: 409 });
  let feedback: Prisma.JsonValue | null = active.simulatorFeedback;
  if (!feedback && answers.length) {
    try {
      const result = await generateSummary({ userId: connection.userId, sessionId: active.id, model: active.aiModel, config: { role: active.jobTitle, company: active.company, experience: active.experience }, answers, skipped: 0 });
      feedback = result as Prisma.JsonValue;
      if (feedback !== null) await prisma.interviewSession.updateMany({ where: { id: active.id, userId: connection.userId }, data: { simulatorFeedback: feedback as Prisma.InputJsonValue } });
    } catch { /* Ending practice remains successful if optional feedback generation fails. */ }
  }
  return NextResponse.json({ status: 'COMPLETED', sessionId: active.id, answerCount: answers.length, durationSeconds, endedAt: endedAt.toISOString(), summary: feedback }, { headers: { 'Cache-Control': 'no-store' } });
}
