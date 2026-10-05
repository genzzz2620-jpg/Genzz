import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Please sign in to view this question.' }, { status: 401 });
  try {
    const item = await prisma.questionBankItem.findFirst({
      where: { id: id, status: 'PUBLISHED', OR: [{ userId: null }, { userId: session.user.id }] },
      include: { favorites: { where: { userId: session.user.id }, select: { id: true } } },
    });
    if (!item) return NextResponse.json({ error: 'Question not found.' }, { status: 404 });
    const { favorites, ...question } = item;
    return NextResponse.json({ question: { ...question, isFavorite: favorites.length > 0 } });
  } catch {
    return NextResponse.json({ error: 'Unable to load this question right now.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Please sign in to delete this question.' }, { status: 401 });
  try {
    const result = await prisma.questionBankItem.deleteMany({ where: { id: id, userId: session.user.id } });
    if (!result.count) return NextResponse.json({ error: 'Question not found.' }, { status: 404 });
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: 'Unable to delete this question right now.' }, { status: 500 });
  }
}
