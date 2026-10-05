import { NextResponse } from 'next/server';
import { Prisma } from '@/prisma/generated/client';
import { z } from 'zod';
import { authenticateDesktop } from '@/lib/desktop-auth';
import { streamInterviewAnswer } from '@/lib/ai/ai-service';
import { AIConfigurationError, AIProviderError } from '@/lib/ai/errors';
import { AIRateLimitError, enforceAIRateLimit } from '@/lib/ai/rate-limit';
import { prisma } from '@/lib/prisma';
import { normalizeQuestion } from '@/lib/speech/question-detection';

export const runtime = 'nodejs';

const preferencesSchema = z.object({ answerLength: z.enum(['Short', 'Balanced', 'Long']), answerFormat: z.enum(['Normal', 'Bullet Points', 'Script', 'STAR', 'Technical Explanation']), language: z.string().min(1).max(40), aiModel: z.enum(['ChatGPT', 'Gemini']) }).optional();
const schema = z.object({ question: z.string().trim().min(1).max(3000), answerId: z.string().cuid().optional(), preferences: preferencesSchema });
const encoder = new TextEncoder();
const eventFrame = (event: Record<string, unknown>) => encoder.encode(`${JSON.stringify(event)}\n`);

function errorMessage(error: unknown) {
  if (error instanceof AIConfigurationError || error instanceof AIRateLimitError) return error.message;
  if (error instanceof AIProviderError) return error.kind === 'TIMEOUT'
    ? 'The AI provider timed out. Please try again.'
    : error.kind === 'RATE_LIMIT'
      ? 'The AI provider is rate-limiting requests. Please wait and try again.'
      : error.kind === 'CONTEXT'
        ? 'The question context is too large. Shorten the resume or job description and try again.'
        : 'The AI provider could not complete this answer. Please try again.';
  return 'Genzz AI could not generate the answer right now. Please try again.';
}

export async function POST(request: Request) {
  const requestStartedAt = performance.now();
  const connection = await authenticateDesktop(request);
  if (!connection) return NextResponse.json({ error: 'Session Expired. Reconnect from the web application.' }, { status: 401 });
  const interviewSession = connection.session;
  const contextRetrievedAt = performance.now();
  if (interviewSession.status !== 'ACTIVE') return NextResponse.json({ error: 'This interview session is no longer active.' }, { status: 410 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Enter a question (up to 3,000 characters).' }, { status: 400 });
  const overrides = parsed.data.preferences;
  const aiModel = overrides?.aiModel || interviewSession.aiModel;
  const configured = aiModel === 'ChatGPT' ? Boolean(process.env.OPENAI_API_KEY) : Boolean(process.env.GEMINI_API_KEY);
  if (aiModel !== interviewSession.aiModel && !configured) return NextResponse.json({ error: `${aiModel} is not configured on this Genzz AI server.` }, { status: 400 });

  let savedAnswer: { id: string } | null = null;
  if (parsed.data.answerId) {
    savedAnswer = await prisma.interviewAnswer.findFirst({ where: { id: parsed.data.answerId, sessionId: interviewSession.id }, select: { id: true } });
    if (!savedAnswer) return NextResponse.json({ error: 'Detected question was not found in this interview session.' }, { status: 404 });
  } else {
    try {
      const recent = await prisma.interviewAnswer.findMany({
        where: { sessionId: interviewSession.id, createdAt: { gte: new Date(Date.now() - 3 * 60 * 1000) } },
        select: { id: true, question: true, answer: true, questionType: true, createdAt: true },
        orderBy: { createdAt: 'desc' }, take: 30,
      });
      const duplicate = recent.find((item) => normalizeQuestion(item.question) === normalizeQuestion(parsed.data.question));
      if (duplicate?.answer.trim()) {
        const duplicateStream = new ReadableStream<Uint8Array>({ start(controller) {
          controller.enqueue(eventFrame({ type: 'delta', token: duplicate.answer }));
          controller.enqueue(eventFrame({ type: 'done', duplicate: true, answer: {
            id: duplicate.id, question: duplicate.question, answer: duplicate.answer, questionType: duplicate.questionType,
            createdAt: duplicate.createdAt.toISOString(),
          }, timings: { serverTotalMs: performance.now() - requestStartedAt } }));
          controller.close();
        } });
        return new Response(duplicateStream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' } });
      }
      if (duplicate) savedAnswer = { id: duplicate.id };
    } catch {
      return NextResponse.json({ error: 'Unable to check recent practice questions.' }, { status: 500 });
    }
  }

  if (!savedAnswer) {
    try {
      const pendingAnswer = await prisma.interviewAnswer.create({ data: {
        sessionId: interviewSession.id, question: parsed.data.question, answer: '',
      }, select: { id: true } });
      savedAnswer = pendingAnswer;
    } catch {
      return NextResponse.json({ error: 'Unable to save the detected question.' }, { status: 500 });
    }
  }

  let usageId: string | undefined;
  try {
    await enforceAIRateLimit(connection.userId);
    const usage = await prisma.aIUsage.create({ data: {
      userId: connection.userId, sessionId: interviewSession.id,
      provider: aiModel, model: aiModel, status: 'PENDING',
    }, select: { id: true } });
    usageId = usage.id;
  } catch (error) {
    if (error instanceof AIRateLimitError) return NextResponse.json({ error: error.message }, { status: 429, headers: { 'Retry-After': '60' } });
    return NextResponse.json({ error: 'Unable to prepare this answer right now.' }, { status: 500 });
  }

  const serverStartedAt = requestStartedAt;
  const streamAbort = new AbortController();
  request.signal.addEventListener('abort', () => streamAbort.abort(), { once: true });
  let streamClosed = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => { if (!streamClosed) controller.enqueue(eventFrame(event)); };
      try {
        send({ type: 'milestone', name: 'serverRequestStarted', timestampMs: 0 });
        send({ type: 'milestone', name: 'sessionContextRetrievalCompleted', timestampMs: contextRetrievedAt - serverStartedAt, durationMs: contextRetrievedAt - requestStartedAt });
        const generated = await streamInterviewAnswer(aiModel, {
          question: parsed.data.question,
          company: interviewSession.company,
          jobTitle: interviewSession.jobTitle,
          experience: interviewSession.experience,
          jobDescription: interviewSession.jobDescription,
          resumeText: interviewSession.resume?.userId === connection.userId ? interviewSession.resume.extractedText : null,
          answerLength: overrides?.answerLength || interviewSession.answerLength,
          answerFormat: overrides?.answerFormat || interviewSession.answerFormat,
          tone: interviewSession.tone,
          language: overrides?.language || interviewSession.language,
          technicalDepth: interviewSession.technicalDepth,
          customInstructions: interviewSession.customInstructions,
        }, (token) => send({ type: 'delta', token }), (milestone) => send({ type: 'milestone', ...milestone }), streamAbort.signal);

        const analysisJson = { confidence: generated.confidence, ...generated.analysis } as Prisma.InputJsonValue;
        const answer = savedAnswer
          ? await prisma.interviewAnswer.update({ where: { id: savedAnswer.id }, data: {
            question: parsed.data.question, answer: generated.text, questionType: generated.questionType,
            analysisJson,
            versions: { create: { answer: generated.text, provider: aiModel, model: generated.model, versionNumber: 1, action: 'INITIAL', validationWarnings: generated.validationWarnings as Prisma.InputJsonValue } },
          }, select: { id: true, createdAt: true } })
          : await prisma.interviewAnswer.create({ data: {
            sessionId: interviewSession.id, question: parsed.data.question, answer: generated.text, questionType: generated.questionType, analysisJson,
            versions: { create: { answer: generated.text, provider: aiModel, model: generated.model, versionNumber: 1, action: 'INITIAL', validationWarnings: generated.validationWarnings as Prisma.InputJsonValue } },
          }, select: { id: true, createdAt: true } });

        await prisma.aIUsage.update({ where: { id: usageId }, data: {
          model: generated.model, inputTokens: generated.inputTokens, outputTokens: generated.outputTokens, status: 'SUCCESS',
        } });
        send({ type: 'done', answer: {
          id: answer.id, question: parsed.data.question, answer: generated.text, questionType: generated.questionType,
          model: generated.model, provider: aiModel, createdAt: answer.createdAt.toISOString(),
          validationWarnings: generated.validationWarnings,
        }, timings: { serverTotalMs: performance.now() - serverStartedAt, ...generated.timings } });
      } catch (error) {
        if (usageId) await prisma.aIUsage.update({ where: { id: usageId }, data: { status: 'FAILED' } }).catch(() => undefined);
        send({ type: 'error', error: errorMessage(error) });
      } finally {
        if (!streamClosed) { streamClosed = true; controller.close(); }
      }
    },
    cancel() { streamClosed = true; streamAbort.abort(); },
  });

  return new Response(stream, { headers: {
    'Content-Type': 'application/x-ndjson; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'X-Accel-Buffering': 'no',
  } });
}
