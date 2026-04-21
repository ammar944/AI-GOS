import { redirect } from 'next/navigation';
import { requireActiveAccount, isClientJourneyLocked } from '@/lib/auth/app-access';

export default async function JourneyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await requireActiveAccount();
  if (isClientJourneyLocked(access) && access.primaryProfileId) {
    redirect(`/profiles/${access.primaryProfileId}`);
  }
  return <>{children}</>;
}
