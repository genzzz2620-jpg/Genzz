import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { getBalance, getTransactions, validateFreeSession, calculateSessionCost, formatCredits, CREDIT_PACKS } from '@/lib/billing/credits';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export async function GET() {
  const auth = await getServerSession(authOptions);
  if (!auth?.user?.id) return NextResponse.json({ error: 'Please sign in to view your credits.' }, { status: 401 });
  const [balance, transactions, freeSession] = await Promise.all([getBalance(auth.user.id), getTransactions(auth.user.id), validateFreeSession(auth.user.id)]);
  const recentCheckouts = await prisma.creditCheckout.findMany({ where: { userId: auth.user.id }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, packId: true, amountUnits: true, status: true, createdAt: true } });
  return NextResponse.json({ balance: { ...balance, reserved: formatCredits(balance.reservedUnits), display: `${formatCredits(balance.availableUnits)} Credits` }, transactions, recentCheckouts: recentCheckouts.map(row => ({ ...row, credits: formatCredits(row.amountUnits), createdAt: row.createdAt.toISOString() })), packs: CREDIT_PACKS.map(pack => ({ id: pack.id, credits: pack.credits, available: Boolean(pack.priceId) })), session: { costUnits: calculateSessionCost(), cost: formatCredits(calculateSessionCost()), free: freeSession } }, { headers: { 'Cache-Control': 'private, no-store' } });
}
