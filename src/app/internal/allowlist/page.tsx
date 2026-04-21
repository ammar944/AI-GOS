import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppSidebar } from '@/components/shell/app-sidebar';
import { requireActiveAccount, requireAdmin } from '@/lib/auth/app-access';
import { createAdminClient } from '@/lib/supabase/server';
import { AllowlistAdminForm } from './allowlist-admin-form';
import { AllowlistTable } from './allowlist-table';

export default async function AllowlistAdminPage() {
  const access = await requireActiveAccount();
  if (!requireAdmin(access)) {
    redirect('/dashboard');
  }

  const supabase = createAdminClient();
  const { data: entries } = await supabase
    .from('client_allowlist')
    .select('id, email, intended_role, status')
    .order('created_at', { ascending: false });

  const initial = (entries ?? []).map((e) => ({
    id: e.id as string,
    email: e.email as string,
    intended_role: e.intended_role as string,
    status: e.status as string,
  }));

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg-base)', color: '#E5E5E5' }}>
      <AppSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl w-full px-8 py-10 space-y-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="font-heading text-2xl font-bold tracking-[-0.03em] text-[var(--text-primary)]">
                Allowlist
              </h1>
              <p className="mt-1 text-sm text-[var(--text-tertiary)]">
                Invite-only access for external clients and team roles.
              </p>
            </div>
            <Link
              href="/internal/clients"
              className="text-sm text-[var(--accent-green)] hover:underline shrink-0"
            >
              ← Clients
            </Link>
          </div>

          <AllowlistAdminForm />
          <AllowlistTable initial={initial} />
        </div>
      </main>
    </div>
  );
}
