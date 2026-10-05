'use client';

import { useEffect, useState } from 'react';

type WalletData = {
  balance: { display: string; availableUnits: number; reserved: string };
  transactions: Array<{ id: string; type: string; amountUnits: number; credits: string; sessionId: string | null; createdAt: string }>;
  packs: Array<{ id: string; credits: number; available: boolean }>;
  session: { cost: string; free: { eligible: boolean; usedThisMonth: number; allowance: number; cooldownUntil: string | null; durationMinutes: number } };
};

export function CreditWallet({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => { void fetch('/api/credits', { cache: 'no-store' }).then(async response => { const value = await response.json(); if (!response.ok) throw new Error(value.error || 'Unable to load credits.'); setData(value); }).catch(error => setNotice(error instanceof Error ? error.message : 'Unable to load credits.')).finally(() => setLoading(false)); }, []);

  async function purchase(packId: string) {
    setBusy(packId); setNotice('');
    try { const response = await fetch('/api/credits/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ packId }) }); const result = await response.json(); if (!response.ok || typeof result.url !== 'string') throw new Error(result.error || 'Unable to start checkout.'); window.location.assign(result.url); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to start checkout.'); setBusy(''); }
  }

  return <section className="card" aria-labelledby="credit-wallet-title">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-sm uppercase tracking-wider text-violet-300">Practice wallet</p><h2 id="credit-wallet-title" className="mt-1 text-xl font-semibold text-white">Available Credits</h2><p className="mt-1 text-sm text-slate-400">{loading ? 'Loading your balance…' : data?.balance.display || '0 Credits'}{data && data.balance.reserved !== '0' ? ` · ${data.balance.reserved} reserved` : ''}</p></div>
      {data && <div className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-right"><p className="text-xs text-slate-400">Practice session</p><p className="mt-1 text-sm font-medium text-slate-100">{data.session.free.eligible ? `${data.session.free.durationMinutes} min free available` : `${data.session.cost} Credits`}</p><p className="text-[11px] text-slate-500">{data.session.free.usedThisMonth}/{data.session.free.allowance} free this month</p></div>}
    </div>
    <div className="mt-4 flex flex-wrap gap-2">{data?.packs.map(pack => <button key={pack.id} type="button" className="btn-secondary" disabled={!pack.available || Boolean(busy)} onClick={() => void purchase(pack.id)}>{busy === pack.id ? 'Opening checkout…' : `Buy ${pack.credits} Credits`}</button>)}</div>
    {!data?.packs.some(pack => pack.available) && !loading && <p className="mt-2 text-xs text-slate-500">Credit purchases are not configured on this server.</p>}
    {notice && <p role="status" className="mt-3 text-sm text-rose-300">{notice}</p>}
    {!compact && data && <div className="mt-5 border-t border-slate-800 pt-4"><h3 className="text-sm font-semibold text-white">Credit history</h3>{data.transactions.length ? <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[420px] text-left text-xs"><thead className="text-slate-500"><tr><th className="pb-2 font-medium">Activity</th><th className="pb-2 font-medium">Credits</th><th className="pb-2 font-medium">Date</th></tr></thead><tbody>{data.transactions.map(row => <tr key={row.id} className="border-t border-slate-800 text-slate-300"><td className="py-2">{row.type.replaceAll('_', ' ').toLowerCase().replace(/^\w/, letter => letter.toUpperCase())}</td><td className="py-2">{row.type === 'SESSION_RESERVATION' ? `${row.credits} held` : row.type === 'FREE_SESSION' ? 'Included' : `${row.amountUnits > 0 ? '+' : row.amountUnits < 0 ? '−' : ''}${row.credits}`}</td><td className="py-2">{new Date(row.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div> : <p className="mt-2 text-sm text-slate-500">Your credit activity will appear here.</p>}</div>}
  </section>;
}
