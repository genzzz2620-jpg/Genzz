import { PrismaClient } from '@/prisma/generated/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; slowQueryMiddlewareInstalled?: boolean };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'],
  });

if (!globalForPrisma.slowQueryMiddlewareInstalled) {
  prisma.$use(async (params, next) => {
    const startedAt = Date.now();
    try {
      const result = await next(params);
      const durationMs = Date.now() - startedAt;
      if (durationMs >= 250) console.warn(JSON.stringify({ event: 'db.slow_query', model: params.model || 'raw', action: params.action, durationMs }));
      return result;
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      console.error(JSON.stringify({ event: 'db.query_failed', model: params.model || 'raw', action: params.action, durationMs, errorType: error instanceof Error ? error.name : 'UnknownError' }));
      throw error;
    }
  });
  globalForPrisma.slowQueryMiddlewareInstalled = true;
}

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
