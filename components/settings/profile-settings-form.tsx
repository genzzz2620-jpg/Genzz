'use client';

import { useState, type FormEvent } from 'react';

const experienceLevels = ['Fresher', '1-2 Years', '3-5 Years', '6-8 Years', '8+ Years'];
const languages = ['English', 'Hindi', 'Telugu', 'Tamil', 'Kannada', 'Malayalam', 'Marathi', 'Bengali'];
const answerFormats = ['Normal', 'Bullet Points', 'Script', 'STAR', 'Technical Explanation'];
const fieldClass = 'input';

type ProfileSettings = {
  name: string;
  targetRole: string;
  experienceLevel: string | null;
  preferredLanguage: string | null;
  preferredAnswerFormat: string | null;
  preferredAIProvider: 'ChatGPT' | 'Gemini' | null;
};

type ProfileSettingsFormProps = {
  email: string;
  initialSettings: ProfileSettings;
  configuredProviders: Array<'ChatGPT' | 'Gemini'>;
};

export function ProfileSettingsForm({ email, initialSettings, configuredProviders }: ProfileSettingsFormProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/settings/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const result = await response.json() as { error?: string; profile?: ProfileSettings };
      if (!response.ok || !result.profile) throw new Error(result.error || 'Unable to save your settings.');
      setSettings(result.profile);
      setMessage('Settings saved.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save your settings.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="mt-6">
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="profile-name">Name</label>
          <input id="profile-name" className={fieldClass} autoComplete="name" maxLength={120} required value={settings.name} onChange={(event) => setSettings({ ...settings, name: event.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="profile-email">Email</label>
          <input id="profile-email" className={fieldClass} type="email" value={email} readOnly aria-describedby="email-help" />
          <p id="email-help" className="mt-1 text-xs text-slate-400">Email address changes are not available in this version.</p>
        </div>
        <div>
          <label className="label" htmlFor="target-role">Target role</label>
          <input id="target-role" className={fieldClass} maxLength={120} value={settings.targetRole} onChange={(event) => setSettings({ ...settings, targetRole: event.target.value })} placeholder="e.g. Product Designer" />
        </div>
        <div>
          <label className="label" htmlFor="experience-level">Experience level</label>
          <select id="experience-level" className={fieldClass} value={settings.experienceLevel || ''} onChange={(event) => setSettings({ ...settings, experienceLevel: event.target.value || null })}>
            <option value="">Choose later</option>
            {experienceLevels.map((level) => <option key={level} value={level}>{level}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="preferred-language">Preferred language</label>
          <select id="preferred-language" className={fieldClass} value={settings.preferredLanguage || ''} onChange={(event) => setSettings({ ...settings, preferredLanguage: event.target.value || null })}>
            <option value="">Use feature default</option>
            {languages.map((language) => <option key={language} value={language}>{language}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="answer-format">Default answer format</label>
          <select id="answer-format" className={fieldClass} value={settings.preferredAnswerFormat || ''} onChange={(event) => setSettings({ ...settings, preferredAnswerFormat: event.target.value || null })}>
            <option value="">Use feature default</option>
            {answerFormats.map((format) => <option key={format} value={format}>{format}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ai-provider">Preferred AI provider</label>
          <select id="ai-provider" className={fieldClass} value={settings.preferredAIProvider || ''} onChange={(event) => setSettings({ ...settings, preferredAIProvider: (event.target.value || null) as ProfileSettings['preferredAIProvider'] })}>
            <option value="">Use feature default</option>
            {settings.preferredAIProvider && !configuredProviders.includes(settings.preferredAIProvider) && <option value={settings.preferredAIProvider}>{settings.preferredAIProvider} (currently unavailable)</option>}
            {configuredProviders.map((provider) => <option key={provider} value={provider}>{provider}</option>)}
            {configuredProviders.length === 0 && <option value="" disabled>No provider is configured</option>}
          </select>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</button>
        <p role="status" aria-live="polite" className={error ? 'text-sm text-red-300' : 'text-sm text-emerald-300'}>{error || message}</p>
      </div>
    </form>
  );
}
