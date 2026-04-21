import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { resolveAuthorizedAppUser } from '@/lib/auth/app-access';

export default async function AccessPendingPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const access = await resolveAuthorizedAppUser();
  if (access?.accountStatus === 'active') {
    redirect('/dashboard');
  }
  if (access?.accountStatus === 'disabled') {
    redirect('/access-disabled');
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: 'var(--bg-base)', color: '#E5E5E5' }}
    >
      <div className="max-w-md text-center space-y-4">
        <h1 className="font-heading text-xl font-semibold text-[var(--text-primary)]">
          Access pending
        </h1>
        <p className="text-sm text-[var(--text-tertiary)] leading-relaxed">
          Your account is waiting for approval. If you were invited to try AIGOS,
          an administrator must approve your email before you can continue.
        </p>
        <p className="text-xs text-[var(--text-quaternary)]">
          You can refresh this page after you have been approved.
        </p>
      </div>
    </div>
  );
}
