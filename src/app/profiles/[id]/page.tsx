'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Loader2,
  FileText,
  FlaskConical,
  Compass,
  TrendingUp,
  Target,
  Lightbulb,
  Sparkles,
  Palette,
} from 'lucide-react';
import { AppSidebar } from '@/components/shell/app-sidebar';
import { JOURNEY_FIELD_GROUPS, JOURNEY_FIELD_LABELS } from '@/lib/journey/field-catalog';
import type { BusinessProfile, ProfileSession } from '@/lib/profiles/business-profiles';
import { ScriptPackViewer } from '@/components/scripts/script-pack-viewer';
import { StyleRefsTab } from '@/components/scripts/style-refs-tab';
import type { AdScript } from '@/lib/scripts/schemas';

type TabId = 'overview' | 'research' | 'scripts' | 'style-refs';

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', label: 'OVERVIEW', icon: FileText },
  { id: 'research', label: 'RESEARCH', icon: FlaskConical },
  { id: 'scripts', label: 'SCRIPTS', icon: Sparkles },
  { id: 'style-refs', label: 'ASSETS', icon: Palette },
];

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

export default function ProfileDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeTab = (searchParams.get('tab') as TabId) || 'overview';
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [sessions, setSessions] = useState<ProfileSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [latestSessionRunId, setLatestSessionRunId] = useState<string | null>(null);
  const [latestPack, setLatestPack] = useState<{ id: string; scripts: AdScript[] } | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch(`/api/profiles/${id}`);
      if (res.status === 401) {
        router.push('/sign-in');
        return;
      }
      if (res.status === 404) {
        router.push('/profiles');
        return;
      }
      const data = await res.json();
      setProfile(data.profile ?? null);
    } catch {
      router.push('/profiles');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await fetch(`/api/profiles/${id}/sessions`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions ?? []);
      }
    } catch {
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (activeTab === 'research' || activeTab === 'scripts') {
      fetchSessions();
    }
  }, [activeTab, fetchSessions]);

  // Fetch session run_id + latest script pack when Scripts tab is active
  useEffect(() => {
    if (activeTab !== 'scripts' || !profile?.id) return;

    if (sessions.length > 0 && !latestSessionRunId) {
      // Pick the most complete session (highest section count), breaking ties by most recent
      const best = [...sessions].sort((a, b) =>
        b.sectionCount !== a.sectionCount
          ? b.sectionCount - a.sectionCount
          : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];
      setLatestSessionRunId(best.runId);
    }

    fetch(`/api/profiles/${profile.id}/script-packs`)
      .then((res) => res.json())
      .then(({ packs }) => {
        if (packs?.length > 0) {
          const p = packs[0];
          // Skip stale packs stuck in 'generating' for over 5 minutes
          const scripts = typeof p.scripts === 'string' ? JSON.parse(p.scripts) : p.scripts;
          const isStale =
            p.status === 'generating' &&
            (!scripts || scripts.length === 0) &&
            Date.now() - new Date(p.created_at).getTime() > 5 * 60 * 1000;
          if (isStale) return;

          if (p.status === 'complete' || (scripts && scripts.length > 0)) {
            setLatestPack({ id: p.id, scripts });
          }
        }
      })
      .catch(() => {});
  }, [activeTab, profile?.id, sessions, latestSessionRunId]);

  function switchTab(tab: TabId) {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'overview') {
      params.delete('tab');
    } else {
      params.set('tab', tab);
    }
    const qs = params.toString();
    router.push(`/profiles/${id}${qs ? `?${qs}` : ''}`, { scroll: false });
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

  if (!profile) return null;

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg-base)', color: '#E5E5E5' }}>
      <AppSidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl w-full px-8 py-10">
          {/* Back + header */}
          <div className="mb-8">
            <Link
              href="/profiles"
              className="inline-flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors mb-4"
            >
              <ArrowLeft className="size-3.5" />
              All Profiles
            </Link>

            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-11 h-11 rounded-lg bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] text-xl font-bold shrink-0">
                {profile.companyName?.[0]?.toUpperCase() ?? 'B'}
              </span>
              <div>
                <h1 className="font-heading text-2xl font-bold tracking-[-0.03em] text-[var(--text-primary)]">
                  {profile.companyName ?? 'Unnamed Profile'}
                </h1>
                {profile.industryVertical && (
                  <p className="text-sm text-[var(--text-tertiary)] mt-0.5">
                    {profile.industryVertical}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex gap-6 border-b border-[var(--border-default)] mb-8">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => switchTab(tab.id)}
                  className={`flex items-center gap-1.5 pb-2.5 text-xs font-mono font-medium tracking-wider cursor-pointer transition-colors ${
                    isActive
                      ? 'text-[var(--text-primary)] border-b-[1.5px] border-[var(--accent-blue)]'
                      : 'text-[var(--text-quaternary)] hover:text-[var(--text-tertiary)]'
                  }`}
                >
                  <Icon className="size-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          {activeTab === 'overview' && <OverviewTab profile={profile} />}

          {activeTab === 'research' && (
            <ResearchTab
              sessions={sessions}
              loading={sessionsLoading}
              profileName={profile.companyName}
            />
          )}

          {activeTab === 'scripts' && (
            latestSessionRunId ? (
              <ScriptPackViewer
                key={latestPack?.id ?? 'no-pack'}
                profileId={profile.id}
                sessionId={latestSessionRunId}
                initialScripts={latestPack?.scripts}
                initialPackId={latestPack?.id}
              />
            ) : (
              <div className="text-center py-12 text-[var(--text-quaternary)] text-sm">
                Run research for this profile first to generate scripts.
              </div>
            )
          )}

          {activeTab === 'style-refs' && (
            <StyleRefsTab
              profileId={profile.id}
              initialRefs={profile.styleReferences}
              initialProofPoints={profile.proofPoints}
            />
          )}
        </div>
      </main>
    </div>
  );
}

/* ─── Overview Tab ─── */

function OverviewTab({ profile }: { profile: BusinessProfile }) {
  return (
    <div className="space-y-8">
      {/* AI Insights section */}
      <InsightsSection profile={profile} />

      {/* Onboarding fields by group */}
      {JOURNEY_FIELD_GROUPS.map((group) => {
        const fields = group.fieldKeys
          .filter((key) => key !== 'companyName')
          .map((key) => {
            const raw = profile.allFields[key];
            const value =
              typeof raw === 'string' && raw.trim()
                ? raw
                : Array.isArray(raw) && raw.length > 0
                  ? raw.join(', ')
                  : null;
            return { key, label: JOURNEY_FIELD_LABELS[key] ?? key, value };
          })
          .filter((f) => f.value);

        if (fields.length === 0) return null;

        return (
          <div key={group.id}>
            <p className="text-[11px] uppercase tracking-[0.06em] font-mono font-medium text-[var(--text-quaternary)] mb-3">
              {group.label}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
              {fields.map(({ key, label, value }) => (
                <div key={key}>
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-quaternary)] mb-0.5">
                    {label}
                  </p>
                  <p className="text-sm text-[var(--text-secondary)]">{value}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function InsightsSection({ profile }: { profile: BusinessProfile }) {
  const hasInsights = profile.aiInsights && Object.keys(profile.aiInsights).length > 0;
  const offerScore = profile.offerScore as Record<string, unknown> | null;
  const positioning = profile.positioningStrategy as Record<string, unknown> | null;
  const insights = profile.aiInsights as Record<string, unknown> | null;

  if (!hasInsights) {
    return (
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] p-6 text-center">
        <Lightbulb className="size-6 text-[var(--text-quaternary)] mx-auto mb-2" />
        <p className="text-sm text-[var(--text-tertiary)] mb-1">No AI insights yet</p>
        <p className="text-xs text-[var(--text-quaternary)]">
          Run a research journey to unlock offer scores, positioning, and key findings.
        </p>
        <Link
          href="/journey"
          className="inline-flex items-center gap-1.5 mt-4 px-3 py-1.5 rounded-md bg-[var(--accent-blue)] text-white text-xs font-medium hover:opacity-90 transition-opacity"
        >
          <Compass className="size-3.5" />
          Start Journey
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-[11px] uppercase tracking-[0.06em] font-mono font-medium text-[var(--text-quaternary)]">
        AI Intelligence
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Offer Score */}
        {offerScore && (
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="size-3.5 text-[var(--accent-blue)]" />
              <p className="text-[10px] uppercase tracking-wider font-mono text-[var(--text-tertiary)]">
                Offer Score
              </p>
            </div>
            {Object.entries(offerScore).map(([dimension, score]) => {
              if (typeof score !== 'number' && typeof score !== 'string') return null;
              return (
                <div key={dimension} className="flex items-center justify-between py-1">
                  <span className="text-xs text-[var(--text-secondary)] capitalize">
                    {dimension.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                  <span className="text-xs font-mono text-[var(--text-primary)] tabular-nums">
                    {String(score)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Positioning Strategy */}
        {positioning && (
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Target className="size-3.5 text-[var(--accent-blue)]" />
              <p className="text-[10px] uppercase tracking-wider font-mono text-[var(--text-tertiary)]">
                Positioning
              </p>
            </div>
            {Object.entries(positioning).map(([key, value]) => {
              if (!value || typeof value !== 'string') return null;
              return (
                <div key={key} className="mb-2">
                  <p className="text-[10px] uppercase tracking-wider text-[var(--text-quaternary)] mb-0.5">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{value}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Key Insights */}
      {Array.isArray(insights?.keyInsights) && insights.keyInsights.length > 0 ? (
        <div className="space-y-2">
          {(insights.keyInsights as string[]).map((insight, i) => (
            <div
              key={i}
              className="border-l-2 border-[var(--accent-blue)] pl-3 py-1"
            >
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{insight}</p>
            </div>
          ))}
        </div>
      ) : null}

      {profile.lastResearchAt && (
        <p className="text-[10px] font-mono text-[var(--text-quaternary)]">
          Last researched {formatDate(profile.lastResearchAt)}
        </p>
      )}
    </div>
  );
}

/* ─── Research Tab ─── */

function ResearchTab({
  sessions,
  loading,
  profileName,
}: {
  sessions: ProfileSession[];
  loading: boolean;
  profileName: string | null;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-5 animate-spin text-[var(--text-tertiary)]" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FlaskConical className="size-6 text-[var(--text-quaternary)] mb-3" />
        <p className="text-sm text-[var(--text-tertiary)] mb-1">No research sessions yet</p>
        <p className="text-xs text-[var(--text-quaternary)] max-w-sm mb-5">
          {profileName
            ? `Start a journey for ${profileName} to see research history here.`
            : 'Start a journey to see research history here.'}
        </p>
        <Link
          href="/journey"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--accent-blue)] text-white text-xs font-medium hover:opacity-90 transition-opacity"
        >
          <Compass className="size-3.5" />
          Start Journey
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] uppercase tracking-[0.06em] font-mono font-medium text-[var(--text-quaternary)] mb-3">
        Research Sessions ({sessions.length})
      </p>

      {sessions.map((session) => (
        <Link
          key={session.id}
          href={`/research/${session.runId}`}
          className="flex items-center justify-between rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] p-4 transition-colors hover:border-[var(--border-hover)] hover:bg-[var(--bg-hover)]"
        >
          <div className="flex items-center gap-3">
            <FlaskConical className="size-4 text-[var(--text-quaternary)]" />
            <div>
              <p className="text-sm text-[var(--text-primary)]">
                {formatDate(session.createdAt)}
              </p>
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                {session.sectionCount}/{session.totalSections} sections completed
              </p>
            </div>
          </div>
          <SectionProgress count={session.sectionCount} total={session.totalSections} />
        </Link>
      ))}
    </div>
  );
}

function SectionProgress({ count, total }: { count: number; total: number }) {
  const isComplete = count === total;
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className="w-1.5 h-4 rounded-sm"
            style={{
              background:
                i < count
                  ? isComplete
                    ? 'var(--accent-green)'
                    : 'var(--accent-blue)'
                  : 'var(--border-default)',
            }}
          />
        ))}
      </div>
      <span
        className="text-[10px] font-mono font-medium tabular-nums"
        style={{
          color: isComplete ? 'var(--accent-green)' : 'var(--text-tertiary)',
        }}
      >
        {count}/{total}
      </span>
    </div>
  );
}
