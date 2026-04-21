'use client';

import { useState } from 'react';

export function AllowlistAdminForm() {
  const [email, setEmail] = useState('');
  const [intendedRole, setIntendedRole] = useState<'admin' | 'internal' | 'client'>('client');
  const [status, setStatus] = useState<'pending' | 'approved'>('pending');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/allowlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          intended_role: intendedRole,
          status,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage((data as { error?: string }).error ?? 'Request failed');
        return;
      }
      setEmail('');
      setMessage('Saved. Refresh the list below if it does not update automatically.');
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      className="rounded-xl border border-[var(--border-default)] p-4 space-y-3 max-w-lg"
    >
      <p className="text-xs uppercase tracking-wide text-[var(--text-quaternary)]">
        Add entry
      </p>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="email@company.com"
        className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-sm"
      />
      <div className="flex gap-3 flex-wrap">
        <select
          value={intendedRole}
          onChange={(e) =>
            setIntendedRole(e.target.value as 'admin' | 'internal' | 'client')
          }
          className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2 py-2 text-sm"
        >
          <option value="client">client</option>
          <option value="internal">internal</option>
          <option value="admin">admin</option>
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as 'pending' | 'approved')}
          className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2 py-2 text-sm"
        >
          <option value="pending">pending</option>
          <option value="approved">approved</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-[var(--accent-green)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50 cursor-pointer"
      >
        {busy ? 'Saving…' : 'Add to allowlist'}
      </button>
      {message && <p className="text-xs text-[var(--text-tertiary)]">{message}</p>}
    </form>
  );
}
