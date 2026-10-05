'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type Question = { id: string; question: string; category: string; difficulty: string | null; experienceLevel: string | null; technology: string | null; jobRole: string | null; company: string | null; tags: string[]; status: 'DRAFT'|'PUBLISHED'|'ARCHIVED'; isAiGenerated: boolean };
const categories = ['HR','Behavioral','Technical','Managerial','Leadership','Situational','Project','Resume Based','Coding','System Design','Database','Networking','Cloud','Security','DevOps','SAP','General','Other'];
const levels = ['Fresher','1-2 Years','3-5 Years','6-8 Years','8+ Years'];

export function QuestionAdmin({ questions }: { questions: Question[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>, id?: string) {
    event.preventDefault();
    setBusy(true); setMessage('');
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(form.entries()) as Record<string, string>;
    const body = { ...values, tags: (values.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean), isAiGenerated: values.isAiGenerated === 'on' };
    try {
      const response = await fetch(id ? `/api/admin/questions/${id}` : '/api/admin/questions', { method: id ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save question.');
      setMessage(id ? 'Question updated.' : 'Question created.');
      if (!id) event.currentTarget.reset();
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save question.'); }
    finally { setBusy(false); }
  }

  async function remove(question: Question) {
    if (!window.confirm(`Permanently delete this question?\n\n${question.question}`)) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch(`/api/admin/questions/${question.id}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to delete question.');
      setMessage('Question deleted.'); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to delete question.'); }
    finally { setBusy(false); }
  }

  return <div className="space-y-6">
    <form onSubmit={(event) => void submit(event)} className="card grid gap-3 sm:grid-cols-2">
      <h2 className="text-lg font-semibold sm:col-span-2">Create question</h2>
      <textarea required minLength={8} maxLength={3000} name="question" placeholder="Question" className="input min-h-24 sm:col-span-2" />
      <select name="category" className="input" defaultValue="Technical">{categories.map((value) => <option key={value}>{value}</option>)}</select>
      <select name="status" className="input" defaultValue="DRAFT"><option>DRAFT</option><option>PUBLISHED</option><option>ARCHIVED</option></select>
      <select name="difficulty" className="input" defaultValue=""><option value="">Difficulty (optional)</option><option>Easy</option><option>Medium</option><option>Hard</option></select>
      <select name="experienceLevel" className="input" defaultValue=""><option value="">Experience (optional)</option>{levels.map((value) => <option key={value}>{value}</option>)}</select>
      <input name="technology" maxLength={100} placeholder="Technology" className="input" /><input name="jobRole" maxLength={120} placeholder="Job role" className="input" />
      <input name="company" maxLength={120} placeholder="Company (optional)" className="input" /><input name="tags" placeholder="Tags, comma separated" className="input" />
      <label className="flex items-center gap-2 text-sm text-slate-300 sm:col-span-2"><input type="checkbox" name="isAiGenerated" /> AI-generated question</label>
      <button disabled={busy} className="btn-primary w-fit">Create question</button>
      {message && <p role="status" className="self-center text-sm text-violet-200">{message}</p>}
    </form>

    <section className="space-y-3"><h2 className="text-lg font-semibold">Question catalog <span className="text-sm font-normal text-slate-500">({questions.length})</span></h2>
      {questions.length ? questions.map((question) => <article key={question.id} className="card">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="max-w-4xl"><p className="font-medium leading-6 text-white">{question.question}</p><p className="mt-2 text-xs text-slate-400">{question.category} · {question.difficulty || 'Difficulty not set'} · {question.experienceLevel || 'Any experience'} · {question.technology || 'No technology'}</p><p className="mt-1 text-xs text-slate-500">{question.jobRole || 'Any role'}{question.company ? ` · ${question.company}` : ''}{question.tags.length ? ` · Tags: ${question.tags.join(', ')}` : ''}</p></div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300">{question.status}</span>{question.isAiGenerated && <span className="rounded-full border border-emerald-500/30 bg-emerald-500/5 px-2.5 py-1 text-xs text-emerald-200">AI generated</span>}</div></div>
        <details className="mt-4 border-t border-slate-800 pt-3"><summary className="cursor-pointer text-sm text-violet-200">Edit fields</summary>
          <form onSubmit={(event) => void submit(event, question.id)} className="mt-3 grid gap-3 sm:grid-cols-2">
            <textarea required minLength={8} maxLength={3000} name="question" defaultValue={question.question} className="input min-h-20 sm:col-span-2" />
            <select name="category" className="input" defaultValue={question.category}>{categories.map((value) => <option key={value}>{value}</option>)}</select><select name="status" className="input" defaultValue={question.status}><option>DRAFT</option><option>PUBLISHED</option><option>ARCHIVED</option></select>
            <select name="difficulty" className="input" defaultValue={question.difficulty || ''}><option value="">Difficulty (optional)</option><option>Easy</option><option>Medium</option><option>Hard</option></select><select name="experienceLevel" className="input" defaultValue={question.experienceLevel || ''}><option value="">Experience (optional)</option>{levels.map((value) => <option key={value}>{value}</option>)}</select>
            <input name="technology" maxLength={100} defaultValue={question.technology || ''} placeholder="Technology" className="input" /><input name="jobRole" maxLength={120} defaultValue={question.jobRole || ''} placeholder="Job role" className="input" />
            <input name="company" maxLength={120} defaultValue={question.company || ''} placeholder="Company" className="input" /><input name="tags" defaultValue={question.tags.join(', ')} placeholder="Tags, comma separated" className="input" />
            <label className="flex items-center gap-2 text-sm text-slate-300 sm:col-span-2"><input type="checkbox" name="isAiGenerated" defaultChecked={question.isAiGenerated} /> AI-generated question</label>
            <div className="flex gap-2"><button disabled={busy} className="btn-primary">Save changes</button><button type="button" disabled={busy} onClick={() => void remove(question)} className="btn-secondary border-rose-500/30 text-rose-200">Delete</button></div>
          </form>
        </details>
      </article>) : <p className="card text-sm text-slate-400">No questions yet.</p>}
    </section>
  </div>;
}
