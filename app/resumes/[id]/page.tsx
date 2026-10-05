import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { notFound, redirect } from 'next/navigation';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type ResumeDetailPageProps = {
  params: Promise<{ id: string }>;
};

function formatSize(size: number | null) {
  if (size === null) return 'Unavailable';
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function ResumeDetailPage({ params }: ResumeDetailPageProps) {
  const { id } = await params;
  const authSession = await getServerSession(authOptions);
  if (!authSession?.user?.id) redirect('/login');

  const resume = await prisma.resume.findFirst({
    where: { id, userId: authSession.user.id },
    select: {
      id: true,
      fileName: true,
      fileType: true,
      fileSize: true,
      extractedText: true,
      processingStatus: true,
      createdAt: true,
    },
  });
  if (!resume) notFound();

  return (
    <DashboardShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm uppercase tracking-[0.2em] text-violet-300">Resume details</p>
            <h1 className="mt-2 break-all text-2xl font-bold text-white">{resume.fileName}</h1>
            <p className="mt-2 text-sm text-slate-400">{resume.fileType || 'File'} · {formatSize(resume.fileSize)} · Uploaded {resume.createdAt.toLocaleString()}</p>
          </div>
          <span className={`inline-flex w-fit rounded-full border px-3 py-1.5 text-sm ${resume.processingStatus === 'COMPLETED' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : resume.processingStatus === 'FAILED' ? 'border-rose-500/30 bg-rose-500/10 text-rose-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-200'}`}>
            {resume.processingStatus}
          </span>
        </div>

        <section className="card">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="text-xl font-semibold text-white">Extracted text</h2><p className="mt-1 text-sm text-slate-400">Text extracted from the uploaded document. No AI analysis has been performed.</p></div>
            <a href={`/api/resumes/${resume.id}`} className="btn-secondary">Download Original</a>
          </div>
          {resume.processingStatus === 'COMPLETED' && resume.extractedText ? (
            <pre className="mt-5 max-h-[70vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-slate-700 bg-slate-950/60 p-5 font-sans text-sm leading-6 text-slate-200">{resume.extractedText}</pre>
          ) : resume.processingStatus === 'FAILED' ? (
            <div className="mt-5 rounded-lg border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-200">Text extraction failed. Return to your resume list to retry processing.</div>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-slate-600 p-5 text-sm text-slate-300">Resume processing is in progress.</div>
          )}
        </section>

        <Link href="/resumes" className="btn-secondary">Back to Resumes</Link>
      </div>
    </DashboardShell>
  );
}
