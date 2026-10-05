import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { markNotificationRead } from '@/lib/notifications';
const idSchema = z.string().cuid();
export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getServerSession(authOptions);
  if (!auth?.user?.id) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: 'Invalid notification.' }, { status: 400 });
  const result = await markNotificationRead(auth.user.id, id);
  if (!result.count) return NextResponse.json({ error: 'Notification not found.' }, { status: 404 });
  return NextResponse.json({ success: true });
}
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await getServerSession(authOptions);
  if (!auth?.user?.id) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: 'Invalid notification.' }, { status: 400 });
  const result = await (await import('@/lib/notifications')).deleteNotification(auth.user.id, id);
  if (!result.count) return NextResponse.json({ error: 'Notification not found.' }, { status: 404 });
  return NextResponse.json({ success: true });
}
