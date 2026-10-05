import { DashboardShell } from '@/components/layout/dashboard-shell';

export default function ResumeDetailLoading() {
  return (
    <DashboardShell>
      <div className="mx-auto max-w-5xl animate-pulse space-y-6">
        <div className="h-12 w-96 max-w-full rounded bg-slate-800" />
        <div className="card h-[28rem] bg-slate-900/80" />
        <p className="sr-only">Loading resume and extracted text...</p>
      </div>
    </DashboardShell>
  );
}
