import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { Prisma } from '@/prisma/generated/client';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { questionCategories, questionDifficulties, questionExperienceLevels } from '@/lib/question-bank';

export const runtime = 'nodejs';

const questionSchema = z.object({
  question: z.string().trim().min(8).max(3000),
  category: z.enum(questionCategories),
  subcategory: z.string().trim().max(100).optional().nullable(),
  difficulty: z.enum(questionDifficulties).optional().nullable(),
  experienceLevel: z.enum(questionExperienceLevels).optional().nullable(),
  technology: z.string().trim().max(100).optional().nullable(),
  company: z.string().trim().max(120).optional().nullable(),
  jobRole: z.string().trim().max(120).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional().default([]),
  explanation: z.string().trim().max(3000).optional().nullable(),
});

export async function GET(request: Request) {
  const authSession = await getServerSession(authOptions);
  if (!authSession?.user?.id) {
    return NextResponse.json({ error: 'Please sign in to browse the question bank.' }, { status: 401 });
  }

  const searchParams = new URL(request.url).searchParams;
  const page = Math.max(1, Number(searchParams.get('page') || 1) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get('pageSize') || 20) || 20));
  const query = (searchParams.get('q') || '').trim().slice(0, 150);
  const category = searchParams.get('category') || '';
  const difficulty = searchParams.get('difficulty') || '';
  const experienceLevel = searchParams.get('experience') || '';
  const technology = (searchParams.get('technology') || '').trim().slice(0, 100);
  const jobRole = (searchParams.get('jobRole') || '').trim().slice(0, 120);
  const company = (searchParams.get('company') || '').trim().slice(0, 120);
  const favoritesOnly = searchParams.get('favorites') === 'true';
  const recentOnly = searchParams.get('recent') === 'true';

  if (category && !(questionCategories as readonly string[]).includes(category)) {
    return NextResponse.json({ error: 'Invalid category filter.' }, { status: 400 });
  }
  if (difficulty && !(questionDifficulties as readonly string[]).includes(difficulty)) {
    return NextResponse.json({ error: 'Invalid difficulty filter.' }, { status: 400 });
  }
  if (experienceLevel && !(questionExperienceLevels as readonly string[]).includes(experienceLevel)) {
    return NextResponse.json({ error: 'Invalid experience filter.' }, { status: 400 });
  }

  let recentIds: string[] | null = null;
  if (recentOnly) {
    const usedQuestions = await prisma.interviewAnswer.findMany({
      where: {
        questionBankItemId: { not: null },
        session: { userId: authSession.user.id },
      },
      select: { questionBankItemId: true },
      orderBy: { createdAt: 'desc' },
      distinct: ['questionBankItemId'],
      take: 1000,
    });
    recentIds = usedQuestions.map((item) => item.questionBankItemId).filter((id): id is string => Boolean(id));
    if (!recentIds.length) return NextResponse.json({ items: [], page, pageSize, total: 0, totalPages: 0 });
  }

  const conditions: Prisma.QuestionBankItemWhereInput[] = [
    { status: 'PUBLISHED' },
    { OR: [{ userId: null }, { userId: authSession.user.id }] },
  ];
  if (query) {
    conditions.push({
      OR: [
        { question: { contains: query, mode: 'insensitive' } },
        { explanation: { contains: query, mode: 'insensitive' } },
        { subcategory: { contains: query, mode: 'insensitive' } },
        { technology: { contains: query, mode: 'insensitive' } },
        { company: { contains: query, mode: 'insensitive' } },
        { jobRole: { contains: query, mode: 'insensitive' } },
        { tags: { has: query } },
      ],
    });
  }
  if (category) conditions.push({ category });
  if (difficulty) conditions.push({ difficulty });
  if (experienceLevel) conditions.push({ experienceLevel });
  if (technology) conditions.push({ technology: { contains: technology, mode: 'insensitive' } });
  if (jobRole) conditions.push({ jobRole: { contains: jobRole, mode: 'insensitive' } });
  if (company) conditions.push({ company: { contains: company, mode: 'insensitive' } });
  if (favoritesOnly) conditions.push({ favorites: { some: { userId: authSession.user.id } } });
  if (recentIds) conditions.push({ id: { in: recentIds } });

  const where: Prisma.QuestionBankItemWhereInput = { AND: conditions };
  const total = await prisma.questionBankItem.count({ where });
  const items = await prisma.questionBankItem.findMany({
    where,
    select: {
      id: true,
      question: true,
      category: true,
      questionType: true,
      subcategory: true,
      difficulty: true,
      experienceLevel: true,
      technology: true,
      company: true,
      jobRole: true,
      tags: true,
      explanation: true,
      isAiGenerated: true,
      userId: true,
      createdAt: true,
      favorites: { where: { userId: authSession.user.id }, select: { id: true } },
    },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return NextResponse.json({
    items: items.map(({ favorites, ...item }) => ({ ...item, isFavorite: favorites.length > 0, createdAt: item.createdAt.toISOString() })),
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  });
}

export async function POST(request: Request) {
  const authSession = await getServerSession(authOptions);
  if (!authSession?.user?.id) {
    return NextResponse.json({ error: 'Please sign in to add a question.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const parsed = questionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Check the question details.' }, { status: 400 });
  }

  try {
    const item = await prisma.questionBankItem.create({
      data: { ...parsed.data, userId: authSession.user.id, isAiGenerated: false },
      select: { id: true },
    });
    return NextResponse.json({ id: item.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Unable to save this question right now.' }, { status: 500 });
  }
}
