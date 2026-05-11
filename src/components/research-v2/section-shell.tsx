'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  FileText,
  Loader2,
  XCircle,
} from 'lucide-react';
import { useUser } from '@clerk/nextjs';

import {
  POSITIONING_SECTION_IDS,
  POSITIONING_SECTION_LABELS,
  type PositioningSectionId,
} from '@/lib/ai/prompts/positioning-skills';
import { useResearchJobActivity } from '@/lib/journey/research-job-activity';
import {
  sectionEnvelopeToMarkdown,
  type PositioningSectionEnvelope,
} from '@/lib/research-v2/json-to-markdown';

import { ChatMessage } from './chat-message';
import { RunSectionButton, type SectionRunState } from './run-section-button';
import { ThinkingBlock } from './thinking-block';
import { SectionErrorCard } from './section-error-card';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SectionShellProps {
  runId: string;
  currentSection: PositioningSectionId | null;
}

type SectionStatus = 'idle' | 'running' | 'complete' | 'error';

interface SectionState {
  status: SectionStatus;
  markdown?: string;
  errorMessage?: string;
}

interface ChatEntry {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sectionId?: PositioningSectionId;
  showRunButton?: boolean;
  showThinking?: boolean;
  showError?: boolean;
}

// ---------------------------------------------------------------------------
// Progress strip status icon
// ---------------------------------------------------------------------------

function StatusIcon({ status }: { status: SectionStatus }) {
  switch (status) {
    case 'complete':
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
    case 'running':
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />;
    case 'error':
      return <XCircle className="h-3.5 w-3.5 text-destructive" />;
    default:
      return <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />;
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SectionShell({ runId }: SectionShellProps) {
  const { user } = useUser();
  const userId = user?.id ?? null;

  const [progressOpen, setProgressOpen] = useState(false);
  const [artifactOpen, setArtifactOpen] = useState(false);
  const [sectionStates, setSectionStates] = useState<
    Record<PositioningSectionId, SectionState>
  >(() =>
    Object.fromEntries(
      POSITIONING_SECTION_IDS.map((id) => [id, { status: 'idle' as SectionStatus }]),
    ) as Record<PositioningSectionId, SectionState>,
  );

  // Chat history
  const [chatEntries, setChatEntries] = useState<ChatEntry[]>(() => [
    {
      id: 'init',
      role: 'assistant',
      content:
        'Corpus and onboarding complete. Run each section below to generate your Pre-Pitch Positioning Audit.',
      showRunButton: true,
      sectionId: POSITIONING_SECTION_IDS[0],
    },
  ]);

  const [refineInput, setRefineInput] = useState('');
  const [isRefining, setIsRefining] = useState(false);

  // Artifact: accumulated markdown (each section appends below)
  const [artifactSections, setArtifactSections] = useState<
    Partial<Record<PositioningSectionId, string>>
  >({});

  const bottomRef = useRef<HTMLDivElement>(null);

  // Track which sections we've already toasted for
  const toastedRef = useRef<Set<PositioningSectionId>>(new Set());
  const prevCompletedRef = useRef<Set<PositioningSectionId>>(new Set());

  // -------------------------------------------------------------------------
  // Poll activity to detect section completion
  // -------------------------------------------------------------------------

  const activity = useResearchJobActivity({
    userId,
    activeRunId: runId,
  });

  // Sync job status into sectionStates (pure state mirror — no side effects).
  useEffect(() => {
    setSectionStates((prev) => {
      const next = { ...prev };

      for (const sectionId of POSITIONING_SECTION_IDS) {
        const job = activity[sectionId];
        if (!job) continue;

        const current = prev[sectionId];
        const jobStatus: SectionStatus =
          job.status === 'complete'
            ? 'complete'
            : job.status === 'error'
              ? 'error'
              : 'running';

        if (jobStatus !== current.status) {
          next[sectionId] = { ...current, status: jobStatus, errorMessage: job.error };
        }
      }

      return next;
    });
  }, [activity]);

  // Fetch artifact for completed section and advance chat
  const handleSectionCompleted = useCallback(
    async (sectionId: PositioningSectionId) => {
      const label = POSITIONING_SECTION_LABELS[sectionId];

      // Toast
      if (!toastedRef.current.has(sectionId)) {
        toastedRef.current.add(sectionId);
        toast.success(`${label} complete.`);
      }

      // Fetch the artifact markdown from the session
      let markdown = '';
      try {
        const res = await fetch(`/api/journey/session?runId=${runId}`, {
          cache: 'no-store',
          credentials: 'same-origin',
        });
        if (res.ok) {
          const data = (await res.json()) as {
            researchResults?: Record<
              string,
              {
                status?: string;
                data?: unknown;
                artifact?: { markdown?: string };
              }
            > | null;
          };
          const entry = data.researchResults?.[sectionId];
          if (entry?.artifact?.markdown) {
            markdown = entry.artifact.markdown;
          } else if (entry?.data) {
            // Fallback: convert JSON envelope to markdown
            try {
              markdown = sectionEnvelopeToMarkdown(
                entry.data as PositioningSectionEnvelope,
              );
            } catch {
              markdown = `# ${label}\n\nSection complete.`;
            }
          }
        }
      } catch {
        markdown = `# ${label}\n\nSection complete.`;
      }

      // Update artifact panel
      setArtifactSections((prev) => {
        const next = { ...prev, [sectionId]: markdown };
        // Auto-open the artifact sheet on the FIRST completion so the user
        // discovers the panel exists. After that, leave it to the user.
        if (Object.keys(prev).length === 0) {
          setArtifactOpen(true);
        }
        return next;
      });

      // Update section states with markdown
      setSectionStates((prev) => ({
        ...prev,
        [sectionId]: { ...prev[sectionId], markdown, status: 'complete' },
      }));

      // Find next pending section
      const currentIdx = POSITIONING_SECTION_IDS.indexOf(sectionId);
      const nextSectionId = POSITIONING_SECTION_IDS[currentIdx + 1] as
        | PositioningSectionId
        | undefined;

      // Advance chat
      setChatEntries((prev) => {
        // Remove the thinking block entry for this section
        const filtered = prev.filter(
          (e) => !(e.showThinking && e.sectionId === sectionId),
        );

        const completionEntry: ChatEntry = {
          id: `complete-${sectionId}`,
          role: 'assistant',
          content: nextSectionId
            ? `Section complete. ${label} added to your audit.`
            : 'All sections complete. Refine via chat input below.',
          ...(nextSectionId
            ? {
                showRunButton: true,
                sectionId: nextSectionId,
              }
            : {}),
        };

        return [...filtered, completionEntry];
      });
    },
    [runId],
  );

  // Detect newly-completed sections and fire side effects.
  // MUST come AFTER handleSectionCompleted is defined (block-scoped const).
  // MUST also be separate from the state-sync effect above: in React 18
  // batched mode, setState updaters run on the next render commit (not
  // synchronously), so any array we tried to mutate inside the updater
  // closure would still be empty when read in the trailing code — the side
  // effects would never fire and the artifact panel would stay stuck on its
  // empty-state copy.
  useEffect(() => {
    for (const sectionId of POSITIONING_SECTION_IDS) {
      const job = activity[sectionId];
      if (!job) continue;
      if (job.status === 'complete' && !prevCompletedRef.current.has(sectionId)) {
        prevCompletedRef.current.add(sectionId);
        void handleSectionCompleted(sectionId);
      }
    }
  }, [activity, handleSectionCompleted]);

  // Auto-scroll chat on new entries
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatEntries.length]);

  // -------------------------------------------------------------------------
  // Section run state changes (from RunSectionButton)
  // -------------------------------------------------------------------------

  function handleRunStateChange(
    sectionId: PositioningSectionId,
    state: SectionRunState,
  ) {
    if (state === 'running' || state === 'pending') {
      setSectionStates((prev) => ({
        ...prev,
        [sectionId]: { ...prev[sectionId], status: 'running' },
      }));

      // Add thinking block to chat
      setChatEntries((prev) => {
        const alreadyHasThinking = prev.some(
          (e) => e.showThinking && e.sectionId === sectionId,
        );
        if (alreadyHasThinking) return prev;

        // Remove the run button entry for this section
        const filtered = prev.map((e) =>
          e.showRunButton && e.sectionId === sectionId
            ? { ...e, showRunButton: false }
            : e,
        );

        return [
          ...filtered,
          {
            id: `thinking-${sectionId}`,
            role: 'assistant' as const,
            content: '',
            sectionId,
            showThinking: true,
          },
        ];
      });
    }

    if (state === 'error') {
      setSectionStates((prev) => ({
        ...prev,
        [sectionId]: { ...prev[sectionId], status: 'error' },
      }));

      setChatEntries((prev) => {
        const filtered = prev.filter(
          (e) => !(e.showThinking && e.sectionId === sectionId),
        );
        return [
          ...filtered,
          {
            id: `error-${sectionId}`,
            role: 'assistant' as const,
            content: '',
            sectionId,
            showError: true,
          },
        ];
      });
    }
  }

  // -------------------------------------------------------------------------
  // Section error: retry / skip
  // -------------------------------------------------------------------------

  function handleRetrySection(sectionId: PositioningSectionId) {
    setSectionStates((prev) => ({
      ...prev,
      [sectionId]: { ...prev[sectionId], status: 'idle' },
    }));
    setChatEntries((prev) =>
      prev.map((e) =>
        e.showError && e.sectionId === sectionId
          ? { ...e, showError: false, showRunButton: true }
          : e,
      ),
    );
  }

  function handleSkipSection(sectionId: PositioningSectionId) {
    setSectionStates((prev) => ({
      ...prev,
      [sectionId]: { ...prev[sectionId], status: 'error', errorMessage: 'Skipped' },
    }));

    const currentIdx = POSITIONING_SECTION_IDS.indexOf(sectionId);
    const nextSectionId = POSITIONING_SECTION_IDS[currentIdx + 1] as
      | PositioningSectionId
      | undefined;

    setChatEntries((prev) => {
      const filtered = prev.filter(
        (e) => !(e.showError && e.sectionId === sectionId),
      );
      const skipEntry: ChatEntry = {
        id: `skip-${sectionId}`,
        role: 'assistant',
        content: `Skipped ${POSITIONING_SECTION_LABELS[sectionId]}.`,
        ...(nextSectionId ? { showRunButton: true, sectionId: nextSectionId } : {}),
      };
      return [...filtered, skipEntry];
    });
  }

  // -------------------------------------------------------------------------
  // Chat refinement
  // -------------------------------------------------------------------------

  async function handleRefineSubmit() {
    if (!refineInput.trim() || isRefining) return;

    const instruction = refineInput.trim();
    setRefineInput('');
    setIsRefining(true);

    setChatEntries((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: 'user', content: instruction },
    ]);

    try {
      const res = await fetch('/api/research-v2/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ runId, instruction }),
      });

      const data = (await res.json().catch(() => ({}))) as { status?: string };

      if (data.status === 'not_implemented') {
        setChatEntries((prev) => [
          ...prev,
          {
            id: `refine-stub-${Date.now()}`,
            role: 'assistant',
            content:
              'Refinement is coming in Phase 5. For now, you can re-run any section after editing your onboarding answers.',
          },
        ]);
      } else {
        setChatEntries((prev) => [
          ...prev,
          {
            id: `refine-ack-${Date.now()}`,
            role: 'assistant',
            content: 'Refinement queued. The section will re-run shortly.',
          },
        ]);
      }
    } catch {
      setChatEntries((prev) => [
        ...prev,
        {
          id: `refine-err-${Date.now()}`,
          role: 'assistant',
          content: 'Failed to send refinement request. Please try again.',
        },
      ]);
    } finally {
      setIsRefining(false);
    }
  }

  // -------------------------------------------------------------------------
  // Derived
  // -------------------------------------------------------------------------

  const completedSections = POSITIONING_SECTION_IDS.filter(
    (id) => sectionStates[id].status === 'complete',
  );

  const artifactMarkdown = POSITIONING_SECTION_IDS.map(
    (id) => artifactSections[id] ?? '',
  )
    .filter(Boolean)
    .join('\n\n---\n\n');

  const allComplete =
    completedSections.length === POSITIONING_SECTION_IDS.length;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (!userId) return null;

  return (
    <div className="flex h-svh overflow-hidden">
      {/* ------------------------------------------------------------------ */}
      {/* Left: section progress strip                                         */}
      {/* ------------------------------------------------------------------ */}
      <aside className="shrink-0 border-r border-border">
        <Collapsible open={progressOpen} onOpenChange={setProgressOpen}>
          <CollapsibleTrigger className="flex items-center gap-1.5 px-3 py-3 text-xs text-muted-foreground hover:text-foreground transition-colors w-full">
            {progressOpen ? (
              <ChevronDown className="h-3 w-3 shrink-0" />
            ) : (
              <ChevronRight className="h-3 w-3 shrink-0" />
            )}
            <span className="font-medium">Sections</span>
            <span className="ml-1 tabular-nums">
              {completedSections.length}/{POSITIONING_SECTION_IDS.length}
            </span>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <ul className="px-2 pb-3 space-y-0.5 min-w-[200px]">
              {POSITIONING_SECTION_IDS.map((id, idx) => (
                <li
                  key={id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs"
                >
                  <StatusIcon status={sectionStates[id].status} />
                  <span
                    className={
                      sectionStates[id].status === 'complete'
                        ? 'text-foreground'
                        : 'text-muted-foreground'
                    }
                  >
                    {idx + 1}. {POSITIONING_SECTION_LABELS[id]}
                  </span>
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      </aside>

      {/* ------------------------------------------------------------------ */}
      {/* Center: chat                                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top bar — artifact trigger lives here so it's always reachable.
            Kept thin (h-11) to stay out of the chat's way. */}
        <div className="shrink-0 flex items-center justify-between gap-2 px-4 h-11 border-b border-border">
          <div className="text-xs text-muted-foreground tabular-nums">
            {completedSections.length === 0
              ? 'Run sections to build your audit'
              : `${completedSections.length}/${POSITIONING_SECTION_IDS.length} sections complete`}
          </div>
          <Sheet open={artifactOpen} onOpenChange={setArtifactOpen}>
            <SheetTrigger asChild>
              <Button
                size="sm"
                variant={completedSections.length > 0 ? 'default' : 'outline'}
                className="rounded-md h-7 px-2.5 text-xs gap-1.5"
                disabled={completedSections.length === 0}
                aria-label="View Pre-Pitch Positioning Audit"
              >
                <FileText className="h-3.5 w-3.5" />
                View Audit
                {completedSections.length > 0 && (
                  <span className="ml-0.5 rounded-sm bg-background/20 px-1 py-px text-[10px] font-medium tabular-nums leading-none">
                    {completedSections.length}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-full sm:max-w-xl flex flex-col gap-0 p-0"
            >
              <SheetHeader className="shrink-0 px-5 py-4 border-b border-border">
                <SheetTitle className="text-base font-semibold tracking-tight">
                  Pre-Pitch Positioning Audit
                </SheetTitle>
                <SheetDescription className="text-xs">
                  {completedSections.length === 0
                    ? 'Sections will appear here as they complete.'
                    : `${completedSections.length} of ${POSITIONING_SECTION_IDS.length} sections complete`}
                </SheetDescription>
              </SheetHeader>
              <ScrollArea className="flex-1 px-5 py-5">
                {artifactMarkdown ? (
                  <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none prose-headings:tracking-tight prose-headings:font-semibold prose-h1:text-xl prose-h2:text-base prose-h3:text-sm prose-p:leading-relaxed prose-blockquote:border-l-2 prose-blockquote:border-foreground/20 prose-blockquote:not-italic prose-blockquote:text-foreground prose-blockquote:font-normal prose-hr:border-border">
                    <ReactMarkdown>{artifactMarkdown}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Run your first section to populate the audit.
                  </p>
                )}
              </ScrollArea>
            </SheetContent>
          </Sheet>
        </div>

        <ScrollArea className="flex-1 px-4 py-4">
          <div className="space-y-3 max-w-2xl mx-auto">
            {chatEntries.map((entry) => {
              if (entry.showThinking && entry.sectionId && userId) {
                return (
                  <div key={entry.id} className="px-2 py-1">
                    <ThinkingBlock
                      userId={userId}
                      runId={runId}
                      sectionId={entry.sectionId}
                      sectionLabel={POSITIONING_SECTION_LABELS[entry.sectionId]}
                    />
                  </div>
                );
              }

              if (entry.showError && entry.sectionId) {
                return (
                  <div key={entry.id}>
                    <SectionErrorCard
                      runId={runId}
                      sectionId={entry.sectionId}
                      sectionLabel={POSITIONING_SECTION_LABELS[entry.sectionId]}
                      errorMessage={sectionStates[entry.sectionId].errorMessage}
                      onRetry={handleRetrySection}
                      onSkip={handleSkipSection}
                    />
                  </div>
                );
              }

              return (
                <div key={entry.id}>
                  {entry.content && (
                    <ChatMessage role={entry.role} content={entry.content} />
                  )}
                  {entry.showRunButton && entry.sectionId && (
                    <div className="mt-2 ml-2">
                      <RunSectionButton
                        runId={runId}
                        sectionId={entry.sectionId}
                        sectionLabel={POSITIONING_SECTION_LABELS[entry.sectionId]}
                        externalState={
                          sectionStates[entry.sectionId].status === 'complete'
                            ? 'complete'
                            : sectionStates[entry.sectionId].status === 'running'
                              ? 'running'
                              : sectionStates[entry.sectionId].status === 'error'
                                ? 'error'
                                : 'idle'
                        }
                        onStateChange={handleRunStateChange}
                      />
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* Chat input */}
        <div className="shrink-0 border-t border-border px-4 py-3">
          <div className="flex gap-2 max-w-2xl mx-auto">
            <Textarea
              placeholder={
                allComplete
                  ? 'Ask AIGOS to refine any section…'
                  : 'Refine after sections complete…'
              }
              className="min-h-[2.5rem] max-h-32 resize-none rounded-md text-sm"
              value={refineInput}
              onChange={(e) => setRefineInput(e.target.value)}
              disabled={isRefining}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleRefineSubmit();
                }
              }}
            />
            <Button
              size="sm"
              className="rounded-md shrink-0 self-end"
              disabled={!refineInput.trim() || isRefining}
              onClick={() => void handleRefineSubmit()}
            >
              {isRefining ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Send'
              )}
            </Button>
          </div>
        </div>
      </div>

    </div>
  );
}
