'use client';

import { useState, useEffect, useRef } from 'react';
import { Building2, ChevronDown, Check, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { BusinessProfile } from '@/lib/profiles/business-profiles';

interface ProfileSelectorProps {
  expanded: boolean;
}

export function ProfileSelector({ expanded }: ProfileSelectorProps) {
  const router = useRouter();
  const [profiles, setProfiles] = useState<BusinessProfile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load profiles on mount
  useEffect(() => {
    fetch('/api/profiles')
      .then((r) => r.json())
      .then((data) => {
        const list = (data.profiles ?? []) as BusinessProfile[];
        setProfiles(list);
        // Restore active profile from localStorage
        const stored = localStorage.getItem('aigog_active_profile_id');
        if (stored && list.some((p) => p.id === stored)) {
          setActiveId(stored);
        } else if (list.length > 0) {
          // Default to most recent profile
          setActiveId(list[0].id);
          localStorage.setItem('aigog_active_profile_id', list[0].id);
        }
      })
      .catch(() => { /* non-critical */ })
      .finally(() => setLoading(false));
  }, []);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const activeProfile = profiles.find((p) => p.id === activeId);

  function selectProfile(id: string) {
    setActiveId(id);
    localStorage.setItem('aigog_active_profile_id', id);
    setOpen(false);
  }

  function handleNewJourney() {
    setOpen(false);
    router.push('/journey');
  }

  // Don't render during initial load
  if (loading) {
    return null;
  }

  const hasProfiles = profiles.length > 0;
  const initial = activeProfile?.companyName?.[0]?.toUpperCase() ?? 'B';

  return (
    <div ref={containerRef} className="relative px-2">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-3 w-full h-10 rounded-lg cursor-pointer transition-colors duration-150',
          'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]',
          expanded ? 'px-4' : 'justify-center',
        )}
        title={expanded ? undefined : (hasProfiles ? (activeProfile?.companyName ?? 'Profiles') : 'Profiles')}
      >
        {hasProfiles ? (
          <span
            className={cn(
              'flex items-center justify-center shrink-0 rounded-md text-[11px] font-semibold',
              'w-[18px] h-[18px] bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]',
            )}
          >
            {initial}
          </span>
        ) : (
          <Building2 size={18} className="shrink-0" />
        )}
        {expanded && (
          <>
            <span className="text-[13px] font-medium whitespace-nowrap truncate min-w-0 flex-1 text-left">
              {hasProfiles ? (activeProfile?.companyName ?? 'Select profile') : 'Profiles'}
            </span>
            <ChevronDown
              size={14}
              className={cn(
                'shrink-0 text-[var(--text-tertiary)] transition-transform duration-150',
                open && 'rotate-180',
              )}
            />
          </>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className={cn(
            'absolute z-50 py-1 rounded-lg border shadow-lg',
            'bg-[var(--bg-elevated)] border-[var(--border-default)]',
            expanded
              ? 'left-2 right-2 bottom-full mb-1'
              : 'left-full ml-2 bottom-0 w-56',
          )}
        >
          <div className="px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
            Profiles
          </div>

          {hasProfiles ? (
            <div className="max-h-48 overflow-y-auto">
              {profiles.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => selectProfile(profile.id)}
                  className={cn(
                    'flex items-center gap-3 w-full px-3 py-2 text-left cursor-pointer transition-colors duration-100',
                    profile.id === activeId
                      ? 'bg-[var(--accent-blue)]/10 text-[var(--text-primary)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]',
                  )}
                >
                  <span
                    className={cn(
                      'flex items-center justify-center shrink-0 rounded-md text-[10px] font-semibold',
                      'w-6 h-6',
                      profile.id === activeId
                        ? 'bg-[var(--accent-blue)]/20 text-[var(--accent-blue)]'
                        : 'bg-[var(--bg-hover)] text-[var(--text-tertiary)]',
                    )}
                  >
                    {profile.companyName?.[0]?.toUpperCase() ?? 'B'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium truncate">
                      {profile.companyName ?? 'Unnamed'}
                    </div>
                    {profile.industryVertical && (
                      <div className="text-[11px] text-[var(--text-tertiary)] truncate">
                        {profile.industryVertical}
                      </div>
                    )}
                  </div>
                  {profile.id === activeId && (
                    <Check size={14} className="shrink-0 text-[var(--accent-blue)]" />
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="px-3 py-3 text-[12px] text-[var(--text-tertiary)]">
              No profiles yet. Complete a journey to save your first business profile.
            </div>
          )}

          <div className="border-t border-[var(--border-default)] mt-1 pt-1">
            <button
              type="button"
              onClick={handleNewJourney}
              className="flex items-center gap-3 w-full px-3 py-2 text-left cursor-pointer text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors duration-100"
            >
              <Plus size={14} className="shrink-0" />
              <span className="text-[13px]">New Journey</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
