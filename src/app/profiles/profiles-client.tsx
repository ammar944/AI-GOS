'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Compass,
  Building2,
  Pencil,
  X,
  Loader2,
} from 'lucide-react';
import { AppSidebar } from '@/components/shell/app-sidebar';
import { PROFILE_FIELD_GROUPS, PROFILE_MULTILINE_KEYS, JOURNEY_FIELD_LABELS } from '@/lib/journey/field-catalog';
import type { BusinessProfile } from '@/lib/profiles/business-profiles';

function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Recently';
  }
}

export default function ProfilesPageClient() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<BusinessProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfiles = useCallback(async () => {
    try {
      const res = await fetch('/api/profiles');
      if (res.status === 401) {
        router.push('/sign-in');
        return;
      }
      const data = await res.json();
      setProfiles(data.profiles ?? []);
    } catch {
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  function startEdit(profile: BusinessProfile) {
    setEditingId(profile.id);
    setError(null);
    const fields: Record<string, string> = {};
    for (const group of PROFILE_FIELD_GROUPS) {
      for (const key of group.fieldKeys) {
        const fromAll = profile.allFields[key];
        const value =
          typeof fromAll === 'string'
            ? fromAll
            : Array.isArray(fromAll)
              ? fromAll.join(', ')
              : '';
        fields[key] = value;
      }
    }
    setEditFields(fields);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditFields({});
    setError(null);
  }

  async function saveEdit(profileId: string) {
    setSaving(true);
    setError(null);
    try {
      const { companyName: _, ...fieldsToSave } = editFields;
      const res = await fetch(`/api/profiles/${profileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: fieldsToSave }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Save failed');
        return;
      }
      setEditingId(null);
      setEditFields({});
      await fetchProfiles();
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen" style={{ background: 'var(--bg-base)', color: '#E5E5E5' }}>
        <AppSidebar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="size-6 animate-spin text-[var(--text-tertiary)]" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg-base)', color: '#E5E5E5' }}>
      <AppSidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl w-full px-8 py-10">
          <div className="mb-10">
            <h1 className="font-heading text-2xl font-bold tracking-[-0.03em] text-[var(--text-primary)]">
              Business Profiles
            </h1>
            <p className="mt-1 text-sm text-[var(--text-tertiary)]">
              Saved business profiles from your research journeys
            </p>
          </div>

          {profiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[var(--bg-hover)] flex items-center justify-center mb-4">
                <Building2 className="size-7 text-[var(--text-tertiary)]" />
              </div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                No profiles yet
              </h2>
              <p className="text-sm text-[var(--text-tertiary)] max-w-sm mb-6">
                Complete a research journey and your business profile will be saved automatically.
              </p>
              <Link
                href="/journey"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-green)] text-white text-sm font-medium cursor-pointer hover:opacity-90 transition-opacity"
              >
                <Compass className="size-4" />
                Start a Journey
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {profiles.map((profile) => {
                const isEditing = editingId === profile.id;

                return (
                  <div
                    key={profile.id}
                    className={`rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 transition-colors hover:border-[var(--border-hover)] ${
                      isEditing ? '' : 'cursor-pointer'
                    }`}
                    onClick={() => {
                      if (!isEditing) router.push(`/profiles/${profile.id}`);
                    }}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--bg-hover)] text-[var(--text-secondary)] border border-[var(--border-subtle)] text-lg font-bold shrink-0">
                          {profile.companyName?.[0]?.toUpperCase() ?? 'B'}
                        </span>
                        <div>
                          <h3 className="text-base font-semibold text-[var(--text-primary)]">
                            {profile.companyName ?? 'Unnamed'}
                          </h3>
                          {profile.industryVertical && (
                            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                              {profile.industryVertical}
                            </p>
                          )}
                        </div>
                      </div>
                      {isEditing ? (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); cancelEdit(); }}
                          className="flex items-center gap-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] cursor-pointer transition-colors"
                        >
                          <X className="size-3.5" />
                          Cancel
                        </button>
                      ) : (
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-[var(--text-quaternary)] shrink-0">
                            {formatDate(profile.updatedAt)}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); startEdit(profile); }}
                            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--text-secondary)] bg-[var(--bg-hover)] hover:bg-[var(--bg-active)] border border-[var(--border-subtle)] cursor-pointer transition-colors"
                          >
                            <Pencil className="size-3" />
                            Edit
                          </button>
                        </div>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="space-y-5" onClick={(e) => e.stopPropagation()}>
                        {PROFILE_FIELD_GROUPS.map((group) => (
                          <div key={group.id}>
                            <p className="text-[10px] uppercase tracking-wider text-[var(--text-quaternary)] mb-2 font-medium">
                              {group.label}
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {group.fieldKeys.map((key) => {
                                const isCompanyName = key === 'companyName';
                                const isMultiline = PROFILE_MULTILINE_KEYS.has(key);
                                const baseClasses = `w-full rounded-md border px-3 py-1.5 text-xs text-[var(--text-primary)] bg-[var(--bg-base)] outline-none transition-colors ${
                                  isCompanyName
                                    ? 'border-transparent opacity-50 cursor-not-allowed'
                                    : 'border-[var(--border-subtle)] focus:border-[var(--text-primary)]'
                                }`;
                                return (
                                  <div key={key} className={isMultiline ? 'sm:col-span-2' : ''}>
                                    <label className="block text-[10px] uppercase tracking-wider text-[var(--text-quaternary)] mb-1">
                                      {JOURNEY_FIELD_LABELS[key] ?? key}
                                    </label>
                                    {isMultiline ? (
                                      <textarea
                                        value={editFields[key] ?? ''}
                                        rows={3}
                                        onChange={(e) =>
                                          setEditFields((prev) => ({
                                            ...prev,
                                            [key]: e.target.value,
                                          }))
                                        }
                                        className={`${baseClasses} resize-y`}
                                      />
                                    ) : (
                                      <input
                                        type="text"
                                        value={editFields[key] ?? ''}
                                        readOnly={isCompanyName}
                                        onChange={(e) =>
                                          setEditFields((prev) => ({
                                            ...prev,
                                            [key]: e.target.value,
                                          }))
                                        }
                                        className={baseClasses}
                                      />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}

                        {error && (
                          <p className="text-xs text-red-400">{error}</p>
                        )}

                        <div className="flex justify-end gap-2 pt-2">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); cancelEdit(); }}
                            className="rounded-md border border-[var(--border-default)] px-4 py-1.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] cursor-pointer transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); saveEdit(profile.id); }}
                            disabled={saving}
                            className="rounded-md bg-[var(--accent-green)] px-4 py-1.5 text-xs text-white font-medium hover:bg-[var(--accent-green)]/90 cursor-pointer transition-colors disabled:opacity-50"
                          >
                            {saving ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              'Save Changes'
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <ProfileSummaryGrid profile={profile} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function ProfileSummaryGrid({ profile }: { profile: BusinessProfile }) {
  const summaryFields: { label: string; value: string | null }[] = [];

  for (const group of PROFILE_FIELD_GROUPS) {
    for (const key of group.fieldKeys) {
      if (key === 'companyName') continue;
      const raw = profile.allFields[key];
      const value =
        typeof raw === 'string' && raw.trim()
          ? raw
          : Array.isArray(raw) && raw.length > 0
            ? raw.join(', ')
            : null;
      if (value) {
        const label = JOURNEY_FIELD_LABELS[key] ?? key;
        summaryFields.push({ label, value });
      }
    }
  }

  if (summaryFields.length === 0) {
    return (
      <p className="text-xs text-[var(--text-quaternary)] italic">
        No fields saved yet. Run a research journey to populate.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {summaryFields.map(({ label, value }) => (
        <div key={label} className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-quaternary)]">
            {label}
          </p>
          <p className="text-xs text-[var(--text-secondary)] truncate">{value}</p>
        </div>
      ))}
    </div>
  );
}
