import { DashboardShell } from '@/components/layout/dashboard-shell';

export default function CreateSessionLoading() {
  return (
    <DashboardShell>
      <div className="mx-auto max-w-6xl animate-pulse">
        <div className="mb-6 h-9 w-72 rounded bg-slate-800" />
        <div className="grid gap-6 xl:grid-cols-[1.5fr_0.7fr]">
          <div className="space-y-6">
            {[1, 2, 3].map((item) => <div key={item} className="card h-48 bg-slate-900/80" />)}
          </div>
          <div className="card h-80 bg-slate-900/80" />
        </div>
        <p className="sr-only">Loading resumes and session form...</p>
      </div>
    </DashboardShell>
  );
}
