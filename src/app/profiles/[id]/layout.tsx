import { notFound, redirect } from 'next/navigation';
import {
  requireActiveAccount,
  fetchBusinessProfileRowById,
  canAccessProfileId,
} from '@/lib/auth/app-access';

export default async function ProfileDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const access = await requireActiveAccount();
  const row = await fetchBusinessProfileRowById(id);
  if (!row) notFound();
  const ownerId = row.user_id as string;
  if (!canAccessProfileId(access, id, ownerId)) {
    if (access.role === 'client' && access.primaryProfileId) {
      redirect(`/profiles/${access.primaryProfileId}`);
    }
    redirect('/profiles');
  }
  return <>{children}</>;
}
