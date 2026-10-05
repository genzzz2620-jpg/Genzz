'use client';
import { useEffect, useState } from 'react';
const categories = [['interview','Interview'],['preparation','Preparation'],['resume','Resume'],['desktop','Desktop'],['subscription','Subscription'],['system','System']] as const;
type Preferences = Record<(typeof categories)[number][0] | 'security', boolean>;
export function NotificationPreferences() {
  const [prefs, setPrefs] = useState<Preferences | null>(null); const [saving, setSaving] = useState(false); const [notice, setNotice] = useState('');
  useEffect(() => { void fetch('/api/settings/notifications').then(r => r.json()).then(d => setPrefs(d.preferences)).catch(() => setNotice('Unable to load preferences.')); }, []);
  async function save() { if (!prefs) return; setSaving(true); setNotice(''); try { const r = await fetch('/api/settings/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(prefs) }); if (!r.ok) throw new Error(); setNotice('Preferences saved.'); } catch { setNotice('Could not save preferences.'); } finally { setSaving(false); } }
  if (!prefs) return <p className="text-sm text-slate-400">Loading preferences…</p>;
  return <div className="space-y-4">{categories.map(([key,label]) => <label key={key} className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-700 p-4 text-slate-200">{label}<input type="checkbox" checked={prefs[key]} onChange={e => setPrefs({ ...prefs, [key]: e.target.checked })} className="h-5 w-5 accent-violet-500" /></label>)}<p className="text-sm text-slate-400">Security notifications stay on for important account events.</p><button disabled={saving} onClick={() => void save()} className="btn-primary">{saving ? 'Saving…' : 'Save preferences'}</button>{notice && <p role="status" className="text-sm text-slate-300">{notice}</p>}</div>;
}
