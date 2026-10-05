export type AnalyticsFilters = { period: '7' | '30' | '90' | 'all' | 'custom'; from: Date | null; to: Date; role: string; company: string; experience: string; sessionId: string };

export function parseAnalyticsFilters(params: URLSearchParams, now = new Date()): AnalyticsFilters {
  const period = params.get('period') || '30';
  if (!['7', '30', '90', 'all', 'custom'].includes(period)) throw new Error('Choose a valid date range.');
  let from: Date | null = null;
  let to = new Date(now);
  if (period === 'custom') {
    const start = params.get('from') || '';
    const end = params.get('to') || '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) throw new Error('Choose both custom dates.');
    from = new Date(`${start}T00:00:00.000Z`);
    const inclusiveEnd = new Date(`${end}T00:00:00.000Z`);
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(inclusiveEnd.getTime()) || from > inclusiveEnd || inclusiveEnd > now) throw new Error('Choose a valid date range ending today or earlier.');
    if (inclusiveEnd.getTime() - from.getTime() > 366 * 24 * 60 * 60_000) throw new Error('Custom date ranges can span up to 366 days.');
    to = new Date(inclusiveEnd.getTime() + 24 * 60 * 60_000);
  } else if (period !== 'all') from = new Date(now.getTime() - Number(period) * 24 * 60 * 60_000);
  const role = (params.get('role') || '').trim();
  const company = (params.get('company') || '').trim();
  const experience = (params.get('experience') || '').trim();
  const sessionId = (params.get('sessionId') || '').trim();
  if (role.length > 120 || company.length > 120 || experience.length > 40) throw new Error('A filter value is too long.');
  if (sessionId && !/^c[a-z0-9]{20,30}$/.test(sessionId)) throw new Error('Choose a valid session.');
  return { period: period as AnalyticsFilters['period'], from, to, role, company, experience, sessionId };
}

export function buildSessionFilter(userId: string, filters: AnalyticsFilters) {
  const and: Record<string, unknown>[] = [{ status: { in: ['ACTIVE', 'COMPLETED'] } }];
  if (filters.from) and.push({ OR: [{ startedAt: { gte: filters.from, lt: filters.to } }, { startedAt: null, createdAt: { gte: filters.from, lt: filters.to } }] });
  else and.push({ OR: [{ startedAt: { lt: filters.to } }, { startedAt: null, createdAt: { lt: filters.to } }] });
  if (filters.role) and.push({ jobTitle: filters.role });
  if (filters.company) and.push({ company: filters.company });
  if (filters.experience) and.push({ experience: filters.experience });
  if (filters.sessionId) and.push({ id: filters.sessionId });
  return { userId, AND: and };
}

export function normalizeCategory(raw: string | null | undefined) {
  const value = (raw || '').trim().toUpperCase().replace(/[\s/-]+/g, '_');
  if (!value) return 'Other';
  if (value === 'HR') return 'HR';
  if (value === 'BEHAVIORAL') return 'Behavioral';
  if (value === 'TECHNICAL' || ['DATABASE', 'NETWORKING', 'CLOUD', 'SECURITY', 'DEVOPS', 'SAP'].includes(value)) return 'Technical';
  if (value === 'PROJECT' || value === 'RESUME_BASED') return 'Project';
  if (value === 'SITUATIONAL' || value === 'SCENARIO_BASED') return 'Scenario';
  if (value === 'MANAGERIAL' || value === 'LEADERSHIP') return 'Managerial';
  if (value === 'SYSTEM_DESIGN') return 'System Design';
  if (value === 'CODING') return 'Coding';
  return 'Other';
}

export function aggregateCategoryCounts(groups: Array<{ questionType: string | null; _count: { _all: number } }>) {
  const counts = new Map<string, number>();
  for (const group of groups) {
    const category = normalizeCategory(group.questionType);
    counts.set(category, (counts.get(category) || 0) + group._count._all);
  }
  return Array.from(counts.entries()).map(([category, count]) => ({ category, count })).filter(row => row.count > 0).sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
}

export function calculateStreak(dayStrings: string[], today = new Date()) {
  const days = Array.from(new Set(dayStrings)).sort();
  if (!days.length) return { current: 0, longest: 0 };
  const dayMs = 24 * 60 * 60_000;
  const dayNumber = (s: string) => Math.floor(new Date(`${s.slice(0, 10)}T00:00:00.000Z`).getTime() / dayMs);
  let longest = 0, run = 0, previous = -2;
  for (const day of days) { const n = dayNumber(day); run = n === previous + 1 ? run + 1 : 1; previous = n; longest = Math.max(longest, run); }
  const todayNumber = Math.floor(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) / dayMs);
  const last = dayNumber(days[days.length - 1]);
  let current = 0;
  if (last === todayNumber || last === todayNumber - 1) {
    current = 1;
    for (let i = days.length - 1; i > 0; i -= 1) { if (dayNumber(days[i]) - dayNumber(days[i - 1]) !== 1) break; current += 1; }
  }
  return { current, longest };
}

export type FeedbackSource = { sessionId: string; createdAt: Date | string; jobTitle: string; strengths?: unknown; improvementAreas?: unknown; feedback?: unknown; suggestedImprovement?: unknown; overallSummary?: unknown; communication?: unknown; technicalDepth?: unknown; answerStructure?: unknown; roleAlignment?: unknown };
type ThemeRecord = { key: string; label: string; count: number; sessions: Map<string, { id: string; date: string; role: string }> };
function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean) : []; }
function themeKey(text: string) { return text.toLocaleLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim(); }

export function aggregateFeedback(sources: FeedbackSource[]) {
  const strengths = new Map<string, ThemeRecord>(), improvements = new Map<string, ThemeRecord>(), trend = new Map<string, { month: string; feedbackCount: number; sessionIds: Set<string> }>();
  const uniqueSessions = new Set<string>();
  const add = (target: Map<string, ThemeRecord>, label: string, source: FeedbackSource, date: string) => {
    const key = themeKey(label); if (!key) return;
    const old = target.get(key) || { key, label, count: 0, sessions: new Map() };
    old.count += 1; old.sessions.set(source.sessionId, { id: source.sessionId, date, role: source.jobTitle }); target.set(key, old);
  };
  for (const source of sources) {
    const date = new Date(source.createdAt).toISOString(); uniqueSessions.add(source.sessionId);
    strings(source.strengths).forEach(value => add(strengths, value, source, date));
    strings(source.improvementAreas).forEach(value => add(improvements, value, source, date));
    if (source.suggestedImprovement && typeof source.suggestedImprovement === 'string') add(improvements, source.suggestedImprovement, source, date);
    const month = date.slice(0, 7); const item = trend.get(month) || { month, feedbackCount: 0, sessionIds: new Set<string>() }; item.feedbackCount += 1; item.sessionIds.add(source.sessionId); trend.set(month, item);
  }
  const project = (map: Map<string, ThemeRecord>) => Array.from(map.values()).sort((a, b) => b.sessions.size - a.sessions.size || b.count - a.count).slice(0, 8).map(({ key, label, count, sessions }) => ({ key, label, occurrences: count, sessionCount: sessions.size, recentAt: Array.from(sessions.values()).map(s => s.date).sort().slice(-1)[0] || null, sessions: Array.from(sessions.values()).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3) }));
  const trendRows = Array.from(trend.values()).sort((a, b) => a.month.localeCompare(b.month));
  return { feedbackSessions: uniqueSessions.size, strengths: project(strengths), improvements: project(improvements), trendsSufficient: uniqueSessions.size >= 4 && trendRows.filter(row => row.sessionIds.size >= 2).length >= 2, trends: uniqueSessions.size >= 4 ? trendRows.map(({ month, feedbackCount, sessionIds }) => ({ month, feedbackCount, sessions: sessionIds.size })) : [] };
}

export function calculateDurationSeconds(rows: Array<{ durationSeconds: number | null; status: string; startedAt: Date | null }>, now = new Date()) {
  return rows.reduce((total, row) => total + (row.durationSeconds ?? (row.status === 'ACTIVE' && row.startedAt ? Math.max(0, Math.floor((now.getTime() - row.startedAt.getTime()) / 1000)) : 0)), 0);
}

export function calculateCreditMetrics(rows: Array<{ amountUnits: number; type: string; sessionId: string | null }>) {
  const spent = rows.filter(row => row.type === 'SESSION_CONSUMPTION');
  return { creditsUsedUnits: spent.reduce((sum, row) => sum + Math.abs(row.amountUnits), 0), sessionsStartedWithCredits: new Set(spent.map(row => row.sessionId).filter(Boolean)).size };
}
