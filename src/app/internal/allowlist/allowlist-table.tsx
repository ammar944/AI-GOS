'use client';

import { useCallback, useEffect, useState } from 'react';

interface Entry {
  id: string;
  email: string;
  intended_role: string;
  status: string;
}

export function AllowlistTable({ initial }: { initial: Entry[] }) {
  const [rows, setRows] = useState(initial);

  const refresh = useCallback(async () => {
    const res = await fetch('/api/admin/allowlist');
    if (!res.ok) return;
    const data = await res.json();
    setRows((data.entries as Entry[]) ?? []);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function patch(id: string, status: 'approved' | 'revoked' | 'pending') {
    const res = await fetch('/api/admin/allowlist', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) void refresh();
  }

  return (
    <div className="rounded-xl border border-[var(--border-default)] overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-[var(--bg-hover)] text-[var(--text-tertiary)] text-left text-xs uppercase tracking-wide">
          <tr>
            <th className="px-4 py-3 font-medium">Email</th>
            <th className="px-4 py-3 font-medium">Role</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-[var(--text-quaternary)]">
                No entries.
              </td>
            </tr>
          ) : (
            rows.map((e) => (
              <tr
                key={e.id}
                className="border-t border-[var(--border-default)] text-[var(--text-secondary)]"
              >
                <td className="px-4 py-3">{e.email}</td>
                <td className="px-4 py-3">{e.intended_role}</td>
                <td className="px-4 py-3">{e.status}</td>
                <td className="px-4 py-3 text-right space-x-3">
                  {e.status !== 'approved' && (
                    <button
                      type="button"
                      onClick={() => void patch(e.id, 'approved')}
                      className="text-xs text-[var(--accent-green)] hover:underline cursor-pointer bg-transparent border-0 p-0"
                    >
                      Approve
                    </button>
                  )}
                  {e.status !== 'revoked' && (
                    <button
                      type="button"
                      onClick={() => void patch(e.id, 'revoked')}
                      className="text-xs text-red-400 hover:underline cursor-pointer bg-transparent border-0 p-0"
                    >
                      Revoke
                    </button>
                  )}
                  {e.status === 'revoked' && (
                    <button
                      type="button"
                      onClick={() => void patch(e.id, 'pending')}
                      className="text-xs text-[var(--text-tertiary)] hover:underline cursor-pointer bg-transparent border-0 p-0"
                    >
                      Reset pending
                    </button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
