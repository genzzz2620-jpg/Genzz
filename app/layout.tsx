import './globals.css';
import type { Metadata } from 'next';
import { AppSessionProvider } from '@/components/providers/session-provider';

export const metadata: Metadata = {
  title: 'Genzz AI | Prepare Smarter. Interview Better.',
  description: 'Genzz AI — AI-Powered Interview Preparation. Prepare Smarter. Interview Better.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppSessionProvider>{children}</AppSessionProvider>
      </body>
    </html>
  );
}
