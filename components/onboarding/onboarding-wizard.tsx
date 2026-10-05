'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, FileText, Sparkles } from 'lucide-react';

type OnboardingProfile = {
  name: string;
  targetRole: string;
  experienceLevel: string;
  preferredLanguage: string;
  preferredAnswerFormat: string;
  preferredAIProvider: string;
};

const experienceOptions = ['Fresher', '1-2 Years', '3-5 Years', '6-8 Years', '8+ Years'];
const languageOptions = ['English', 'Hindi', 'Telugu', 'Tamil', 'Kannada', 'Malayalam', 'Marathi', 'Bengali'];
const answerOptions = ['Normal', 'Bullet Points', 'Script', 'STAR', 'Technical Explanation'];
const emptyProfile: OnboardingProfile = { name: '', targetRole: '', experienceLevel: '', preferredLanguage: '', preferredAnswerFormat: '', preferredAIProvider: '' };

export function OnboardingWizard({ initialProfile, initialStep, resumeCount, providers }: {
  initialProfile: OnboardingProfile;
  initialStep: number;
  resumeCount: number;
  providers: string[];
}) {
  const router = useRouter();
  const [profile, setProfile] = useState({ ...emptyProfile, ...initialProfile });
  const [step, setStep] = useState(Math.max(1, Math.min(3, initialStep)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const update = (field: keyof OnboardingProfile, value: string) => {
    setProfile((current) => ({ ...current, [field]: value }));
    setError('');
  };

  const save = async (action: 'save' | 'complete', nextStep?: number, includePreferences = false) => {
    if (busy) return false;
    setBusy(true);
    setError('');
    const body: Record<string, unknown> = {
      action,
      ...(nextStep ? { step: nextStep } : {}),
      name: profile.name.trim(),
      targetRole: profile.targetRole.trim(),
      experienceLevel: profile.experienceLevel || null,
    };
    if (includePreferences) {
      body.preferredLanguage = profile.preferredLanguage || null;
      body.preferredAnswerFormat = profile.preferredAnswerFormat || null;
      body.preferredAIProvider = profile.preferredAIProvider || null;
    }
    try {
      const response = await fetch('/api/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save your progress.');
      if (action === 'complete') {
        router.push('/dashboard');
        router.refresh();
      } else {
        setStep(nextStep || step);
      }
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save your progress.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const next = async () => {
    if (step === 1 && profile.name.trim().length < 2) {
      setError('Please enter a name with at least 2 characters.');
      return;
    }
    if (step < 3) await save('save', step + 1, step === 2);
    else await save('complete', undefined, true);
  };

  const back = async () => {
    const previous = step - 1;
    if (previous < 1) return;
    const saved = await save('save', previous, step === 3);
    if (saved) setStep(previous);
  };

  const skip = async () => {
    if (step === 2) {
      await save('save', 3);
      return;
    }
    await save('complete', undefined, false);
  };

  const steps = ['Profile & target role', 'Resume', 'Preferences'];

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(124,58,237,0.14),_transparent_48%),#080b14] px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-500/10 text-violet-200"><Sparkles className="h-5 w-5" /></span><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">Genzz AI</p><p className="text-xs text-slate-500">A few details to personalize your practice</p></div></div>

        <section className="rounded-3xl border border-slate-700/80 bg-slate-900/90 p-5 shadow-2xl shadow-black/30 sm:p-8">
          <div className="mb-7">
            <div className="mb-3 flex items-center justify-between gap-3"><p className="text-xs font-medium text-slate-400">Step {step} of 3</p><Link href="/dashboard" onClick={(event) => { event.preventDefault(); void save('complete'); }} className="text-xs text-slate-400 underline decoration-slate-600 underline-offset-4 hover:text-white">Skip setup</Link></div>
            <div className="flex gap-2" aria-label={`Step ${step} of 3`}>{steps.map((title, index) => <div key={title} className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800"><div className={`h-full rounded-full transition-all ${index < step ? 'w-full bg-violet-400' : 'w-0'}`} /></div>)}</div>
            <p className="mt-2 text-[11px] text-slate-500">{steps[step - 1]}</p>
          </div>

          {step === 1 && <div>
            <h1 className="text-2xl font-bold text-white">Let’s personalize your practice</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">Your name is already on your account. Add a target role if you have one in mind. You can skip the optional details.</p>
            <div className="mt-6 space-y-4">
              <div><label className="label" htmlFor="onboarding-name">Name</label><input id="onboarding-name" className="input" autoComplete="name" maxLength={120} value={profile.name} onChange={(event) => update('name', event.target.value)} required /></div>
              <div><label className="label" htmlFor="target-role">Target job title <span className="font-normal text-slate-500">(optional)</span></label><input id="target-role" className="input" maxLength={120} value={profile.targetRole} onChange={(event) => update('targetRole', event.target.value)} placeholder="For example, Product Designer" /></div>
              <div><label className="label" htmlFor="experience-level">Experience level <span className="font-normal text-slate-500">(optional)</span></label><select id="experience-level" className="input" value={profile.experienceLevel} onChange={(event) => update('experienceLevel', event.target.value)}><option value="">Choose later</option>{experienceOptions.map((option) => <option key={option}>{option}</option>)}</select></div>
            </div>
          </div>}

          {step === 2 && <div>
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-500/10 text-emerald-200"><FileText className="h-5 w-5" /></span>
            <h1 className="mt-4 text-2xl font-bold text-white">Add a resume if it helps</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">A resume can give practice answers useful context about your experience. It stays private to your account and is optional.</p>
            <div className="mt-6 rounded-xl border border-slate-700 bg-slate-950/50 p-4">
              {resumeCount > 0 ? <p className="text-sm text-slate-200"><span className="font-semibold text-emerald-300">{resumeCount} resume{resumeCount === 1 ? '' : 's'} in your library.</span> You can select one when you create a practice session.</p> : <p className="text-sm text-slate-300">No resume added yet. You can upload a PDF or DOCX now, or keep going without one.</p>}
              <Link href="/resumes?returnTo=%2Fonboarding" className="btn-secondary mt-4 inline-flex">{resumeCount ? 'Manage Resumes' : 'Upload a Resume'}</Link>
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500">Resume context is sent to your selected AI provider only when you ask Genzz AI to generate practice content.</p>
          </div>}

          {step === 3 && <div>
            <h1 className="text-2xl font-bold text-white">Choose your practice defaults</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">These are starting points for future sessions. You can change them for any session.</p>
            <div className="mt-6 space-y-4">
              <div><label className="label" htmlFor="preferred-language">Answer language <span className="font-normal text-slate-500">(optional)</span></label><select id="preferred-language" className="input" value={profile.preferredLanguage} onChange={(event) => update('preferredLanguage', event.target.value)}><option value="">Choose later</option>{languageOptions.map((option) => <option key={option}>{option}</option>)}</select></div>
              <div><label className="label" htmlFor="preferred-format">Answer style <span className="font-normal text-slate-500">(optional)</span></label><select id="preferred-format" className="input" value={profile.preferredAnswerFormat} onChange={(event) => update('preferredAnswerFormat', event.target.value)}><option value="">Choose later</option>{answerOptions.map((option) => <option key={option}>{option}</option>)}</select></div>
              <div><label className="label" htmlFor="preferred-provider">AI provider <span className="font-normal text-slate-500">(optional)</span></label><select id="preferred-provider" className="input" value={profile.preferredAIProvider} onChange={(event) => update('preferredAIProvider', event.target.value)}><option value="">Choose later</option>{providers.map((option) => <option key={option}>{option}</option>)}</select>{!providers.length && <p className="mt-1 text-xs text-amber-200">No AI provider is configured right now. You can finish setup and try again later.</p>}</div>
            </div>
          </div>}

          {error && <p role="alert" className="mt-5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p>}
          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>{step > 1 && <button type="button" className="btn-secondary" disabled={busy} onClick={() => void back()}><ArrowLeft className="mr-1.5 inline h-4 w-4" />Back</button>}</div>
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              {step !== 1 && <button type="button" className="btn-secondary" disabled={busy} onClick={() => void skip()}>{step === 2 ? 'Skip this step' : 'Skip preferences'}</button>}
              <button type="button" className="btn-primary" disabled={busy} onClick={() => void next()}>{busy ? 'Saving…' : step === 3 ? <><Check className="mr-1.5 inline h-4 w-4" />Finish setup</> : <>Continue <ArrowRight className="ml-1.5 inline h-4 w-4" /></>}</button>
            </div>
          </div>
          <p className="mt-5 text-center text-xs text-slate-500">Your progress is saved as you continue. You can leave and come back anytime.</p>
        </section>
      </div>
    </main>
  );
}
