import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const schema = z.object({ title: z.string().trim().min(1).max(120).optional(), status: z.enum(['ACTIVE','COMPLETED','ARCHIVED']).optional() });
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }); }
  const parsed = schema.safeParse(body); if (!parsed.success) return NextResponse.json({ error: 'Invalid plan update.' }, { status: 400 });
  const result = await prisma.preparationPlan.updateMany({ where: { id: id, userId: session.user.id }, data: parsed.data });
  if (!result.count) return NextResponse.json({ error: 'Plan not found.' }, { status: 404 });
  return NextResponse.json({ success: true });
}
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  const result = await prisma.preparationPlan.deleteMany({ where: { id: id, userId: session.user.id } });
  return result.count ? NextResponse.json({ success: true }) : NextResponse.json({ error: 'Plan not found.' }, { status: 404 });
}
