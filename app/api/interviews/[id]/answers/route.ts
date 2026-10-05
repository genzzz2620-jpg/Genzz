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

type RouteContext = { params: Promise<{ id: string }> };

const requestSchema = z.object({
  question: z.string().min(1, 'Enter an interview question.').max(3000, 'Questions must be 3,000 characters or fewer.').refine((question) => question.trim().length > 0, 'Enter an interview question.'),
  questionBankItemId: z.string().cuid().nullable().optional(),
  aiModel: z.enum(['ChatGPT', 'Gemini']).optional(),
});

function providerFailure(error: unknown) {
  if (error instanceof AIConfigurationError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  if (error instanceof AIRateLimitError) {
    return NextResponse.json({ error: error.message }, { status: 429, headers: { 'Retry-After': '60' } });
  }
  if (error instanceof AIProviderError) {
    const messages = {
      RATE_LIMIT: 'The selected AI provider is rate-limiting requests. Please wait and try again.',
      TIMEOUT: 'Genzz AI timed out while preparing this answer. Please try again.',
      CONTEXT: 'This question and its reference context are too large. Shorten the job description or resume context and try again.',
      INVALID_RESPONSE: 'The selected AI provider returned an unusable answer. Please try again.',
      UNAVAILABLE: 'The selected AI provider is temporarily unavailable. Please try again.',
    } as const;
    const status = error.kind === 'RATE_LIMIT' ? 429 : error.kind === 'CONTEXT' ? 413 : 502;
    return NextResponse.json({ error: messages[error.kind] }, { status });
  }
  return NextResponse.json({ error: 'Genzz AI could not generate the answer right now. Please try again.' }, { status: 502 });
}

export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const authSession = await getServerSession(authOptions);
  if (!authSession?.user?.id) {
    return NextResponse.json({ error: 'Please sign in to generate a practice answer.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Enter an interview question.' }, { status: 400 });
  }

  let usageId: string | undefined;
  try {
    const interviewSession = await prisma.interviewSession.findFirst({
      where: { id: id, userId: authSession.user.id },
      include: { resume: { select: { userId: true, extractedText: true } } },
    });
    if (!interviewSession) {
      return NextResponse.json({ error: 'Interview session not found.' }, { status: 404 });
    }
    if (interviewSession.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'This interview session is no longer active.' }, { status: 409 });
    }

    if (parsed.data.questionBankItemId) {
      const bankItem = await prisma.questionBankItem.findFirst({
        where: {
          id: parsed.data.questionBankItemId,
          OR: [{ userId: null }, { userId: authSession.user.id }],
        },
        select: { id: true },
      });
      if (!bankItem) return NextResponse.json({ error: 'Practice question not found.' }, { status: 404 });
    }

    await enforceAIRateLimit(authSession.user.id);
    const usage = await prisma.aIUsage.create({
      data: {
        userId: authSession.user.id,
        sessionId: interviewSession.id,
        provider: parsed.data.aiModel || interviewSession.aiModel,
        model: parsed.data.aiModel || interviewSession.aiModel,
        status: 'PENDING',
      },
      select: { id: true },
    });
    usageId = usage.id;

    let generated;
    try {
      generated = await generateInterviewAnswer(parsed.data.aiModel || interviewSession.aiModel, {
        question: parsed.data.question,
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
      });
    } catch (error) {
      await prisma.aIUsage.update({ where: { id: usage.id }, data: { status: 'FAILED' } });
      return providerFailure(error);
    }

    const savedAnswer = await prisma.interviewAnswer.create({
      data: {
        sessionId: interviewSession.id,
        question: parsed.data.question,
        questionBankItemId: parsed.data.questionBankItemId || null,
        answer: generated.text,
        questionType: generated.questionType,
        analysisJson: {
          confidence: generated.confidence,
          ...generated.analysis,
        } as Prisma.InputJsonValue,
        versions: {
          create: {
            answer: generated.text,
            provider: parsed.data.aiModel || interviewSession.aiModel,
            model: generated.model,
            versionNumber: 1,
            action: 'INITIAL',
            validationWarnings: generated.validationWarnings as Prisma.InputJsonValue,
          },
        },
      },
      include: { versions: true },
    });

    await prisma.aIUsage.update({
      where: { id: usage.id },
      data: {
        model: generated.model,
        inputTokens: generated.inputTokens,
        outputTokens: generated.outputTokens,
        status: 'SUCCESS',
      },
    });

    return NextResponse.json({
      answer: {
        id: savedAnswer.id,
        question: savedAnswer.question,
        answer: generated.text,
        questionType: generated.questionType,
        validationWarnings: generated.validationWarnings,
        versions: savedAnswer.versions.map((version) => ({
          id: version.id,
          answer: version.answer,
          provider: version.provider,
          model: version.model,
          versionNumber: version.versionNumber,
          action: version.action,
          validationWarnings: version.validationWarnings,
          createdAt: version.createdAt.toISOString(),
        })),
        createdAt: savedAnswer.createdAt.toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    if (usageId) {
      await prisma.aIUsage.update({ where: { id: usageId }, data: { status: 'FAILED' } }).catch(() => undefined);
    }
    if (usageId) {
      return NextResponse.json({ error: 'Genzz AI could not generate the answer right now. Please try again.' }, { status: 502 });
    }
    if (error instanceof AIRateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429, headers: { 'Retry-After': '60' } });
    }
    return NextResponse.json({ error: 'Unable to access this interview session right now.' }, { status: 500 });
  }
}
