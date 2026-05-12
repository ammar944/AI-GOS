'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Loader2,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  XCircle,
} from 'lucide-react';
import { useUser } from '@clerk/nextjs';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import {
  POSITIONING_SECTION_IDS,
  POSITIONING_SECTION_LABELS,
  type PositioningSectionId,
} from '@/lib/ai/prompts/positioning-skills';
import { useResearchJobActivity } from '@/lib/journey/research-job-activity';

import { AuditArtifactCanvas } from './audit-artifact-canvas';
import { ChatThread } from './chat-thread';
import { RunSectionButton, type SectionRunState } from './run-section-button';
import { SectionErrorCard } from './section-error-card';

interface SectionShellProps {
  runId: string;
  currentSection: PositioningSectionId | null;
}

type ZoneStatus = 'idle' | 'running' | 'complete' | 'error';

function deriveZoneStatus(
  jobStatus: string | undefined,
  resultStatus: string | undefined,
): ZoneStatus {
  if (resultStatus === 'complete') return 'complete';
  if (resultStatus === 'error' || jobStatus === 'error') return 'error';
  if (jobStatus === 'running' || jobStatus === 'pending' || resultStatus === 'pending') {
    return 'running';
  }
  return 'idle';
}

function statusIcon(status: ZoneStatus) {
  if (status === 'running')
    return <Loader2 className="size-3 animate-spin text-primary" />;
  if (status === 'complete')
    return <CheckCircle2 className="size-3 text-emerald-600" />;
  if (status === 'error') return <XCircle className="size-3 text-destructive" />;
  return <Circle className="size-3 text-muted-foreground" />;
}

export function SectionShell({ runId, currentSection }: SectionShellProps) {
  const { user } = useUser();
  const userId = user?.id ?? null;

  const [researchResults, setResearchResults] = useState<
    Record<string, unknown> | null
  >(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(true);
  const [errorBySection, setErrorBySection] = useState<
    Partial<Record<PositioningSectionId, string>>
  >({});

  const activity = useResearchJobActivity({ userId, activeRunId: runId });

  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    let timer: number | null = null;
    let inFlight = false;
    let version = 0;
    let lastApplied = 0;

    const tick = async () => {
      if (inFlight) return; // skip overlapping polls
      inFlight = true;
      const tickVersion = ++version;
      try {
        const url = new URL('/api/journey/session', window.location.origin);
        url.searchParams.set('runId', runId);
        const resp = await fetch(url.toString(), {
          credentials: 'same-origin',
        });
        if (!resp.ok) return;
        const data = (await resp.json()) as {
          researchResults?: Record<string, unknown> | null;
        };
        if (cancelled) return;
        // Drop responses that came back after a newer one already applied.
        if (tickVersion < lastApplied) return;
        lastApplied = tickVersion;
        setResearchResults(data.researchResults ?? null);
      } catch {
        // swallow — polling will retry
      } finally {
        inFlight = false;
      }
    };

    void tick();
    timer = window.setInterval(() => void tick(), 2500);

    return () => {
      cancelled = true;
      if (timer !== null) window.clearInterval(timer);
    };
  }, [runId]);

  const sectionStatuses = useMemo(() => {
    const map = {} as Record<PositioningSectionId, ZoneStatus>;
    for (const id of POSITIONING_SECTION_IDS) {
      const row = researchResults?.[id] as { status?: string } | undefined;
      const job = activity[id];
      map[id] = deriveZoneStatus(job?.status, row?.status);
    }
    return map;
  }, [researchResults, activity]);

  const completedCount = useMemo(
    () =>
      POSITIONING_SECTION_IDS.reduce(
        (n, id) => (sectionStatuses[id] === 'complete' ? n + 1 : n),
        0,
      ),
    [sectionStatuses],
  );

  const handleRunStateChange = useCallback(
    (sectionId: PositioningSectionId, state: SectionRunState) => {
      if (state === 'error') {
        setErrorBySection((prev) => ({
          ...prev,
          [sectionId]: `Failed to dispatch ${POSITIONING_SECTION_LABELS[sectionId]}. Try again.`,
        }));
      } else {
        setErrorBySection((prev) => {
          if (!(sectionId in prev)) return prev;
          const next = { ...prev };
          delete next[sectionId];
          return next;
        });
      }
    },
    [],
  );

  const handleRetrySection = useCallback((sectionId: PositioningSectionId) => {
    setErrorBySection((prev) => {
      if (!(sectionId in prev)) return prev;
      const next = { ...prev };
      delete next[sectionId];
      return next;
    });
  }, []);

  const handleSkipSection = useCallback((sectionId: PositioningSectionId) => {
    setErrorBySection((prev) => {
      if (!(sectionId in prev)) return prev;
      const next = { ...prev };
      delete next[sectionId];
      return next;
    });
  }, []);

  // Fallback to the first non-complete section when the parent state machine
  // hasn't pinned a currentSection yet (e.g. on initial sections-state entry).
  // This keeps the operator's Run-section affordance reachable in every state.
  const operatorSection = useMemo<PositioningSectionId | null>(() => {
    if (currentSection) return currentSection;
    return (
      POSITIONING_SECTION_IDS.find(
        (id) => sectionStatuses[id] !== 'complete',
      ) ?? null
    );
  }, [currentSection, sectionStatuses]);

  const currentError = operatorSection ? errorBySection[operatorSection] : null;

  return (
    <div className="flex h-svh overflow-hidden bg-background">
      {/* Left rail — section progress */}
      <aside
        className={cn(
          'border-r bg-muted/20 flex flex-col transition-[width] duration-200',
          sidebarOpen ? 'w-60' : 'w-11',
        )}
      >
        <div className="flex items-center justify-between border-b px-2 py-2">
          <span
            className={cn(
              'text-xs font-semibold',
              !sidebarOpen && 'sr-only',
            )}
          >
            Sections ({completedCount}/{POSITIONING_SECTION_IDS.length})
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => setSidebarOpen((open) => !open)}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? (
              <PanelLeftClose className="size-4" />
            ) : (
              <PanelLeftOpen className="size-4" />
            )}
          </Button>
        </div>
        <ul className="p-2 space-y-1 flex-1 overflow-auto">
          {POSITIONING_SECTION_IDS.map((id) => {
            const status = sectionStatuses[id];
            const isCurrent = id === currentSection;
            return (
              <li
                key={id}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-1.5 text-xs',
                  isCurrent && 'bg-muted',
                )}
                title={POSITIONING_SECTION_LABELS[id]}
              >
                {statusIcon(status)}
                {sidebarOpen ? (
                  <span
                    className={cn(
                      'truncate',
                      status === 'complete' && 'text-muted-foreground',
                    )}
                  >
                    {POSITIONING_SECTION_LABELS[id]}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Center — canvas */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="border-b px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-sm font-semibold leading-tight">
              Pre-Pitch Positioning Audit
            </span>
            <span className="text-[11px] text-muted-foreground leading-tight">
              {completedCount}/{POSITIONING_SECTION_IDS.length} sections complete
            </span>
          </div>
          <div className="flex items-center gap-2">
            {operatorSection ? (
              <RunSectionButton
                runId={runId}
                sectionId={operatorSection}
                sectionLabel={POSITIONING_SECTION_LABELS[operatorSection]}
                externalState={
                  sectionStatuses[operatorSection] === 'running'
                    ? 'running'
                    : sectionStatuses[operatorSection] === 'complete'
                      ? 'complete'
                      : sectionStatuses[operatorSection] === 'error'
                        ? 'error'
                        : 'idle'
                }
                onStateChange={handleRunStateChange}
              />
            ) : null}
          </div>
        </header>

        {currentError && operatorSection ? (
          <div className="px-4 pt-3">
            <SectionErrorCard
              runId={runId}
              sectionId={operatorSection}
              sectionLabel={POSITIONING_SECTION_LABELS[operatorSection]}
              errorMessage={currentError}
              onRetry={handleRetrySection}
              onSkip={handleSkipSection}
            />
          </div>
        ) : null}

        <AuditArtifactCanvas
          runId={runId}
          researchResults={researchResults}
          jobActivity={activity}
          className="flex-1"
        />
      </div>

      {/* Right rail — chat (post-research refinement) */}
      <aside
        className={cn(
          'border-l bg-muted/10 flex flex-col transition-[width] duration-200',
          chatOpen ? 'w-80' : 'w-11',
        )}
      >
        <Collapsible
          open={chatOpen}
          onOpenChange={setChatOpen}
          className="flex flex-col h-full"
        >
          <CollapsibleTrigger
            asChild
            className="flex w-full items-center justify-between gap-2 border-b px-2 py-2 hover:bg-muted/40 text-xs font-semibold"
          >
            <button type="button" aria-label={chatOpen ? 'Collapse chat' : 'Expand chat'}>
              {chatOpen ? (
                <>
                  <span className="inline-flex items-center gap-1.5">
                    <MessageSquare className="size-3.5" />
                    Chat
                  </span>
                  <ChevronRight className="size-4" />
                </>
              ) : (
                <span className="mx-auto inline-flex items-center justify-center">
                  <ChevronLeft className="size-4" />
                </span>
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent
            forceMount
            className={cn(
              'flex-1 overflow-hidden',
              !chatOpen && 'hidden',
            )}
          >
            {userId ? (
              <ChatThread runId={runId} userId={userId} className="h-full" />
            ) : null}
          </CollapsibleContent>
        </Collapsible>
      </aside>
    </div>
  );
}
