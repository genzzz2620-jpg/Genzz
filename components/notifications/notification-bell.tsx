'use client';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { useEffect, useState } from 'react';

export function NotificationBell() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let active = true;
    const refresh = () => { void fetch('/api/notifications', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (active && d) setCount(d.unreadCount || 0); }).catch(() => undefined); };
    refresh(); const timer = window.setInterval(refresh, 60_000); window.addEventListener('focus', refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  return <Link href="/notifications" aria-label={`Notifications${count ? `, ${count} unread` : ', none unread'}`} className="relative rounded-full border border-slate-700 bg-slate-900 p-2 text-slate-200 transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400">
    <Bell className="h-4 w-4" />{count > 0 && <span aria-hidden="true" className="absolute -right-2 -top-2 min-w-5 rounded-full bg-violet-500 px-1 text-center text-[10px] font-bold text-white">{count > 99 ? '99+' : count}</span>}
  </Link>;
}
