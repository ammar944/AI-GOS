import Link from 'next/link';
import { AppSidebar } from '@/components/shell/app-sidebar';
import { createAdminClient } from '@/lib/supabase/server';
import { requireActiveAccount, requireAdmin } from '@/lib/auth/app-access';
import { ImpersonateClientButton } from './impersonate-button';

export default async function InternalClientsPage() {
  const access = await requireActiveAccount();
  const isAdmin = requireAdmin(access);

  const supabase = createAdminClient();
  const { data: clients } = await supabase
    .from('user_profiles')
    .select('id, email, primary_profile_id, account_status, created_at')
    .eq('app_role', 'client')
    .order('created_at', { ascending: false });

  const rows = clients ?? [];

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg-base)', color: '#E5E5E5' }}>
      <AppSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl w-full px-8 py-10 space-y-6">
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-[-0.03em] text-[var(--text-primary)]">
              Client accounts
            </h1>
            <p className="mt-1 text-sm text-[var(--text-tertiary)]">
              Review client workspaces and open impersonation to edit on their behalf.
            </p>
          </div>

          {isAdmin && (
            <p className="text-sm text-[var(--text-secondary)]">
              Manage the invite allowlist via{' '}
              <Link
                href="/internal/allowlist"
                className="text-[var(--accent-green)] underline-offset-2 hover:underline"
              >
                Allowlist admin
              </Link>
              .
            </p>
          )}

          <div className="rounded-xl border border-[var(--border-default)] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg-hover)] text-[var(--text-tertiary)] text-left text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Primary profile</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-[var(--text-quaternary)]">
                      No client accounts yet.
                    </td>
                  </tr>
                ) : (
                  rows.map((c) => (
                    <tr
                      key={c.id as string}
                      className="border-t border-[var(--border-default)] text-[var(--text-secondary)]"
                    >
                      <td className="px-4 py-3">{(c.email as string) ?? c.id}</td>
                      <td className="px-4 py-3">{(c.account_status as string) ?? '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {(c.primary_profile_id as string) ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        {c.primary_profile_id ? (
                          <>
                            <Link
                              href={`/profiles/${c.primary_profile_id as string}`}
                              className="text-[var(--accent-green)] hover:underline"
                            >
                              Open
                            </Link>
                            <ImpersonateClientButton
                              profileId={c.primary_profile_id as string}
                            />
                          </>
                        ) : (
                          <span className="text-[var(--text-quaternary)]">No profile</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
