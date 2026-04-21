import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { resolveAuthorizedAppUser } from '@/lib/auth/app-access';

export default async function AccessDisabledPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const access = await resolveAuthorizedAppUser();
  if (access?.accountStatus === 'active') {
    redirect('/dashboard');
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: 'var(--bg-base)', color: '#E5E5E5' }}
    >
      <div className="max-w-md text-center space-y-4">
        <h1 className="font-heading text-xl font-semibold text-[var(--text-primary)]">
          Account disabled
        </h1>
        <p className="text-sm text-[var(--text-tertiary)] leading-relaxed">
          Your access to this workspace has been revoked. Contact your administrator
          if you believe this is a mistake.
        </p>
      </div>
    </div>
  );
}
