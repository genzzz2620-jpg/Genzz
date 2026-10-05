import type { ReactNode } from 'react';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { requireAdminPage } from '@/lib/admin/auth';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const access = await requireAdminPage();
  if (!access.userId) {
    return <main className="grid min-h-screen place-items-center bg-slate-950 p-6 text-slate-100"><p>Sign in to continue.</p></main>;
  }
  if (!access.authorized) {
    return <main className="grid min-h-screen place-items-center bg-slate-950 p-6 text-slate-100"><section className="card max-w-md"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-300">403 Forbidden</p><h1 className="mt-3 text-xl font-semibold">Admin access required</h1><p className="mt-2 text-sm text-slate-400">Your account does not have permission to view this page.</p></section></main>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 lg:flex">
      <AdminSidebar />
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-9">{children}</main>
    </div>
  );
}
