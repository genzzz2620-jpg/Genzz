'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type Item = { id: string; title: string; message: string; type: string; category: string; actionUrl: string | null; readAt: string | null; createdAt: string };
export function NotificationCenter({ preview = false }: { preview?: boolean }) {
  const [items, setItems] = useState<Item[]>([]); const [unread, setUnread] = useState(0); const [busy, setBusy] = useState(true);
  const load = () => { void fetch('/api/notifications', { cache: 'no-store' }).then(r => r.ok ? r.json() : Promise.reject()).then(d => { setItems(d.items); setUnread(d.unreadCount); }).catch(() => undefined).finally(() => setBusy(false)); };
  useEffect(load, []);
  async function act(url: string, method: string) { await fetch(url, { method }); load(); }
  const shown = preview ? items.slice(0, 5) : items;
  return <section className="card" aria-label="Notifications">
    {!preview && <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold text-white">Notifications</h1><p className="mt-1 text-sm text-slate-400">{unread} unread</p></div>{unread > 0 && <button className="btn-secondary" onClick={() => void act('/api/notifications/read-all', 'PATCH')}>Mark all as read</button>}</div>}
    {busy ? <p className="text-sm text-slate-400">Loading notifications…</p> : shown.length === 0 ? <p className="text-sm text-slate-400">You’re all caught up.</p> : <ul className="space-y-3">{shown.map(item => <li key={item.id} className={`rounded-xl border p-4 ${item.readAt ? 'border-slate-700 bg-slate-950/40' : 'border-violet-500/40 bg-violet-500/5'}`}>
      <div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-white">{item.title}</h2>{!item.readAt && <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-xs text-violet-200">Unread</span>}<span className="text-xs text-slate-400">{item.category.toLowerCase()}</span></div><p className="mt-1 text-sm text-slate-300">{item.message}</p><time className="mt-2 block text-xs text-slate-500" dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
      <div className="mt-3 flex flex-wrap gap-3">{item.actionUrl && <Link onClick={() => { if (!item.readAt) void act(`/api/notifications/${item.id}/read`, 'PATCH'); }} className="text-sm text-violet-300 hover:text-violet-200" href={item.actionUrl}>View details</Link>}{!item.readAt && <button className="text-sm text-slate-300 underline hover:text-white" onClick={() => void act(`/api/notifications/${item.id}/read`, 'PATCH')}>Mark as read</button>}</div></div><button aria-label={`Delete ${item.title}`} className="text-sm text-slate-400 underline hover:text-white" onClick={() => void act(`/api/notifications/${item.id}`, 'DELETE')}>Delete</button></div>
    </li>)}</ul>}{preview && <Link className="mt-4 inline-block text-sm text-violet-300 hover:text-violet-200" href="/notifications">View all notifications</Link>}
  </section>;
}
