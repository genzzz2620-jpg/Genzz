'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { questionCategories, questionDifficulties, questionExperienceLevels } from '@/lib/question-bank';

type QuestionItem = {
  id: string;
  question: string;
  category: string;
  questionType: string | null;
  subcategory: string | null;
  difficulty: string | null;
  experienceLevel: string | null;
  technology: string | null;
  company: string | null;
  jobRole: string | null;
  tags: string[];
  explanation: string | null;
  isAiGenerated: boolean;
  userId: string | null;
  isFavorite: boolean;
  createdAt: string;
};

type ListResponse = {
  items: QuestionItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

const difficulties = [...questionDifficulties];
const experiences = [...questionExperienceLevels];

export function QuestionBankClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<QuestionItem[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [difficulty, setDifficulty] = useState('');
  const [experience, setExperience] = useState('');
  const [technology, setTechnology] = useState('');
  const [jobRole, setJobRole] = useState(searchParams.get('jobRole') || '');
  const [company, setCompany] = useState(searchParams.get('company') || '');
  const [page, setPage] = useState(1);
  const [pageInfo, setPageInfo] = useState<ListResponse>({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [view, setView] = useState<'all' | 'favorites' | 'recent'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState('');
  const [busyFavoriteId, setBusyFavoriteId] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [generatedNotice, setGeneratedNotice] = useState('');
  const [manualForm, setManualForm] = useState({ question: '', category: 'General', subcategory: '', difficulty: '', experienceLevel: '', technology: '', company: '', jobRole: '', tags: '', explanation: '' });
  const [generateForm, setGenerateForm] = useState({ company: '', jobTitle: '', experience: 'Fresher', technology: '', category: 'Technical', difficulty: 'Medium', numberOfQuestions: 5, aiModel: 'ChatGPT' });

  useEffect(() => {
    let current = true;
    setIsLoading(true);
    setError('');
    const timer = window.setTimeout(async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (query.trim()) params.set('q', query.trim());
      if (category) params.set('category', category);
      if (difficulty) params.set('difficulty', difficulty);
      if (experience) params.set('experience', experience);
      if (technology.trim()) params.set('technology', technology.trim());
      if (jobRole.trim()) params.set('jobRole', jobRole.trim());
      if (company.trim()) params.set('company', company.trim());
      if (view === 'favorites') params.set('favorites', 'true');
      if (view === 'recent') params.set('recent', 'true');
      try {
        const response = await fetch(`/api/question-bank?${params.toString()}`);
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unable to load questions.');
        if (current) {
          setPageInfo(result as ListResponse);
          setItems(result.items);
        }
      } catch (loadError) {
        if (current) setError(loadError instanceof Error ? loadError.message : 'Unable to load questions.');
      } finally {
        if (current) setIsLoading(false);
      }
    }, query.trim() ? 250 : 0);
    return () => { current = false; window.clearTimeout(timer); };
  }, [query, category, difficulty, experience, technology, jobRole, company, page, view]);

  const changeView = (nextView: 'all' | 'favorites' | 'recent') => {
    setView(nextView);
    setPage(1);
  };

  const toggleFavorite = async (item: QuestionItem) => {
    setBusyFavoriteId(item.id);
    setError('');
    try {
      const response = await fetch(`/api/question-bank/${item.id}/favorite`, { method: item.isFavorite ? 'DELETE' : 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to update favorite.');
      setItems((current) => current.map((row) => row.id === item.id ? { ...row, isFavorite: result.isFavorite } : row));
      if (view === 'favorites' && !result.isFavorite) setItems((current) => current.filter((row) => row.id !== item.id));
    } catch (favoriteError) {
      setError(favoriteError instanceof Error ? favoriteError.message : 'Unable to update favorite.');
    } finally {
      setBusyFavoriteId('');
    }
  };

  const practice = async (item: QuestionItem) => {
    setLoadingMessage(item.id);
    setError('');
    try {
      const response = await fetch(`/api/question-bank/${item.id}/practice`, { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to open practice.');
      router.push(`/interviews/${result.sessionId}?questionId=${encodeURIComponent(item.id)}`);
    } catch (practiceError) {
      setError(practiceError instanceof Error ? practiceError.message : 'Unable to open practice.');
      setLoadingMessage('');
    }
  };

  const addQuestion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoadingMessage('add');
    setError('');
    try {
      const response = await fetch('/api/question-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...manualForm, tags: manualForm.tags.split(',').map((tag) => tag.trim()).filter(Boolean) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to add question.');
      setShowAdd(false);
      setManualForm({ question: '', category: 'General', subcategory: '', difficulty: '', experienceLevel: '', technology: '', company: '', jobRole: '', tags: '', explanation: '' });
      setView('all');
      setPage(1);
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : 'Unable to add question.');
    } finally {
      setLoadingMessage('');
    }
  };

  const generateQuestions = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoadingMessage('generate');
    setGeneratedNotice('');
    setError('');
    try {
      const response = await fetch('/api/question-bank/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(generateForm),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to generate practice questions.');
      setGeneratedNotice(result.notice || 'AI-generated practice question.');
      setShowGenerate(false);
      setView('all');
      setPage(1);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : 'Unable to generate practice questions.');
    } finally {
      setLoadingMessage('');
    }
  };

  const clearFilters = () => {
    setQuery(''); setCategory(''); setDifficulty(''); setExperience(''); setTechnology(''); setJobRole(''); setCompany(''); setPage(1); setView('all');
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-sm uppercase tracking-[0.2em] text-violet-300">Genzz AI</p><h1 className="mt-2 text-3xl font-bold text-white">Question Bank</h1><p className="mt-2 text-sm text-slate-400">Search and practice original preparation questions. No question is guaranteed to appear in an interview.</p></div>
        <div className="flex flex-wrap gap-2"><button className="btn-secondary" type="button" onClick={() => setShowGenerate((open) => !open)}>Generate Practice Questions</button><button className="btn-primary" type="button" onClick={() => setShowAdd((open) => !open)}>Add Question</button></div>
      </div>

      {generatedNotice && <p role="status" className="rounded-lg border border-violet-500/30 bg-violet-500/10 p-3 text-sm text-violet-100">{generatedNotice}</p>}
      {error && <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}

      {showGenerate && <form onSubmit={generateQuestions} className="card grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div><label className="label" htmlFor="gen-company">Company (optional)</label><input id="gen-company" className="input" maxLength={120} value={generateForm.company} onChange={(event) => setGenerateForm({ ...generateForm, company: event.target.value })} /></div>
        <div><label className="label" htmlFor="gen-role">Job title</label><input id="gen-role" className="input" required maxLength={120} value={generateForm.jobTitle} onChange={(event) => setGenerateForm({ ...generateForm, jobTitle: event.target.value })} /></div>
        <div><label className="label" htmlFor="gen-experience">Experience</label><select id="gen-experience" className="input" value={generateForm.experience} onChange={(event) => setGenerateForm({ ...generateForm, experience: event.target.value })}>{experiences.map((level) => <option key={level}>{level}</option>)}</select></div>
        <div><label className="label" htmlFor="gen-technology">Technology</label><input id="gen-technology" className="input" maxLength={100} value={generateForm.technology} onChange={(event) => setGenerateForm({ ...generateForm, technology: event.target.value })} /></div>
        <div><label className="label" htmlFor="gen-category">Category</label><select id="gen-category" className="input" value={generateForm.category} onChange={(event) => setGenerateForm({ ...generateForm, category: event.target.value })}>{questionCategories.map((item) => <option key={item}>{item}</option>)}</select></div>
        <div><label className="label" htmlFor="gen-difficulty">Difficulty</label><select id="gen-difficulty" className="input" value={generateForm.difficulty} onChange={(event) => setGenerateForm({ ...generateForm, difficulty: event.target.value })}>{difficulties.map((item) => <option key={item}>{item}</option>)}</select></div>
        <div><label className="label" htmlFor="gen-count">Number of questions</label><input id="gen-count" className="input" type="number" min={1} max={12} value={generateForm.numberOfQuestions} onChange={(event) => setGenerateForm({ ...generateForm, numberOfQuestions: Number(event.target.value) })} /></div>
        <div><label className="label" htmlFor="gen-model">Provider</label><select id="gen-model" className="input" value={generateForm.aiModel} onChange={(event) => setGenerateForm({ ...generateForm, aiModel: event.target.value })}><option>ChatGPT</option><option>Gemini</option></select></div>
        <div className="flex flex-wrap items-center gap-2 md:col-span-2 xl:col-span-4"><button className="btn-primary" type="submit" disabled={loadingMessage === 'generate'}>{loadingMessage === 'generate' ? 'Generating...' : 'Generate Practice Questions'}</button><span className="text-xs text-slate-400">AI-generated practice questions are not guaranteed real company interview questions.</span></div>
      </form>}

      {showAdd && <form onSubmit={addQuestion} className="card grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="md:col-span-2 xl:col-span-3"><label className="label" htmlFor="new-question">Question</label><textarea id="new-question" className="input min-h-24" required minLength={8} maxLength={3000} value={manualForm.question} onChange={(event) => setManualForm({ ...manualForm, question: event.target.value })} /></div>
        <div><label className="label" htmlFor="new-category">Category</label><select id="new-category" className="input" value={manualForm.category} onChange={(event) => setManualForm({ ...manualForm, category: event.target.value })}>{questionCategories.map((item) => <option key={item}>{item}</option>)}</select></div>
        <div><label className="label" htmlFor="new-subcategory">Subcategory</label><input id="new-subcategory" className="input" maxLength={100} value={manualForm.subcategory} onChange={(event) => setManualForm({ ...manualForm, subcategory: event.target.value })} /></div>
        <div><label className="label" htmlFor="new-difficulty">Difficulty</label><select id="new-difficulty" className="input" value={manualForm.difficulty} onChange={(event) => setManualForm({ ...manualForm, difficulty: event.target.value })}><option value="">Not specified</option>{difficulties.map((item) => <option key={item}>{item}</option>)}</select></div>
        <div><label className="label" htmlFor="new-experience">Experience level</label><select id="new-experience" className="input" value={manualForm.experienceLevel} onChange={(event) => setManualForm({ ...manualForm, experienceLevel: event.target.value })}><option value="">Any</option>{experiences.map((item) => <option key={item}>{item}</option>)}</select></div>
        <div><label className="label" htmlFor="new-tech">Technology</label><input id="new-tech" className="input" maxLength={100} value={manualForm.technology} onChange={(event) => setManualForm({ ...manualForm, technology: event.target.value })} /></div>
        <div><label className="label" htmlFor="new-company">Company</label><input id="new-company" className="input" maxLength={120} value={manualForm.company} onChange={(event) => setManualForm({ ...manualForm, company: event.target.value })} /></div>
        <div><label className="label" htmlFor="new-role">Job role</label><input id="new-role" className="input" maxLength={120} value={manualForm.jobRole} onChange={(event) => setManualForm({ ...manualForm, jobRole: event.target.value })} /></div>
        <div><label className="label" htmlFor="new-tags">Tags (comma separated)</label><input id="new-tags" className="input" value={manualForm.tags} onChange={(event) => setManualForm({ ...manualForm, tags: event.target.value })} /></div>
        <div className="md:col-span-2 xl:col-span-3"><label className="label" htmlFor="new-approach">Expected answer approach</label><textarea id="new-approach" className="input min-h-20" maxLength={3000} value={manualForm.explanation} onChange={(event) => setManualForm({ ...manualForm, explanation: event.target.value })} /></div>
        <div className="flex gap-2 md:col-span-2 xl:col-span-3"><button className="btn-primary" type="submit" disabled={loadingMessage === 'add'}>{loadingMessage === 'add' ? 'Saving...' : 'Save Question'}</button><button className="btn-secondary" type="button" onClick={() => setShowAdd(false)}>Cancel</button></div>
      </form>}

      <div className="card">
        <div className="mb-5 flex flex-wrap gap-2 border-b border-slate-800 pb-4">
          <button className={view === 'all' ? 'btn-primary' : 'btn-secondary'} type="button" onClick={() => changeView('all')}>All Questions</button>
          <button className={view === 'favorites' ? 'btn-primary' : 'btn-secondary'} type="button" onClick={() => changeView('favorites')}>Favorites</button>
          <button className={view === 'recent' ? 'btn-primary' : 'btn-secondary'} type="button" onClick={() => changeView('recent')}>Recently Used</button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="sm:col-span-2"><label className="sr-only" htmlFor="bank-search">Search question bank</label><input id="bank-search" className="input" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search questions, topics, tags..." /></div>
          <select aria-label="Category filter" className="input" value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }}><option value="">All categories</option>{questionCategories.map((item) => <option key={item}>{item}</option>)}</select>
          <select aria-label="Difficulty filter" className="input" value={difficulty} onChange={(event) => { setDifficulty(event.target.value); setPage(1); }}><option value="">All difficulties</option>{difficulties.map((item) => <option key={item}>{item}</option>)}</select>
          <select aria-label="Experience filter" className="input" value={experience} onChange={(event) => { setExperience(event.target.value); setPage(1); }}><option value="">All experience levels</option>{experiences.map((item) => <option key={item}>{item}</option>)}</select>
          <input aria-label="Technology filter" className="input" value={technology} onChange={(event) => { setTechnology(event.target.value); setPage(1); }} placeholder="Technology" />
          <input aria-label="Job role filter" className="input" value={jobRole} onChange={(event) => { setJobRole(event.target.value); setPage(1); }} placeholder="Job role" />
          <input aria-label="Company filter" className="input" value={company} onChange={(event) => { setCompany(event.target.value); setPage(1); }} placeholder="Company" />
          <button className="btn-secondary" type="button" onClick={clearFilters}>Clear filters</button>
        </div>

        <div className="mt-5 flex items-center justify-between gap-4 text-sm text-slate-400"><span>{pageInfo.total} questions</span><span>Page {pageInfo.totalPages ? pageInfo.page : 0} of {pageInfo.totalPages}</span></div>
        {isLoading ? <div className="mt-4 rounded-lg border border-slate-700 p-8 text-center text-sm text-slate-400">Loading questions...</div> : items.length ? (
          <div className="mt-4 space-y-3">
            {items.map((item) => (
              <article key={item.id} className="rounded-lg border border-slate-700 bg-slate-950/40 p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <Link href={`/question-bank/${item.id}`} className="text-base font-medium leading-6 text-white hover:text-violet-200">{item.question}</Link>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-xs text-violet-200">{item.category}</span>
                      {item.difficulty && <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300">{item.difficulty}</span>}
                      {item.experienceLevel && <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300">{item.experienceLevel}</span>}
                      {item.technology && <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300">{item.technology}</span>}
                      {item.company && <span className="rounded-full border border-amber-500/20 bg-amber-500/5 px-2.5 py-1 text-xs text-amber-100/80">Practice questions associated with this company/role</span>}
                      {item.isAiGenerated && <span className="rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1 text-xs text-emerald-200">AI-generated practice question</span>}
                    </div>
                    {item.jobRole && <p className="mt-2 text-xs text-slate-400">Role: {item.jobRole}</p>}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button className="btn-primary text-xs" type="button" disabled={loadingMessage === item.id} onClick={() => void practice(item)}>{loadingMessage === item.id ? 'Opening...' : 'Practice'}</button>
                    <Link href={`/question-bank/${item.id}`} className="btn-secondary text-xs">View Answer</Link>
                    <button className="btn-secondary text-xs" type="button" disabled={busyFavoriteId === item.id} onClick={() => void toggleFavorite(item)}>{item.isFavorite ? 'Unfavorite' : 'Favorite'}</button>
                    {item.userId && <button className="btn-secondary text-xs" type="button" onClick={async () => { if (!window.confirm('Delete this question?')) return; const response = await fetch(`/api/question-bank/${item.id}`, { method: 'DELETE' }); if (response.ok) setItems((current) => current.filter((entry) => entry.id !== item.id)); else setError('Unable to delete this question.'); }}>Delete</button>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : <div className="mt-4 rounded-lg border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">No matching questions yet. Adjust your filters or add a question.</div>}

        <div className="mt-5 flex justify-end gap-2"><button className="btn-secondary" type="button" disabled={page <= 1 || isLoading} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button><button className="btn-secondary" type="button" disabled={page >= pageInfo.totalPages || isLoading} onClick={() => setPage((current) => current + 1)}>Next</button></div>
      </div>
    </div>
  );
}
