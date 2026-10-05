import Link from 'next/link';

const links = [
  ['Dashboard', '/admin'],
  ['Users', '/admin/users'],
  ['Subscriptions', '/admin/subscriptions'],
  ['Interview Sessions', '/admin/interviews'],
  ['Question Bank', '/admin/questions'],
  ['Resumes', '/admin/resumes'],
  ['AI Usage', '/admin/ai-usage'],
  ['Reports', '/admin/reports'],
  ['Audit Logs', '/admin/audit-logs'],
  ['System Health', '/admin/system'],
  ['Settings', '/admin/settings'],
];

export function AdminSidebar() {
  return (
    <aside className="w-full shrink-0 border-b border-slate-800 bg-slate-950/90 p-4 lg:min-h-screen lg:w-64 lg:border-b-0 lg:border-r lg:p-5">
      <Link href="/admin" className="mb-5 block rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
        <p className="text-[10px] uppercase tracking-[0.2em] text-violet-300">Genzz AI</p>
        <p className="mt-1 text-sm font-semibold text-white">Admin Console</p>
        <p className="mt-1 text-xs text-slate-400">Prepare Smarter. Interview Better.</p>
      </Link>
      <nav aria-label="Admin navigation" className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1">
        {links.map(([label, href]) => (
          <Link key={href} href={href} className="rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800 hover:text-white">
            {label}
          </Link>
        ))}
      </nav>
      <Link href="/dashboard" className="mt-4 inline-flex text-xs text-slate-500 hover:text-slate-300">← Back to app</Link>
    </aside>
  );
}
