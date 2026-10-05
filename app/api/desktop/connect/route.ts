import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { consumeRateLimit, requestAddress } from '@/lib/security/rate-limit';
import { createNotification } from '@/lib/notifications';

const schema = z.object({ code: z.string().trim().toUpperCase().regex(/^[A-HJ-NP-Z2-9]{8}$/) });
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

export async function POST(request: Request) {
  const limit = consumeRateLimit(`desktop-connect:${requestAddress(request.headers)}`, 10, 10 * 60_000);
  if (!limit.allowed) return NextResponse.json({ error: 'Too many connection attempts. Try again later.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid Code' }, { status: 400 });
  const token = randomBytes(32).toString('base64url');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const result = await prisma.desktopConnection.updateMany({
    where: { codeHash: hash(parsed.data.code), codeExpiresAt: { gt: now }, revokedAt: null, session: { status: 'ACTIVE' }, user: { accountStatus: 'ACTIVE' } },
    data: { codeHash: null, codeExpiresAt: null, tokenHash: hash(token), tokenExpiresAt: expiresAt, connectedAt: now },
  });
  if (!result.count) return NextResponse.json({ error: 'Invalid or expired code. Create a new code from your web session.' }, { status: 401 });
  const connection = await prisma.desktopConnection.findFirst({ where: { tokenHash: hash(token) }, include: { session: { include: { resume: { select: { fileName: true } } } } } });
  if (!connection || connection.session.status !== 'ACTIVE') {
    await prisma.desktopConnection.updateMany({ where: { tokenHash: hash(token) }, data: { revokedAt: new Date() } });
    return NextResponse.json({ error: 'This interview session is no longer active.' }, { status: 409 });
  }
  await createNotification({ userId: connection.userId, type: 'DESKTOP_CONNECTED', category: 'DESKTOP', title: 'Desktop session connected', message: 'Your desktop app connected to an active practice session.', actionUrl: `/interviews/${connection.sessionId}`, eventKey: `desktop:${connection.id}:connected` }).catch(() => undefined);
  return NextResponse.json({ token, expiresAt: expiresAt.toISOString(), session: { id: connection.session.id, company: connection.session.company, jobTitle: connection.session.jobTitle, experience: connection.session.experience, aiModel: connection.session.aiModel, language: connection.session.language, resume: connection.session.resume?.fileName || 'No Resume' } }, { headers: { 'Cache-Control': 'no-store' } });
}
