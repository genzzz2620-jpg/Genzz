import { AdminHeading } from '@/components/admin/admin-ui';
import { requireAdminPage } from '@/lib/admin/auth';

export default async function AdminSettingsPage() {
  const access = await requireAdminPage();
  if (!access.authorized) return null;
  return <><AdminHeading title="Admin settings" description="Administrative configuration status. Secret values and credentials are never displayed." />
    <section className="card"><h2 className="text-lg font-semibold">Access and configuration</h2><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><dt className="text-slate-400">Admin access</dt><dd>Granted by the server side ADMIN role</dd><dt className="text-slate-400">User administration</dt><dd>Available in Users</dd><dt className="text-slate-400">AI pricing estimates</dt><dd>Configured through server environment rates</dd><dt className="text-slate-400">Service configuration</dt><dd><a className="text-violet-300 hover:underline" href="/admin/system-health">View system health</a></dd></dl></section>
  </>;
}
