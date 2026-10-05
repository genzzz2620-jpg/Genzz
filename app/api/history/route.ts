import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { questionTypes } from '@/lib/ai/types';

export async function GET(request: Request) {
  const authSession = await getServerSession(authOptions);
  if (!authSession?.user?.id) return NextResponse.json({ error: 'Please sign in to view practice history.' }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const page = Math.max(1, Number(params.get('page') || 1) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(params.get('pageSize') || 20) || 20));
  const company = (params.get('company') || '').trim().slice(0, 120);
  const jobRole = (params.get('jobRole') || '').trim().slice(0, 120);
  const provider = params.get('provider') || '';
  const questionType = params.get('questionType') || '';
  const from = params.get('from') || '';
  const to = params.get('to') || '';

  if (provider && !['ChatGPT', 'Gemini'].includes(provider)) return NextResponse.json({ error: 'Invalid AI provider filter.' }, { status: 400 });
  if (questionType && !(questionTypes as readonly string[]).includes(questionType)) return NextResponse.json({ error: 'Invalid question type filter.' }, { status: 400 });
  const createdAt: { gte?: Date; lte?: Date } = {};
  if (from) {
    const date = new Date(from);
    if (!Number.isFinite(date.getTime())) return NextResponse.json({ error: 'Invalid start date.' }, { status: 400 });
    createdAt.gte = date;
  }
  if (to) {
    const date = new Date(to);
    if (!Number.isFinite(date.getTime())) return NextResponse.json({ error: 'Invalid end date.' }, { status: 400 });
    date.setUTCHours(23, 59, 59, 999);
    createdAt.lte = date;
  }

  const where = {
    userId: authSession.user.id,
    ...(company ? { company: { contains: company, mode: 'insensitive' as const } } : {}),
    ...(jobRole ? { jobTitle: { contains: jobRole, mode: 'insensitive' as const } } : {}),
    ...(provider ? { aiModel: provider } : {}),
    ...(Object.keys(createdAt).length ? { createdAt } : {}),
    ...(questionType ? { answers: { some: { questionType } } } : {}),
  };

  try {
    const [total, sessions] = await Promise.all([
      prisma.interviewSession.count({ where }),
      prisma.interviewSession.findMany({
        where,
        select: {
          id: true,
          company: true,
          jobTitle: true,
          experience: true,
          aiModel: true,
          status: true,
          createdAt: true,
          resume: { select: { fileName: true } },
          _count: { select: { answers: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return NextResponse.json({
      sessions: sessions.map((session) => ({
        ...session,
        resumeName: session.resume?.fileName || null,
        questionCount: session._count.answers,
        createdAt: session.createdAt.toISOString(),
      })),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch {
    return NextResponse.json({ error: 'Unable to load practice history right now.' }, { status: 500 });
  }
}
