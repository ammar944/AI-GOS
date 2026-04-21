'use client';

import { useState } from 'react';

export function ImpersonateClientButton({ profileId }: { profileId: string }) {
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/impersonation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert((data as { error?: string }).error ?? 'Could not start impersonation');
        return;
      }
      window.location.href = `/profiles/${profileId}`;
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void onClick()}
      className="text-xs font-medium text-amber-200 hover:text-amber-100 disabled:opacity-50 cursor-pointer"
    >
      {busy ? 'Starting…' : 'Impersonate'}
    </button>
  );
}
