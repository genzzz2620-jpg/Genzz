import { NotificationCategory, NotificationType, Prisma } from '@/prisma/generated/client';
import { prisma } from '@/lib/prisma';
import { consumeRateLimit } from '@/lib/security/rate-limit';

const categoryPreference: Record<NotificationCategory, keyof Pick<Prisma.NotificationPreferenceUncheckedCreateInput, 'interview' | 'preparation' | 'resume' | 'desktop' | 'subscription' | 'security' | 'system'>> = {
  INTERVIEW: 'interview', PREPARATION: 'preparation', RESUME: 'resume', DESKTOP: 'desktop',
  SUBSCRIPTION: 'subscription', SECURITY: 'security', SYSTEM: 'system',
};

const actions = [/^\/resumes\/[a-zA-Z0-9_-]+$/, /^\/preparation$/, /^\/subscription$/, /^\/interviews\/[a-zA-Z0-9_-]+$/];
export function safeNotificationAction(value?: string | null) {
  if (!value) return null;
  return value.length <= 300 && actions.some((pattern) => pattern.test(value)) ? value : null;
}

export async function createNotification(input: {
  userId: string; type: NotificationType; category: NotificationCategory; title: string; message: string;
  actionUrl?: string | null; eventKey?: string; metadata?: Prisma.InputJsonValue;
}) {
  const preference = await prisma.notificationPreference.findUnique({ where: { userId: input.userId }, select: { interview: true, preparation: true, resume: true, desktop: true, subscription: true, security: true, system: true } });
  const key = categoryPreference[input.category];
  if (preference && preference[key] === false) return null;
  if (input.title.length > 120 || input.message.length > 500) throw new Error('Notification text exceeds limits.');
  if (!consumeRateLimit(`notifications:create:${input.userId}`, 30, 60 * 60_000).allowed) return null;
  const data = { userId: input.userId, type: input.type, category: input.category, title: input.title, message: input.message, actionUrl: safeNotificationAction(input.actionUrl), eventKey: input.eventKey || null, metadata: input.metadata };
  try { return await prisma.notification.create({ data }); }
  catch (error) {
    if (input.eventKey && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return prisma.notification.findUnique({ where: { userId_eventKey: { userId: input.userId, eventKey: input.eventKey } } });
    throw error;
  }
}

export async function getNotifications(userId: string, limit = 50) {
  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: Math.min(100, Math.max(1, limit)) }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  return { items, unreadCount };
}

export async function markNotificationRead(userId: string, id: string) {
  return prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
}

export async function markAllNotificationsRead(userId: string) {
  return prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
}

export async function deleteNotification(userId: string, id: string) {
  return prisma.notification.deleteMany({ where: { id, userId } });
}
