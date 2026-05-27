import type { ReactNode } from 'react';
import { notFound, redirect } from 'next/navigation';

import {
  canAccessProfileId,
  fetchBusinessProfileRowById,
  requireActiveAccount,
} from '@/lib/auth/app-access';

interface ProfileDetailLayoutProps {
  children: ReactNode;
  params: Promise<{ id: string }>;
}

export default async function ProfileDetailLayout({
  children,
  params,
}: ProfileDetailLayoutProps): Promise<ReactNode> {
  const { id } = await params;
  const access = await requireActiveAccount();
  const row = await fetchBusinessProfileRowById(id);
  if (!row) notFound();

  const ownerId = row.user_id;
  if (!canAccessProfileId(access, id, ownerId)) {
    if (access.role === 'client' && access.primaryProfileId) {
      redirect(`/profiles/${access.primaryProfileId}`);
    }
    redirect('/profiles');
  }

  return children;
}
