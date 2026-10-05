'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

type Plan = { name: 'FREE' | 'PREMIUM'; priceDisplay: string; billingInterval: string };
type Feature = { label: string; description: string; free: string; premium: string };
export function PricingPlans({ plans, features, paymentsConfigured }: { plans: { FREE: Plan; PREMIUM: Plan }; features: readonly Feature[]; paymentsConfigured: boolean }) {
  const { data: session, status } = useSession();
  const [plan, setPlan] = useState<'FREE' | 'PREMIUM'>(session?.user?.subscriptionType || 'FREE');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!session?.user?.id) return;
    void fetch('/api/subscription', { cache: 'no-store' }).then(response => response.json()).then(data => { if (data.subscription?.plan === 'FREE' || data.subscription?.plan === 'PREMIUM') setPlan(data.subscription.plan); }).catch(() => undefined);
  }, [session?.user?.id]);

  const startCheckout = async () => {
    if (!session?.user) { window.location.assign('/login?callbackUrl=%2Fpricing'); return; }
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/subscription/checkout', { method: 'POST' });
      const data = await response.json();
      if (!response.ok || typeof data.url !== 'string') throw new Error(data.error || 'Unable to start checkout.');
      window.location.assign(data.url);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to start checkout.'); setBusy(false); }
  };

  return <main className="min-h-screen bg-slate-950 px-4 py-12 text-slate-100 sm:px-8"><div className="mx-auto max-w-6xl">
    <header className="mb-10 flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.25em] text-violet-300">Genzz AI</p><h1 className="mt-2 text-3xl font-bold sm:text-4xl">Prepare Smarter. Interview Better.</h1><p className="mt-3 max-w-2xl text-slate-300">Choose a plan for your interview practice. Your account starts on Free; Premium is activated only after a completed checkout is confirmed by billing.</p></div><Link href={session?.user ? '/dashboard' : '/login'} className="btn-secondary">{session?.user ? 'Go to Dashboard' : 'Sign In'}</Link></header>
    {message && <p role="alert" className="mb-6 rounded-lg border border-rose-700 bg-rose-950/50 p-3 text-sm text-rose-200">{message}</p>}
    <section className="grid gap-5 md:grid-cols-2">
      {([plans.FREE, plans.PREMIUM] as Plan[]).map(item => {
        const premium = item.name === 'PREMIUM';
        const current = plan === item.name;
        return <article key={item.name} className={`rounded-2xl border p-6 ${premium ? 'border-violet-400/70 bg-violet-950/20 shadow-xl shadow-violet-950/30' : 'border-slate-700 bg-slate-900/70'}`}>
          <div className="flex items-center justify-between"><h2 className="text-2xl font-bold">{premium ? '⭐ Premium' : 'Free'}</h2>{current && <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">Current Plan</span>}</div>
          <p className="mt-5 text-3xl font-bold">{item.priceDisplay}</p><p className="mt-1 text-sm text-slate-400">{item.billingInterval}</p>
          <ul className="mt-6 space-y-2 text-sm text-slate-200">{features.map(feature => <li key={feature.label} className="flex justify-between gap-4"><span>{feature.label}</span><strong className="text-right">{premium ? feature.premium : feature.free}</strong></li>)}</ul>
          {premium ? current ? <Link href="/subscription" className="btn-secondary mt-7 w-full">Manage Subscription</Link> : <button type="button" className="btn-primary mt-7 w-full" disabled={!paymentsConfigured || busy || status === 'loading'} onClick={() => void startCheckout()}>{busy ? 'Opening secure checkout…' : paymentsConfigured ? 'Upgrade to Premium' : 'Premium checkout not configured'}</button> : current ? <Link href={session?.user ? '/dashboard' : '/register'} className="btn-secondary mt-7 w-full">Your current plan</Link> : plan === 'PREMIUM' ? <button type="button" className="btn-secondary mt-7 w-full" disabled>Included with Premium</button> : <Link href={session?.user ? '/dashboard' : '/register'} className="btn-secondary mt-7 w-full">Start Free</Link>}
          {premium && !paymentsConfigured && <p className="mt-3 text-center text-xs text-slate-400">Checkout becomes available after a payment provider, price, and webhook are configured.</p>}
        </article>;
      })}
    </section>
    <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900/50 p-5"><h2 className="font-semibold text-white">Feature comparison</h2><div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="text-slate-400"><tr><th className="py-2 pr-6">Included today</th><th className="px-6 py-2">Free</th><th className="px-6 py-2">Premium</th></tr></thead><tbody>{features.map(feature => <tr key={feature.label} className="border-t border-slate-800"><th className="py-3 pr-6 font-medium text-slate-200">{feature.label}<span className="mt-1 block text-xs font-normal text-slate-500">{feature.description}</span></th><td className="px-6 py-3 text-slate-300">{feature.free}</td><td className="px-6 py-3 text-slate-300">{feature.premium}</td></tr>)}</tbody></table></div><p className="mt-4 text-xs text-slate-500">Plan limits apply to AI-powered requests across currently available features. Advanced analytics and other unimplemented features are not represented as plan benefits.</p></section>
  </div></main>;
}
