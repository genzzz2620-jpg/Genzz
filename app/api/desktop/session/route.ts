import { NextResponse } from 'next/server';
import { authenticateDesktop } from '@/lib/desktop-auth';
import { prisma } from '@/lib/prisma';
import { getCurrentSubscription } from '@/lib/billing/subscription';
import { getBalance, validateFreeSession, calculateSessionCost, formatCredits } from '@/lib/billing/credits';

export async function GET(request: Request) {
  const connection = await authenticateDesktop(request);
  if (!connection) return NextResponse.json({ error: 'Session Expired. Reconnect from the web application.' }, { status: 401 });
  const session = connection.session;
  if (session.status !== 'ACTIVE') return NextResponse.json({ error: 'Session Expired' }, { status: 410 });
  const [subscription, balance, free] = await Promise.all([getCurrentSubscription(connection.userId), getBalance(connection.userId), validateFreeSession(connection.userId)]);
  const [questionCount, recentAnswers] = await Promise.all([
    prisma.interviewAnswer.count({ where: { sessionId: session.id } }),
    prisma.interviewAnswer.findMany({ where: { sessionId: session.id }, select: { id: true, question: true, answer: true, questionType: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 20 }),
  ]);
  const providers = [
    ...(process.env.OPENAI_API_KEY ? ['ChatGPT'] : []),
    ...(process.env.GEMINI_API_KEY ? ['Gemini'] : []),
  ];
  if (!providers.includes(session.aiModel)) providers.push(session.aiModel);
  return NextResponse.json({ expiresAt: connection.tokenExpiresAt?.toISOString(), profile: { name: connection.user.name }, access: { plan: subscription.plan, sessionEligible: true, freeSessionEligible: session.freePractice || free.eligible, free, credits: { enabled: true, balance: formatCredits(balance.availableUnits), balanceUnits: balance.availableUnits, reservedUnits: balance.reservedUnits, sessionCost: formatCredits(calculateSessionCost()), purchaseAvailable: true }, durationMinutes: session.practiceExpiresAt ? Math.max(0, Math.ceil((session.practiceExpiresAt.getTime() - Date.now()) / 60_000)) : null }, session: {
    id: session.id, company: session.company, jobTitle: session.jobTitle, experience: session.experience,
    aiModel: session.aiModel, language: session.language, answerLength: session.answerLength, answerFormat: session.answerFormat,
    resume: session.resume?.fileName || 'No Resume', status: 'ACTIVE', freePractice: session.freePractice, creditUnits: session.creditUnits, practiceExpiresAt: session.practiceExpiresAt?.toISOString() || null, connectedAt: connection.connectedAt?.toISOString() || null, providers, questionCount,
    recentAnswers: recentAnswers.map(answer => ({ ...answer, createdAt: answer.createdAt.toISOString() })),
  } }, { headers: { 'Cache-Control': 'no-store' } });
}
