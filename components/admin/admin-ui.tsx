import type { ReactNode } from 'react';
import Link from 'next/link';

export function AdminHeading({ eyebrow = 'GENZZ AI ADMIN', title, description, action }: { eyebrow?: string; title: string; description: string; action?: ReactNode }) {
  return <header className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">{eyebrow}</p><h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">{title}</h1><p className="mt-2 max-w-3xl text-sm text-slate-400">{description}</p></div>{action}</header>;
}

export function AdminStat({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return <article className="rounded-xl border border-slate-800 bg-slate-900/70 p-5"><p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p><p className="mt-3 text-3xl font-semibold text-white">{value}</p>{note && <p className="mt-2 text-xs text-slate-500">{note}</p>}</article>;
}

export function AdminTable({ children, headers }: { children: ReactNode; headers: string[] }) {
  return <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60"><table className="min-w-full divide-y divide-slate-800 text-left text-sm"><thead className="bg-slate-900"><tr>{headers.map((header) => <th key={header} className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-800">{children}</tbody></table></div>;
}

export function AdminEmpty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-slate-700 px-5 py-10 text-center text-sm text-slate-400">{children}</p>;
}

export function AdminPagination({ page, pageSize, total, basePath, query = '' }: { page: number; pageSize: number; total: number; basePath: string; query?: string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (nextPage: number) => `${basePath}?${query ? `${query}&` : ''}page=${nextPage}`;
  return <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm text-slate-400">
    <span>Showing {total ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, total)} of {total}</span>
    <div className="flex gap-2"><Link aria-disabled={page <= 1} className={`rounded-lg border border-slate-700 px-3 py-2 ${page <= 1 ? 'pointer-events-none opacity-40' : 'hover:bg-slate-800'}`} href={href(Math.max(1, page - 1))}>Previous</Link><span className="px-2 py-2">Page {page} of {pages}</span><Link aria-disabled={page >= pages} className={`rounded-lg border border-slate-700 px-3 py-2 ${page >= pages ? 'pointer-events-none opacity-40' : 'hover:bg-slate-800'}`} href={href(Math.min(pages, page + 1))}>Next</Link></div>
  </nav>;
}

export function dateLabel(value: Date | null | undefined) {
  return value ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(value) : '—';
}

export function shortId(value: string | null | undefined) {
  return value ? `${value.slice(0, 7)}…${value.slice(-4)}` : '—';
}
