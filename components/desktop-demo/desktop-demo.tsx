'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { classifyInterviewQuestion } from '@/lib/ai/question-classifier';
import { DesktopConnect } from '@/components/interviews/desktop-connect';

type PracticeSession = {
  id: string; company: string; jobTitle: string; experience: string; resume: string; aiModel: string;
  answerLength: string; answerFormat: string; tone: string; technicalDepth: string; status: string;
};
type Mode = 'simulation' | 'real';
type Stage = 'Ready' | 'Listening' | 'Transcribing' | 'Question Detected' | 'Generating Answer' | 'Answer Ready' | 'Stopped' | 'Error';
type RecognitionEventLike = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type RecognitionLike = { lang: string; interimResults: boolean; onresult: ((event: RecognitionEventLike) => void) | null; onerror: ((event: { error: string }) => void) | null; onend: (() => void) | null; start: () => void; stop: () => void };

const examples = [
  { question: 'Tell me about yourself.', answer: 'I am a software professional with experience building reliable applications and collaborating across product and engineering teams. In my recent work, I have focused on delivering maintainable features, improving quality through testing, and learning from production feedback. I am now looking to bring that experience to a role where I can contribute and continue to grow.' },
  { question: 'Can you explain your current project?', answer: 'My current project focuses on delivering a dependable service for its users. I work across requirements, implementation, testing, and release, partnering with teammates to break work into clear milestones. One area I pay close attention to is reliability: we monitor the service, investigate issues with evidence, and use those findings to improve the next release.' },
  { question: 'What are your strengths?', answer: 'One of my strengths is bringing structure to ambiguous problems. I clarify the goal, communicate tradeoffs early, and turn the work into manageable steps. I also value feedback and use it to improve the quality of both my technical work and collaboration.' },
  { question: 'Explain the difference between TCP and UDP.', answer: 'TCP establishes a connection and provides ordered, reliable delivery with retransmission when data is lost. UDP sends independent datagrams without those delivery guarantees, which keeps overhead low. Applications choose based on their needs: reliable transfer often favors TCP, while real-time traffic may prefer UDP and handle loss at another layer.' },
  { question: 'How would you troubleshoot a production issue?', answer: 'I would first assess customer impact and confirm the scope using dashboards, logs, and recent changes. I would communicate status, stabilize the service with a safe mitigation, and coordinate owners for parallel investigation. After recovery, I would verify normal operation, document the timeline, and track follow-up actions that reduce the chance of recurrence.' },
  { question: 'Why should we hire you?', answer: 'I bring a combination of practical problem solving, dependable execution, and a collaborative approach. I take ownership from understanding the need through validating the result, and I am comfortable learning unfamiliar parts of a system. I would connect those strengths to the teamâ€™s current priorities and keep building expertise in the role.' },
  { question: 'Explain your experience with Java.', answer: 'My Java experience includes building and maintaining application services, working with object-oriented design, integrating APIs, and writing automated tests. I focus on readable code and clear boundaries between components, and I use profiling and logs to investigate issues. I would tailor the details to the frameworks and scale used on this team.' },
  { question: 'How do you handle a critical incident?', answer: 'I establish impact and urgency, assign clear roles, and keep a shared timeline so responders can work without losing coordination. I prioritize safe restoration, provide concise stakeholder updates, and record decisions as they happen. Once service is stable, I help lead a blameless review with specific owners and measurable follow-up actions.' },
];

export function DesktopDemo({ sessions, initialSessionId }: { sessions: PracticeSession[]; initialSessionId: string }) {
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [mode, setMode] = useState<Mode>('simulation');
  const [provider, setProvider] = useState(sessions.find((s) => s.id === initialSessionId)?.aiModel || 'ChatGPT');
  const [questionIndex, setQuestionIndex] = useState(1);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [stage, setStage] = useState<Stage>('Ready');
  const [transcript, setTranscript] = useState('');
  const [micActive, setMicActive] = useState(false);
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [answerId, setAnswerId] = useState('');
  const [copied, setCopied] = useState(false);
  const timeouts = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const recognition = useRef<RecognitionLike | null>(null);
  const current = useMemo(() => sessions.find((item) => item.id === sessionId) || sessions[0], [sessions, sessionId]);
  const classification = question ? classifyInterviewQuestion(question) : null;

  const clearTimers = useCallback(() => { timeouts.current.forEach(clearTimeout); timeouts.current = []; }, []);
  const stopMic = useCallback(() => { recognition.current?.stop(); recognition.current = null; setMicActive(false); }, []);
  useEffect(() => () => { clearTimers(); recognition.current?.stop(); }, [clearTimers]);

  const makeAnswer = async (askedQuestion: string, targetMode: Mode = mode) => {
    setError(''); setStage('Generating Answer'); setElapsed(null);
    if (targetMode === 'simulation') {
      const match = examples.find((item) => item.question === askedQuestion) || examples[questionIndex % examples.length];
      const startedAt = Date.now();
      timeouts.current.push(setTimeout(() => {
        setAnswer(match.answer); setElapsed((Date.now() - startedAt) / 1000); setStage('Answer Ready');
      }, 720));
      return;
    }
    const startedAt = Date.now();
    try {
      const response = await fetch(`/api/interviews/${sessionId}/answers`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: askedQuestion, aiModel: provider }) });
      const result = await response.json();
      if (!response.ok || !result.answer?.answer) throw new Error(result.error || 'Genzz AI could not generate the answer.');
      setAnswer(result.answer.answer); setAnswerId(result.answer.id); setElapsed((Date.now() - startedAt) / 1000); setStage('Answer Ready');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to generate an answer.'); setStage('Error'); }
  };

  const simulateQuestion = (index = questionIndex) => {
    clearTimers(); stopMic(); setError(''); setAnswer(''); setAnswerId(''); setElapsed(null);
    const nextQuestion = examples[index % examples.length].question;
    setQuestion(nextQuestion); setTranscript(''); setStage('Listening'); setMicActive(false);
    timeouts.current.push(setTimeout(() => { setStage('Transcribing'); }, 560));
    timeouts.current.push(setTimeout(() => { setTranscript(nextQuestion); setStage('Question Detected'); }, 1180));
    if (mode === 'real') timeouts.current.push(setTimeout(() => { void makeAnswer(nextQuestion, 'real'); }, 1500));
    else timeouts.current.push(setTimeout(() => { void makeAnswer(nextQuestion, 'simulation'); }, 1500));
  };
  const startDemo = () => { setStage('Ready'); simulateQuestion(); };
  const stopDemo = () => { clearTimers(); stopMic(); setStage('Stopped'); setError(''); };
  const nextQuestion = () => { const next = (questionIndex + 1) % examples.length; setQuestionIndex(next); simulateQuestion(next); };

  const showDemoMicrophoneNotice = async () => {
    setError('This Interactive Demo never requests microphone access. Use sample questions here, or connect the Windows desktop app for microphone-controlled practice.');
  };

  const changeMode = (next: Mode) => { clearTimers(); stopMic(); setMode(next); setAnswer(''); setAnswerId(''); setError(''); setStage('Ready'); setTranscript(''); };
  const selectSession = (id: string) => { setSessionId(id); setProvider(sessions.find((s) => s.id === id)?.aiModel || 'ChatGPT'); setAnswer(''); setAnswerId(''); setQuestion(''); setTranscript(''); setStage('Ready'); setError(''); };
  const mutateAnswer = async (action: string) => {
    if (mode === 'simulation') {
      if (action === 'SHORTER') setAnswer((v) => v.split('. ').slice(0, 2).join('. ') + '.');
      else if (action === 'LONGER') setAnswer((v) => `${v} I would measure the outcome, share what I learned, and use feedback to keep improving.`);
      else if (action === 'SIMPLIFY') setAnswer((v) => v.replace(/dependable|mitigation|stakeholders|recurrence/gi, 'reliable'));
      else if (action === 'STAR') setAnswer(`Situation: ${answer.split('. ')[0]}.\nTask: I clarified the goal and what success needed to look like.\nAction: ${answer.split('. ').slice(1, 3).join('. ')}.\nResult: I validated the outcome and captured what I learned.`);
      else if (action === 'TECHNICAL') setAnswer(`${answer} I would confirm assumptions with observable signals and choose the smallest safe change, then verify the result with targeted checks.`);
      return;
    }
    if (!answerId) return;
    setStage('Generating Answer'); setError('');
    try {
      const response = await fetch(`/api/interviews/${sessionId}/answers/${answerId}/versions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, aiModel: provider }) });
      const result = await response.json(); if (!response.ok || !result.version) throw new Error(result.error || 'Unable to update this answer.');
      setAnswer(result.version.answer); setStage('Answer Ready');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to update this answer.'); setStage('Error'); }
  };
  const copyAnswer = async () => { try { await navigator.clipboard.writeText(answer); setCopied(true); window.setTimeout(() => setCopied(false), 1600); } catch { setError('Clipboard access is unavailable.'); } };
  const reset = () => { clearTimers(); stopMic(); setQuestion(''); setTranscript(''); setAnswer(''); setAnswerId(''); setElapsed(null); setError(''); setStage('Ready'); };

  return <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
    <section className="overflow-hidden rounded-2xl border border-slate-700 bg-[#0b1120] shadow-2xl shadow-black/30">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/90 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-500/15 text-xs font-bold text-violet-200">GZ</span><div><p className="font-semibold text-white">Genzz AI <span className="font-normal text-slate-400">Â· Interview Practice</span></p><p className="text-[11px] text-slate-500">Prepare Smarter. Interview Better.</p></div></div>
        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${stage === 'Stopped' || stage === 'Error' ? 'border-rose-500/30 bg-rose-500/10 text-rose-200' : stage === 'Ready' ? 'border-slate-600 bg-slate-800 text-slate-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'}`}><i className={`h-1.5 w-1.5 rounded-full ${stage === 'Ready' || stage === 'Stopped' || stage === 'Error' ? 'bg-slate-500' : 'bg-emerald-400'}`} />{stage === 'Stopped' ? 'Disconnected' : stage === 'Ready' ? 'Ready' : 'Connected'}</span>
      </div>

      <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_250px]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.16em] text-violet-300">{current?.company || 'Practice session'}</p><h2 className="mt-1 text-xl font-semibold text-white">{current?.jobTitle || 'Interview Practice'}</h2><p className="mt-1 text-xs text-slate-400">{current?.experience || 'Experience not specified'} Â· {current?.resume || 'No Resume'}</p></div><span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300">{mode === 'simulation' ? 'Demo Simulation' : 'Real AI Practice'}</span></div>
          <div className="grid gap-3 sm:grid-cols-2"><section className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"><div className="flex items-center justify-between"><h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Transcript</h3><span className={`text-xs ${micActive ? 'text-rose-300' : 'text-slate-500'}`}>{micActive ? 'ðŸ”´ Microphone Active' : 'âšª Microphone Off'}</span></div><p className="mt-3 min-h-16 text-sm leading-6 text-slate-200">{transcript || (stage === 'Listening' ? 'Listening for a practice questionâ€¦' : 'Waiting for interview questionâ€¦')}</p></section><section className="rounded-xl border border-violet-500/20 bg-violet-500/[0.04] p-4"><div className="flex items-center justify-between"><h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Detected question</h3>{classification && <span className="rounded-full border border-violet-500/30 px-2 py-0.5 text-[10px] text-violet-200">{classification.type.replace(/_/g, ' ')}</span>}</div><p className="mt-3 min-h-16 text-sm leading-6 text-white">{question || 'A detected question will appear here.'}</p></section></div>
          <section className="min-h-48 rounded-xl border border-slate-800 bg-slate-950/40 p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold text-white">Genzz AI Answer</h3><p className="mt-1 text-xs text-slate-500">{mode === 'simulation' ? 'Sample response Â· Demo timing' : `${provider} Â· Actual response time`}{elapsed !== null ? ` Â· ${elapsed.toFixed(2)}s` : ''}</p></div>{answer && <button type="button" className="btn-secondary py-1.5 text-xs" onClick={() => void copyAnswer()}>{copied ? 'Copied' : 'Copy'}</button>}</div><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-200">{answer || (stage === 'Generating Answer' ? 'Preparing a practice responseâ€¦' : 'Your practice response will appear here.')}</p>{answer && <div className="mt-4 flex flex-wrap gap-2">{[['REGENERATE','Regenerate'],['SHORTER','Shorter'],['LONGER','Longer'],['SIMPLIFY','Simple'],['TECHNICAL','Technical'],['STAR','STAR']].map(([action,label])=><button key={action} type="button" className="btn-secondary px-3 py-1.5 text-xs" disabled={stage === 'Generating Answer'} onClick={() => action === 'REGENERATE' ? void makeAnswer(question) : void mutateAnswer(action)}>{label}</button>)}</div>}</section>
          {error && <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p>}
          <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-4"><button type="button" className="btn-primary" onClick={startDemo} disabled={!current}>Start Demo</button><button type="button" className="btn-secondary" onClick={stopDemo}>Stop Demo</button><button type="button" className="btn-secondary" onClick={nextQuestion}>Next Question</button><button type="button" className="btn-secondary" onClick={() => question && void makeAnswer(question)} disabled={!question || stage === 'Generating Answer' || current?.status !== 'ACTIVE'}>Generate Answer</button><button type="button" className="btn-secondary" onClick={reset}>Reset Demo</button></div>
          <p className="text-[11px] text-slate-500">Interactive Demo · no real payments, credit deductions, or microphone permission requests.</p>
        </div>

        <aside className="space-y-4 lg:border-l lg:border-slate-800 lg:pl-5"><div><label className="label" htmlFor="demo-session">Interview session</label><select id="demo-session" className="input" value={sessionId} onChange={(e) => selectSession(e.target.value)}>{sessions.map((item)=><option key={item.id} value={item.id}>{item.jobTitle} Â· {item.experience}</option>)}</select></div><div><p className="label">Practice mode</p><div className="space-y-2">{([['simulation','Demo Simulation'],['real','Real AI Practice']] as const).map(([value,label])=><button key={value} type="button" aria-pressed={mode===value} className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm ${mode===value?'border-violet-500/50 bg-violet-500/10 text-violet-100':'border-slate-700 bg-slate-950/40 text-slate-300'}`} onClick={()=>changeMode(value)}>{label}</button>)}</div></div><div><label className="label" htmlFor="demo-provider">AI Provider</label><select id="demo-provider" className="input" value={provider} onChange={(e)=>setProvider(e.target.value)}><option>ChatGPT</option><option>Gemini</option></select><p className="mt-1.5 text-[11px] leading-4 text-slate-500">Used by Real AI Practice. Provider keys stay on the server.</p></div><div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3"><p className="text-xs font-semibold text-slate-200">Practice Credits</p><p className="mt-2 text-xs leading-5 text-slate-400">Credit balance and credit purchases are not configured. This demo will not charge or deduct credits.</p></div><div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3"><p className="text-xs font-semibold text-slate-200">Answer preferences</p><dl className="mt-2 space-y-2 text-xs"><div className="flex justify-between gap-2"><dt className="text-slate-500">Length</dt><dd className="text-right text-slate-300">{current?.answerLength}</dd></div><div className="flex justify-between gap-2"><dt className="text-slate-500">Format</dt><dd className="text-right text-slate-300">{current?.answerFormat}</dd></div><div className="flex justify-between gap-2"><dt className="text-slate-500">Tone</dt><dd className="text-right text-slate-300">{current?.tone}</dd></div><div className="flex justify-between gap-2"><dt className="text-slate-500">Depth</dt><dd className="text-right text-slate-300">{current?.technicalDepth}</dd></div></dl></div><button type="button" className="btn-secondary w-full" disabled={mode!=='real'||!current||current.status!=='ACTIVE'||micActive} onClick={()=>void showDemoMicrophoneNotice()}>{micActive?'Listeningâ€¦':'Microphone unavailable in demo'}</button>{micActive&&<button type="button" className="w-full rounded-lg border border-rose-500/30 px-3 py-2 text-sm text-rose-200" onClick={stopMic}>Stop microphone</button>}</aside>
      </div>
    </section>
    <DesktopConnect sessionId={current.id} active={current.status === 'ACTIVE'} />
  </div>;
}
