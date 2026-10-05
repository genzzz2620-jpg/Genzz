'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

// Prisma JSON responses are intentionally rendered from the API's stable, user-scoped response shape.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>;
type AnalyticsData = AnyRow & { overview: AnyRow; activity: AnyRow[]; daily: AnyRow; categories: AnyRow[]; feedback: AnyRow; preparation: AnyRow; recentSessions: AnyRow[]; timeline: AnyRow[]; options: AnyRow };
const selectClass = 'rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white';

export function AnalyticsDashboard() {
  const search = useSearchParams();
  const initialSession = search.get('sessionId') || '';
  const [period, setPeriod] = useState('30');
  const [role, setRole] = useState('');
  const [company, setCompany] = useState('');
  const [experience, setExperience] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [questions, setQuestions] = useState<AnyRow[]>([]);
  const [questionPage, setQuestionPage] = useState(1);
  const [questionPages, setQuestionPages] = useState(1);
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [saved, setSaved] = useState<Record<string, string>>({});

  const query = useMemo(() => {
    const params = new URLSearchParams({ period });
    if (period === 'custom') { if (fromDate) params.set('from', fromDate); if (toDate) params.set('to', toDate); }
    if (role) params.set('role', role);
    if (company) params.set('company', company);
    if (experience) params.set('experience', experience);
    if (initialSession) params.set('sessionId', initialSession);
    return params;
  }, [period, fromDate, toDate, role, company, experience, initialSession]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch(`/api/analytics/overview?${query}`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load analytics.');
      setData(result);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load analytics.'); }
    finally { setLoading(false); }
  }, [query]);

  const loadQuestions = useCallback(async () => {
    const params = new URLSearchParams(query);
    params.set('page', String(questionPage));
    if (category) params.set('category', category);
    try {
      const response = await fetch(`/api/analytics/questions?${params}`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load practice questions.');
      setQuestions(result.questions || []); setQuestionPages(Math.max(1, result.pages || 1));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load practice questions.'); }
  }, [query, questionPage, category]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadQuestions(); }, [loadQuestions]);

  async function saveQuestion(id: string) {
    setSaved(current => ({ ...current, [id]: 'Saving…' }));
    try {
      const response = await fetch(`/api/analytics/questions/${id}/save`, { method: 'POST' });
      const result = await response.json();
      setSaved(current => ({ ...current, [id]: response.ok ? (result.message || 'Saved') : (result.error || 'Unable to save') }));
    } catch { setSaved(current => ({ ...current, [id]: 'Unable to save' })); }
  }

  const overview = data?.overview || {};
  const comparisons = (data?.recentSessions || []).filter(row => selectedSessions.includes(row.id));
  const selectedValue = (event: React.ChangeEvent<HTMLSelectElement>, setter: (value: string) => void) => setter(event.target.value);

  return <main className="space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm uppercase tracking-[0.2em] text-violet-300">Your practice history</p><h1 className="mt-2 text-3xl font-bold text-white">Interview Performance Analytics</h1><p className="mt-2 text-slate-300">Review your own practice activity, saved feedback and preparation progress.</p></div><a className="btn-secondary" href={`/api/analytics/overview?${query}&format=csv`}>Export CSV</a></header>

    <section className="card space-y-4" aria-label="Analytics filters"><div className="flex flex-wrap gap-3">
      <label className="sr-only" htmlFor="analytics-period">Date range</label><select id="analytics-period" className={selectClass} value={period} onChange={event => { const value = event.target.value; setPeriod(value); if (value === 'custom' && (!fromDate || !toDate)) { const today = new Date(); const from = new Date(today); from.setDate(today.getDate() - 29); setFromDate(from.toISOString().slice(0, 10)); setToDate(today.toISOString().slice(0, 10)); } }}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="all">All time</option><option value="custom">Custom dates</option></select>
      {period === 'custom' && <><label className="sr-only" htmlFor="analytics-from">From date</label><input id="analytics-from" aria-label="From date" type="date" className={selectClass} value={fromDate} onChange={event => setFromDate(event.target.value)} /><label className="sr-only" htmlFor="analytics-to">To date</label><input id="analytics-to" aria-label="To date" type="date" className={selectClass} value={toDate} onChange={event => setToDate(event.target.value)} /></>}
      <label className="sr-only" htmlFor="analytics-role">Role</label><select id="analytics-role" className={selectClass} value={role} onChange={event => selectedValue(event, setRole)}><option value="">All roles</option>{(data?.options?.roles || []).map((value: string) => <option key={value}>{value}</option>)}</select>
      <label className="sr-only" htmlFor="analytics-company">Company</label><select id="analytics-company" className={selectClass} value={company} onChange={event => selectedValue(event, setCompany)}><option value="">All companies</option>{(data?.options?.companies || []).filter(Boolean).map((value: string) => <option key={value}>{value === 'No company selected' ? 'No company selected' : value}</option>)}</select>
      <label className="sr-only" htmlFor="analytics-experience">Experience</label><select id="analytics-experience" className={selectClass} value={experience} onChange={event => selectedValue(event, setExperience)}><option value="">All experience levels</option>{(data?.options?.experiences || []).map((value: string) => <option key={value}>{value}</option>)}</select>
    </div>{initialSession && <p className="text-sm text-violet-200">Showing analytics for a selected practice session. <Link href="/analytics" className="underline">Clear session</Link></p>}</section>

    {error && <section role="alert" className="card border-rose-500/30"><p className="text-rose-200">{error}</p><button className="btn-secondary mt-3" onClick={() => { void load(); void loadQuestions(); }}>Retry</button></section>}
    {loading && !data ? <div className="card text-slate-300" role="status">Loading your analytics…</div> : null}
    {!loading && !error && data && overview.practiceSessions === 0 && <section className="card text-center"><h2 className="text-xl font-semibold text-white">Your analytics will appear after you complete your first practice session.</h2><p className="mt-2 text-slate-300">Start a mock interview or another practice session to build your personal history.</p><Link href="/interview-simulator" className="btn-primary mt-4 inline-flex">Start Practice</Link></section>}

    {data && <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Practice summary">
        {[
          ['Practice sessions', overview.practiceSessions], ['Questions answered', overview.questionsAnswered], ['Practice time', formatMinutes(overview.practiceSeconds)], ['AI feedback sessions', overview.aiFeedbackSessions],
          ['Mock interviews', overview.mockInterviews], ['Credits used', overview.creditsUsed], ['Available credits', formatCreditUnits(overview.creditsRemaining)], ['Resumes', overview.resumes],
        ].map(([label, value]) => <div className="card" key={String(label)}><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-2xl font-bold text-white">{loading ? '…' : value}</p></div>)}
      </section>

      <section className="grid gap-6 xl:grid-cols-2"><div className="card"><h2 className="text-lg font-semibold text-white">Practice activity</h2><p className="mt-1 text-sm text-slate-400">Sessions and answers by day, or by month for all time.</p><ActivityChart points={data.activity || []} /></div><div className="card"><h2 className="text-lg font-semibold text-white">Question categories</h2><p className="mt-1 text-sm text-slate-400">Select a category to review the related questions below.</p><div className="mt-4 space-y-2">{data.categories.length ? data.categories.map((row: AnyRow) => <button key={row.category} onClick={() => { setCategory(category === row.category ? '' : row.category); setQuestionPage(1); }} className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left ${category === row.category ? 'border-violet-400 bg-violet-500/10 text-white' : 'border-slate-700 text-slate-300'}`}><span>{row.category}</span><span>{row.count} questions</span></button>) : <p className="text-sm text-slate-400">No answered questions in this range.</p>}</div><p className="mt-4 text-sm text-slate-400">Most practiced: {data.categories[0]?.category || 'No category yet'}</p></div></section>

      <section className="grid gap-6 xl:grid-cols-2"><div className="card"><h2 className="text-lg font-semibold text-white">Feedback themes</h2><p className="mt-1 text-sm text-slate-400">Themes are drawn from your stored AI practice feedback.</p><ThemeList heading="Recurring strengths" rows={data.feedback.strengths} /><ThemeList heading="Areas to work on" rows={data.feedback.improvements} /><p className="mt-4 rounded-lg bg-slate-900 p-3 text-sm text-violet-100">{data.feedback.insight}</p>{data.feedback.trendsSufficient ? <><p className="mt-3 text-xs text-slate-400">Feedback sessions across {data.feedback.trends.length} months; comparisons reflect saved feedback only.</p><div aria-label="AI feedback sessions by month" className="mt-2 flex flex-wrap gap-2">{data.feedback.trends.map((point: AnyRow) => <span key={point.month} className="rounded bg-slate-900 px-2 py-1 text-xs text-slate-300">{point.month}: {point.sessions} sessions</span>)}</div></> : <p className="mt-3 text-sm text-slate-400">Complete more sessions to see feedback trends.</p>}</div>
        <div className="card"><h2 className="text-lg font-semibold text-white">Preparation progress</h2><p className="mt-1 text-sm text-slate-400">{data.preparation.completed} of {data.preparation.total} tasks completed</p>{data.preparation.percent !== null && <div className="mt-3 h-2 overflow-hidden rounded bg-slate-700"><div className="h-full bg-violet-400" style={{ width: `${data.preparation.percent}%` }} /></div>}<p className="mt-4 text-sm text-slate-300">Practice streak: {data.preparation.streak.current} days · longest {data.preparation.streak.longest} days</p>{!data.preparation.streak.current && <p className="text-sm text-slate-500">No practice streak yet.</p>}<div className="mt-4 space-y-2">{data.preparation.byCategory.map((row: AnyRow) => <div key={row.category} className="flex justify-between text-sm text-slate-300"><span>{row.category}</span><span>{row.completed}/{row.total}</span></div>)}</div><Link href="/preparation" className="btn-secondary mt-4 inline-flex">Continue Preparation</Link></div></section>

      <section className="card"><h2 className="text-lg font-semibold text-white">Daily practice</h2><div className="mt-4 grid gap-3 sm:grid-cols-3">{(['today', 'week', 'month'] as const).map(key => <div className="rounded-xl border border-slate-700 p-4" key={key}><h3 className="font-semibold capitalize text-white">{key === 'week' ? 'Last 7 days' : key}</h3><p className="mt-2 text-sm text-slate-300">{data.daily[key].sessions} sessions · {data.daily[key].questions} questions · {data.daily[key].minutes} min</p></div>)}</div></section>

      <section className="card"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-white">Practice sessions</h2><p className="text-sm text-slate-400">Choose up to three sessions to compare your practice history.</p></div><label className="text-sm text-slate-300"><input type="checkbox" checked={category === ''} onChange={() => { setCategory(''); setQuestionPage(1); }} /> <span className="ml-2">All categories</span></label></div>
        {data.recentSessions.length ? <div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="text-slate-400"><tr><th className="p-2">Compare</th><th className="p-2">Date</th><th className="p-2">Role / company</th><th className="p-2">Type</th><th className="p-2">Questions</th><th className="p-2">Duration</th><th className="p-2">Actions</th></tr></thead><tbody>{data.recentSessions.map((row: AnyRow) => <tr key={row.id} className="border-t border-slate-800 text-slate-200"><td className="p-2"><input aria-label={`Compare ${row.role}`} type="checkbox" checked={selectedSessions.includes(row.id)} onChange={event => setSelectedSessions(current => event.target.checked ? (current.length < 3 ? [...current, row.id] : current) : current.filter(id => id !== row.id))} /></td><td className="p-2">{new Date(row.date).toLocaleDateString()}</td><td className="p-2">{row.role}<span className="block text-xs text-slate-500">{row.company || 'No company selected'}</span></td><td className="p-2">{row.type}</td><td className="p-2">{row.questions}</td><td className="p-2">{formatMinutes(row.durationSeconds)}</td><td className="p-2"><Link className="text-violet-300 hover:underline" href={`/interviews/${row.id}`}>View session</Link><Link className="ml-3 text-violet-300 hover:underline" href={`/analytics?sessionId=${encodeURIComponent(row.id)}`}>Feedback</Link><Link className="ml-3 text-violet-300 hover:underline" href={`/interview-simulator?targetRole=${encodeURIComponent(row.role)}${row.company ? `&targetCompany=${encodeURIComponent(row.company)}` : ''}`}>Practice again</Link></td></tr>)}</tbody></table></div> : <p className="mt-4 text-sm text-slate-400">No sessions match these filters.</p>}
        {comparisons.length > 1 && <div className="mt-4 rounded-xl border border-violet-500/20 bg-violet-500/5 p-4"><h3 className="font-semibold text-white">Selected session comparison</h3><div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{comparisons.map((row: AnyRow) => <div key={row.id} className="rounded-lg bg-slate-900 p-3 text-sm text-slate-300"><p className="font-medium text-white">{row.role} · {row.type}</p><p className="mt-1">{row.questions} questions · {formatMinutes(row.durationSeconds)}</p><p className="mt-2">Feedback areas: {row.feedbackAreas?.join(', ') || 'No structured areas recorded'}</p></div>)}</div></div>}
      </section>

      <section className="card"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-white">Question history</h2><p className="text-sm text-slate-400">Review your answer and its saved AI feedback{category ? ` · ${category}` : ''}.</p></div>{category && <button className="text-sm text-violet-300" onClick={() => setCategory('')}>Clear category</button>}</div>
        {questions.length ? <div className="mt-4 space-y-4">{questions.map((row: AnyRow) => <article key={row.id} className="rounded-xl border border-slate-700 p-4"><p className="text-xs uppercase tracking-wide text-violet-300">{row.category} · {new Date(row.createdAt).toLocaleDateString()} · {row.session.jobTitle}</p><h3 className="mt-2 font-semibold text-white">{row.question}</h3><details className="mt-3"><summary className="cursor-pointer text-sm text-slate-300">View my answer</summary><p className="mt-2 whitespace-pre-wrap text-sm text-slate-400">{row.answer || 'No answer recorded.'}</p></details>{(row.feedback.strengths.length > 0 || row.feedback.improvementAreas.length > 0 || row.feedback.suggestedImprovement) && <div className="mt-3 text-sm text-slate-300"><p><strong>Strengths:</strong> {row.feedback.strengths.join('; ') || 'Not recorded'}</p><p className="mt-1"><strong>Areas to work on:</strong> {row.feedback.improvementAreas.join('; ') || row.feedback.suggestedImprovement || 'Not recorded'}</p></div>}<div className="mt-3 flex flex-wrap gap-3"><Link className="text-sm text-violet-300 hover:underline" href={`/interviews/${row.session.id}`}>View session</Link><button className="text-sm text-violet-300 hover:underline" onClick={() => void saveQuestion(row.id)}>Save to Question Bank</button>{saved[row.id] && <span role="status" className="text-sm text-slate-400">{saved[row.id]}</span>}</div></article>)}</div> : <p className="mt-4 text-sm text-slate-400">No questions found for this selection.</p>}
        {questionPages > 1 && <div className="mt-4 flex items-center justify-between"><button className="btn-secondary" disabled={questionPage <= 1} onClick={() => setQuestionPage(value => value - 1)}>Previous</button><span className="text-sm text-slate-400">Page {questionPage} of {questionPages}</span><button className="btn-secondary" disabled={questionPage >= questionPages} onClick={() => setQuestionPage(value => value + 1)}>Next</button></div>}
      </section>

      <section className="card"><h2 className="text-lg font-semibold text-white">Recent activity</h2>{data.timeline.length ? <ol className="mt-3 space-y-3">{data.timeline.map((event: AnyRow) => <li key={event.id} className="flex items-start gap-3 border-l border-slate-700 pl-4"><span className="mt-1 h-2 w-2 rounded-full bg-violet-400" /><div className="text-sm text-slate-300">{event.title}<p className="text-xs text-slate-500">{new Date(event.at).toLocaleString()}</p></div></li>)}</ol> : <p className="mt-3 text-sm text-slate-400">Your practice and preparation activity will appear here.</p>}</section>
      <section className="card"><p className="text-sm uppercase tracking-wider text-violet-300">Suggested next step</p><h2 className="mt-2 text-lg font-semibold text-white">{data.recommendation?.title || data.feedback.insight}</h2><p className="mt-1 text-sm text-slate-400">{data.recommendation?.reason}</p><div className="mt-4 flex flex-wrap gap-3"><Link className="btn-primary" href={data.recommendation?.href || '/interviews/create'}>Practice Now</Link><Link className="btn-secondary" href="/preparation">Continue Preparation</Link>{data.recentSessions[0] && <Link className="btn-secondary" href={`/interviews/${data.recentSessions[0].id}`}>View Feedback</Link>}</div></section>
      <p className="text-xs text-slate-500">Analytics use your saved practice records and AI feedback. They do not predict an employer’s interview or imply that questions are guaranteed to appear.</p>
    </>}
  </main>;
}

function ActivityChart({ points }: { points: AnyRow[] }) {
  if (!points.length) return <p className="mt-6 text-sm text-slate-400">No activity in this date range yet.</p>;
  const rows = points.slice(-30); const max = Math.max(1, ...rows.map(row => row.sessions));
  const width = 600, height = 180, gap = 8, bar = Math.max(4, (width - gap * rows.length) / rows.length);
  return <div className="mt-5 overflow-x-auto"><svg role="img" aria-label="Practice sessions by date; questions are listed under each bar" viewBox={`0 0 ${width} ${height + 28}`} className="min-w-[500px] w-full"><line x1="0" y1={height} x2={width} y2={height} stroke="#475569" />{rows.map((point, index) => { const h = point.sessions / max * (height - 20); const x = index * (bar + gap); return <g key={point.date}><title>{point.date}: {point.sessions} sessions, {point.questions} questions</title><rect x={x} y={height - h} width={bar} height={h} rx="3" fill="#a78bfa" /><text x={x + bar / 2} y={height + 18} fill="#94a3b8" fontSize="9" textAnchor="middle">{point.date.slice(rows.length > 12 ? 8 : 5)}</text></g>; })}</svg><div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">{rows.slice(-8).map(point => <span key={point.date} className="rounded bg-slate-900 px-2 py-1">{point.date}: {point.questions} answers</span>)}</div></div>;
}

function ThemeList({ heading, rows }: { heading: string; rows: AnyRow[] }) {
  return <div className="mt-4"><h3 className="text-sm font-medium text-white">{heading}</h3>{rows?.length ? <ul className="mt-2 space-y-2">{rows.slice(0, 5).map((row: AnyRow) => <li key={row.key} className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-200"><span>{row.label}</span><span className="ml-2 text-xs text-slate-500">{row.sessionCount} session{row.sessionCount === 1 ? '' : 's'}</span>{row.sessions?.[0] && <Link className="ml-2 text-xs text-violet-300 hover:underline" href={`/interviews/${row.sessions[0].id}`}>View example</Link>}</li>)}</ul> : <p className="mt-2 text-sm text-slate-500">No saved feedback themes yet.</p>}</div>;
}
function formatMinutes(seconds?: number | null) { if (seconds === null || seconds === undefined) return '—'; if (seconds < 60) return `${seconds}s`; const minutes = Math.round(seconds / 60); return `${minutes} min`; }
function formatCreditUnits(units?: number) { return typeof units === 'number' ? `${(units / 100).toFixed(2).replace(/\.00$/, '')} Credits` : '—'; }
