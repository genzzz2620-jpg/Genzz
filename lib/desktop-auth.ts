import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';

export const hashDesktopSecret = (value: string) => createHash('sha256').update(value).digest('hex');
export const newDesktopSecret = (bytes = 32) => randomBytes(bytes).toString('base64url');

export async function authenticateDesktop(request: Request, options: { allowExpiredSession?: boolean } = {}) {
  const header = request.headers.get('authorization') || '';
  const token = /^Bearer ([A-Za-z0-9_-]{32,})$/.exec(header)?.[1];
  if (!token) return null;
  const connection = await prisma.desktopConnection.findFirst({
    where: { tokenHash: hashDesktopSecret(token), revokedAt: null, tokenExpiresAt: { gt: new Date() }, user: { accountStatus: 'ACTIVE' } },
    include: { user: { select: { name: true } }, session: { include: { resume: { select: { id: true, fileName: true, extractedText: true, userId: true } } } } },
  });
  if (!connection || connection.session.userId !== connection.userId) return null;
  if (!options.allowExpiredSession && connection.session.practiceExpiresAt && connection.session.practiceExpiresAt <= new Date()) return null;
  return connection;
}
