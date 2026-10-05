import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { OnboardingWelcome } from '@/components/onboarding/welcome';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function WelcomePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, onboardingStatus: true },
  });
  if (!user) redirect('/login');
  if (user.onboardingStatus === 'COMPLETED') redirect('/dashboard');
  if (user.onboardingStatus === 'IN_PROGRESS') redirect('/onboarding');

  return <OnboardingWelcome name={user.name} />;
}
