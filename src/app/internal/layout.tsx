import { redirect } from 'next/navigation';
import {
  requireActiveAccount,
  requireInternalOrAdmin,
} from '@/lib/auth/app-access';

export default async function InternalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await requireActiveAccount();
  if (!requireInternalOrAdmin(access)) {
    redirect('/dashboard');
  }
  return <>{children}</>;
}
