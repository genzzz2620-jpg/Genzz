import { NextResponse } from 'next/server';
import { Prisma } from '@/prisma/generated/client';
import { z } from 'zod';
import { authenticateDesktop } from '@/lib/desktop-auth';
import { generateInterviewAnswer } from '@/lib/ai/ai-service';
import { AIConfigurationError, AIProviderError } from '@/lib/ai/errors';
import { AIRateLimitError, enforceAIRateLimit } from '@/lib/ai/rate-limit';
import { prisma } from '@/lib/prisma';

const schema = z.object({ answerId: z.string().cuid(), action: z.enum(['REGENERATE', 'SHORTER', 'LONGER', 'SIMPLIFY', 'FORMAL', 'TECHNICAL', 'STAR', 'SCRIPT', 'EDIT']), editedAnswer: z.string().trim().min(1).max(20000).optional() });

export async function POST(request: Request) {
  const connection = await authenticateDesktop(request);
  if (!connection) return NextResponse.json({ error: 'Session Expired. Reconnect from the web application.' }, { status: 401 });
  const session = connection.session;
  if (session.status !== 'ACTIVE') return NextResponse.json({ error: 'This interview session is no longer active.' }, { status: 410 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Choose a valid answer action.' }, { status: 400 });
  const answer = await prisma.interviewAnswer.findFirst({ where: { id: parsed.data.answerId, sessionId: session.id }, include: { versions: { orderBy: { versionNumber: 'desc' } } } });
  if (!answer) return NextResponse.json({ error: 'Practice answer not found.' }, { status: 404 });
  if (parsed.data.action === 'EDIT') {
    if (!parsed.data.editedAnswer) return NextResponse.json({ error: 'Enter the edited answer before saving.' }, { status: 400 });
    try {
      const version = await prisma.$transaction(async (tx) => {
        const nextVersion = (answer.versions[0]?.versionNumber || 0) + 1;
        await tx.interviewAnswer.update({ where: { id: answer.id }, data: { answer: parsed.data.editedAnswer! } });
        return tx.answerVersion.create({ data: { interviewAnswerId: answer.id, answer: parsed.data.editedAnswer!, provider: session.aiModel, model: session.aiModel, versionNumber: nextVersion, action: 'EDIT' }, select: { id: true, answer: true, provider: true, model: true, versionNumber: true, action: true, createdAt: true } });
      });
      return NextResponse.json({ version: { ...version, createdAt: version.createdAt.toISOString() } });
    } catch { return NextResponse.json({ error: 'Unable to save this edit. Please retry.' }, { status: 409 }); }
  }
  try {
    await enforceAIRateLimit(connection.userId);
    const usage = await prisma.aIUsage.create({ data: { userId: connection.userId, sessionId: session.id, provider: session.aiModel, model: session.aiModel, status: 'PENDING' }, select: { id: true } });
    const context = { question: answer.question, company: session.company, jobTitle: session.jobTitle, experience: session.experience, jobDescription: session.jobDescription, resumeText: session.resume?.userId === connection.userId ? session.resume.extractedText : null, answerLength: session.answerLength, answerFormat: session.answerFormat, tone: session.tone, language: session.language, technicalDepth: session.technicalDepth, customInstructions: session.customInstructions };
    const action = parsed.data.action;
    const adjusted = { ...context,
      ...(action === 'SHORTER' ? { answerLength: 'Short' } : {}), ...(action === 'LONGER' ? { answerLength: 'Long' } : {}),
      ...(action === 'SIMPLIFY' ? { tone: 'Simple' } : {}), ...(action === 'FORMAL' ? { tone: 'Formal' } : {}),
      ...(action === 'TECHNICAL' ? { technicalDepth: 'DEEP' } : {}), ...(action === 'STAR' ? { answerFormat: 'STAR' } : {}),
      ...(action === 'SCRIPT' ? { answerFormat: 'Script' } : {}),
    };
    try {
      const generated = await generateInterviewAnswer(session.aiModel, adjusted, { action, previousAnswers: answer.versions.map(v => v.answer) });
      const next = (answer.versions[0]?.versionNumber || 0) + 1;
      const version = await prisma.answerVersion.create({ data: { interviewAnswerId: answer.id, answer: generated.text, provider: session.aiModel, model: generated.model, versionNumber: next, action, validationWarnings: generated.validationWarnings as Prisma.InputJsonValue }, select: { id: true, answer: true, provider: true, model: true, versionNumber: true, action: true, validationWarnings: true, createdAt: true } });
      await prisma.aIUsage.update({ where: { id: usage.id }, data: { model: generated.model, inputTokens: generated.inputTokens, outputTokens: generated.outputTokens, status: 'SUCCESS' } });
      return NextResponse.json({ version: { ...version, createdAt: version.createdAt.toISOString() } }, { status: 201 });
    } catch (error) {
      await prisma.aIUsage.update({ where: { id: usage.id }, data: { status: 'FAILED' } });
      if (error instanceof AIConfigurationError) return NextResponse.json({ error: error.message }, { status: 503 });
      if (error instanceof AIRateLimitError) return NextResponse.json({ error: error.message }, { status: 429, headers: { 'Retry-After': '60' } });
      if (error instanceof AIProviderError) return NextResponse.json({ error: error.message }, { status: error.kind === 'CONTEXT' ? 413 : error.kind === 'RATE_LIMIT' ? 429 : 502 });
      throw error;
    }
  } catch (error) {
    if (error instanceof AIRateLimitError) return NextResponse.json({ error: error.message }, { status: 429, headers: { 'Retry-After': '60' } });
    return NextResponse.json({ error: 'Unable to update this practice answer right now.' }, { status: 502 });
  }
}
