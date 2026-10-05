import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { AIConfigurationError, AIProviderError } from '@/lib/ai/errors';
import { getAIProvider } from '@/lib/ai/provider';
import { AIRateLimitError, enforceAIRateLimit } from '@/lib/ai/rate-limit';
import { prisma } from '@/lib/prisma';
import { questionCategories, questionDifficulties, questionExperienceLevels } from '@/lib/question-bank';

export const runtime = 'nodejs';

const generationSchema = z.object({
  company: z.string().trim().max(120).optional().default(''),
  jobTitle: z.string().trim().min(1).max(120),
  experience: z.enum(questionExperienceLevels),
  technology: z.string().trim().max(100).optional().default(''),
  category: z.enum(questionCategories),
  difficulty: z.enum(questionDifficulties),
  numberOfQuestions: z.number().int().min(1).max(12),
  aiModel: z.enum(['ChatGPT', 'Gemini']).default('ChatGPT'),
});

const generatedQuestionSchema = z.array(z.object({
  question: z.string().trim().min(8).max(1200),
  subcategory: z.string().trim().max(100).optional().default(''),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).optional().default([]),
  explanation: z.string().trim().max(1800).optional().default(''),
})).min(1).max(12);

function generationError(error: unknown) {
  if (error instanceof AIRateLimitError) return NextResponse.json({ error: error.message }, { status: 429, headers: { 'Retry-After': '60' } });
  if (error instanceof AIConfigurationError) return NextResponse.json({ error: error.message }, { status: 503 });
  if (error instanceof AIProviderError && error.kind === 'RATE_LIMIT') return NextResponse.json({ error: 'The selected AI provider is busy. Please wait and try again.' }, { status: 429, headers: { 'Retry-After': '60' } });
  return NextResponse.json({ error: 'Genzz AI could not generate practice questions right now. Please try again.' }, { status: 502 });
}

export async function POST(request: Request) {
  const authSession = await getServerSession(authOptions);
  if (!authSession?.user?.id) return NextResponse.json({ error: 'Please sign in to generate practice questions.' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const parsed = generationSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Check the generation details.' }, { status: 400 });

  let usageId: string | undefined;
  try {
    await enforceAIRateLimit(authSession.user.id);
    const usage = await prisma.aIUsage.create({
      data: { userId: authSession.user.id, sessionId: null, provider: parsed.data.aiModel, model: parsed.data.aiModel, feature: 'QUESTION_GENERATION', status: 'PENDING' },
      select: { id: true },
    });
    usageId = usage.id;

    const provider = getAIProvider(parsed.data.aiModel);
    const companyContext = parsed.data.company ? `Company context: ${parsed.data.company}. These must be original preparation prompts, not claims about actual or confidential interview questions.` : '';
    const response = await provider.generateText({
      systemInstruction: [
        'You are Genzz AI, creating original interview-practice questions for learning.',
        'Do not claim questions are real, confidential, guaranteed, or officially associated with an employer.',
        'Return only a JSON array. Each object must have question, subcategory, tags, and explanation fields.',
        'Create varied, role-appropriate questions and do not invent confidential company interview content.',
      ].join('\n'),
      prompt: [
        `Create ${parsed.data.numberOfQuestions} practice questions.`,
        `Category: ${parsed.data.category}`,
        `Difficulty: ${parsed.data.difficulty}`,
        `Experience: ${parsed.data.experience}`,
        `Job role: ${parsed.data.jobTitle}`,
        parsed.data.technology ? `Technology: ${parsed.data.technology}` : '',
        companyContext,
        'Explanation should briefly describe a useful answer approach, not provide a fabricated candidate story.',
      ].filter(Boolean).join('\n'),
    });

    const arrayText = response.text.match(/\[[\s\S]*\]/)?.[0];
    if (!arrayText) throw new AIProviderError('INVALID_RESPONSE');
    let rawQuestions: unknown;
    try {
      rawQuestions = JSON.parse(arrayText);
    } catch {
      throw new AIProviderError('INVALID_RESPONSE');
    }
    const questions = generatedQuestionSchema.safeParse(rawQuestions);
    if (!questions.success) throw new AIProviderError('INVALID_RESPONSE');

    const created = await prisma.$transaction(questions.data.slice(0, parsed.data.numberOfQuestions).map((item) => prisma.questionBankItem.create({
      data: {
        userId: authSession.user.id,
        question: item.question,
        category: parsed.data.category,
        subcategory: item.subcategory || null,
        difficulty: parsed.data.difficulty,
        experienceLevel: parsed.data.experience,
        technology: parsed.data.technology || null,
        company: parsed.data.company || null,
        jobRole: parsed.data.jobTitle,
        tags: item.tags,
        explanation: item.explanation || null,
        isAiGenerated: true,
      },
      select: { id: true, question: true, category: true, difficulty: true, isAiGenerated: true },
    })));

    await prisma.aIUsage.update({
      where: { id: usage.id },
      data: { model: response.model, inputTokens: response.inputTokens, outputTokens: response.outputTokens, status: 'SUCCESS' },
    });

    return NextResponse.json({
      questions: created,
      notice: parsed.data.company
        ? 'AI-generated practice question. Practice questions associated with this company/role; not guaranteed real or company-provided interview questions.'
        : 'AI-generated practice question. These are original practice prompts, not guaranteed real interview questions.',
    }, { status: 201 });
  } catch (error) {
    if (usageId) await prisma.aIUsage.update({ where: { id: usageId }, data: { status: 'FAILED' } }).catch(() => undefined);
    return generationError(error);
  }
}
