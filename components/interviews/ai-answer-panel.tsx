'use client';

import { useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Check, Copy, Pencil, Search, Sparkles } from 'lucide-react';

type AnswerVersion = {
  id: string;
  answer: string;
  provider: string;
  model: string;
  versionNumber: number;
  action: string;
  validationWarnings: string[];
  createdAt: string;
};

type SavedAnswer = {
  id: string;
  question: string;
  answer: string;
  questionType: string | null;
  createdAt: string;
  versions: AnswerVersion[];
};

type AIAnswerPanelProps = {
  sessionId: string;
  status: string;
  model: string;
  initialQuestion: string;
  initialQuestionBankItemId: string;
  initialAnswers: SavedAnswer[];
};

const suggestions = [
  'Tell me about yourself.',
  'Why should we hire you?',
  'Explain your current project.',
  'Explain TCP vs UDP.',
  'Describe a difficult production issue you handled.',
];

const actionButtons = [
  { action: 'SHORTER', label: 'Shorter' },
  { action: 'LONGER', label: 'Longer' },
  { action: 'SIMPLIFY', label: 'Simpler' },
  { action: 'TECHNICAL', label: 'More Technical' },
  { action: 'FORMAL', label: 'More Formal' },
  { action: 'CONVERSATIONAL', label: 'More Conversational' },
  { action: 'BULLET', label: 'Bullet Points' },
  { action: 'SCRIPT', label: 'Script' },
  { action: 'STAR', label: 'STAR' },
] as const;

const actionLabels: Record<string, string> = {
  INITIAL: 'Initial',
  REGENERATE: 'Regenerated',
  SHORTER: 'Shorter',
  LONGER: 'Longer',
  SIMPLIFY: 'Simpler',
  TECHNICAL: 'More technical',
  FORMAL: 'More formal',
  CONVERSATIONAL: 'More conversational',
  BULLET: 'Bullet points',
  SCRIPT: 'Script',
  STAR: 'STAR',
  EDIT: 'Manual edit',
};

function normalizeLegacyAnswer(answer: SavedAnswer): SavedAnswer {
  if (answer.versions.length) return answer;
  return {
    ...answer,
    versions: [{
      id: `${answer.id}-legacy`,
      answer: answer.answer,
      provider: 'Unknown',
      model: 'Legacy answer',
      versionNumber: 1,
      action: 'INITIAL',
      validationWarnings: [],
      createdAt: answer.createdAt,
    }],
  };
}

function questionTypeLabel(value: string | null) {
  if (!value) return 'GENERAL';
  return value.replace(/_/g, ' ');
}

export function AIAnswerPanel({ sessionId, status, model, initialQuestion, initialQuestionBankItemId, initialAnswers }: AIAnswerPanelProps) {
  const [question, setQuestion] = useState(initialQuestion);
  const [answers, setAnswers] = useState(initialAnswers.map(normalizeLegacyAnswer));
  const [selectedAnswerId, setSelectedAnswerId] = useState(initialAnswers[0]?.id || '');
  const [selectedVersions, setSelectedVersions] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const answer of initialAnswers) {
      const latest = answer.versions[0];
      if (latest) initial[answer.id] = latest.id;
      else initial[answer.id] = `${answer.id}-legacy`;
    }
    return initial;
  });
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [copiedVersionId, setCopiedVersionId] = useState('');
  const isActive = status === 'ACTIVE';

  const filteredAnswers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return answers;
    return answers.filter((answer) =>
      answer.question.toLowerCase().includes(query)
      || questionTypeLabel(answer.questionType).toLowerCase().includes(query)
      || answer.versions.some((version) => version.answer.toLowerCase().includes(query)),
    );
  }, [answers, search]);

  const selectedAnswer = answers.find((answer) => answer.id === selectedAnswerId) || null;
  const activeVersion = selectedAnswer?.versions.find((version) => version.id === selectedVersions[selectedAnswer.id])
    || selectedAnswer?.versions[0]
    || null;

  const selectQuestion = (answer: SavedAnswer) => {
    setSelectedAnswerId(answer.id);
    setSelectedVersions((current) => current[answer.id] ? current : { ...current, [answer.id]: answer.versions[0]?.id || '' });
    setIsEditing(false);
    setError('');
  };

  const handleGenerate = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!question.trim() || isGenerating || !isActive) return;
    setIsGenerating(true);
    setError('');
    try {
      const response = await fetch(`/api/interviews/${sessionId}/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, questionBankItemId: initialQuestionBankItemId || null }),
      });
      const result = await response.json();
      if (!response.ok || !result.answer) throw new Error(result.error || 'Genzz AI could not generate the answer.');
      const created = normalizeLegacyAnswer(result.answer as SavedAnswer);
      setAnswers((current) => [created, ...current.filter((answer) => answer.id !== created.id)]);
      setSelectedAnswerId(created.id);
      setSelectedVersions((current) => ({ ...current, [created.id]: created.versions[0]?.id || '' }));
      setQuestion('');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Genzz AI could not generate the answer.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleQuestionKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && event.ctrlKey) {
      event.preventDefault();
      void handleGenerate();
    }
  };

  const addVersion = async (answer: SavedAnswer, action: string, editedAnswer?: string) => {
    if (isGenerating || isSavingEdit) return;
    setIsGenerating(true);
    setError('');
    try {
      const response = await fetch(`/api/interviews/${sessionId}/answers/${answer.id}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, editedAnswer }),
      });
      const result = await response.json();
      if (!response.ok || !result.version) throw new Error(result.error || 'Unable to update this answer.');
      const version = result.version as AnswerVersion;
      setAnswers((current) => current.map((item) => item.id === answer.id ? { ...item, versions: [version, ...item.versions] } : item));
      setSelectedVersions((current) => ({ ...current, [answer.id]: version.id }));
      setIsEditing(false);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to update this answer.');
    } finally {
      setIsGenerating(false);
      setIsSavingEdit(false);
    }
  };

  const saveEdit = async () => {
    if (!selectedAnswer || !editedText.trim()) return;
    setIsSavingEdit(true);
    await addVersion(selectedAnswer, 'EDIT', editedText.trim());
  };

  const copyActiveAnswer = async () => {
    if (!activeVersion) return;
    try {
      await navigator.clipboard.writeText(activeVersion.answer);
      setCopiedVersionId(activeVersion.id);
      window.setTimeout(() => setCopiedVersionId(''), 1800);
    } catch {
      setError('Could not copy the answer. Check clipboard permissions and try again.');
    }
  };

  return (
    <section className="card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-300"><Sparkles className="h-4 w-4" /></span>
          <div>
            <h2 className="text-xl font-semibold text-white">Genzz AI Answer Engine</h2>
            <p className="mt-1 text-xs text-slate-400">{model} · Answers use the saved session context and preferences.</p>
          </div>
        </div>
        <span className="text-xs text-slate-400">Question classification is automatic</span>
      </div>

      <p className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs leading-5 text-amber-100/80">
        Your question and relevant session context, including resume excerpts when needed, are sent to {model}. Review personal claims before using an answer.
      </p>

      {isActive ? (
        <form onSubmit={(event) => void handleGenerate(event)} className="mt-5">
          <label htmlFor="practice-question" className="label">Interview question</label>
          <textarea
            id="practice-question"
            className="input min-h-[130px] resize-y"
            value={question}
            onChange={(event) => { setQuestion(event.target.value); setError(''); }}
            onKeyDown={handleQuestionKeyDown}
            maxLength={3000}
            placeholder="Ask Genzz AI an interview question."
            required
          />
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs text-slate-400">{question.length}/3000 · Ctrl+Enter to submit</span>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary" onClick={() => { setQuestion(''); setError(''); }} disabled={!question}>Clear question</button>
              <button type="submit" className="btn-primary" disabled={isGenerating || !question.trim()}>
                {isGenerating ? 'Generating answer...' : 'Generate Answer'}
              </button>
            </div>
          </div>
          {error && <p role="alert" className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p>}
          {!answers.length && (
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Try a question</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {suggestions.map((suggestion) => <button key={suggestion} type="button" className="btn-secondary text-xs" onClick={() => setQuestion(suggestion)}>{suggestion}</button>)}
              </div>
            </div>
          )}
        </form>
      ) : (
        <p className="mt-5 rounded-lg border border-slate-700 bg-slate-950/50 p-4 text-sm text-slate-300">This session is complete. Saved practice answers remain available below.</p>
      )}

      <div className="mt-7 grid gap-5 lg:grid-cols-[0.72fr_1.28fr]">
        <aside className="min-w-0">
          <div className="flex items-center justify-between gap-3">
            <div><h3 className="font-semibold text-white">Question History</h3><p className="mt-1 text-xs text-slate-400">{answers.length} saved questions</p></div>
          </div>
          <label className="sr-only" htmlFor="answer-history-search">Search question and answer history</label>
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/50 px-3">
            <Search className="h-4 w-4 shrink-0 text-slate-500" />
            <input id="answer-history-search" className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-500" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search questions, answers, type..." />
          </div>
          {answers.length > 0 && <p className="mt-4 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Recent Questions</p>}
          <div className="mt-2 max-h-[550px] space-y-2 overflow-y-auto pr-1">
            {filteredAnswers.map((answer) => (
              <button key={answer.id} type="button" onClick={() => selectQuestion(answer)} className={`block w-full rounded-lg border p-3 text-left transition ${selectedAnswerId === answer.id ? 'border-violet-500/60 bg-violet-500/10' : 'border-slate-700 bg-slate-950/40 hover:bg-slate-800/70'}`}>
                <span className="flex items-start justify-between gap-3"><span className="line-clamp-3 text-sm leading-5 text-slate-100">{answer.question}</span><span className="shrink-0 rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-400">{answer.versions.length} {answer.versions.length === 1 ? 'answer' : 'answers'}</span></span>
                <span className="mt-2 inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2 py-0.5 text-[10px] text-emerald-200">{questionTypeLabel(answer.questionType)}</span>
              </button>
            ))}
            {filteredAnswers.length === 0 && answers.length > 0 && <p className="rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-400">No matching question or answer.</p>}
            {!answers.length && <p className="rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-400">Your recent questions will appear here.</p>}
          </div>
        </aside>

        <div className="min-w-0">
          {selectedAnswer && activeVersion ? (
            <article className="rounded-lg border border-slate-700 bg-slate-950/40 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-xs text-violet-200">{questionTypeLabel(selectedAnswer.questionType)}</span>
                  <span className="text-xs text-slate-500">{selectedAnswer.versions.length} version{selectedAnswer.versions.length === 1 ? '' : 's'}</span>
                </div>
                <button type="button" className="btn-secondary text-xs" onClick={() => void copyActiveAnswer()} disabled={!activeVersion}>
                  {copiedVersionId === activeVersion.id ? <><Check className="mr-1.5 h-3.5 w-3.5" />Copied</> : <><Copy className="mr-1.5 h-3.5 w-3.5" />Copy Answer</>}
                </button>
              </div>
              <h3 className="mt-4 text-base font-semibold leading-6 text-white">{selectedAnswer.question}</h3>

              <div className="mt-4 flex flex-wrap gap-2 border-b border-slate-800 pb-4">
                {selectedAnswer.versions.map((version) => (
                  <button key={version.id} type="button" className={`rounded-md border px-2.5 py-1.5 text-xs ${activeVersion.id === version.id ? 'border-violet-500/50 bg-violet-500/10 text-violet-100' : 'border-slate-700 text-slate-400 hover:text-slate-100'}`} onClick={() => { setSelectedVersions((current) => ({ ...current, [selectedAnswer.id]: version.id })); setIsEditing(false); }}>
                    v{version.versionNumber} · {actionLabels[version.action] || version.action}
                  </button>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                <span>Provider: {activeVersion.provider} · Model: {activeVersion.model}</span>
                <time dateTime={activeVersion.createdAt}>{new Date(activeVersion.createdAt).toLocaleString()}</time>
              </div>

              {activeVersion.validationWarnings.length > 0 && (
                <div className="mt-3 rounded-md border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs leading-5 text-amber-100/80">
                  Review before using: {activeVersion.validationWarnings.join(' ')}
                </div>
              )}

              {isEditing ? (
                <div className="mt-4">
                  <label className="label" htmlFor="edit-practice-answer">Edit answer</label>
                  <textarea id="edit-practice-answer" className="input min-h-[210px] resize-y" maxLength={20000} value={editedText} onChange={(event) => setEditedText(event.target.value)} />
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <button type="button" className="btn-secondary" onClick={() => setIsEditing(false)} disabled={isSavingEdit}>Cancel</button>
                    <button type="button" className="btn-primary" onClick={() => void saveEdit()} disabled={isSavingEdit || !editedText.trim()}>{isSavingEdit ? 'Saving version...' : 'Save as New Version'}</button>
                  </div>
                </div>
              ) : (
                <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-200">{activeVersion.answer}</p>
              )}

              {!isEditing && (
                <div className="mt-5 border-t border-slate-800 pt-4">
                  <div className="flex flex-wrap gap-2">
                    {isActive && <>
                      <button type="button" className="btn-secondary text-xs" disabled={isGenerating} onClick={() => void addVersion(selectedAnswer, 'REGENERATE')}>{isGenerating ? 'Working...' : 'Regenerate'}</button>
                      {actionButtons.map(({ action, label }) => <button key={action} type="button" className="btn-secondary text-xs" disabled={isGenerating} onClick={() => void addVersion(selectedAnswer, action)}>{label}</button>)}
                    </>}
                    <button type="button" className="btn-secondary text-xs" onClick={() => { setEditedText(activeVersion.answer); setIsEditing(true); }}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</button>
                  </div>
                </div>
              )}
              {error && <p role="alert" className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p>}
            </article>
          ) : (
            <div className="flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-950/30 p-7 text-center">
              <Sparkles className="h-6 w-6 text-violet-300" />
              <h3 className="mt-3 font-semibold text-white">Ask Genzz AI an interview question.</h3>
              <p className="mt-1 max-w-sm text-sm text-slate-400">Choose one of the examples or write your own question. Nothing is generated until you press Generate Answer.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
