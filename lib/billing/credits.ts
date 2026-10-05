import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@/prisma/generated/client';

export const CREDIT_UNITS_PER_CREDIT = 100;
const FREE_LIMIT_PER_MONTH = nonnegativeInt(process.env.FREE_PRACTICE_SESSIONS_PER_MONTH, 1);
const FREE_COOLDOWN_HOURS = nonnegativeInt(process.env.FREE_PRACTICE_COOLDOWN_HOURS, 24);
const FREE_DURATION_MINUTES = positiveInt(process.env.FREE_PRACTICE_DURATION_MINUTES, 30);
const SESSION_COST_UNITS = positiveInt(process.env.PRACTICE_SESSION_COST_UNITS, CREDIT_UNITS_PER_CREDIT);

function nonnegativeInt(raw: string | undefined, fallback: number) {
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}
function positiveInt(raw: string | undefined, fallback: number) { const value = nonnegativeInt(raw, fallback); return value > 0 ? value : fallback; }

export class CreditServiceError extends Error {
  constructor(message: string, readonly status = 400, readonly code = 'CREDIT_ERROR') { super(message); }
}

export function formatCredits(units: number) {
  if (!Number.isSafeInteger(units)) throw new Error('Credit units must be an integer.');
  const sign = units < 0 ? '-' : '';
  const absolute = Math.abs(units);
  const whole = Math.floor(absolute / CREDIT_UNITS_PER_CREDIT);
  const fraction = String(absolute % CREDIT_UNITS_PER_CREDIT).padStart(2, '0').replace(/0+$/, '');
  return `${sign}${whole}${fraction ? `.${fraction}` : ''}`;
}

export function calculateSessionCost() { return SESSION_COST_UNITS; }
export function validateSessionCost(units: number) {
  if (!Number.isSafeInteger(units) || units <= 0) throw new CreditServiceError('Practice session pricing is not configured correctly.', 503, 'INVALID_SESSION_COST');
  return units;
}

async function ensureAccount(db: Prisma.TransactionClient | typeof prisma, userId: string) {
  return db.creditAccount.upsert({ where: { userId }, create: { userId }, update: {} });
}
async function holdAccountCredits(tx: Prisma.TransactionClient, accountId: string, units: number) {
  const updated = await tx.$queryRaw<Array<{ id: string }>>`UPDATE "CreditAccount" SET "reservedUnits" = "reservedUnits" + ${units}, "updatedAt" = NOW() WHERE "id" = ${accountId} AND ("balanceUnits" - "reservedUnits") >= ${units} RETURNING "id"`;
  return updated.length > 0;
}

async function serializable<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try { return await prisma.$transaction(operation, { isolationLevel: 'Serializable' }); }
    catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
      if (attempt === 2 || (code !== 'P2034' && code !== 'P2002')) throw error;
      await new Promise(resolve => setTimeout(resolve, 15 * (attempt + 1)));
    }
  }
  throw new CreditServiceError('Unable to safely update the credit wallet. Try again.', 409, 'CREDIT_CONFLICT');
}

export async function getBalance(userId: string) {
  const account = await ensureAccount(prisma, userId);
  return { balanceUnits: account.balanceUnits, reservedUnits: account.reservedUnits, availableUnits: account.balanceUnits - account.reservedUnits, balance: formatCredits(account.balanceUnits - account.reservedUnits) };
}

export async function addCredits(userId: string, units: number, idempotencyKey: string, metadata?: Prisma.InputJsonValue) {
  if (!Number.isSafeInteger(units) || units <= 0 || units > 1_000_000) throw new CreditServiceError('Invalid credit amount.');
  return serializable(tx => addCreditsInTransaction(tx, userId, units, idempotencyKey, metadata));
}

export async function addCreditsInTransaction(tx: Prisma.TransactionClient, userId: string, units: number, idempotencyKey: string, metadata?: Prisma.InputJsonValue) {
  if (!Number.isSafeInteger(units) || units <= 0 || units > 1_000_000) throw new CreditServiceError('Invalid credit amount.');
  const existing = await tx.creditTransaction.findUnique({ where: { idempotencyKey } });
  if (existing) return tx.creditAccount.findUniqueOrThrow({ where: { userId } });
  const account = await ensureAccount(tx, userId);
  if (account.balanceUnits > 2_147_483_647 - units) throw new CreditServiceError('Credit balance limit reached.', 409, 'BALANCE_LIMIT');
  await tx.creditAccount.update({ where: { id: account.id }, data: { balanceUnits: { increment: units } } });
  await tx.creditTransaction.create({ data: { userId, accountId: account.id, type: 'PURCHASE', amountUnits: units, idempotencyKey, metadata } });
  return tx.creditAccount.findUniqueOrThrow({ where: { id: account.id } });
}

export async function reserveCredits(userId: string, sessionId: string, amountUnits = calculateSessionCost()) {
  validateSessionCost(amountUnits);
  return serializable(async (tx) => {
    const existing = await tx.creditReservation.findUnique({ where: { sessionId } });
    if (existing) {
      if (existing.userId !== userId) throw new CreditServiceError('Session billing ownership mismatch.', 403, 'OWNERSHIP_MISMATCH');
      if (existing.status !== 'REFUNDED') return existing;
      const priorAccount = await tx.creditAccount.findUniqueOrThrow({ where: { id: existing.accountId } });
      if (!await holdAccountCredits(tx, priorAccount.id, amountUnits)) throw new CreditServiceError('Not enough credits. Add credits or use an eligible free practice session.', 402, 'INSUFFICIENT_CREDITS');
      const reservation = await tx.creditReservation.update({ where: { id: existing.id }, data: { status: 'RESERVED', amountUnits } });
      await tx.creditTransaction.create({ data: { userId, accountId: priorAccount.id, sessionId, type: 'SESSION_RESERVATION', amountUnits, idempotencyKey: `session-reserve-ledger:${sessionId}:${randomUUID()}` } });
      return reservation;
    }
    const account = await ensureAccount(tx, userId);
    if (!await holdAccountCredits(tx, account.id, amountUnits)) throw new CreditServiceError('Not enough credits. Add credits or use an eligible free practice session.', 402, 'INSUFFICIENT_CREDITS');
    const reservation = await tx.creditReservation.create({ data: { userId, accountId: account.id, sessionId, amountUnits, idempotencyKey: `session-reserve:${sessionId}` } });
    await tx.creditTransaction.create({ data: { userId, accountId: account.id, sessionId, type: 'SESSION_RESERVATION', amountUnits, idempotencyKey: `session-reserve-ledger:${sessionId}:${randomUUID()}` } });
    return reservation;
  });
}

export async function consumeCredits(userId: string, sessionId: string) {
  return serializable(async (tx) => {
    const reservation = await tx.creditReservation.findUnique({ where: { sessionId } });
    if (!reservation || reservation.userId !== userId) throw new CreditServiceError('No credit reservation exists for this session.', 409, 'RESERVATION_NOT_FOUND');
    if (reservation.status === 'CONSUMED') return reservation;
    if (reservation.status !== 'RESERVED') throw new CreditServiceError('This credit reservation is no longer available.', 409, 'RESERVATION_CLOSED');
    await tx.creditAccount.update({ where: { id: reservation.accountId }, data: { balanceUnits: { decrement: reservation.amountUnits }, reservedUnits: { decrement: reservation.amountUnits } } });
    await tx.creditReservation.update({ where: { id: reservation.id }, data: { status: 'CONSUMED' } });
    await tx.creditTransaction.create({ data: { userId, accountId: reservation.accountId, sessionId, type: 'SESSION_CONSUMPTION', amountUnits: -reservation.amountUnits, idempotencyKey: `session-consume:${sessionId}` } });
    return tx.creditReservation.findUniqueOrThrow({ where: { id: reservation.id } });
  });
}

export async function refundCredits(userId: string, sessionId: string, reason = 'Session refund') {
  return serializable(async (tx) => {
    const reservation = await tx.creditReservation.findUnique({ where: { sessionId } });
    if (!reservation) {
      const alreadyRefunded = await tx.creditTransaction.findUnique({ where: { idempotencyKey: `free-session-refund:${sessionId}` } });
      if (alreadyRefunded) return null;
      const free = await tx.creditTransaction.findUnique({ where: { idempotencyKey: `free-session:${sessionId}` } });
      if (!free || free.userId !== userId) return null;
      await tx.creditTransaction.delete({ where: { id: free.id } });
      await tx.creditTransaction.create({ data: { userId, accountId: free.accountId, sessionId, type: 'REFUND', amountUnits: 0, idempotencyKey: `free-session-refund:${sessionId}`, metadata: { reason, freeSession: true } } });
      await tx.interviewSession.updateMany({ where: { id: sessionId, userId }, data: { status: 'DRAFT', freePractice: false, practiceExpiresAt: null, startedAt: null } });
      return null;
    }
    if (reservation.userId !== userId || reservation.status === 'REFUNDED') return null;
    if (reservation.status === 'RESERVED') {
      await tx.creditAccount.update({ where: { id: reservation.accountId }, data: { reservedUnits: { decrement: reservation.amountUnits } } });
    } else if (reservation.status === 'CONSUMED') {
      await tx.creditAccount.update({ where: { id: reservation.accountId }, data: { balanceUnits: { increment: reservation.amountUnits } } });
      await tx.creditTransaction.create({ data: { userId, accountId: reservation.accountId, sessionId, type: 'REFUND', amountUnits: reservation.amountUnits, idempotencyKey: `session-refund:${sessionId}`, metadata: { reason } } });
    }
    return tx.creditReservation.update({ where: { id: reservation.id }, data: { status: 'REFUNDED' } });
  });
}

export async function validateFreeSession(userId: string, now = new Date()) {
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [usedThisMonth, latest] = await Promise.all([
    prisma.creditTransaction.count({ where: { userId, type: 'FREE_SESSION', createdAt: { gte: startOfMonth } } }),
    prisma.creditTransaction.findFirst({ where: { userId, type: 'FREE_SESSION' }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
  ]);
  const cooldownUntil = latest ? new Date(latest.createdAt.getTime() + FREE_COOLDOWN_HOURS * 60 * 60_000) : null;
  const eligible = usedThisMonth < FREE_LIMIT_PER_MONTH && (!cooldownUntil || cooldownUntil <= now);
  return { eligible, usedThisMonth, allowance: FREE_LIMIT_PER_MONTH, cooldownUntil: eligible ? null : cooldownUntil, durationMinutes: FREE_DURATION_MINUTES };
}

export async function startBilledSession(userId: string, sessionId: string) {
  const session = await prisma.interviewSession.findFirst({ where: { id: sessionId, userId }, select: { id: true, status: true, creditUnits: true, freePractice: true } });
  if (!session) throw new CreditServiceError('Practice session not found.', 404, 'SESSION_NOT_FOUND');
  if (session.status === 'ACTIVE' && (session.freePractice || session.creditUnits > 0)) return { free: session.freePractice, units: session.creditUnits, durationMinutes: FREE_DURATION_MINUTES };
  if (session.status !== 'DRAFT') throw new CreditServiceError('This practice session cannot be started.', 409, 'SESSION_NOT_STARTABLE');
  const freeStart = await serializable(async (tx) => {
    const account = await ensureAccount(tx, userId);
    await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "CreditAccount" WHERE "id" = ${account.id} FOR UPDATE`;
    const marker = await tx.creditTransaction.findUnique({ where: { idempotencyKey: `free-session:${sessionId}` } });
    if (marker) return { free: true, units: 0, durationMinutes: FREE_DURATION_MINUTES };
    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const [used, latest] = await Promise.all([
      tx.creditTransaction.count({ where: { userId, type: 'FREE_SESSION', createdAt: { gte: startOfMonth } } }),
      tx.creditTransaction.findFirst({ where: { userId, type: 'FREE_SESSION' }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    ]);
    if (used >= FREE_LIMIT_PER_MONTH || (latest && latest.createdAt.getTime() + FREE_COOLDOWN_HOURS * 60 * 60_000 > now.getTime())) return null;
    await tx.creditTransaction.create({ data: { userId, accountId: account.id, sessionId, type: 'FREE_SESSION', amountUnits: 0, idempotencyKey: `free-session:${sessionId}` } });
    const startedAt = new Date();
    const activated = await tx.interviewSession.updateMany({ where: { id: sessionId, userId, status: 'DRAFT' }, data: { status: 'ACTIVE', freePractice: true, creditUnits: 0, startedAt, practiceExpiresAt: new Date(startedAt.getTime() + FREE_DURATION_MINUTES * 60_000) } });
    if (!activated.count) throw new CreditServiceError('This practice session has already been started.', 409, 'SESSION_NOT_STARTABLE');
    return { free: true, units: 0, durationMinutes: FREE_DURATION_MINUTES };
  });
  if (freeStart) return freeStart;
  const cost = validateSessionCost(calculateSessionCost());
  try {
    await reserveCredits(userId, sessionId, cost);
    await consumeCredits(userId, sessionId);
    const startedAt = new Date();
    await prisma.interviewSession.update({ where: { id: sessionId }, data: { status: 'ACTIVE', freePractice: false, creditUnits: cost, startedAt, practiceExpiresAt: new Date(startedAt.getTime() + positiveInt(process.env.PAID_PRACTICE_DURATION_MINUTES, 60) * 60_000) } });
    return { free: false, units: cost, durationMinutes: positiveInt(process.env.PAID_PRACTICE_DURATION_MINUTES, 60) };
  } catch (error) {
    await refundCredits(userId, sessionId, 'Session did not start').catch(() => null);
    throw error;
  }
}

export async function getTransactions(userId: string, take = 50) {
  const rows = await prisma.creditTransaction.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: Math.min(100, Math.max(1, take)), select: { id: true, type: true, amountUnits: true, sessionId: true, metadata: true, createdAt: true } });
  return rows.map(row => ({ ...row, credits: formatCredits(Math.abs(row.amountUnits)), createdAt: row.createdAt.toISOString() }));
}

export const CREDIT_PACKS = [
  { id: 'starter', credits: 5, units: 500, priceId: process.env.STRIPE_CREDIT_PACK_STARTER_PRICE_ID || '' },
  { id: 'plus', credits: 15, units: 1500, priceId: process.env.STRIPE_CREDIT_PACK_PLUS_PRICE_ID || '' },
  { id: 'pro', credits: 40, units: 4000, priceId: process.env.STRIPE_CREDIT_PACK_PRO_PRICE_ID || '' },
] as const;

export function creditCheckoutIdempotencyKey(userId: string) { return `credit-checkout:${userId}:${randomUUID()}`; }
