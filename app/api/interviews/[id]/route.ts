import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const updateSchema = z.object({ status: z.literal('COMPLETED') });

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const authSession = await getServerSession(authOptions);
  if (!authSession?.user?.id) {
    return NextResponse.json({ error: 'Please sign in to update this session.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid session status.' }, { status: 400 });
  }

  try {
    const session = await prisma.interviewSession.findFirst({ where: { id: id, userId: authSession.user.id }, select: { id: true, status: true, startedAt: true } });
    if (!session) return NextResponse.json({ error: 'Interview session not found.' }, { status: 404 });
    if (session.status === 'COMPLETED') return NextResponse.json({ status: 'COMPLETED' });
    if (session.status !== 'ACTIVE') return NextResponse.json({ error: 'Only active sessions can be ended.' }, { status: 409 });
    const completedAt = new Date();
    const durationSeconds = session.startedAt ? Math.max(0, Math.floor((completedAt.getTime() - session.startedAt.getTime()) / 1000)) : null;
    const result = await prisma.interviewSession.updateMany({
      where: { id: id, userId: authSession.user.id, status: 'ACTIVE' },
      data: { status: parsed.data.status, completedAt, durationSeconds },
    });
    if (result.count === 0) return NextResponse.json({ error: 'Only active sessions can be ended.' }, { status: 409 });

    return NextResponse.json({ status: 'COMPLETED' });
  } catch {
    return NextResponse.json({ error: 'Unable to update the session right now.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const authSession = await getServerSession(authOptions);
  if (!authSession?.user?.id) {
    return NextResponse.json({ error: 'Please sign in to delete this session.' }, { status: 401 });
  }

  try {
    const result = await prisma.interviewSession.deleteMany({
      where: { id: id, userId: authSession.user.id },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: 'Interview session not found.' }, { status: 404 });
    }
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: 'Unable to delete the session right now.' }, { status: 500 });
  }
}
