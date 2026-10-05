'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type ConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'EXPIRED' | 'FAILED';
export function DesktopConnect({ sessionId, active }: { sessionId: string; active: boolean }) {
  const [code, setCode] = useState(''); const [expiresAt, setExpiresAt] = useState('');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [secondsLeft, setSecondsLeft] = useState(0);
  const [retryGeneration, setRetryGeneration] = useState(0);
  const [state, setState] = useState<ConnectionState>('DISCONNECTED'); const [copied, setCopied] = useState(false);
  const pollingEnabled = Boolean(code && expiresAt && state !== 'CONNECTED' && state !== 'EXPIRED' && state !== 'FAILED');
  useEffect(() => {
    if (!expiresAt) return;
    const update = () => { const remaining = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000)); setSecondsLeft(remaining); if (!remaining && code) setState('EXPIRED'); };
    update(); const timer = window.setInterval(update, 1000); return () => window.clearInterval(timer);
  }, [expiresAt, code]);
  useEffect(() => {
    if (!pollingEnabled) return;
    let disposed = false;
    let timer: number | undefined;
    let failures = 0;
    const check = async () => {
      if (Date.now() >= new Date(expiresAt).getTime()) return;
      try {
        const response = await fetch(`/api/desktop/code?sessionId=${encodeURIComponent(sessionId)}`, { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Connection status is unavailable.');
        if (disposed) return;
        if (data.state === 'CONNECTED') { setState('CONNECTED'); return; }
        if (data.state === 'EXPIRED') { setState('EXPIRED'); return; }
        failures = 0; setState('CONNECTING'); timer = window.setTimeout(check, 5000);
      } catch {
        if (disposed) return;
        failures += 1;
        if (failures > 5) { setState('FAILED'); return; }
        setState('RECONNECTING'); timer = window.setTimeout(check, Math.min(30_000, 3000 * (2 ** (failures - 1))));
      }
    };
    void check();
    return () => { disposed = true; if (timer !== undefined) window.clearTimeout(timer); };
  }, [pollingEnabled, code, expiresAt, sessionId, retryGeneration]);
  const createCode = async () => {
    setBusy(true); setError(''); setCode(''); setState('CONNECTING');
    try {
      const response = await fetch('/api/desktop/code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to create a desktop code.');
      setCode(data.code); setExpiresAt(data.expiresAt); setState('CONNECTING');
    } catch (e) { setState('FAILED'); setError(e instanceof Error ? e.message : 'Unable to create a desktop code.'); }
    finally { setBusy(false); }
  };
  const copyCode = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }
    catch { setError('Could not copy the code. Select and copy it manually.'); }
  };
  const statusText = state === 'CONNECTED' ? 'Connected' : state === 'CONNECTING' ? 'Connecting' : state === 'RECONNECTING' ? 'Reconnecting' : state === 'EXPIRED' ? 'Expired' : state === 'FAILED' ? 'Connection Failed' : 'Disconnected';
  return <section className="card" aria-live="polite">
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">Desktop connection</p>
    <h2 className="mt-2 text-xl font-semibold text-white">{active ? 'Your practice session is ready.' : 'This practice session has ended.'}</h2>
    <p className="mt-2 text-sm text-slate-400">Generate a one-time secure code. The code expires after five minutes and can connect only to this session.</p>
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button type="button" className="btn-primary" onClick={() => void createCode()} disabled={!active || busy}>{busy ? 'Creating secure code…' : code ? 'Create New Connection Code' : 'Connect Genzz AI Desktop'}</button>
      <span className={`rounded-full border px-3 py-1.5 text-xs ${state === 'CONNECTED' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-slate-600 bg-slate-800 text-slate-300'}`}>{statusText}</span>
      <Link href={`/desktop-demo?sessionId=${encodeURIComponent(sessionId)}`} className="btn-secondary">Continue in Browser</Link>
    </div>
    {code && secondsLeft > 0 && <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/50 p-4">
      <code aria-label="Short-lived desktop connection code" className="rounded-lg border border-violet-500/30 bg-slate-950 px-4 py-2 text-lg tracking-[0.2em] text-violet-200">{code}</code>
      <button className="btn-secondary" type="button" onClick={() => void copyCode()}>{copied ? 'Copied' : 'Copy Connection Code'}</button>
      <a className="btn-primary" href={`genzz-ai://connect?code=${encodeURIComponent(code)}`}>Open Genzz AI Desktop</a>
      <span className="text-xs text-slate-400">Code expires in {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}.</span>
      <p className="w-full text-xs text-slate-400">If the app does not open, launch Genzz AI Desktop and enter the copied code.</p>
    </div>}
    {state === 'CONNECTED' && <p className="mt-3 text-sm text-emerald-200">Genzz AI Desktop is connected to this practice session.</p>}
    {state === 'EXPIRED' && <p className="mt-3 text-sm text-amber-200">The connection code expired. Create a new code to reconnect.</p>}
    {state === 'RECONNECTING' && <p role="status" className="mt-3 text-sm text-amber-200">Connection interrupted. Checking again with increasing delays.</p>}
    {state === 'FAILED' && <div role="alert" className="mt-3 text-sm text-rose-300"><p>{error || 'Could not confirm the connection. Check your network.'}</p><button type="button" className="btn-secondary mt-2" onClick={() => { setError(''); setState('RECONNECTING'); setRetryGeneration(value => value + 1); }}>Retry status check</button></div>}
    {error && state !== 'FAILED' && <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
  </section>;
}
