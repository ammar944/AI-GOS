'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import {
  Loader2,
  RefreshCw,
  Database,
  FlaskConical,
  Trash2,
  Play,
  Copy,
  AlertTriangle,
  CheckCircle2,
  Server,
} from 'lucide-react';
import { ArtifactPanel } from '@/components/journey/artifact-panel';
import {
  JourneyKeywordIntelDetail,
  getJourneyKeywordIntelDetailData,
} from '@/components/journey/journey-keyword-intel-detail';
import { JourneyResearchSandboxSequencePanel } from '@/components/journey/journey-research-sandbox-sequence-panel';
import { ResearchInlineCard } from '@/components/journey/research-inline-card';
import { KeyedResearchSubsectionReveal } from '@/components/journey/keyed-research-subsection-reveal';
import { JourneyResearchSandboxChecklist } from '@/components/journey/journey-research-sandbox-checklist';
import {
  collapseResearchJobUpdates,
  extractResearchJobActivity,
  useResearchJobActivity,
  type ResearchJobActivity,
} from '@/lib/journey/research-job-activity';
import {
  useResearchRealtime,
  type ResearchSectionResult,
} from '@/lib/journey/research-realtime';
import {
  buildJourneyResearchSandboxContext,
  buildJourneyResearchSandboxUnifiedExport,
  buildJourneyResearchSandboxUnifiedReport,
  JOURNEY_RESEARCH_PRODUCTION_SEQUENCE,
  JOURNEY_RESEARCH_SANDBOX_SECTIONS,
  getJourneyResearchSandboxUserId,
  getJourneyResearchSandboxRunAllSequence,
  getJourneySandboxMissingPrerequisites,
  type JourneyResearchSandboxSection,
  type JourneyResearchSandboxBackendStatus,
  type JourneyResearchSandboxSnapshot,
} from '@/lib/journey/research-sandbox';
import { cn } from '@/lib/utils';

interface JourneyResearchSandboxProps {
  liveUserId: string;
}

type ContextSource = 'live' | 'sandbox';

interface SequenceRunState {
  status: 'idle' | 'running' | 'complete' | 'error';
  activeSection: JourneyResearchSandboxSection | null;
  error: string | null;
}

interface SectionSettlement {
  snapshot: JourneyResearchSandboxSnapshot;
  status: 'complete' | 'partial' | 'error';
  error: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return 'Never';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function formatJson(value: unknown): string {
  if (value == null) {
    return 'null';
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getSectionLabel(section: JourneyResearchSandboxSection): string {
  return (
    JOURNEY_RESEARCH_SANDBOX_SECTIONS.find((config) => config.section === section)
      ?.label ?? section
  );
}

function getArtifactStatus(
  result: ResearchSectionResult | null,
  activity: ResearchJobActivity | undefined,
): 'loading' | 'complete' | 'error' {
  if (result?.status === 'complete') {
    return 'complete';
  }

  if (result?.status === 'error' || activity?.status === 'error') {
    return 'error';
  }

  return 'loading';
}

function canUseJourneyArtifactRenderer(section: JourneyResearchSandboxSection): boolean {
  return (
    section === 'industryMarket' ||
    section === 'competitors' ||
    section === 'icpValidation' ||
    section === 'offerAnalysis'
  );
}

function getSectionStatusValue(
  snapshot: JourneyResearchSandboxSnapshot | null,
  section: JourneyResearchSandboxSection,
): string {
  const sandboxResult = snapshot?.sandboxSession.researchResults[section];
  if (sandboxResult) {
    return sandboxResult.status;
  }

  const liveResult = snapshot?.liveSession.researchResults[section];
  if (liveResult) {
    return `live ${liveResult.status}`;
  }

  return 'empty';
}

function formatCapabilityValue(value: boolean | null | undefined): string {
  if (value == null) {
    return 'unknown';
  }

  return value ? 'ready' : 'missing';
}

export function JourneyResearchSandbox({
  liveUserId,
}: JourneyResearchSandboxProps) {
  const [sandboxKey, setSandboxKey] = useState('default');
  const [section, setSection] =
    useState<JourneyResearchSandboxSection>('industryMarket');
  const [contextSource, setContextSource] = useState<ContextSource>('sandbox');
  const [context, setContext] = useState('');
  const [snapshot, setSnapshot] = useState<JourneyResearchSandboxSnapshot | null>(
    null,
  );
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [realtimeResetSignal, setRealtimeResetSignal] = useState(0);
  const [ignoreRealtimeBefore, setIgnoreRealtimeBefore] = useState<string | null>(
    null,
  );
  const [realtimeResults, setRealtimeResults] = useState<
    Record<string, ResearchSectionResult>
  >({});
  const [sequenceRun, setSequenceRun] = useState<SequenceRunState>({
    status: 'idle',
    activeSection: null,
    error: null,
  });
  const [isPending, startTransition] = useTransition();

  const sandboxUserId = useMemo(
    () => getJourneyResearchSandboxUserId(liveUserId, sandboxKey),
    [liveUserId, sandboxKey],
  );

  const loadSnapshot = useCallback(
    async (
      options?: {
        hydrateContext?: boolean;
        preferredSource?: ContextSource;
        section?: JourneyResearchSandboxSection;
      },
    ) => {
      const targetSection = options?.section ?? section;
      const params = new URLSearchParams({
        sandboxKey,
        section: targetSection,
      });

      const response = await fetch(
        `/api/journey/dev/research-sandbox?${params.toString()}`,
        {
          cache: 'no-store',
        },
      );
      const payload = (await response.json()) as
        | JourneyResearchSandboxSnapshot
        | { error?: string };

      if (!response.ok) {
        throw new Error(
          isRecord(payload) && 'error' in payload && typeof payload.error === 'string'
            ? payload.error
            : 'Failed to load sandbox snapshot',
        );
      }

      const nextSnapshot = payload as JourneyResearchSandboxSnapshot;
      setSnapshot(nextSnapshot);

      if (options?.hydrateContext) {
        const source = options.preferredSource ?? contextSource;
        setContext(nextSnapshot.suggestedContext[source]);
      }

      return nextSnapshot;
    },
    [contextSource, sandboxKey, section],
  );

  useEffect(() => {
    let cancelled = false;

    void loadSnapshot({
      hydrateContext: true,
      preferredSource: contextSource,
    })
      .then(() => {
        if (!cancelled) {
          setSnapshotError(null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setSnapshotError(
            error instanceof Error ? error.message : 'Failed to load snapshot',
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [contextSource, loadSnapshot]);

  useResearchRealtime({
    userId: sandboxUserId,
    resetSignal: realtimeResetSignal,
    ignoreUpdatedBefore: ignoreRealtimeBefore,
    onSectionComplete: (completedSection, result) => {
      setRealtimeResults((previous) => ({
        ...previous,
        [completedSection]: result,
      }));
      if (completedSection === section) {
        void loadSnapshot();
      }
    },
  });

  const jobActivity = useResearchJobActivity({
    userId: sandboxUserId,
    resetSignal: realtimeResetSignal,
    ignoreUpdatedBefore: ignoreRealtimeBefore,
  });

  const clearRealtimeSection = useCallback((targetSection: JourneyResearchSandboxSection) => {
    setRealtimeResults((previous) => {
      const next = { ...previous };
      delete next[targetSection];
      return next;
    });
  }, []);

  const clearAllRealtimeSections = useCallback(() => {
    setRealtimeResults({});
  }, []);

  const performSandboxRequest = useCallback(
    async (
      actionLabel: string,
      targetSection: JourneyResearchSandboxSection,
      requestBody: Record<string, unknown>,
    ): Promise<JourneyResearchSandboxSnapshot> => {
      const response = await fetch('/api/journey/dev/research-sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sandboxKey,
          section: targetSection,
          ...requestBody,
        }),
      });

      const payload = (await response.json()) as
        | { error?: string; snapshot?: JourneyResearchSandboxSnapshot }
        | {
            ok: boolean;
            snapshot: JourneyResearchSandboxSnapshot;
          };

      if (!response.ok) {
        throw new Error(
          isRecord(payload) && 'error' in payload && typeof payload.error === 'string'
            ? payload.error
            : `${actionLabel} failed`,
        );
      }

      const nextSnapshot = payload.snapshot ?? (await loadSnapshot({ section: targetSection }));
      setSnapshot(nextSnapshot);
      return nextSnapshot;
    },
    [loadSnapshot, sandboxKey],
  );

  const runAction = useCallback(
    (
      actionLabel: string,
      requestBody: Record<string, unknown>,
      options?: {
        resetRealtime?: boolean;
        clearSelectedSection?: boolean;
        clearAllRealtime?: boolean;
        onSuccess?: (nextSnapshot: JourneyResearchSandboxSnapshot) => void;
      },
    ) => {
      setPendingAction(actionLabel);
      setSnapshotError(null);

      startTransition(async () => {
        try {
          if (options?.resetRealtime) {
            setIgnoreRealtimeBefore(new Date().toISOString());
            setRealtimeResetSignal((value) => value + 1);
          }

          if (options?.clearSelectedSection) {
            clearRealtimeSection(section);
          }

          if (options?.clearAllRealtime) {
            clearAllRealtimeSections();
          }

          const nextSnapshot = await performSandboxRequest(
            actionLabel,
            section,
            requestBody,
          );
          options?.onSuccess?.(nextSnapshot);
        } catch (error) {
          setSnapshotError(
            error instanceof Error ? error.message : `${actionLabel} failed`,
          );
        } finally {
          setPendingAction(null);
        }
      });
    },
    [clearAllRealtimeSections, clearRealtimeSection, performSandboxRequest, section],
  );

  const waitForSectionSettlement = useCallback(
    async (
      targetSection: JourneyResearchSandboxSection,
    ): Promise<SectionSettlement> => {
      const deadline = Date.now() + 10 * 60 * 1000;

      while (Date.now() < deadline) {
        const nextSnapshot = await loadSnapshot({ section: targetSection });
        const result = nextSnapshot.sandboxSession.researchResults[targetSection];
        const activity = extractResearchJobActivity(
          nextSnapshot.sandboxSession.jobStatus,
        )[targetSection];

        if (result?.status === 'complete') {
          return {
            snapshot: nextSnapshot,
            status: 'complete',
            error: null,
          };
        }

        if (result?.status === 'partial' || result?.status === 'error') {
          return {
            snapshot: nextSnapshot,
            status: result.status,
            error:
              result.error ??
              `${getSectionLabel(targetSection)} did not complete successfully.`,
          };
        }

        if (activity?.status === 'error') {
          return {
            snapshot: nextSnapshot,
            status: 'error',
            error: activity.error ?? `${getSectionLabel(targetSection)} worker job failed.`,
          };
        }

        await new Promise((resolve) => window.setTimeout(resolve, 2000));
      }

      throw new Error(`${getSectionLabel(targetSection)} timed out in the sandbox.`);
    },
    [loadSnapshot],
  );

  const runSequence = useCallback(() => {
    setPendingAction('Run first six sections');
    setSnapshotError(null);

    startTransition(async () => {
      try {
        const nextIgnoreBoundary = new Date().toISOString();
        setIgnoreRealtimeBefore(nextIgnoreBoundary);
        setRealtimeResetSignal((value) => value + 1);
        setRealtimeResults({});
        setSequenceRun({
          status: 'running',
          activeSection: null,
          error: null,
        });

        const sequence = getJourneyResearchSandboxRunAllSequence();
        const sequenceIssues: string[] = [];
        let currentSnapshot = await performSandboxRequest(
          'Clear sandbox',
          sequence[0],
          { action: 'clear', scope: 'all' },
        );

        for (const targetSection of sequence) {
          const missingPrerequisites = getJourneySandboxMissingPrerequisites(
            targetSection,
            currentSnapshot.sandboxSession.researchResults,
          );

          if (missingPrerequisites.length > 0) {
            const prerequisiteLabels = missingPrerequisites
              .map((dependency) => getSectionLabel(dependency))
              .join(', ');
            sequenceIssues.push(
              `${getSectionLabel(targetSection)} blocked by ${prerequisiteLabels}.`,
            );
            continue;
          }

          setSection(targetSection);
          setContextSource('sandbox');
          setSequenceRun({
            status: 'running',
            activeSection: targetSection,
            error: null,
          });

          const contextPayload = buildJourneyResearchSandboxContext(targetSection, {
            metadata:
              currentSnapshot.sandboxSession.metadata ??
              currentSnapshot.liveSession.metadata,
            researchResults: currentSnapshot.sandboxSession.researchResults,
          });
          setContext(contextPayload);
          clearRealtimeSection(targetSection);

          await performSandboxRequest('Run section', targetSection, {
            action: 'run',
            context: contextPayload,
          });
          const settlement = await waitForSectionSettlement(targetSection);
          currentSnapshot = settlement.snapshot;

          if (settlement.status !== 'complete') {
            sequenceIssues.push(
              settlement.error ??
                `${getSectionLabel(targetSection)} completed with ${settlement.status}.`,
            );
          }
        }

        const sequenceMessage =
          sequenceIssues.length > 0
            ? `Run finished with issues. ${sequenceIssues.join(' ')}`
            : 'Run finished successfully.';

        setSnapshotError(
          sequenceIssues.length > 0 ? sequenceMessage : null,
        );
        setSequenceRun({
          status: sequenceIssues.length > 0 ? 'error' : 'complete',
          activeSection: null,
          error: sequenceIssues.length > 0 ? sequenceMessage : null,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Run-first-six sequence failed.';
        setSnapshotError(message);
        setSequenceRun({
          status: 'error',
          activeSection: null,
          error: message,
        });
      } finally {
        setPendingAction(null);
      }
    });
  }, [
    clearRealtimeSection,
    performSandboxRequest,
    waitForSectionSettlement,
  ]);

  const selectedSnapshotResult =
    (snapshot?.sandboxSession.researchResults[section] as
      | ResearchSectionResult
      | undefined) ?? null;
  const snapshotActivityBySection = useMemo(
    () => extractResearchJobActivity(snapshot?.sandboxSession.jobStatus),
    [snapshot?.sandboxSession.jobStatus],
  );
  const selectedSnapshotActivity = snapshotActivityBySection[section];
  const selectedResult = realtimeResults[section] ?? selectedSnapshotResult;
  const selectedActivity = jobActivity[section] ?? selectedSnapshotActivity;
  const selectedData = isRecord(selectedResult?.data)
    ? selectedResult.data
    : undefined;
  const selectedStatus = getArtifactStatus(selectedResult, selectedActivity);
  const hasSelectedArtifact = Boolean(selectedResult || selectedActivity);
  const sandboxResultKeys = useMemo(
    () => Object.keys(snapshot?.sandboxSession.researchResults ?? {}),
    [snapshot],
  );
  const mergedSandboxResults = useMemo(
    () => ({
      ...(snapshot?.liveSession.researchResults ?? {}),
      ...(snapshot?.sandboxSession.researchResults ?? {}),
    }),
    [snapshot],
  );
  const draftResearchResults = useMemo(
    () =>
      contextSource === 'live'
        ? (snapshot?.liveSession.researchResults ?? {})
        : mergedSandboxResults,
    [contextSource, mergedSandboxResults, snapshot],
  );
  const missingPrerequisites = useMemo(
    () => getJourneySandboxMissingPrerequisites(section, draftResearchResults),
    [draftResearchResults, section],
  );
  const unifiedReport = useMemo(
    () =>
      buildJourneyResearchSandboxUnifiedReport({
        sandboxResults: snapshot?.sandboxSession.researchResults,
        sandboxJobStatus: snapshot?.sandboxSession.jobStatus,
        liveResults: snapshot?.liveSession.researchResults,
      }),
    [snapshot],
  );
  const unifiedOutput = useMemo(
    () => buildJourneyResearchSandboxUnifiedExport(unifiedReport),
    [unifiedReport],
  );
  const sequenceRows = useMemo(
    () =>
      JOURNEY_RESEARCH_PRODUCTION_SEQUENCE.map((sequenceSection, index) => [
        `${String(index + 1).padStart(2, '0')} · ${getSectionLabel(sequenceSection)}`,
        getSectionStatusValue(snapshot, sequenceSection),
      ] as [string, string]),
    [snapshot],
  );

  const liveContextAvailable = Boolean(snapshot?.liveSession.exists);
  const sandboxDraftAvailable = Boolean(
    snapshot?.sandboxSession.exists || snapshot?.sandboxSession.contextDrafts[section],
  );

  return (
    <div className="min-h-screen bg-[var(--bg-base)] relative overflow-hidden">
      <div className="sl-shader-background" />
      <div className="sl-bg-pattern" />

      <div className="relative z-10 mx-auto max-w-[1600px] px-6 py-10 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-mono uppercase tracking-[0.22em] text-[var(--accent-cyan)]">
              <FlaskConical className="h-3.5 w-3.5" />
              Journey Research Sandbox
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-text-primary">
              Single-section QA harness
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-text-secondary">
              This page dispatches the real Journey research worker against a sandbox-scoped
              `journey_sessions` row, so prompts, tools, worker activity, persistence, and result
              shapes stay on the production path while the live Journey session stays untouched.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(sandboxUserId);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-white/[0.08] hover:text-text-primary"
            >
              <Copy className="h-4 w-4" />
              Copy sandbox user id
            </button>
            <button
              type="button"
              onClick={() => {
                void loadSnapshot({
                  hydrateContext: false,
                }).catch((error) => {
                  setSnapshotError(
                    error instanceof Error ? error.message : 'Refresh failed',
                  );
                });
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-white/[0.08] hover:text-text-primary"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh snapshot
            </button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[440px_minmax(0,1fr)]">
          <section className="space-y-6">
            <div className="rounded-[28px] border border-white/10 bg-[rgba(8,12,20,0.82)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent-blue)]">
                    Controls
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-text-tertiary">
                    Pick a section, load or edit the exact context string, then dispatch only that
                    worker job.
                  </p>
                </div>
                {isPending ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-3 py-1 text-xs text-text-secondary">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {pendingAction ?? 'Working'}
                  </span>
                ) : null}
              </div>

              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                    Sandbox key
                  </span>
                  <input
                    value={sandboxKey}
                    onChange={(event) => setSandboxKey(event.target.value)}
                    className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-text-primary outline-none transition-colors focus:border-[var(--accent-blue)]"
                    placeholder="default"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                    Section
                  </span>
                  <select
                    value={section}
                    onChange={(event) =>
                      setSection(event.target.value as JourneyResearchSandboxSection)
                    }
                    className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-text-primary outline-none transition-colors focus:border-[var(--accent-blue)]"
                  >
                    {JOURNEY_RESEARCH_SANDBOX_SECTIONS.map((config) => (
                      <option key={config.section} value={config.section}>
                        {config.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      setContextSource('live');
                      if (snapshot) {
                        setContext(snapshot.suggestedContext.live);
                      }
                    }}
                    className={cn(
                      'rounded-xl border px-4 py-3 text-left transition-colors',
                      contextSource === 'live'
                        ? 'border-[var(--accent-blue)] bg-[var(--accent-blue)]/10'
                        : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]',
                    )}
                  >
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">
                      Load live Journey
                    </div>
                    <div className="mt-1 text-sm text-text-secondary">
                      Build a context draft from the real Journey metadata and live persisted
                      upstream artifacts.
                    </div>
                    <div className="mt-2 text-[11px] text-text-tertiary">
                      {liveContextAvailable ? 'Available' : 'No live session data found'}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setContextSource('sandbox');
                      if (snapshot) {
                        setContext(snapshot.suggestedContext.sandbox);
                      }
                    }}
                    className={cn(
                      'rounded-xl border px-4 py-3 text-left transition-colors',
                      contextSource === 'sandbox'
                        ? 'border-[var(--accent-cyan)] bg-[var(--accent-cyan)]/10'
                        : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]',
                    )}
                  >
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">
                      Load sandbox draft
                    </div>
                    <div className="mt-1 text-sm text-text-secondary">
                      Reuse the last context draft for this section, or synthesize a draft from the
                      sandbox row.
                    </div>
                    <div className="mt-2 text-[11px] text-text-tertiary">
                      {sandboxDraftAvailable ? 'Available' : 'No saved sandbox draft yet'}
                    </div>
                  </button>
                </div>

                <label className="block">
                  <span className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                    Context payload
                  </span>
                  <textarea
                    value={context}
                    onChange={(event) => setContext(event.target.value)}
                    rows={18}
                    className="min-h-[340px] w-full rounded-2xl border border-white/10 bg-[#06101c] px-4 py-4 font-mono text-xs leading-6 text-text-primary outline-none transition-colors focus:border-[var(--accent-blue)]"
                    placeholder="Paste the exact research context you want to send to the worker."
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() =>
                      runAction(
                        'Seed sandbox',
                        { action: 'seed' },
                        {
                          onSuccess: (nextSnapshot) => {
                            setContext(nextSnapshot.suggestedContext[contextSource]);
                          },
                        },
                      )
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-text-secondary transition-colors hover:bg-white/[0.08] hover:text-text-primary"
                  >
                    <Database className="h-4 w-4" />
                    Seed sandbox from live
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      runAction(
                        'Clear section',
                        { action: 'clear', scope: 'section' },
                        { resetRealtime: true, clearSelectedSection: true },
                      )
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-text-secondary transition-colors hover:bg-white/[0.08] hover:text-text-primary"
                  >
                    <Trash2 className="h-4 w-4" />
                    Clear selected section
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      runAction(
                        'Run section',
                        { action: 'run', context },
                        { resetRealtime: true, clearSelectedSection: true },
                      )
                    }
                    disabled={!context.trim()}
                    className={cn(
                      'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white transition-colors',
                      context.trim()
                        ? 'bg-[linear-gradient(135deg,rgb(32,97,255),rgb(0,173,181))] hover:opacity-90'
                        : 'cursor-not-allowed bg-white/[0.08] text-text-tertiary',
                    )}
                  >
                    <Play className="h-4 w-4" />
                    Run selected section
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      runAction(
                        'Clear sandbox',
                        { action: 'clear', scope: 'all' },
                        {
                          resetRealtime: true,
                          clearAllRealtime: true,
                          onSuccess: (nextSnapshot) => {
                            setContext(nextSnapshot.suggestedContext[contextSource]);
                          },
                        },
                      )
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-[rgba(255,120,120,0.25)] bg-[rgba(255,120,120,0.06)] px-4 py-3 text-sm text-[rgb(255,189,189)] transition-colors hover:bg-[rgba(255,120,120,0.12)]"
                  >
                    <Trash2 className="h-4 w-4" />
                    Clear full sandbox
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <InfoCard
                title="Session routing"
                rows={[
                  ['Live user id', liveUserId],
                  ['Sandbox user id', sandboxUserId],
                  ['Live session updated', formatTimestamp(snapshot?.liveSession.updatedAt)],
                  ['Sandbox updated', formatTimestamp(snapshot?.sandboxSession.updatedAt)],
                ]}
              />
              <InfoCard
                title="Persisted sections"
                rows={JOURNEY_RESEARCH_SANDBOX_SECTIONS.map((config) => [
                  config.label,
                  snapshot?.sandboxSession.researchResults[config.section]?.status ?? 'empty',
                ])}
                onRowClick={(label) => {
                  const match = JOURNEY_RESEARCH_SANDBOX_SECTIONS.find(
                    (config) => config.label === label,
                  );
                  if (match) {
                    setSection(match.section);
                  }
                }}
              />
              <InfoCard
                title="Current backend order"
                rows={sequenceRows}
                onRowClick={(label) => {
                  const sequenceMatch = JOURNEY_RESEARCH_PRODUCTION_SEQUENCE.find(
                    (sequenceSection) => label.endsWith(getSectionLabel(sequenceSection)),
                  );
                  if (sequenceMatch) {
                    setSection(sequenceMatch);
                  }
                }}
              />
              <BackendStatusCard backendStatus={snapshot?.backendStatus ?? null} />
            </div>

            {snapshotError ? (
              <div className="rounded-2xl border border-[rgba(255,120,120,0.24)] bg-[rgba(255,120,120,0.08)] px-4 py-3 text-sm text-[rgb(255,198,198)]">
                {snapshotError}
              </div>
            ) : null}
          </section>

          <section className="space-y-6">
            <JourneyResearchSandboxSequencePanel
              report={unifiedReport}
              isRunning={sequenceRun.status === 'running'}
              activeSection={sequenceRun.activeSection}
              sequenceStatus={sequenceRun.status}
              sequenceMessage={sequenceRun.error}
              unifiedOutput={unifiedOutput}
              onRunAll={runSequence}
              onCopyUnifiedOutput={() => {
                void navigator.clipboard?.writeText(unifiedOutput);
              }}
              onSelectSection={setSection}
            />

            <div className="grid gap-4 md:grid-cols-3">
              <MetricCard
                label="Selected section"
                value={getSectionLabel(section)}
                detail="Worker dispatch target"
              />
              <MetricCard
                label="Artifact status"
                value={selectedResult?.status ?? selectedActivity?.status ?? 'idle'}
                detail={selectedActivity?.jobId ?? 'No job recorded yet'}
              />
              <MetricCard
                label="Saved sandbox artifacts"
                value={String(sandboxResultKeys.length)}
                detail={sandboxResultKeys.length > 0 ? sandboxResultKeys.join(', ') : 'None yet'}
              />
            </div>

            {snapshot ? (
              <SectionReadinessCard
                section={section}
                contextSource={contextSource}
                missingPrerequisites={missingPrerequisites}
                sandboxStatus={snapshot.sandboxSession.researchResults[section]?.status ?? null}
                liveStatus={snapshot.liveSession.researchResults[section]?.status ?? null}
              />
            ) : null}

            {snapshot ? (
              <JourneyResearchSandboxChecklist
                section={section}
                missingPrerequisites={missingPrerequisites}
                backendStatus={snapshot.backendStatus}
                selectedResult={selectedResult}
                selectedActivity={selectedActivity}
              />
            ) : null}

            <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.15fr)_minmax(380px,0.85fr)]">
              <div className="rounded-[30px] border border-white/10 bg-[rgba(8,12,20,0.84)] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent-cyan)]">
                      Rendered preview
                    </h2>
                    <p className="mt-1 text-xs text-text-tertiary">
                      Existing Journey artifact renderer when available; otherwise the same inline
                      research cards and subsection reveal components the app already uses for
                      later-stage Journey outputs.
                    </p>
                  </div>
                  <StatusPill status={selectedResult?.status ?? selectedActivity?.status ?? 'idle'} />
                </div>

                {canUseJourneyArtifactRenderer(section) ? (
                  hasSelectedArtifact ? (
                    <div className="h-[760px] overflow-hidden rounded-[24px] border border-white/8">
                      <ArtifactPanel
                        section={section}
                        status={selectedStatus}
                        data={selectedData}
                        activity={selectedActivity}
                        approved={false}
                        onApprove={() => undefined}
                        onRequestChanges={() => undefined}
                        onClose={() => undefined}
                        showCloseButton={false}
                        showReviewControls={false}
                      />
                    </div>
                  ) : (
                    <InlineSectionPreview
                      section={section}
                      result={selectedResult}
                      activity={selectedActivity}
                    />
                  )
                ) : (
                  <InlineSectionPreview
                    section={section}
                    result={selectedResult}
                    activity={selectedActivity}
                  />
                )}
              </div>

              <div className="space-y-6">
                <JsonCard
                  title="Final persisted result"
                  body={formatJson(selectedResult)}
                  subtitle="This is the exact object currently stored in journey_sessions.research_results for the sandbox row."
                />
                <JsonCard
                  title="Selected job activity"
                  body={formatJson(selectedActivity)}
                  subtitle="Raw job_status entry collapsed down to the latest job for this section."
                />
                <JsonCard
                  title="Live result for this section"
                  body={formatJson(snapshot?.liveSession.researchResults[section] ?? null)}
                  subtitle="Useful when comparing the sandbox rerun against the current production Journey artifact."
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-[rgba(8,12,20,0.82)] px-5 py-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">
        {label}
      </div>
      <div className="mt-3 text-xl font-semibold text-text-primary">{value}</div>
      <div className="mt-2 text-xs leading-5 text-text-tertiary">{detail}</div>
    </div>
  );
}

function InfoCard({
  title,
  rows,
  onRowClick,
}: {
  title: string;
  rows: Array<[string, string]>;
  onRowClick?: (label: string) => void;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-[rgba(8,12,20,0.82)] p-5">
      <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-text-tertiary">
        {title}
      </h3>
      <div className="mt-4 space-y-2">
        {rows.map(([label, value]) => (
          <button
            key={label}
            type="button"
            onClick={() => onRowClick?.(label)}
            className={cn(
              'flex w-full items-start justify-between gap-4 rounded-xl px-3 py-2 text-left',
              onRowClick ? 'transition-colors hover:bg-white/[0.05]' : 'cursor-default',
            )}
          >
            <span className="text-xs text-text-tertiary">{label}</span>
            <span className="text-xs font-mono text-text-secondary">{value}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-mono uppercase tracking-[0.14em]',
        normalized === 'complete' && 'bg-[rgba(30,170,95,0.16)] text-[rgb(134,255,188)]',
        normalized === 'error' && 'bg-[rgba(255,120,120,0.16)] text-[rgb(255,188,188)]',
        normalized === 'running' && 'bg-[rgba(48,126,255,0.18)] text-[rgb(168,205,255)]',
        normalized === 'idle' && 'bg-white/[0.06] text-text-tertiary',
        normalized !== 'complete' &&
          normalized !== 'error' &&
          normalized !== 'running' &&
          normalized !== 'idle' &&
          'bg-[rgba(255,186,59,0.14)] text-[rgb(255,222,158)]',
      )}
    >
      {status}
    </span>
  );
}

function JsonCard({
  title,
  subtitle,
  body,
}: {
  title: string;
  subtitle: string;
  body: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-[rgba(8,12,20,0.82)] p-4">
      <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--accent-blue)]">
        {title}
      </h3>
      <p className="mt-2 text-xs leading-5 text-text-tertiary">{subtitle}</p>
      <pre className="mt-4 max-h-[280px] overflow-auto rounded-2xl bg-[#06101c] px-4 py-4 text-xs leading-6 text-text-secondary">
        {body}
      </pre>
    </div>
  );
}

function BackendStatusCard({
  backendStatus,
}: {
  backendStatus: JourneyResearchSandboxBackendStatus | null;
}) {
  const rows: Array<[string, string]> = [
    ['Worker URL', backendStatus?.workerUrlConfigured ? 'configured' : 'missing'],
    ['Worker health', backendStatus?.workerReachable ? 'reachable' : 'unreachable'],
    ['Web search', formatCapabilityValue(backendStatus?.capabilities?.webSearch)],
    ['SpyFu', formatCapabilityValue(backendStatus?.capabilities?.spyfu)],
    ['Firecrawl', formatCapabilityValue(backendStatus?.capabilities?.firecrawl)],
    ['Google Ads', formatCapabilityValue(backendStatus?.capabilities?.googleAds)],
    ['Meta Ads', formatCapabilityValue(backendStatus?.capabilities?.metaAds)],
    ['GA4', formatCapabilityValue(backendStatus?.capabilities?.ga4)],
    ['Charting', formatCapabilityValue(backendStatus?.capabilities?.charting)],
  ];

  return (
    <div className="rounded-[24px] border border-white/10 bg-[rgba(8,12,20,0.82)] p-5">
      <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-text-tertiary">
        <Server className="h-4 w-4 text-[var(--accent-cyan)]" />
        Backend readiness
      </div>
      <div className="mt-4 space-y-2">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex items-start justify-between gap-4 rounded-xl px-3 py-2"
          >
            <span className="text-xs text-text-tertiary">{label}</span>
            <span className="text-xs font-mono text-text-secondary">{value}</span>
          </div>
        ))}
      </div>
      {backendStatus?.warnings.length ? (
        <div className="mt-4 space-y-2 rounded-2xl border border-[rgba(255,186,59,0.18)] bg-[rgba(255,186,59,0.08)] p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[rgb(255,222,158)]">
            <AlertTriangle className="h-3.5 w-3.5" />
            Warnings
          </div>
          <div className="space-y-2 text-xs leading-5 text-[rgb(255,222,158)]">
            {backendStatus.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-[rgba(30,170,95,0.2)] bg-[rgba(30,170,95,0.08)] px-4 py-3 text-xs text-[rgb(170,255,203)]">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Worker route is reachable and no readiness warnings were detected.
        </div>
      )}
    </div>
  );
}

function SectionReadinessCard({
  section,
  contextSource,
  missingPrerequisites,
  sandboxStatus,
  liveStatus,
}: {
  section: JourneyResearchSandboxSection;
  contextSource: ContextSource;
  missingPrerequisites: JourneyResearchSandboxSection[];
  sandboxStatus: string | null;
  liveStatus: string | null;
}) {
  const dependencyLabels = JOURNEY_RESEARCH_SANDBOX_SECTIONS.find(
    (config) => config.section === section,
  )?.dependsOn.map(getSectionLabel) ?? [];

  return (
    <div
      className={cn(
        'rounded-[24px] border p-5',
        missingPrerequisites.length > 0
          ? 'border-[rgba(255,186,59,0.2)] bg-[rgba(255,186,59,0.08)]'
          : 'border-[rgba(30,170,95,0.2)] bg-[rgba(30,170,95,0.08)]',
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        <StatusPill status={sandboxStatus ?? liveStatus ?? 'idle'} />
        <div className="text-sm font-semibold text-text-primary">
          {getSectionLabel(section)} readiness
        </div>
        <div className="text-xs text-text-tertiary">
          Context draft source: {contextSource === 'live' ? 'live Journey' : 'sandbox + live fallback'}
        </div>
      </div>
      <div className="mt-3 text-sm leading-6 text-text-secondary">
        {dependencyLabels.length > 0
          ? `Dependencies: ${dependencyLabels.join(', ')}.`
          : 'This section has no upstream dependencies.'}
      </div>
      {missingPrerequisites.length > 0 ? (
        <div className="mt-3 text-sm leading-6 text-[rgb(255,222,158)]">
          Missing persisted prerequisites for this draft: {missingPrerequisites.map(getSectionLabel).join(', ')}.
          You can still run manually, but the worker will only see whatever is currently in the context box.
        </div>
      ) : (
        <div className="mt-3 text-sm leading-6 text-[rgb(170,255,203)]">
          Persisted dependencies are available for this draft, so reruns should match the normal backend path.
        </div>
      )}
    </div>
  );
}

function InlineSectionPreview({
  section,
  result,
  activity,
}: {
  section: JourneyResearchSandboxSection;
  result: ResearchSectionResult | null;
  activity: ResearchJobActivity | undefined;
}) {
  const updates = collapseResearchJobUpdates(activity?.updates);
  const data = isRecord(result?.data) ? result.data : undefined;
  const keywordData =
    section === 'keywordIntel'
      ? getJourneyKeywordIntelDetailData(data)
      : null;
  const status =
    !result && !activity
      ? 'idle'
      : getArtifactStatus(result, activity);

  if (status === 'idle') {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="text-sm font-semibold text-text-primary">
          {getSectionLabel(section)}
        </div>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          No sandbox artifact or active worker job exists for this section yet. Load context, run
          the real worker, then inspect the rendered preview and persisted JSON side by side.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <ResearchInlineCard
          section={section}
          status={status}
          data={data}
          activity={activity}
          error={result?.error ?? activity?.error}
        />
        {keywordData ? (
          <JourneyKeywordIntelDetail data={keywordData} className="mt-4" />
        ) : data ? (
          <KeyedResearchSubsectionReveal
            sectionKey={section}
            data={data}
            status={status === 'complete' ? 'complete' : status === 'error' ? 'error' : 'running'}
          />
        ) : null}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-text-tertiary">
          Activity feed
        </div>
        {updates.length > 0 ? (
          <div className="space-y-2 font-mono text-xs text-text-secondary">
            {updates.slice(-12).map((update) => (
              <div key={update.id}>
                [{update.phase}] {update.message}
                {update.count > 1 ? ` x${update.count}` : ''}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-text-tertiary">
            {result?.status === 'complete'
              ? 'Artifact persisted. Inspect the raw JSON panel for the exact payload.'
              : 'No worker updates recorded yet.'}
          </div>
        )}
      </div>
    </div>
  );
}
