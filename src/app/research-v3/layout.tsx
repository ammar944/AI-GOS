import type { ReactNode } from 'react';

import { requireActiveAccount } from '@/lib/auth/app-access';
import { ResearchAppShell } from '@/components/shell/research-app-shell';

interface ResearchV3LayoutProps {
  children: ReactNode;
}

export default async function ResearchV3Layout({
  children,
}: ResearchV3LayoutProps): Promise<ReactNode> {
  await requireActiveAccount();
  return <ResearchAppShell>{children}</ResearchAppShell>;
}
