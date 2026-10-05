import { NextResponse } from 'next/server';
import { authenticateDesktop, hashDesktopSecret } from '@/lib/desktop-auth';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';

export async function POST(request: Request) {
  const connection = await authenticateDesktop(request, { allowExpiredSession: true });
  if (!connection) return NextResponse.json({ error: 'Session already disconnected.' }, { status: 401 });
  const token = request.headers.get('authorization')!.slice(7);
  await prisma.desktopConnection.updateMany({ where: { id: connection.id, tokenHash: hashDesktopSecret(token), revokedAt: null }, data: { revokedAt: new Date(), tokenHash: null, tokenExpiresAt: null } });
  await createNotification({ userId: connection.userId, type: 'DESKTOP_DISCONNECTED', category: 'DESKTOP', title: 'Desktop session disconnected', message: 'Your desktop app disconnected from the practice session.', actionUrl: `/interviews/${connection.sessionId}`, eventKey: `desktop:${connection.id}:disconnected` }).catch(() => undefined);
  return NextResponse.json({ disconnected: true });
}
