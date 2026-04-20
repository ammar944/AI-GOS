'use client';

import { useEffect, useState, useRef } from 'react';
import { ChevronDown, Building2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BusinessProfile } from '@/lib/profiles/business-profiles';

function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

interface ProfileDropdownProps {
  onSelect: (profile: BusinessProfile) => void;
}

export function ProfileDropdown({ onSelect }: ProfileDropdownProps) {
  const [profiles, setProfiles] = useState<BusinessProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<BusinessProfile | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/profiles')
      .then((r) => r.json())
      .then((data) => {
        setProfiles(data.profiles ?? []);
      })
      .catch(() => setProfiles([]))
      .finally(() => setLoading(false));
  }, []);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  // Don't render if loading or no profiles
  if (loading) {
    return (
      <div className="mb-4 w-full flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3">
        <Loader2 className="size-4 animate-spin text-[var(--text-quaternary)]" />
        <span className="text-xs text-[var(--text-quaternary)]">Loading profiles...</span>
      </div>
    );
  }

  if (profiles.length === 0) return null;

  function handleSelect(profile: BusinessProfile) {
    setSelected(profile);
    setOpen(false);
    onSelect(profile);
  }

  return (
    <div className="mb-4 w-full" ref={dropdownRef}>
      <p
        className="mb-2 font-mono text-[10px] font-medium uppercase tracking-wider"
        style={{ color: 'var(--text-quaternary)' }}
      >
        Saved Profiles
      </p>

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full cursor-pointer rounded-lg border px-4 py-3 text-left transition-colors',
          'flex items-center justify-between',
          open
            ? 'border-[var(--text-primary)] bg-[var(--bg-surface)]'
            : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-hover)]',
        )}
      >
        {selected ? (
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex items-center justify-center w-7 h-7 rounded-md bg-[var(--bg-hover)] text-[var(--text-secondary)] border border-[var(--border-subtle)] text-xs font-bold shrink-0">
              {selected.companyName?.[0]?.toUpperCase() ?? 'B'}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                {selected.companyName ?? 'Unnamed'}
              </p>
              {selected.industryVertical && (
                <p className="text-[11px] text-[var(--text-quaternary)] truncate">
                  {selected.industryVertical}
                </p>
              )}
            </div>
          </div>
        ) : (
          <span className="text-sm text-[var(--text-tertiary)]">Select a saved profile</span>
        )}
        <ChevronDown
          className={cn(
            'size-4 text-[var(--text-quaternary)] transition-transform shrink-0 ml-2',
            open && 'rotate-180',
          )}
        />
      </button>

      {/* Dropdown list */}
      {open && (
        <div className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-lg overflow-hidden">
          {profiles.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleSelect(p)}
              className={cn(
                'w-full cursor-pointer px-4 py-2.5 text-left transition-colors flex items-center justify-between',
                'hover:bg-[rgba(54,94,255,0.06)]',
                'border-b border-[var(--border-subtle)] last:border-b-0',
                selected?.id === p.id && 'bg-[rgba(54,94,255,0.06)]',
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex items-center justify-center w-6 h-6 rounded-md bg-[var(--bg-hover)] text-[var(--text-secondary)] border border-[var(--border-subtle)] text-[10px] font-bold shrink-0">
                  {p.companyName?.[0]?.toUpperCase() ?? 'B'}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {p.companyName ?? 'Unnamed'}
                  </p>
                  <p className="text-[11px] text-[var(--text-quaternary)] truncate">
                    {[p.industryVertical, formatDate(p.updatedAt)].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </div>
              {selected?.id === p.id && (
                <span className="text-[var(--accent-green)] text-xs shrink-0">&#10003;</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
