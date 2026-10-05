import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { getNotifications } from '@/lib/notifications';
import { consumeRateLimit } from '@/lib/security/rate-limit';

export async function GET() {
  const auth = await getServerSession(authOptions);
  if (!auth?.user?.id) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  const limit = consumeRateLimit(`notifications:read:${auth.user.id}`, 60, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: 'Please wait before refreshing notifications.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } });
  return NextResponse.json(await getNotifications(auth.user.id));
}
