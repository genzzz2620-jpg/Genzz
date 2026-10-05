import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { markAllNotificationsRead } from '@/lib/notifications';
export async function PATCH() {
  const auth = await getServerSession(authOptions);
  if (!auth?.user?.id) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  await markAllNotificationsRead(auth.user.id);
  return NextResponse.json({ success: true });
}
