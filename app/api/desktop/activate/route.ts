import { NextResponse } from 'next/server';
import { authenticateDesktop } from '@/lib/desktop-auth';
import { getCurrentSubscription } from '@/lib/billing/subscription';
import { formatCredits, validateFreeSession } from '@/lib/billing/credits';
import { prisma } from '@/lib/prisma';

// A desktop connection can only be issued for a server-created, owned ACTIVE
// interview session. Activation confirms that state and is safe to retry.
export async function POST(request: Request) {
  const connection = await authenticateDesktop(request);
  if (!connection) return NextResponse.json({ error: 'Session expired. Reconnect from the web application.' }, { status: 401 });
  if (connection.session.status !== 'ACTIVE') return NextResponse.json({ error: 'This practice session has expired.' }, { status: 410 });
  if (connection.session.practiceExpiresAt && connection.session.practiceExpiresAt <= new Date()) return NextResponse.json({ error: 'The practice session duration has ended.' }, { status: 410 });
  const [subscription, wallet, free] = await Promise.all([getCurrentSubscription(connection.userId), prisma.creditAccount.findUnique({ where: { userId: connection.userId }, select: { balanceUnits: true, reservedUnits: true } }), validateFreeSession(connection.userId)]);
  const durationMinutes = connection.session.practiceExpiresAt ? Math.max(0, Math.ceil((connection.session.practiceExpiresAt.getTime() - Date.now()) / 60_000)) : null;
  return NextResponse.json({ status: 'ACTIVE', plan: subscription.plan, session: { id: connection.sessionId, role: connection.session.jobTitle, company: connection.session.company }, billing: { free: connection.session.freePractice, creditUnits: connection.session.creditUnits, creditsUsed: formatCredits(connection.session.creditUnits), remainingCredits: formatCredits((wallet?.balanceUnits || 0) - (wallet?.reservedUnits || 0)), freeSessions: free }, durationMinutes, durationNotice: durationMinutes === null ? 'This practice session has no configured duration limit.' : `${durationMinutes} minutes remaining in this practice session.` }, { headers: { 'Cache-Control': 'no-store' } });
}
