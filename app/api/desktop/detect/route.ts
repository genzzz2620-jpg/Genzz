import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateDesktop } from '@/lib/desktop-auth';
import { classifyInterviewQuestion } from '@/lib/ai/question-classifier';
import { isLikelyInterviewQuestion, normalizeQuestion } from '@/lib/speech/question-detection';
import { prisma } from '@/lib/prisma';
import { consumeRateLimit } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
const schema = z.object({ question: z.string().trim().min(1).max(3000) });

export async function POST(request: Request) {
  const connection = await authenticateDesktop(request);
  if (!connection) return NextResponse.json({ error: 'Session Expired. Reconnect from the web application.' }, { status: 401 });
  const limit = consumeRateLimit(`desktop-detect:${connection.id}`, 120, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: 'Too many speech requests. Please wait and try again.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } });
  if (connection.session.status !== 'ACTIVE') return NextResponse.json({ error: 'This interview session is no longer active.' }, { status: 410 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid question.' }, { status: 400 });

  try {
    const detectionStartedAt = performance.now();
    const classificationStartedAt = performance.now();
    const classification = classifyInterviewQuestion(parsed.data.question);
    const classificationMs = performance.now() - classificationStartedAt;
    if (!isLikelyInterviewQuestion(parsed.data.question, 1)) {
      return NextResponse.json({ error: 'That speech segment was too short or did not sound like an interview question.' }, { status: 422 });
    }
    const cutoff = new Date(Date.now() - 3 * 60 * 1000);
    const recent = await prisma.interviewAnswer.findMany({
      where: { sessionId: connection.sessionId, createdAt: { gte: cutoff } },
      select: { id: true, question: true, questionType: true, answer: true, createdAt: true },
      orderBy: { createdAt: 'desc' }, take: 30,
    });
    const duplicate = recent.find((item) => normalizeQuestion(item.question) === normalizeQuestion(parsed.data.question));
    if (duplicate) return NextResponse.json({ answerId: duplicate.id, question: duplicate.question, questionType: duplicate.questionType || classification.type, answer: duplicate.answer, duplicate: true, answered: Boolean(duplicate.answer.trim()), timings: { classificationMs, detectionMs: performance.now() - detectionStartedAt } });

    const record = await prisma.interviewAnswer.create({
      data: {
        sessionId: connection.sessionId,
        question: parsed.data.question,
        answer: '',
        questionType: classification.type,
        analysisJson: { confidence: classification.confidence },
      },
      select: { id: true, question: true, questionType: true, createdAt: true },
    });
    return NextResponse.json({ answerId: record.id, question: record.question, questionType: record.questionType, duplicate: false, createdAt: record.createdAt.toISOString(), timings: { classificationMs, detectionMs: performance.now() - detectionStartedAt } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Unable to save the detected question right now.' }, { status: 500 });
  }
}
