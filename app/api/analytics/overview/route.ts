import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { Prisma } from '@/prisma/generated/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getBalance, formatCredits } from '@/lib/billing/credits';
import { aggregateCategoryCounts, aggregateFeedback, buildSessionFilter, calculateStreak, parseAnalyticsFilters } from '@/lib/analytics/metrics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function object(value: unknown): Record<string, unknown> | null { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []; }
function text(value: unknown) { return typeof value === 'string' ? value : ''; }
function feedbackSource(sessionId: string, jobTitle: string, createdAt: Date, raw: unknown) {
  const data = object(raw); if (!data) return null;
  const nested = object(data.analysis) || data;
  return { sessionId, jobTitle, createdAt, strengths: nested.strengths, improvementAreas: nested.improvementAreas, suggestedImprovement: nested.suggestedImprovement };
}

function sqlSessionFilter(userId: string, filters: ReturnType<typeof parseAnalyticsFilters>) {
  const date = filters.from
    ? Prisma.sql`AND COALESCE(s."startedAt", s."createdAt") >= ${filters.from} AND COALESCE(s."startedAt", s."createdAt") < ${filters.to}`
    : Prisma.sql`AND COALESCE(s."startedAt", s."createdAt") < ${filters.to}`;
  const role = filters.role ? Prisma.sql`AND s."jobTitle" = ${filters.role}` : Prisma.empty;
  const company = filters.company ? Prisma.sql`AND s."company" = ${filters.company}` : Prisma.empty;
  const experience = filters.experience ? Prisma.sql`AND s."experience" = ${filters.experience}` : Prisma.empty;
  const session = filters.sessionId ? Prisma.sql`AND s."id" = ${filters.sessionId}` : Prisma.empty;
  return Prisma.sql`s."userId" = ${userId} AND s."status" IN ('ACTIVE', 'COMPLETED') ${date} ${role} ${company} ${experience} ${session}`;
}

export async function GET(request: Request) {
  const auth = await getServerSession(authOptions);
  if (!auth?.user?.id) return NextResponse.json({ error: 'Please sign in to view analytics.' }, { status: 401 });
  const url = new URL(request.url);
  let filters: ReturnType<typeof parseAnalyticsFilters>;
  try { filters = parseAnalyticsFilters(url.searchParams); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Choose a valid date range.' }, { status: 400 }); }
  const userId = auth.user.id;
  const sessionWhere = buildSessionFilter(userId, filters);
  const answerWhere = { session: { is: sessionWhere } };
  const rawSessionFilter = sqlSessionFilter(userId, filters);
  try {
    const [sessionStats, activeDurationRows, mockInterviewCount, answerCount, answerGroups, recentSessions, answerFeedback, taskGroups, taskEvents, savedQuestions, resumeCount, account, roleOptions, companyOptions, experienceOptions, activitySessions, activityAnswers, questionDuplicates, creditRows, practiceDays] = await Promise.all([
      prisma.interviewSession.aggregate({ where: sessionWhere, _count: { _all: true }, _sum: { durationSeconds: true } }),
      prisma.$queryRaw<Array<{ seconds: number }>>(Prisma.sql`SELECT COALESCE(SUM(GREATEST(0, EXTRACT(EPOCH FROM (NOW() - s."startedAt"))::int)), 0)::int AS seconds FROM "InterviewSession" s WHERE ${rawSessionFilter} AND s."status" = 'ACTIVE' AND s."startedAt" IS NOT NULL AND s."durationSeconds" IS NULL`),
      prisma.interviewSession.count({ where: { ...sessionWhere, isSimulator: true } }),
      prisma.interviewAnswer.count({ where: answerWhere }),
      prisma.interviewAnswer.groupBy({ by: ['questionType'], where: answerWhere, _count: { _all: true } }),
      prisma.interviewSession.findMany({ where: sessionWhere, orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }], take: 500, select: { id: true, jobTitle: true, company: true, experience: true, isSimulator: true, simulatorInterviewType: true, status: true, startedAt: true, completedAt: true, durationSeconds: true, createdAt: true, simulatorState: true, simulatorFeedback: true, _count: { select: { answers: true } } } }),
      prisma.interviewAnswer.findMany({ where: answerWhere, orderBy: { createdAt: 'desc' }, take: 500, select: { sessionId: true, createdAt: true, analysisJson: true, session: { select: { jobTitle: true } } } }),
      prisma.preparationTask.groupBy({ by: ['category', 'status'], where: { userId, plan: { is: { userId, status: 'ACTIVE', ...(filters.role ? { targetRole: filters.role } : {}), ...(filters.company ? { targetCompany: filters.company } : {}), ...(filters.experience ? { experienceLevel: filters.experience } : {}) } } }, _count: { _all: true } }),
      prisma.preparationTask.findMany({ where: { userId, status: 'COMPLETED', plan: { is: { userId, status: 'ACTIVE', ...(filters.role ? { targetRole: filters.role } : {}), ...(filters.company ? { targetCompany: filters.company } : {}), ...(filters.experience ? { experienceLevel: filters.experience } : {}) } } }, orderBy: { updatedAt: 'desc' }, take: 12, select: { id: true, title: true, category: true, updatedAt: true } }),
      prisma.questionBankItem.count({ where: { OR: [{ userId }, { favorites: { some: { userId } } }] } }),
      prisma.resume.count({ where: { userId } }),
      getBalance(userId),
      prisma.interviewSession.findMany({ where: { userId, status: { in: ['ACTIVE', 'COMPLETED'] } }, distinct: ['jobTitle'], orderBy: { jobTitle: 'asc' }, take: 100, select: { jobTitle: true } }),
      prisma.interviewSession.findMany({ where: { userId, status: { in: ['ACTIVE', 'COMPLETED'] } }, distinct: ['company'], orderBy: { company: 'asc' }, take: 100, select: { company: true } }),
      prisma.interviewSession.findMany({ where: { userId, status: { in: ['ACTIVE', 'COMPLETED'] }, experience: { not: null } }, distinct: ['experience'], orderBy: { experience: 'asc' }, take: 20, select: { experience: true } }),
      prisma.$queryRaw<Array<{ bucket: Date; sessions: number; seconds: number }>>(Prisma.sql`SELECT date_trunc(${filters.period === 'all' ? 'month' : 'day'}, COALESCE(s."startedAt", s."createdAt")) AS bucket, COUNT(*)::int AS sessions, COALESCE(SUM(CASE WHEN s."durationSeconds" IS NOT NULL THEN s."durationSeconds" WHEN s."status" = 'ACTIVE' AND s."startedAt" IS NOT NULL THEN GREATEST(0, EXTRACT(EPOCH FROM (NOW() - s."startedAt"))::int) ELSE 0 END), 0)::int AS seconds FROM "InterviewSession" s WHERE ${rawSessionFilter} GROUP BY 1 ORDER BY 1`),
      prisma.$queryRaw<Array<{ bucket: Date; questions: number }>>(Prisma.sql`SELECT date_trunc(${filters.period === 'all' ? 'month' : 'day'}, a."createdAt") AS bucket, COUNT(*)::int AS questions FROM "InterviewAnswer" a JOIN "InterviewSession" s ON s."id" = a."sessionId" WHERE ${rawSessionFilter} ${filters.from ? Prisma.sql`AND a."createdAt" >= ${filters.from} AND a."createdAt" < ${filters.to}` : Prisma.sql`AND a."createdAt" < ${filters.to}`} GROUP BY 1 ORDER BY 1`),
      prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`SELECT COUNT(*)::int AS count FROM (SELECT lower(regexp_replace(trim(a."question"), '\\s+', ' ', 'g')) AS q FROM "InterviewAnswer" a JOIN "InterviewSession" s ON s."id" = a."sessionId" WHERE ${rawSessionFilter} GROUP BY 1 HAVING COUNT(*) > 1) duplicates`),
      prisma.$queryRaw<Array<{ type: string; amountUnits: number; sessionId: string | null }>>(Prisma.sql`SELECT ct."type"::text AS type, SUM(ct."amountUnits")::int AS "amountUnits", ct."sessionId" FROM "CreditTransaction" ct JOIN "InterviewSession" s ON s."id" = ct."sessionId" WHERE ${rawSessionFilter} AND ct."userId" = ${userId} AND ct."type" IN ('SESSION_CONSUMPTION', 'SESSION_RESERVATION') GROUP BY ct."type", ct."sessionId"`),
      prisma.$queryRaw<Array<{ day: string }>>(Prisma.sql`SELECT DISTINCT date_trunc('day', COALESCE(s."startedAt", s."createdAt"))::date::text AS day FROM "InterviewSession" s WHERE ${rawSessionFilter} ORDER BY day`),
    ]);

    const sessions = recentSessions;
    const practiceSeconds = (sessionStats._sum.durationSeconds || 0) + (activeDurationRows[0]?.seconds || 0);
    const feedbackSources: Array<{ sessionId: string; createdAt: Date; jobTitle: string; strengths?: unknown; improvementAreas?: unknown; suggestedImprovement?: unknown }> = [];
    for (const row of answerFeedback) { const source = feedbackSource(row.sessionId, row.session.jobTitle, row.createdAt, row.analysisJson); if (source) feedbackSources.push(source); }
    for (const row of sessions) { const source = feedbackSource(row.id, row.jobTitle, row.completedAt || row.createdAt, row.simulatorFeedback); if (source) feedbackSources.push(source); }
    const feedback = aggregateFeedback(feedbackSources);
    const categories = aggregateCategoryCounts(answerGroups);
    const activity = mergeActivity(activitySessions, activityAnswers, filters.period === 'all');
    const currentDate = new Date();
    const daily = await getDailyMetrics(userId, sessionWhere, currentDate);
    const taskTotal = taskGroups.reduce((sum, row) => sum + row._count._all, 0);
    const taskComplete = taskGroups.filter(row => row.status === 'COMPLETED').reduce((sum, row) => sum + row._count._all, 0);
    const taskByCategory = new Map<string, { total: number; completed: number }>();
    for (const row of taskGroups) { const item = taskByCategory.get(row.category) || { total: 0, completed: 0 }; item.total += row._count._all; if (row.status === 'COMPLETED') item.completed += row._count._all; taskByCategory.set(row.category, item); }
    const streak = calculateStreak(practiceDays.map(row => row.day));
    const recentEvents = [
      ...sessions.flatMap(row => [
        ...(row.startedAt ? [{ id: `${row.id}:started`, at: row.startedAt.toISOString(), title: `Started practice · ${row.jobTitle}`, kind: 'session', sessionId: row.id }] : []),
        ...(row.completedAt ? [{ id: `${row.id}:completed`, at: row.completedAt.toISOString(), title: `Completed practice · ${row.jobTitle}`, kind: 'session', sessionId: row.id }] : []),
      ]),
      ...taskEvents.map(task => ({ id: task.id, at: task.updatedAt.toISOString(), title: `Completed preparation task · ${task.title}`, kind: 'preparation', sessionId: null })),
    ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30);
    const recentSessionCards = sessions.slice(0, 20).map(row => ({ id: row.id, role: row.jobTitle, company: row.company, experience: row.experience, type: row.isSimulator ? row.simulatorInterviewType || 'Mock Interview' : 'Practice', status: row.status, date: (row.startedAt || row.createdAt).toISOString(), questions: row._count.answers, durationSeconds: row.durationSeconds ?? deriveSimulatorDuration(row.simulatorState, row.status), feedbackAreas: strings(object(row.simulatorFeedback)?.improvementAreas).slice(0, 3) }));
    const spentUnits = creditRows.filter(row => row.type === 'SESSION_CONSUMPTION').reduce((sum, row) => sum + Math.abs(row.amountUnits), 0);
    const creditSessions = new Set(creditRows.filter(row => row.type === 'SESSION_CONSUMPTION').map(row => row.sessionId).filter(Boolean)).size;
    const summary = feedback.improvements[0] ? `Recent AI practice feedback has repeatedly identified ${feedback.improvements[0].label.toLowerCase()} as an area to work on.` : feedback.strengths[0] ? `Recent AI practice feedback has noted ${feedback.strengths[0].label.toLowerCase()} as a recurring strength.` : 'Complete more practice sessions with feedback to see recurring themes.';
    const recommended = feedback.improvements[0] ? { title: `Practice questions related to ${feedback.improvements[0].label.toLowerCase()}`, href: '/interview-simulator', reason: 'Based on a recurring area in your saved AI practice feedback.' } : taskEvents[0] ? { title: `Complete: ${taskEvents[0].title}`, href: '/preparation', reason: 'Based on your next completed-task history.' } : { title: 'Start a practice session for your target role', href: '/interviews/create', reason: 'Continue building your own practice history.' };
    const response = {
      filters: { period: filters.period, from: filters.from?.toISOString() || null, to: filters.to.toISOString(), role: filters.role, company: filters.company, experience: filters.experience, sessionId: filters.sessionId },
      overview: { practiceSessions: sessionStats._count._all, questionsAnswered: answerCount, practiceSeconds, preparationTasksCompleted: taskComplete, preparationTasksTotal: taskTotal, aiFeedbackSessions: feedback.feedbackSessions, mockInterviews: mockInterviewCount, creditsUsedUnits: spentUnits, creditsUsed: formatCredits(spentUnits), sessionsStartedWithCredits: creditSessions, creditsRemaining: account.availableUnits, resumes: resumeCount, questionsSaved: savedQuestions, questionsRepeated: questionDuplicates[0]?.count || 0 },
      activity,
      daily,
      categories,
      feedback: { ...feedback, insight: summary, sampleLimit: 500 },
      recommendation: recommended,
      preparation: { completed: taskComplete, total: taskTotal, percent: taskTotal ? Math.round(taskComplete * 100 / taskTotal) : null, byCategory: Array.from(taskByCategory.entries()).map(([category, value]) => ({ category, ...value })), recentCompleted: taskEvents.map(row => ({ title: row.title, category: row.category, date: row.updatedAt.toISOString() })), streak },
      recentSessions: recentSessionCards,
      timeline: recentEvents,
      options: { roles: roleOptions.map(row => row.jobTitle), companies: companyOptions.map(row => row.company), experiences: experienceOptions.map(row => row.experience).filter((value): value is string => Boolean(value)) },
      limitations: { practiceSecondsKnownForLegacySessions: true, feedbackBasedOnLatestRecords: Math.min(500, answerFeedback.length + sessions.filter(row => row.simulatorFeedback).length) },
    };
    if (url.searchParams.get('format') === 'csv') return csvResponse(response);
    return NextResponse.json(response, { headers: { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie, Authorization' } });
  } catch {
    return NextResponse.json({ error: 'Unable to load analytics.' }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } });
  }
}

function deriveSimulatorDuration(state: unknown, status: string) {
  const data = object(state); const start = text(data?.startedAt); const end = text(data?.endedAt);
  if (!start || !end || status !== 'COMPLETED') return null;
  const seconds = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000) - (typeof data?.pausedDurationSec === 'number' ? data.pausedDurationSec : 0);
  return Number.isFinite(seconds) ? Math.max(0, seconds) : null;
}

function mergeActivity(sessions: Array<{ bucket: Date; sessions: number; seconds: number }>, answers: Array<{ bucket: Date; questions: number }>, monthly: boolean) {
  const map = new Map<string, { date: string; sessions: number; questions: number; seconds: number }>();
  for (const row of sessions) { const date = row.bucket.toISOString().slice(0, monthly ? 7 : 10); map.set(date, { date, sessions: row.sessions, questions: 0, seconds: row.seconds }); }
  for (const row of answers) { const date = row.bucket.toISOString().slice(0, monthly ? 7 : 10); const point = map.get(date) || { date, sessions: 0, questions: 0, seconds: 0 }; point.questions = row.questions; map.set(date, point); }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

async function getDailyMetrics(userId: string, sessionWhere: ReturnType<typeof buildSessionFilter>, now: Date) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const week = new Date(today.getTime() - 6 * 86_400_000);
  const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [todaySessions, weekSessions, monthSessions, todayQuestions, weekQuestions, monthQuestions, todayDuration, weekDuration, monthDuration] = await Promise.all([
    prisma.interviewSession.count({ where: { ...sessionWhere, startedAt: { gte: today } } }),
    prisma.interviewSession.count({ where: { ...sessionWhere, startedAt: { gte: week } } }),
    prisma.interviewSession.count({ where: { ...sessionWhere, startedAt: { gte: month } } }),
    prisma.interviewAnswer.count({ where: { session: { is: sessionWhere }, createdAt: { gte: today } } }),
    prisma.interviewAnswer.count({ where: { session: { is: sessionWhere }, createdAt: { gte: week } } }),
    prisma.interviewAnswer.count({ where: { session: { is: sessionWhere }, createdAt: { gte: month } } }),
    prisma.interviewSession.aggregate({ where: { ...sessionWhere, startedAt: { gte: today } }, _sum: { durationSeconds: true } }),
    prisma.interviewSession.aggregate({ where: { ...sessionWhere, startedAt: { gte: week } }, _sum: { durationSeconds: true } }),
    prisma.interviewSession.aggregate({ where: { ...sessionWhere, startedAt: { gte: month } }, _sum: { durationSeconds: true } }),
  ]);
  return { today: { sessions: todaySessions, questions: todayQuestions, minutes: Math.round((todayDuration._sum.durationSeconds || 0) / 60) }, week: { sessions: weekSessions, questions: weekQuestions, minutes: Math.round((weekDuration._sum.durationSeconds || 0) / 60) }, month: { sessions: monthSessions, questions: monthQuestions, minutes: Math.round((monthDuration._sum.durationSeconds || 0) / 60) } };
}

function csvResponse(data: { overview: Record<string, unknown>; categories: Array<{ category: string; count: number }> }) {
  const entries = Object.entries(data.overview).map(([key, value]) => `${key},${csvValue(value)}`);
  const categories = ['category,count', ...data.categories.map(row => `${csvValue(row.category)},${row.count}`)];
  return new NextResponse(['metric,value', ...entries, '', ...categories].join('\r\n'), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="genzz-practice-analytics.csv"', 'Cache-Control': 'private, no-store' } });
}
function csvValue(value: unknown) { return `"${String(value ?? '').replaceAll('"', '""')}"`; }
