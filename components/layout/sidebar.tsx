'use client';

import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

const navItems = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Notifications', href: '/notifications' },
  { label: 'Interview Sessions', href: '/interviews' },
  { label: 'Desktop Demo', href: '/desktop-demo' },
  { label: 'Create Session', href: '/interviews/create' },
  { label: 'Resumes', href: '/resumes' },
  { label: 'Question Bank', href: '/question-bank' },
  { label: 'Resume Maker', href: '/resume-maker' },
  { label: 'Subscription', href: '/subscription' },
  { label: 'Credits & Wallet', href: '/credits' },
  { label: 'Settings', href: '/settings' },
];

export function Sidebar() {
  const { data: session } = useSession();
  const [plan, setPlan] = useState<'FREE' | 'PREMIUM'>('FREE');
  useEffect(() => {
    if (!session?.user?.id) return;
    void fetch('/api/subscription', { cache: 'no-store' }).then(response => response.json()).then(data => {
      if (data.subscription?.plan === 'FREE' || data.subscription?.plan === 'PREMIUM') setPlan(data.subscription.plan);
    }).catch(() => setPlan(session.user.subscriptionType || 'FREE'));
  }, [session?.user?.id, session?.user?.subscriptionType]);

  return (
    <aside className="flex w-full max-w-[260px] flex-col border-r border-slate-800 bg-slate-950/80 p-5">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/20 text-sm font-bold text-violet-300">
          GZ
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-violet-300">Genzz AI</p>
          <h2 className="text-xs font-medium text-slate-400">Prepare Smarter. Interview Better.</h2>
        </div>
      </div>

      <nav className="space-y-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center rounded-lg border border-transparent px-3 py-2.5 text-sm font-medium text-slate-200 transition hover:border-violet-500/30 hover:bg-slate-800/80"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-auto space-y-4">
        <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Logged in as</p>
          <p className="mt-3 text-sm text-slate-100">{session?.user?.email || 'Loading...'}</p>
          <div className="mt-3 inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
            {plan === 'PREMIUM' ? '⭐ Premium' : 'Free'}
          </div>
        </div>

        <button
          type="button"
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 transition hover:bg-slate-800"
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          Logout
        </button>
      </div>
    </aside>
  );
}
