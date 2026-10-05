import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { WelcomeLanding } from '@/components/landing/welcome-landing';
import { authOptions } from '@/lib/auth';

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (session?.user) redirect('/dashboard');

  return <WelcomeLanding />;
}
