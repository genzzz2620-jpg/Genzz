import { NextResponse } from 'next/server';
import { Prisma } from '@/prisma/generated/client';
import { z } from 'zod';
import { authenticateDesktop } from '@/lib/desktop-auth';
import { generateInterviewAnswer } from '@/lib/ai/ai-service';
import { AIConfigurationError, AIProviderError } from '@/lib/ai/errors';
import { AIRateLimitError, enforceAIRateLimit } from '@/lib/ai/rate-limit';
import { prisma } from '@/lib/prisma';
import { normalizeQuestion } from '@/lib/speech/question-detection';

export const runtime = 'nodejs';
const schema = z.object({ question: z.string().trim().min(1).max(3000), answerId: z.string().cuid().optional() });

export async function POST(request: Request) {
  const connection = await authenticateDesktop(request);
  if (!connection) return NextResponse.json({ error: 'Session Expired. Reconnect from the web application.' }, { status: 401 });
  const s = connection.session;
  if (s.status !== 'ACTIVE') return NextResponse.json({ error: 'This interview session is no longer active.' }, { status: 410 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Enter a question (up to 3,000 characters).' }, { status: 400 });
  let usageId: string | undefined;
  try {
    let duplicateId: string | undefined;
    if (!parsed.data.answerId) {
      const recent = await prisma.interviewAnswer.findMany({ where: { sessionId: s.id, createdAt: { gte: new Date(Date.now() - 3 * 60 * 1000) } }, select: { id: true, question: true, answer: true, questionType: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 30 });
      const duplicate = recent.find((item) => normalizeQuestion(item.question) === normalizeQuestion(parsed.data.question));
      if (duplicate?.answer.trim()) return NextResponse.json({ answer: { id: duplicate.id, question: duplicate.question, answer: duplicate.answer, questionType: duplicate.questionType, versions: [], createdAt: duplicate.createdAt.toISOString() }, duplicate: true });
      duplicateId = duplicate?.id;
    }
    const savedQuestion = parsed.data.answerId
      ? await prisma.interviewAnswer.findFirst({ where: { id: parsed.data.answerId, sessionId: s.id } })
      : duplicateId ? await prisma.interviewAnswer.findFirst({ where: { id: duplicateId, sessionId: s.id } }) : null;
    if (parsed.data.answerId && !savedQuestion) {
      return NextResponse.json({ error: 'Detected question was not found in this interview session.' }, { status: 404 });
    }
    await enforceAIRateLimit(connection.userId);
    const usage = await prisma.aIUsage.create({ data: { userId: connection.userId, sessionId: s.id, provider: s.aiModel, model: s.aiModel, status: 'PENDING' }, select: { id: true } });
    usageId = usage.id;
    try {
      const generated = await generateInterviewAnswer(s.aiModel, {
        question: parsed.data.question, company: s.company, jobTitle: s.jobTitle, experience: s.experience,
        jobDescription: s.jobDescription,
        resumeText: s.resume?.userId === connection.userId ? s.resume.extractedText : null,
        answerLength: s.answerLength, answerFormat: s.answerFormat, tone: s.tone, language: s.language,
        technicalDepth: s.technicalDepth, customInstructions: s.customInstructions,
      });
      const answer = savedQuestion
        ? await prisma.interviewAnswer.update({ where: { id: savedQuestion.id }, data: {
          question: parsed.data.question, answer: generated.text, questionType: generated.questionType,
          analysisJson: { confidence: generated.confidence, ...generated.analysis } as Prisma.InputJsonValue,
          versions: { create: { answer: generated.text, provider: s.aiModel, model: generated.model, versionNumber: 1, action: 'INITIAL', validationWarnings: generated.validationWarnings as Prisma.InputJsonValue } },
        }, include: { versions: true } })
        : await prisma.interviewAnswer.create({ data: {
          sessionId: s.id, question: parsed.data.question, answer: generated.text, questionType: generated.questionType,
          analysisJson: { confidence: generated.confidence, ...generated.analysis } as Prisma.InputJsonValue,
          versions: { create: { answer: generated.text, provider: s.aiModel, model: generated.model, versionNumber: 1, action: 'INITIAL', validationWarnings: generated.validationWarnings as Prisma.InputJsonValue } },
        }, include: { versions: true } });
      await prisma.aIUsage.update({ where: { id: usage.id }, data: { model: generated.model, inputTokens: generated.inputTokens, outputTokens: generated.outputTokens, status: 'SUCCESS' } });
      return NextResponse.json({ answer: { id: answer.id, question: answer.question, answer: generated.text, questionType: generated.questionType, validationWarnings: generated.validationWarnings, versions: answer.versions.map(v => ({ id: v.id, answer: v.answer, provider: v.provider, model: v.model, versionNumber: v.versionNumber, action: v.action, validationWarnings: v.validationWarnings, createdAt: v.createdAt.toISOString() })), createdAt: answer.createdAt.toISOString() }, duplicate: false }, { status: savedQuestion ? 200 : 201 });
    } catch (error) {
      await prisma.aIUsage.update({ where: { id: usage.id }, data: { status: 'FAILED' } });
      if (error instanceof AIConfigurationError) return NextResponse.json({ error: error.message }, { status: 503 });
      if (error instanceof AIRateLimitError) return NextResponse.json({ error: error.message }, { status: 429, headers: { 'Retry-After': '60' } });
      if (error instanceof AIProviderError) return NextResponse.json({ error: error.message }, { status: error.kind === 'CONTEXT' ? 413 : error.kind === 'RATE_LIMIT' ? 429 : 502 });
      throw error;
    }
  } catch (error) {
    if (usageId) await prisma.aIUsage.update({ where: { id: usageId }, data: { status: 'FAILED' } }).catch(() => undefined);
    if (error instanceof AIRateLimitError) return NextResponse.json({ error: error.message }, { status: 429, headers: { 'Retry-After': '60' } });
    return NextResponse.json({ error: 'Genzz AI could not generate the answer right now.' }, { status: 502 });
  }
}
