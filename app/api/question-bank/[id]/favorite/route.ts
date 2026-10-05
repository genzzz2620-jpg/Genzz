import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type RouteContext = { params: Promise<{ id: string }> };

async function getAccessibleQuestion(questionId: string, userId: string) {
  return prisma.questionBankItem.findFirst({
    where: { id: questionId, status: 'PUBLISHED', OR: [{ userId: null }, { userId }] },
    select: { id: true },
  });
}

export async function POST(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Please sign in to save favorites.' }, { status: 401 });
  try {
    const question = await getAccessibleQuestion(id, session.user.id);
    if (!question) return NextResponse.json({ error: 'Question not found.' }, { status: 404 });
    await prisma.questionFavorite.upsert({
      where: { userId_questionId: { userId: session.user.id, questionId: question.id } },
      create: { userId: session.user.id, questionId: question.id },
      update: {},
    });
    return NextResponse.json({ isFavorite: true });
  } catch {
    return NextResponse.json({ error: 'Unable to update this favorite right now.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Please sign in to update favorites.' }, { status: 401 });
  try {
    const question = await getAccessibleQuestion(id, session.user.id);
    if (!question) return NextResponse.json({ error: 'Question not found.' }, { status: 404 });
    await prisma.questionFavorite.deleteMany({ where: { userId: session.user.id, questionId: question.id } });
    return NextResponse.json({ isFavorite: false });
  } catch {
    return NextResponse.json({ error: 'Unable to update this favorite right now.' }, { status: 500 });
  }
}
