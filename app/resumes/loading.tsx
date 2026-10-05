import { DashboardShell } from '@/components/layout/dashboard-shell';

export default function ResumesLoading() {
  return (
    <DashboardShell>
      <div className="card animate-pulse">
        <div className="h-8 w-48 rounded bg-slate-800" />
        <div className="mt-6 h-40 rounded-lg bg-slate-800/70" />
        <div className="mt-6 space-y-3">{[1, 2, 3].map((item) => <div key={item} className="h-16 rounded-lg bg-slate-800/70" />)}</div>
        <p className="sr-only">Loading your resumes...</p>
      </div>
    </DashboardShell>
  );
}
