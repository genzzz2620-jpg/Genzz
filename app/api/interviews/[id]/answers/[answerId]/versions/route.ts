import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { Prisma } from '@/prisma/generated/client';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { generateInterviewAnswer } from '@/lib/ai/ai-service';
import { AIConfigurationError, AIProviderError } from '@/lib/ai/errors';
import { AIRateLimitError, enforceAIRateLimit } from '@/lib/ai/rate-limit';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string; answerId: string }> };

const versionActions = ['REGENERATE', 'SHORTER', 'LONGER', 'SIMPLIFY', 'TECHNICAL', 'FORMAL', 'CONVERSATIONAL', 'BULLET', 'SCRIPT', 'STAR', 'EDIT'] as const;
const requestSchema = z.object({
  action: z.enum(versionActions),
  editedAnswer: z.string().min(1).max(20000).optional(),
  aiModel: z.enum(['ChatGPT', 'Gemini']).optional(),
});

function providerErrorResponse(error: unknown) {
  if (error instanceof AIConfigurationError) return NextResponse.json({ error: error.message }, { status: 503 });
  if (error instanceof AIRateLimitError) return NextResponse.json({ error: error.message }, { status: 429, headers: { 'Retry-After': '60' } });
  if (error instanceof AIProviderError) {
    const message = error.kind === 'RATE_LIMIT'
      ? 'The selected AI provider is rate-limiting requests. Please wait and try again.'
      : error.kind === 'TIMEOUT'
        ? 'Genzz AI timed out while preparing this answer. Please try again.'
        : error.kind === 'CONTEXT'
          ? 'This question and its reference context are too large. Reduce the session context and try again.'
          : error.kind === 'INVALID_RESPONSE'
            ? 'The selected AI provider returned an unusable answer. Please try again.'
            : 'The selected AI provider is temporarily unavailable. Please try again.';
    return NextResponse.json({ error: message }, { status: error.kind === 'RATE_LIMIT' ? 429 : error.kind === 'CONTEXT' ? 413 : 502 });
  }
  return NextResponse.json({ error: 'Genzz AI could not update this answer right now. Please try again.' }, { status: 502 });
}

function applyAction(action: Exclude<(typeof versionActions)[number], 'EDIT'>, context: {
  answerLength: string;
  answerFormat: string;
  tone: string;
  technicalDepth: string;
}) {
  const next = { ...context };
  if (action === 'SHORTER') next.answerLength = 'Short';
  if (action === 'LONGER') next.answerLength = 'Long';
  if (action === 'SIMPLIFY') next.tone = 'Simple';
  if (action === 'TECHNICAL') next.technicalDepth = 'DEEP';
  if (action === 'FORMAL') next.tone = 'Formal';
  if (action === 'CONVERSATIONAL') next.tone = 'Conversational';
  if (action === 'BULLET') next.answerFormat = 'Bullet Points';
  if (action === 'SCRIPT') next.answerFormat = 'Script';
  if (action === 'STAR') next.answerFormat = 'STAR';
  return next;
}

export async function POST(request: Request, { params }: RouteContext) {
  const { id, answerId } = await params;
  const authSession = await getServerSession(authOptions);
  if (!authSession?.user?.id) {
    return NextResponse.json({ error: 'Please sign in to update a practice answer.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Choose a valid answer action.' }, { status: 400 });
  }
  if (parsed.data.action === 'EDIT' && !parsed.data.editedAnswer?.trim()) {
    return NextResponse.json({ error: 'Enter the edited answer before saving.' }, { status: 400 });
  }

  let usageId: string | undefined;
  try {
    const interviewSession = await prisma.interviewSession.findFirst({
      where: { id: id, userId: authSession.user.id },
      include: { resume: { select: { userId: true, extractedText: true } } },
    });
    if (!interviewSession) return NextResponse.json({ error: 'Interview session not found.' }, { status: 404 });

    const savedQuestion = await prisma.interviewAnswer.findFirst({
      where: { id: answerId, sessionId: interviewSession.id },
      include: { versions: { orderBy: { versionNumber: 'desc' } } },
    });
    if (!savedQuestion) return NextResponse.json({ error: 'Practice question not found.' }, { status: 404 });
    const selectedModel = parsed.data.aiModel || interviewSession.aiModel;

    let answerText = parsed.data.editedAnswer?.trim() || '';
    let provider = 'USER';
    let model = 'Manual edit';
    let warnings: string[] = [];
    const nextAction = parsed.data.action;

    if (parsed.data.action !== 'EDIT') {
      if (interviewSession.status !== 'ACTIVE') {
        return NextResponse.json({ error: 'This interview session is no longer active.' }, { status: 409 });
      }
      if (interviewSession.practiceExpiresAt && interviewSession.practiceExpiresAt <= new Date()) return NextResponse.json({ error: 'This practice session has reached its time limit.' }, { status: 410 });
      await enforceAIRateLimit(authSession.user.id);
      const usage = await prisma.aIUsage.create({
        data: {
          userId: authSession.user.id,
          sessionId: interviewSession.id,
          provider: selectedModel,
          model: selectedModel,
          status: 'PENDING',
        },
        select: { id: true },
      });
      usageId = usage.id;
      provider = selectedModel;

      try {
        const action = parsed.data.action;
        const answerContext = {
          question: savedQuestion.question,
          company: interviewSession.company,
          jobTitle: interviewSession.jobTitle,
          experience: interviewSession.experience,
          jobDescription: interviewSession.jobDescription,
          resumeText: interviewSession.resume?.userId === authSession.user.id ? interviewSession.resume.extractedText : null,
          answerLength: interviewSession.answerLength,
          answerFormat: interviewSession.answerFormat,
          tone: interviewSession.tone,
          language: interviewSession.language,
          technicalDepth: interviewSession.technicalDepth,
          customInstructions: interviewSession.customInstructions,
        };
        const generated = await generateInterviewAnswer(selectedModel, {
          ...answerContext,
          ...applyAction(action, answerContext),
        }, {
          action,
          previousAnswers: savedQuestion.versions.map((version) => version.answer),
        });
        answerText = generated.text;
        model = generated.model;
        warnings = generated.validationWarnings;
        await prisma.aIUsage.update({
          where: { id: usage.id },
          data: { model, inputTokens: generated.inputTokens, outputTokens: generated.outputTokens, status: 'SUCCESS' },
        });
      } catch (error) {
        await prisma.aIUsage.update({ where: { id: usage.id }, data: { status: 'FAILED' } });
        return providerErrorResponse(error);
      }
    }

    const nextVersionNumber = savedQuestion.versions.length
      ? savedQuestion.versions[0].versionNumber + 1
      : 2;
    const version = await prisma.answerVersion.create({
      data: {
        interviewAnswerId: savedQuestion.id,
        answer: answerText,
        provider,
        model,
        versionNumber: nextVersionNumber,
        action: nextAction,
        validationWarnings: warnings as Prisma.InputJsonValue,
      },
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
    });

    return NextResponse.json({ version: { ...version, createdAt: version.createdAt.toISOString() } }, { status: 201 });
  } catch (error) {
    if (usageId) {
      await prisma.aIUsage.update({ where: { id: usageId }, data: { status: 'FAILED' } }).catch(() => undefined);
    }
    if (error instanceof AIRateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429, headers: { 'Retry-After': '60' } });
    }
    return NextResponse.json({ error: 'Unable to update this practice answer right now.' }, { status: 500 });
  }
}
