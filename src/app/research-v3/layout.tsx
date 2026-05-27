import type { ReactNode } from 'react';

import { requireActiveAccount } from '@/lib/auth/app-access';

interface ResearchV3LayoutProps {
  children: ReactNode;
}

export default async function ResearchV3Layout({
  children,
}: ResearchV3LayoutProps): Promise<ReactNode> {
  await requireActiveAccount();
  return children;
}
