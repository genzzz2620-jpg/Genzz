import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const experienceLevels = ['Fresher', '1-2 Years', '3-5 Years', '6-8 Years', '8+ Years'] as const;
const answerFormats = ['Normal', 'Bullet Points', 'Script', 'STAR', 'Technical Explanation'] as const;
const languages = ['English', 'Hindi', 'Telugu', 'Tamil', 'Kannada', 'Malayalam', 'Marathi', 'Bengali'] as const;
const aiProviders = ['ChatGPT', 'Gemini'] as const;

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Name must contain at least 2 characters.').max(120),
  targetRole: z.string().trim().max(120),
  experienceLevel: z.enum(experienceLevels).nullable(),
  preferredLanguage: z.enum(languages).nullable(),
  preferredAnswerFormat: z.enum(answerFormats).nullable(),
  preferredAIProvider: z.enum(aiProviders).nullable(),
}).strict();

export async function PATCH(request: Request) {
  const auth = await getServerSession(authOptions);
  if (!auth?.user?.id) return NextResponse.json({ error: 'Please sign in to update your settings.' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }); }

  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Review your settings.' }, { status: 400 });

  try {
    const current = await prisma.user.findUnique({ where: { id: auth.user.id }, select: { preferredAIProvider: true } });
    if (!current) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });

    const provider = parsed.data.preferredAIProvider;
    const providerConfigured = provider === 'ChatGPT'
      ? Boolean(process.env.OPENAI_API_KEY)
      : provider === 'Gemini'
        ? Boolean(process.env.GEMINI_API_KEY)
        : true;
    if (!providerConfigured && provider !== current.preferredAIProvider) {
      return NextResponse.json({ error: 'That AI provider is not configured on this server.' }, { status: 400 });
    }

    const profile = await prisma.user.update({
      where: { id: auth.user.id },
      data: {
        name: parsed.data.name,
        targetRole: parsed.data.targetRole || null,
        experienceLevel: parsed.data.experienceLevel,
        preferredLanguage: parsed.data.preferredLanguage,
        preferredAnswerFormat: parsed.data.preferredAnswerFormat,
        preferredAIProvider: provider,
      },
      select: {
        name: true,
        targetRole: true,
        experienceLevel: true,
        preferredLanguage: true,
        preferredAnswerFormat: true,
        preferredAIProvider: true,
      },
    });
    return NextResponse.json({ profile });
  } catch {
    return NextResponse.json({ error: 'Unable to save your settings right now.' }, { status: 500 });
  }
}
