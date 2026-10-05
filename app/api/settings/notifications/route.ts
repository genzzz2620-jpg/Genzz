import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
const schema = z.object({ interview: z.boolean(), preparation: z.boolean(), resume: z.boolean(), desktop: z.boolean(), subscription: z.boolean(), system: z.boolean() });
export async function GET() {
  const auth = await getServerSession(authOptions);
  if (!auth?.user?.id) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  const preferences = await prisma.notificationPreference.upsert({ where: { userId: auth.user.id }, create: { userId: auth.user.id }, update: {} });
  return NextResponse.json({ preferences });
}
export async function PATCH(request: Request) {
  const auth = await getServerSession(authOptions);
  if (!auth?.user?.id) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid notification preferences.' }, { status: 400 });
  const preferences = await prisma.notificationPreference.upsert({ where: { userId: auth.user.id }, create: { ...parsed.data, userId: auth.user.id }, update: parsed.data });
  return NextResponse.json({ preferences });
}
