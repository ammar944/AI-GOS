import type { ReactNode } from 'react';

import { requireActiveAccount } from '@/lib/auth/app-access';

interface ResearchV2LayoutProps {
  children: ReactNode;
}

export default async function ResearchV2Layout({
  children,
}: ResearchV2LayoutProps): Promise<ReactNode> {
  await requireActiveAccount();
  return children;
}
