import type { ReactNode } from 'react';

import { requireActiveAccount } from '@/lib/auth/app-access';

interface ProfilesLayoutProps {
  children: ReactNode;
}

export default async function ProfilesLayout({
  children,
}: ProfilesLayoutProps): Promise<ReactNode> {
  await requireActiveAccount();
  return children;
}
