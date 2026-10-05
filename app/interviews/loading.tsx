import { DashboardShell } from '@/components/layout/dashboard-shell';

export default function InterviewsLoading() {
  return (
    <DashboardShell>
      <div className="card animate-pulse">
        <div className="h-8 w-64 rounded bg-slate-800" />
        <div className="mt-6 space-y-3">{[1, 2, 3].map((item) => <div key={item} className="h-20 rounded-lg bg-slate-800/70" />)}</div>
        <p className="sr-only">Loading interview sessions...</p>
      </div>
    </DashboardShell>
  );
}
