'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface ProfileSummary {
  id: string;
  companyName: string | null;
  industryVertical: string | null;
  primaryIcp: string | null;
  monthlyAdBudget: string | null;
  geography: string | null;
  websiteUrl: string | null;
  updatedAt: string;
}

interface ProfilePickerProps {
  onSelect: (profile: ProfileSummary) => void;
  onSkip: () => void;
}

export function ProfilePicker({ onSelect, onSkip }: ProfilePickerProps) {
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/profiles')
      .then((r) => r.json())
      .then((data) => {
        const list = (data.profiles ?? []) as ProfileSummary[];
        setProfiles(list);
      })
      .catch(() => setProfiles([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (profiles.length === 0) return null;

  return (
    <div className="mb-8 w-full max-w-md">
      <p
        className="mb-3 font-mono text-[10px] font-medium uppercase tracking-wider"
        style={{ color: 'var(--text-quaternary)' }}
      >
        Saved Profiles
      </p>
      <div className="space-y-2">
        {profiles.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p)}
            className={cn(
              'w-full cursor-pointer rounded-[6px] p-3 text-left transition-colors',
              'border border-[var(--border-subtle)] hover:border-[var(--border-hover)]',
            )}
            style={{ background: 'var(--bg-card, #12141c)' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {p.companyName ?? 'Unnamed'}
                </p>
                {p.industryVertical && (
                  <p className="mt-0.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {p.industryVertical}
                  </p>
                )}
              </div>
              <span
                className="rounded-[3px] px-1.5 py-px font-mono text-[10px] font-medium"
                style={{ color: 'var(--accent-blue)', background: 'rgba(54,94,255,0.08)' }}
              >
                Run Again
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {p.primaryIcp && (
                <span className="text-[11px] font-mono" style={{ color: 'var(--text-quaternary)' }}>
                  ICP: {p.primaryIcp.slice(0, 40)}{p.primaryIcp.length > 40 ? '...' : ''}
                </span>
              )}
              {p.monthlyAdBudget && (
                <span className="text-[11px] font-mono" style={{ color: 'var(--text-quaternary)' }}>
                  Budget: {p.monthlyAdBudget}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onSkip}
        className="mt-3 cursor-pointer text-xs transition-colors hover:underline"
        style={{ color: 'var(--text-tertiary)' }}
      >
        or start fresh with a new company
      </button>
    </div>
  );
}
