import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      onboardingStatus: true,
      onboardingStep: true,
      targetRole: true,
      experienceLevel: true,
      preferredLanguage: true,
      preferredAnswerFormat: true,
      preferredAIProvider: true,
    },
  });
  if (!user) redirect('/login');
  if (user.onboardingStatus === 'COMPLETED') redirect('/dashboard');
  if (user.onboardingStatus === 'NOT_STARTED') redirect('/welcome');

  const resumeCount = await prisma.resume.count({ where: { userId: session.user.id, processingStatus: 'COMPLETED' } });
  const providers = [
    ...(process.env.OPENAI_API_KEY ? ['ChatGPT'] : []),
    ...(process.env.GEMINI_API_KEY ? ['Gemini'] : []),
  ];

  return <OnboardingWizard
    initialStep={user.onboardingStep}
    resumeCount={resumeCount}
    providers={providers}
    initialProfile={{
      name: user.name,
      targetRole: user.targetRole || '',
      experienceLevel: user.experienceLevel || '',
      preferredLanguage: user.preferredLanguage || '',
      preferredAnswerFormat: user.preferredAnswerFormat || '',
      preferredAIProvider: user.preferredAIProvider || '',
    }}
  />;
}
