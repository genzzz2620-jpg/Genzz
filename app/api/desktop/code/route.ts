import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { randomInt, createHash } from 'node:crypto';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { consumeRateLimit } from '@/lib/security/rate-limit';

const schema = z.object({ sessionId: z.string().cuid() });
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

export async function GET(request: Request) {
  const auth = await getServerSession(authOptions);
  if (!auth?.user?.id) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  const sessionId = new URL(request.url).searchParams.get('sessionId') || '';
  const parsed = z.string().cuid().safeParse(sessionId);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid practice session.' }, { status: 400 });
  const limit = consumeRateLimit(`desktop-code-status:${auth.user.id}`, 120, 5 * 60_000);
  if (!limit.allowed) return NextResponse.json({ error: 'Please wait before checking connection status.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } });
  const connection = await prisma.desktopConnection.findFirst({ where: { userId: auth.user.id, sessionId: parsed.data }, orderBy: { createdAt: 'desc' }, select: { connectedAt: true, revokedAt: true, tokenExpiresAt: true, codeExpiresAt: true, session: { select: { status: true } } } });
  if (!connection) return NextResponse.json({ state: 'DISCONNECTED' });
  if (connection.session.status !== 'ACTIVE') return NextResponse.json({ state: 'EXPIRED' });
  if (connection.revokedAt) return NextResponse.json({ state: 'DISCONNECTED' });
  if (connection.connectedAt && connection.tokenExpiresAt && connection.tokenExpiresAt > new Date()) return NextResponse.json({ state: 'CONNECTED' });
  if (connection.codeExpiresAt && connection.codeExpiresAt <= new Date()) return NextResponse.json({ state: 'EXPIRED' });
  return NextResponse.json({ state: 'CONNECTING' });
}

export async function POST(request: Request) {
  const auth = await getServerSession(authOptions);
  if (!auth?.user?.id) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });
  const limit = consumeRateLimit(`desktop-code:${auth.user.id}`, 10, 15 * 60_000);
  if (!limit.allowed) return NextResponse.json({ error: 'Too many connection code requests. Try again later.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Choose a valid interview session.' }, { status: 400 });
  const session = await prisma.interviewSession.findFirst({ where: { id: parsed.data.sessionId, userId: auth.user.id, status: 'ACTIVE' }, select: { id: true } });
  if (!session) return NextResponse.json({ error: 'Active interview session not found.' }, { status: 404 });
  const code = Array.from({ length: 8 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(32)]).join('');
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await prisma.desktopConnection.updateMany({ where: { userId: auth.user.id, sessionId: session.id, revokedAt: null }, data: { revokedAt: new Date() } });
  await prisma.desktopConnection.create({ data: { userId: auth.user.id, sessionId: session.id, codeHash: hash(code), codeExpiresAt: expiresAt } });
  return NextResponse.json({ code, expiresAt: expiresAt.toISOString() }, { headers: { 'Cache-Control': 'no-store' } });
}
