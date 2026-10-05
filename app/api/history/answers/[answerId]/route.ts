import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type RouteContext = { params: Promise<{ answerId: string }> };

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { answerId } = await params;
  const authSession = await getServerSession(authOptions);
  if (!authSession?.user?.id) return NextResponse.json({ error: 'Please sign in to delete practice history.' }, { status: 401 });
  try {
    const result = await prisma.interviewAnswer.deleteMany({
      where: { id: answerId, session: { userId: authSession.user.id } },
    });
    if (!result.count) return NextResponse.json({ error: 'Practice answer not found.' }, { status: 404 });
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: 'Unable to delete this practice answer right now.' }, { status: 500 });
  }
}
