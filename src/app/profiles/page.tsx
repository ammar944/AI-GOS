import { redirect } from 'next/navigation';
import { requireActiveAccount } from '@/lib/auth/app-access';
import ProfilesPageClient from './profiles-client';

export default async function ProfilesPage() {
  const access = await requireActiveAccount();
  if (access.role === 'client' && access.primaryProfileId) {
    redirect(`/profiles/${access.primaryProfileId}`);
  }
  return <ProfilesPageClient />;
}
