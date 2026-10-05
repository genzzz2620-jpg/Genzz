import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type RouteContext = { params: Promise<{ sessionId: string }> };

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { sessionId } = await params;
  const authSession = await getServerSession(authOptions);
  if (!authSession?.user?.id) return NextResponse.json({ error: 'Please sign in to delete practice history.' }, { status: 401 });
  try {
    const result = await prisma.interviewSession.deleteMany({ where: { id: sessionId, userId: authSession.user.id } });
    if (!result.count) return NextResponse.json({ error: 'Interview session not found.' }, { status: 404 });
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: 'Unable to delete this session right now.' }, { status: 500 });
  }
}
