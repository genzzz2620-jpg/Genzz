import type { ReactNode } from 'react';
import { AppShell } from './app-shell';

type DashboardShellProps = {
  children: ReactNode;
};

export function DashboardShell({ children }: DashboardShellProps) {
  return <AppShell>{children}</AppShell>;
}
