import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { consumeRateLimit } from '@/lib/security/rate-limit';

export async function requireAdminPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return { userId: null, authorized: false };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, accountStatus: true },
  });

  return {
    userId: user?.id ?? null,
    authorized: user?.role === 'ADMIN' && user.accountStatus === 'ACTIVE',
  };
}

export async function requireAdminApi() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return { userId: null, response: NextResponse.json({ error: 'Authentication required.' }, { status: 401 }) };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, accountStatus: true },
  });

  if (!user || user.accountStatus !== 'ACTIVE') {
    return { userId: null, response: NextResponse.json({ error: 'Authentication required.' }, { status: 401 }) };
  }
  if (user.role !== 'ADMIN') {
    return { userId: null, response: NextResponse.json({ error: 'Forbidden.' }, { status: 403 }) };
  }
  const rate = consumeRateLimit(`admin-api:${user.id}`, 120, 60_000);
  if (!rate.allowed) return { userId: null, response: NextResponse.json({ error: 'Too many administrative requests. Try again shortly.' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } }) };
  return { userId: user.id, response: null };
}

export async function recordAdminAudit(
  actorId: string,
  action: string,
  targetType: string,
  targetId: string | null,
  details?: Record<string, unknown>,
) {
  await prisma.adminAuditLog.create({
    data: {
      actorId,
      action,
      targetType,
      targetId,
      ...(details ? { details: JSON.parse(JSON.stringify(details)) } : {}),
    },
  });
}
