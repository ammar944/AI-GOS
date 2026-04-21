'use client';

import { useEffect, useState, useCallback } from 'react';
import { X } from 'lucide-react';

type Status =
  | { active: false }
  | { active: true; companyName: string };

export function ImpersonationBanner() {
  const [status, setStatus] = useState<Status>({ active: false });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/impersonation');
      if (!res.ok) {
        setStatus({ active: false });
        return;
      }
      const data = await res.json();
      if (data.active) {
        setStatus({ active: true, companyName: data.companyName ?? 'Client' });
      } else {
        setStatus({ active: false });
      }
    } catch {
      setStatus({ active: false });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function exit() {
    await fetch('/api/admin/impersonation', { method: 'DELETE' });
    setStatus({ active: false });
    window.location.href = '/internal/clients';
  }

  if (!status.active) return null;

  return (
    <div
      className="shrink-0 flex items-center justify-between gap-3 px-4 py-2 border-b border-amber-500/40 bg-amber-500/10 text-amber-100 text-[13px]"
      role="status"
    >
      <span>
        Viewing as <strong className="text-amber-50">{status.companyName}</strong>
      </span>
      <button
        type="button"
        onClick={() => void exit()}
        className="inline-flex items-center gap-1 rounded-md border border-amber-500/50 px-2 py-1 text-xs font-medium text-amber-50 hover:bg-amber-500/20 cursor-pointer transition-colors"
      >
        <X className="size-3.5" />
        Exit impersonation
      </button>
    </div>
  );
}
