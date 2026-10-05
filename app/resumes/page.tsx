import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ResumeManager } from '@/components/resumes/resume-manager';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function ResumesPage({ searchParams: searchParamsPromise }: { searchParams: Promise<{  returnTo?: string  }> }) {
  const searchParams = await searchParamsPromise;
  const authSession = await getServerSession(authOptions);
  if (!authSession?.user?.id) redirect('/login');

  const resumes = await prisma.resume.findMany({
    where: { userId: authSession.user.id },
    select: {
      id: true,
      fileName: true,
      fileType: true,
      mimeType: true,
      fileSize: true,
      processingStatus: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <DashboardShell>
      <ResumeManager
        returnTo={searchParams?.returnTo === '/onboarding' ? '/onboarding' : undefined}
        initialResumes={resumes.map((resume) => ({ ...resume, createdAt: resume.createdAt.toISOString() }))}
      />
    </DashboardShell>
  );
}
