import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { CreateSessionForm } from '@/components/interviews/create-session-form';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function CreateSessionPage() {
  const authSession = await getServerSession(authOptions);

  if (!authSession?.user?.id) {
    redirect('/login');
  }

  const resumes = await prisma.resume.findMany({
    where: { userId: authSession.user.id, processingStatus: 'COMPLETED' },
    select: {
      id: true,
      fileName: true,
      fileType: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const preferences = await prisma.user.findUnique({
    where: { id: authSession.user.id },
    select: { targetRole: true, experienceLevel: true, preferredLanguage: true, preferredAnswerFormat: true, preferredAIProvider: true },
  });

  return (
    <DashboardShell>
      <CreateSessionForm
        defaults={preferences || undefined}
        resumes={resumes.map((resume) => ({
          ...resume,
          createdAt: resume.createdAt.toISOString(),
        }))}
      />
    </DashboardShell>
  );
}
