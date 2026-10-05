import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const requestSchema = z.object({
  action: z.enum(['start', 'save', 'complete', 'skip']),
  step: z.number().int().min(1).max(3).optional(),
  name: z.string().trim().min(2).max(120).optional(),
  targetRole: z.string().trim().max(120).optional(),
  experienceLevel: z.enum(['Fresher', '1-2 Years', '3-5 Years', '6-8 Years', '8+ Years']).nullable().optional(),
  preferredLanguage: z.enum(['English', 'Hindi', 'Telugu', 'Tamil', 'Kannada', 'Malayalam', 'Marathi', 'Bengali']).nullable().optional(),
  preferredAnswerFormat: z.enum(['Normal', 'Bullet Points', 'Script', 'STAR', 'Technical Explanation']).nullable().optional(),
  preferredAIProvider: z.enum(['ChatGPT', 'Gemini']).nullable().optional(),
});

export async function PATCH(request: Request) {
  const authSession = await getServerSession(authOptions);
  if (!authSession?.user?.id) {
    return NextResponse.json({ error: 'Please sign in to save onboarding progress.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Review your onboarding details.' }, { status: 400 });
  }

  const { action, step, ...profile } = parsed.data;
  const data: Record<string, unknown> = {};
  if (profile.name !== undefined) data.name = profile.name;
  if (profile.targetRole !== undefined) data.targetRole = profile.targetRole || null;
  if (profile.experienceLevel !== undefined) data.experienceLevel = profile.experienceLevel;
  if (profile.preferredLanguage !== undefined) data.preferredLanguage = profile.preferredLanguage;
  if (profile.preferredAnswerFormat !== undefined) data.preferredAnswerFormat = profile.preferredAnswerFormat;
  if (profile.preferredAIProvider !== undefined) data.preferredAIProvider = profile.preferredAIProvider;

  if (action === 'start') {
    data.onboardingStatus = 'IN_PROGRESS';
    data.onboardingStep = 1;
  } else if (action === 'skip' || action === 'complete') {
    data.onboardingStatus = 'COMPLETED';
    data.onboardingStep = 0;
  } else {
    data.onboardingStatus = 'IN_PROGRESS';
    data.onboardingStep = step ?? 1;
  }

  try {
    const user = await prisma.user.update({
      where: { id: authSession.user.id },
      data,
      select: { onboardingStatus: true, onboardingStep: true },
    });
    return NextResponse.json(user);
  } catch {
    return NextResponse.json({ error: 'Unable to save onboarding progress right now.' }, { status: 500 });
  }
}
