'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type BillingData = { subscription: { plan: 'FREE' | 'PREMIUM'; status: string; provider: string | null; currentPeriodStart: string | null; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean; billingStatus: string; canManageBilling: boolean }; usage: { usedToday: number; dailyLimit: number; usedThisMinute: number; minuteLimit: number; period: string } };
async function loadBilling() {
  const response = await fetch('/api/subscription', { cache: 'no-store' });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Unable to load subscription details.');
  return result as BillingData;
}

export function SubscriptionManager({ checkoutResult }: { checkoutResult?: string }) {
  const [data, setData] = useState<BillingData | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { void loadBilling().then(setData).catch(reason => setError(reason instanceof Error ? reason.message : 'Unable to load subscription details.')); }, []);
  const openPortal = async () => {
    setBusy(true); setError('');
    try { const response = await fetch('/api/subscription/portal', { method: 'POST' }); const result = await response.json(); if (!response.ok || typeof result.url !== 'string') throw new Error(result.error || 'Unable to open billing management.'); window.location.assign(result.url); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to open billing management.'); setBusy(false); }
  };
  const subscription = data?.subscription;
  return <div className="max-w-4xl space-y-6">
    <header><p className="text-sm uppercase tracking-[0.2em] text-violet-300">Genzz AI</p><h1 className="mt-2 text-3xl font-bold text-white">Subscription</h1><p className="mt-2 text-slate-300">View your plan, usage, and billing status.</p></header>
    {checkoutResult === 'success' && <p role="status" className="rounded-lg border border-violet-700 bg-violet-950/30 p-3 text-sm text-violet-100">Checkout returned successfully. Premium access appears after the payment provider confirms the subscription.</p>}
    {checkoutResult === 'cancelled' && <p className="rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm text-slate-300">Checkout was canceled. Your current plan remains active.</p>}
    {error && <p role="alert" className="rounded-lg border border-rose-700 bg-rose-950/40 p-3 text-sm text-rose-200">{error}</p>}
    <section className="card">
      <div className="flex flex-wrap items-start justify-between gap-5"><div><p className="text-sm uppercase tracking-[0.15em] text-violet-300">Current plan</p><h2 className="mt-2 text-3xl font-bold text-white">{subscription?.plan === 'PREMIUM' ? '⭐ Premium' : subscription?.plan || 'Loading…'}</h2><p className="mt-2 text-slate-300">Subscription status: <strong className="text-white">{subscription?.status || 'Loading'}</strong></p><p className="mt-1 text-slate-300">Billing status: <strong className="text-white">{subscription?.billingStatus || 'Loading'}</strong></p><p className="mt-1 text-slate-400">{subscription?.cancelAtPeriodEnd ? 'Access remains active until the current period ends.' : subscription?.currentPeriodEnd ? `${subscription.plan === 'PREMIUM' ? 'Renewal / period end' : 'Period end'}: ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}` : 'Renewal date: Not applicable'}</p></div><div className="flex flex-wrap gap-3">{subscription?.plan === 'PREMIUM' ? subscription.canManageBilling && <button type="button" className="btn-secondary" disabled={busy} onClick={() => void openPortal()}>{busy ? 'Opening…' : 'Manage Billing'}</button> : <Link href="/pricing" className="btn-primary">View Premium Plan</Link>}<Link href="/pricing" className="btn-secondary">View Plans</Link></div></div>
    </section>
    <section className="card"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-semibold text-white">AI usage</h2><p className="mt-1 text-sm text-slate-400">Shared across currently available AI features · {data?.usage.period || 'Rolling 24 hours'}</p></div></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><div className="rounded-lg border border-slate-700 bg-slate-950/40 p-4"><p className="text-sm text-slate-400">Daily usage</p><p className="mt-2 text-2xl font-semibold text-white">{data ? `${data.usage.usedToday} / ${data.usage.dailyLimit}` : '—'}</p></div><div className="rounded-lg border border-slate-700 bg-slate-950/40 p-4"><p className="text-sm text-slate-400">Last-minute usage</p><p className="mt-2 text-2xl font-semibold text-white">{data ? `${data.usage.usedThisMinute} / ${data.usage.minuteLimit}` : '—'}</p></div></div><button type="button" className="btn-secondary mt-4" onClick={() => void loadBilling().then(setData).catch(reason => setError(reason instanceof Error ? reason.message : 'Unable to refresh subscription.'))}>Refresh Status</button></section>
  </div>;
}
