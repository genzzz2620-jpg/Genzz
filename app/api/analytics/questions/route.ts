import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { buildSessionFilter, normalizeCategory, parseAnalyticsFilters } from '@/lib/analytics/metrics';

const underlying: Record<string, string[]> = {
  HR: ['HR'], Behavioral: ['BEHAVIORAL'], Technical: ['TECHNICAL', 'DATABASE', 'NETWORKING', 'CLOUD', 'SECURITY', 'DEVOPS', 'SAP'],
  Project: ['PROJECT', 'RESUME_BASED'], Scenario: ['SITUATIONAL', 'SCENARIO_BASED'], Managerial: ['MANAGERIAL', 'LEADERSHIP'],
  'System Design': ['SYSTEM_DESIGN'], Coding: ['CODING'],
};
const knownQuestionTypes = ['HR', 'BEHAVIORAL', 'TECHNICAL', 'DATABASE', 'NETWORKING', 'CLOUD', 'SECURITY', 'DEVOPS', 'SAP', 'PROJECT', 'RESUME_BASED', 'SITUATIONAL', 'SCENARIO_BASED', 'MANAGERIAL', 'LEADERSHIP', 'SYSTEM_DESIGN', 'CODING'];

export async function GET(request: Request) {
  const auth = await getServerSession(authOptions);
  if (!auth?.user?.id) return NextResponse.json({ error: 'Please sign in to view practice questions.' }, { status: 401 });
  const url = new URL(request.url);
  try {
    const filters = parseAnalyticsFilters(url.searchParams);
    const parsedPage = Number(url.searchParams.get('page') || '1');
    if (!Number.isSafeInteger(parsedPage) || parsedPage < 1 || parsedPage > 1000) return NextResponse.json({ error: 'Choose a valid question page.' }, { status: 400 });
    const category = url.searchParams.get('category') || '';
    if (category && category !== 'Other' && !underlying[category]) return NextResponse.json({ error: 'Choose a valid question category.' }, { status: 400 });
    const sessionIdRaw = url.searchParams.get('sessionId');
    const sessionId = sessionIdRaw ? z.string().cuid().safeParse(sessionIdRaw) : null;
    if (sessionIdRaw && !sessionId?.success) return NextResponse.json({ error: 'Invalid session filter.' }, { status: 400 });
    const categoryWhere = category === 'Other' ? { OR: [{ questionType: null }, { questionType: { notIn: knownQuestionTypes } }] } : category ? { questionType: { in: underlying[category] } } : {};
    const where = { session: { is: { ...buildSessionFilter(auth.user.id, filters), ...(sessionId?.success ? { id: sessionId.data } : {}) } }, ...categoryWhere };
    const [total, rows] = await Promise.all([
      prisma.interviewAnswer.count({ where }),
      prisma.interviewAnswer.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (parsedPage - 1) * 20, take: 20, select: { id: true, question: true, answer: true, questionType: true, analysisJson: true, createdAt: true, session: { select: { id: true, jobTitle: true, company: true, status: true } } } }),
    ]);
    return NextResponse.json({ page: parsedPage, pageSize: 20, total, pages: Math.ceil(total / 20), questions: rows.map(row => {
      const analysis = row.analysisJson && typeof row.analysisJson === 'object' && !Array.isArray(row.analysisJson) ? row.analysisJson as Record<string, unknown> : {};
      const nested = analysis.analysis && typeof analysis.analysis === 'object' ? analysis.analysis as Record<string, unknown> : analysis;
      return { id: row.id, question: row.question, answer: row.answer, category: normalizeCategory(row.questionType), questionType: row.questionType, feedback: { strengths: Array.isArray(nested.strengths) ? nested.strengths : [], improvementAreas: Array.isArray(nested.improvementAreas) ? nested.improvementAreas : [], suggestedImprovement: typeof nested.suggestedImprovement === 'string' ? nested.suggestedImprovement : '' }, createdAt: row.createdAt.toISOString(), session: row.session };
    }) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load practice questions.' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } });
  }
}
