'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, BriefcaseBusiness, FileText, MessageCircleMore, Mic2, Sparkles } from 'lucide-react';

export function OnboardingWelcome({ name }: { name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const choose = async (action: 'start' | 'skip') => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save your choice.');
      router.push(action === 'start' ? '/onboarding' : '/dashboard');
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save your choice.');
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,_rgba(124,58,237,0.16),_transparent_50%),#080b14] px-4 py-10 sm:px-6">
      <section className="w-full max-w-3xl rounded-3xl border border-slate-700/80 bg-slate-900/90 p-6 shadow-2xl shadow-black/30 sm:p-10">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-500/10 text-violet-200"><Sparkles className="h-5 w-5" /></span>
          <div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-300">Genzz AI</p><p className="mt-1 text-xs text-slate-500">Prepare Smarter. Interview Better.</p></div>
        </div>
        <p className="text-sm text-violet-200">{name ? `Great to have you here, ${name}.` : 'Your practice starts here.'}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Welcome to Genzz AI</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">Prepare smarter. Practice with confidence. Interview better.</p>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Set up a few preferences to make your first practice session feel more like you. You can skip this and change everything later.</p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {[
            { icon: MessageCircleMore, text: 'Practice interview questions at your own pace.' },
            { icon: FileText, text: 'Use your resume as optional context for tailored practice.' },
            { icon: Sparkles, text: 'Generate personalized answers and try different styles.' },
            { icon: BriefcaseBusiness, text: 'Build confidence for the roles you are targeting.' },
          ].map(({ icon: Icon, text }) => <div key={text} className="flex items-start gap-3 rounded-xl border border-slate-700/80 bg-slate-950/50 p-4"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" /><p className="text-sm leading-5 text-slate-300">{text}</p></div>)}
        </div>

        <div className="mt-5 flex items-start gap-3 rounded-xl border border-slate-700/80 bg-slate-950/40 p-4"><Mic2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" /><p className="text-xs leading-5 text-slate-400">Desktop and speech practice are optional. Microphone use is visible and begins only after you choose it and grant permission.</p></div>

        {error && <p role="alert" className="mt-5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p>}
        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => void choose('skip')}>Skip for Now</button>
          <button type="button" className="btn-primary" disabled={busy} onClick={() => void choose('start')}>{busy ? 'Saving…' : <>Get Started <ArrowRight className="ml-2 inline h-4 w-4" /></>}</button>
        </div>
      </section>
    </main>
  );
}
