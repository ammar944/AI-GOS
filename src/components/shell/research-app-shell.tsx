'use client';

import type { ReactNode } from 'react';

import { AppSidebar } from '@/components/shell/app-sidebar';
import { ShellProvider } from '@/components/shell/shell-provider';

// Folds /research-v3 inside the standard app shell (left nav + content area).
// Mirrors the dashboard/profiles wrapper, but uses overflow-hidden on <main>
// so each research phase view (welcome / corpus / onboarding / reader) owns
// its own scroll instead of the viewport scrolling behind a fixed nav.
export function ResearchAppShell({ children }: { children: ReactNode }) {
  return (
    <ShellProvider>
      <div
        className="flex h-screen overflow-hidden"
        style={{ background: 'var(--bg-base)' }}
      >
        <AppSidebar />
        <main className="flex-1 min-w-0 overflow-hidden">{children}</main>
      </div>
    </ShellProvider>
  );
}
