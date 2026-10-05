import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ResumeMaker } from '@/components/resumes/resume-maker';
import { authOptions } from '@/lib/auth';

export default async function ResumeMakerPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');
  return <DashboardShell><ResumeMaker /></DashboardShell>;
}
