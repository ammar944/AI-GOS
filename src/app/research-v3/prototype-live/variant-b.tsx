// variant-b.tsx — PROTOTYPE "Agent Roster" (variant B).
//
// PRIMARY STRUCTURE: the six positioning sections as six live AGENT LANES
// (dense Linear-style rows), conveying "six agents working in parallel". Each
// lane carries a phase chip, a one-line live activity + tool count, a calm
// "N verified · M flagged" trust badge once committed, and an elapsed timer.
// The Paid-media lane appears after the six (terminal). Selecting a lane opens
// that section's committed artifact in a right-side DETAIL PANE at light
// fidelity (title / verdict / status / verification / source count / sub-section
// names). No top timeline spine (variant A) and no single scrolling narrative
// thread (variant C) — the affordance is the roster + lane selection.
//
// Replays a FINISHED run; the engine is atomic + verifier-gated. We stream the
// PROCESS (phases, searched-source chips, "strengthening N claims"), never
// token-streamed unverified content. A section resolves IN atomically the
// moment its worker.status flips to "complete" — animated with opacity/translate
// only. Narration (the `narration` prop) is already customer-safe; no raw
// payload / JSON / schema internals are surfaced.
'use client';

import { useEffect, useMemo, useState } from 'react';

import type { VariantProps } from './variant-contract';
import { ZONE_ORDER } from './variant-contract';
import {
  PHASE_META,
  collapseNarration,
  readVerification,
  sectionTitle,
  type NarrationItem,
  type NarrationTone,
} from './phase-narration';
import type { FixtureArtifactData } from './fixture-types';
import { cn } from '@/lib/utils';

const PAID_MEDIA = 'positioningPaidMediaPlan';

// ---------------------------------------------------------------------------
// Tokens — DESIGN.md dark surface. Kept inline (prototype) so the variant is a
// self-contained industrial surface inside the light prototype page chrome.
// ---------------------------------------------------------------------------

const C = {
  bg0: '#07090e',
  bg1: '#0a0c12',
  bg2: '#0e1018',
  bg3: '#12141c',
  border: 'rgba(255,255,255,0.04)',
  borderHover: 'rgba(255,255,255,0.08)',
  text1: '#e2e4ea',
  text2: '#8b90a0',
  text3: '#555a6a',
  text4: '#3a3e4c',
  accent: '#365eff',
  green: '#22c55e',
  amber: '#eab308',
  red: '#ef4444',
} as const;

const TONE_COLOR: Record<NarrationTone, string> = {
  active: C.accent,
  neutral: C.text3,
  success: C.green,
  warning: C.amber,
};

const mono =
  'font-mono text-[11px] uppercase tracking-[0.06em] tabular-nums';

// AuditSectionPhase ordering — drives the per-lane progress underline so a lane
// visibly "advances" as the worker moves through phases.
const PHASE_RANK: Record<string, number> = {
  Queued: 0,
  'Compiling context': 1,
  'Reading sources': 2,
  Drafting: 3,
  Validating: 4,
  'Draft ready': 5,
  Committed: 6,
  'Needs review': 6,
};
const PHASE_STEPS = 6;

type WorkerState = VariantProps['state']['workerStates'][number];
type WorkerStatus = WorkerState['status'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtClock(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return '—:—';
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function asArtifact(data: unknown): FixtureArtifactData | null {
  return data && typeof data === 'object' ? (data as FixtureArtifactData) : null;
}

function confidenceText(value: unknown): string | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const ten = n <= 1 ? Math.round(n * 100) / 10 : Math.round(n * 10) / 10;
  return `${ten}`;
}

function statusMeta(status: WorkerStatus): { dot: string; label: string; tone: string } {
  switch (status) {
    case 'running':
      return { dot: C.accent, label: 'Running', tone: C.accent };
    case 'complete':
      return { dot: C.green, label: 'Verified', tone: C.green };
    case 'error':
      return { dot: C.red, label: 'Needs review', tone: C.red };
    case 'aborted':
      return { dot: C.red, label: 'Aborted', tone: C.red };
    default:
      return { dot: C.text4, label: 'Queued', tone: C.text3 };
  }
}

interface LaneActivity {
  line: string;
  chip: string | null;
  tone: NarrationTone;
  toolCount: number;
}

// Derive a one-line live activity + tool count for a lane from the (already
// customer-safe) narration prop. Last item wins for the live line; tool count
// sums the collapsed "searching" runs.
function laneActivity(items: NarrationItem[]): LaneActivity | null {
  if (items.length === 0) return null;
  const collapsed = collapseNarration(items);
  const toolCount = collapsed
    .filter((c) => c.phase === 'searching')
    .reduce((sum, c) => sum + c.count, 0);
  const last = items[items.length - 1];
  const lastChip = [...items].reverse().find((i) => i.chip)?.chip ?? null;
  return {
    line: last.detail ?? last.label,
    chip: last.phase === 'searching' ? lastChip : null,
    tone: last.tone,
    toolCount,
  };
}

// ---------------------------------------------------------------------------
// Small presentational atoms
// ---------------------------------------------------------------------------

function PhaseChip({ phase, status }: { phase: string; status: WorkerStatus }): React.ReactElement {
  const m = statusMeta(status);
  const live = status === 'running';
  return (
    <span
      className={cn(mono, 'inline-flex items-center gap-1.5 rounded-[3px] px-1.5 py-0.5')}
      style={{ color: m.tone, backgroundColor: `${m.tone}14` }}
    >
      <span
        className={cn('size-1.5 rounded-full', live && 'motion-safe:animate-pulse')}
        style={{ backgroundColor: m.dot }}
      />
      {status === 'queued' ? 'Queued' : phase}
    </span>
  );
}

function VerificationBadge({
  verified,
  flagged,
}: {
  verified: number;
  flagged: number;
}): React.ReactElement {
  const hasFlags = flagged > 0;
  return (
    <span
      className={cn(mono, 'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5')}
      style={{ borderColor: C.border, color: C.text2 }}
      title={`${verified} verified, ${flagged} flagged`}
    >
      <span style={{ color: C.green }}>{verified} verified</span>
      <span style={{ color: C.text4 }}>·</span>
      <span style={{ color: hasFlags ? C.amber : C.text3 }}>{flagged} flagged</span>
    </span>
  );
}

function ProgressUnderline({ rank, status }: { rank: number; status: WorkerStatus }): React.ReactElement {
  const pct = status === 'complete' ? 100 : Math.round((rank / PHASE_STEPS) * 100);
  const done = status === 'complete';
  const errored = status === 'error' || status === 'aborted';
  const color = errored ? C.red : done ? C.green : C.accent;
  return (
    <span
      aria-hidden
      className="absolute inset-x-0 bottom-0 h-px"
      style={{ backgroundColor: C.border }}
    >
      <span
        className="block h-px transition-[width] duration-300 ease-out"
        style={{ width: `${pct}%`, backgroundColor: color, opacity: status === 'queued' ? 0 : 0.7 }}
      />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Lane row (the primary affordance)
// ---------------------------------------------------------------------------

interface LaneRowProps {
  index: number;
  zone: string;
  worker: WorkerState | undefined;
  artifact: FixtureArtifactData | null;
  activity: LaneActivity | null;
  selected: boolean;
  onSelect: () => void;
}

function LaneRow({
  index,
  zone,
  worker,
  artifact,
  activity,
  selected,
  onSelect,
}: LaneRowProps): React.ReactElement {
  const status: WorkerStatus = worker?.status ?? 'queued';
  const phase = worker?.phase ?? 'Queued';
  const m = statusMeta(status);
  const rank = PHASE_RANK[phase] ?? 0;
  const verification = readVerification(artifact);
  const conf = confidenceText(artifact?.confidence);
  const idle = status === 'queued';

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'group relative flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150',
        'focus:outline-none',
      )}
      style={{
        backgroundColor: selected ? C.bg3 : 'transparent',
        borderLeft: `2px solid ${selected ? m.dot : 'transparent'}`,
      }}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)';
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      {/* lane index + status dot */}
      <span className="flex w-7 shrink-0 items-center gap-2">
        <span
          className={cn('size-2 shrink-0 rounded-full', status === 'running' && 'motion-safe:animate-pulse')}
          style={{ backgroundColor: m.dot }}
        />
      </span>

      {/* identity + live activity */}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-2.5">
          <span
            className="truncate text-[13.5px] font-medium leading-none"
            style={{ color: idle ? C.text3 : C.text1 }}
          >
            {artifact?.sectionTitle?.split('—')[0].trim() || sectionTitle(zone)}
          </span>
          {zone === PAID_MEDIA ? (
            <span className={cn(mono)} style={{ color: C.text4 }}>
              Terminal
            </span>
          ) : null}
        </span>

        {/* one-line live activity (customer-safe narration only) */}
        <span className="flex min-w-0 items-center gap-2 text-[12px] leading-none">
          {status === 'complete' ? (
            <span className="truncate" style={{ color: C.text2 }}>
              {artifact?.statusSummary?.trim() || 'Section verified and committed.'}
            </span>
          ) : idle ? (
            <span style={{ color: C.text4 }}>Waiting for a free worker</span>
          ) : activity ? (
            <>
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: TONE_COLOR[activity.tone] }}
              />
              <span className="truncate" style={{ color: C.text2 }}>
                {activity.line}
              </span>
              {activity.chip ? (
                <span
                  className="hidden max-w-[16rem] truncate rounded-[3px] px-1.5 py-0.5 md:inline"
                  style={{ backgroundColor: C.bg2, color: C.text3, fontSize: 11 }}
                  title={activity.chip}
                >
                  {activity.chip}
                </span>
              ) : null}
            </>
          ) : (
            <span style={{ color: C.text4 }}>Starting…</span>
          )}
        </span>
      </span>

      {/* phase chip */}
      <span className="hidden shrink-0 sm:block">
        <PhaseChip phase={phase} status={status} />
      </span>

      {/* tools run */}
      <span
        className={cn(mono, 'hidden w-16 shrink-0 text-right lg:block')}
        style={{ color: activity && activity.toolCount > 0 ? C.text2 : C.text4 }}
        title="Source lookups run"
      >
        {activity ? activity.toolCount : 0} tools
      </span>

      {/* verification / confidence */}
      <span className="hidden w-44 shrink-0 justify-end md:flex">
        {status === 'complete' && verification ? (
          <span className="flex items-center gap-2">
            <VerificationBadge verified={verification.verified} flagged={verification.flagged} />
          </span>
        ) : conf && status === 'complete' ? (
          <span className={cn(mono)} style={{ color: C.text3 }}>
            {conf}/10
          </span>
        ) : (
          <span className={cn(mono)} style={{ color: C.text4 }}>
            —
          </span>
        )}
      </span>

      {/* elapsed timer */}
      <span
        className={cn(mono, 'w-12 shrink-0 text-right')}
        style={{ color: status === 'running' ? C.text1 : C.text3 }}
      >
        {fmtClock(worker?.elapsedMs)}
      </span>

      <ProgressUnderline rank={rank} status={status} />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Detail pane (right side) — light-fidelity committed artifact OR live readout
// ---------------------------------------------------------------------------

function CalloutVerdict({ verdict }: { verdict: string }): React.ReactElement {
  return (
    <div className="pl-3" style={{ borderLeft: `2px solid ${C.accent}` }}>
      <div className={cn(mono)} style={{ color: C.text3 }}>
        Verdict
      </div>
      <p className="mt-1.5 text-[14px] leading-[1.6]" style={{ color: C.text1 }}>
        {verdict}
      </p>
    </div>
  );
}

function SubSectionList({ body }: { body: Record<string, unknown> | undefined }): React.ReactElement | null {
  const keys = body ? Object.keys(body) : [];
  if (keys.length === 0) return null;
  return (
    <div>
      <div className={cn(mono, 'mb-2')} style={{ color: C.text3 }}>
        Sub-sections · {keys.length}
      </div>
      <div className="flex flex-col">
        {keys.map((key) => (
          <div
            key={key}
            className="flex items-center gap-2 py-1.5 text-[13px]"
            style={{ borderBottom: `1px solid ${C.border}` }}
          >
            <span className="size-1 shrink-0 rounded-full" style={{ backgroundColor: C.green }} />
            <span className="capitalize" style={{ color: C.text2 }}>
              {key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LiveReadout({
  zone,
  worker,
  items,
}: {
  zone: string;
  worker: WorkerState | undefined;
  items: NarrationItem[];
}): React.ReactElement {
  const status: WorkerStatus = worker?.status ?? 'queued';
  const collapsed = collapseNarration(items).slice(-7);
  if (status === 'queued') {
    return (
      <p className="text-[13px] leading-[1.6]" style={{ color: C.text3 }}>
        {sectionTitle(zone)} is queued. It begins as soon as a worker frees up — the
        six agents run with bounded concurrency.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span
          className="size-2 rounded-full motion-safe:animate-pulse"
          style={{ backgroundColor: C.accent }}
        />
        <span className="text-[13px] font-medium" style={{ color: C.text1 }}>
          {worker?.phase ?? 'Working'}
        </span>
      </div>
      {collapsed.length > 0 ? (
        <ol className="flex flex-col" style={{ borderLeft: `1px solid ${C.border}` }}>
          {collapsed.map((c, i) => {
            const meta = PHASE_META[c.phase];
            return (
              <li key={`${c.id}-${i}`} className="relative py-1.5 pl-4">
                <span
                  className="absolute left-[-3.5px] top-2.5 size-1.5 rounded-full"
                  style={{ backgroundColor: TONE_COLOR[c.tone] }}
                />
                <div className="flex items-baseline gap-2">
                  <span className="text-[12.5px] leading-tight" style={{ color: C.text2 }}>
                    {meta.label}
                  </span>
                  {c.count > 1 ? (
                    <span className={cn(mono)} style={{ color: C.text4 }}>
                      ×{c.count}
                    </span>
                  ) : null}
                </div>
                {c.detail && c.detail !== meta.label ? (
                  <div className="mt-0.5 text-[12px] leading-tight" style={{ color: C.text3 }}>
                    {c.detail}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : null}
      {/* skeleton — gives the pane body while the section drafts */}
      <div className="mt-1 flex flex-col gap-2" aria-hidden>
        {[88, 72, 80].map((w, i) => (
          <div
            key={i}
            className="h-2.5 rounded motion-safe:animate-pulse"
            style={{ width: `${w}%`, backgroundColor: C.bg3 }}
          />
        ))}
      </div>
    </div>
  );
}

function DetailPane({
  zone,
  worker,
  artifact,
  items,
}: {
  zone: string;
  worker: WorkerState | undefined;
  artifact: FixtureArtifactData | null;
  items: NarrationItem[];
}): React.ReactElement {
  const status: WorkerStatus = worker?.status ?? 'queued';
  const verification = readVerification(artifact);
  const conf = confidenceText(artifact?.confidence);
  const committed = status === 'complete' && artifact;
  const m = statusMeta(status);

  return (
    <div
      // re-mount on zone change so the commit animation re-fires per selection
      key={zone}
      className="flex h-full flex-col motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-200"
    >
      {/* pane header */}
      <div className="shrink-0 px-5 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ backgroundColor: m.dot }} />
          <span className={cn(mono)} style={{ color: m.tone }}>
            {status === 'complete' ? 'Committed' : m.label}
          </span>
          <span className={cn(mono, 'ml-auto')} style={{ color: C.text3 }}>
            {fmtClock(worker?.elapsedMs)}
          </span>
        </div>
        <h2
          className="mt-2 text-[17px] font-semibold leading-tight tracking-tight"
          style={{ color: C.text1 }}
        >
          {artifact?.sectionTitle?.split('—')[0].trim() || sectionTitle(zone)}
        </h2>
        {committed ? (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {verification ? (
              <VerificationBadge verified={verification.verified} flagged={verification.flagged} />
            ) : null}
            {conf ? (
              <span
                className={cn(mono, 'rounded-full border px-2 py-0.5')}
                style={{ borderColor: C.border, color: C.text2 }}
              >
                {conf}/10 confidence
              </span>
            ) : null}
            {Array.isArray(artifact.sources) && artifact.sources.length > 0 ? (
              <span
                className={cn(mono, 'rounded-full border px-2 py-0.5')}
                style={{ borderColor: C.border, color: C.text2 }}
              >
                {artifact.sources.length} sources
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* pane body */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {committed ? (
          <div className="flex flex-col gap-6">
            {artifact.verdict ? <CalloutVerdict verdict={artifact.verdict} /> : null}
            {artifact.statusSummary ? (
              <p className="text-[13.5px] leading-[1.65]" style={{ color: C.text2 }}>
                {artifact.statusSummary}
              </p>
            ) : null}
            <SubSectionList body={artifact.body} />
            <p className={cn(mono)} style={{ color: C.text4 }}>
              Full typed rendering lands in the reader — this is a roster preview.
            </p>
          </div>
        ) : (
          <LiveReadout zone={zone} worker={worker} items={items} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Variant
// ---------------------------------------------------------------------------

export const VariantB = ({ state, narration, elapsedMs, totalMs }: VariantProps): React.ReactElement => {
  const lanes = ZONE_ORDER;

  const workerByZone = useMemo(() => {
    const m = new Map<string, WorkerState>();
    for (const w of state.workerStates) m.set(w.section_id, w);
    return m;
  }, [state.workerStates]);

  const artifactByZone = useMemo(() => {
    const m = new Map<string, FixtureArtifactData | null>();
    for (const zone of lanes) m.set(zone, asArtifact(state.sectionsByZone[zone]?.data));
    return m;
  }, [state.sectionsByZone, lanes]);

  const narrationByZone = useMemo(() => {
    const m = new Map<string, NarrationItem[]>();
    for (const item of narration) {
      const list = m.get(item.zone) ?? [];
      list.push(item);
      m.set(item.zone, list);
    }
    return m;
  }, [narration]);

  // Default selection follows the action: first running lane, else first
  // committed, else first lane. User selection (once made) sticks.
  const autoZone = useMemo(() => {
    const running = lanes.find((z) => workerByZone.get(z)?.status === 'running');
    const committed = lanes.find((z) => workerByZone.get(z)?.status === 'complete');
    return running ?? committed ?? lanes[0];
  }, [lanes, workerByZone]);

  const [picked, setPicked] = useState<string | null>(null);
  const selected = picked ?? autoZone;

  // If the user hasn't picked, keep the pane glued to the live front (autoZone).
  const [, force] = useState(0);
  useEffect(() => {
    if (picked === null) force((n) => n + 1);
  }, [autoZone, picked]);

  const runningCount = lanes.filter((z) => workerByZone.get(z)?.status === 'running').length;
  const queuedCount = lanes.filter((z) => {
    const s = workerByZone.get(z)?.status ?? 'queued';
    return s === 'queued';
  }).length;
  const positioningComplete = Math.min(state.children_complete, 6);

  const selectedWorker = workerByZone.get(selected);
  const selectedArtifact = artifactByZone.get(selected) ?? null;
  const selectedItems = narrationByZone.get(selected) ?? [];

  return (
    <div
      className="font-sans"
      style={{ backgroundColor: C.bg0, color: C.text1, minHeight: 'calc(100vh - 64px)' }}
    >
      <div className="mx-auto flex max-w-[1180px] flex-col px-5 py-6">
        {/* roster header — command strip (not a dashboard) */}
        <header className="flex flex-wrap items-end justify-between gap-4 pb-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2.5">
              <h1 className="text-[15px] font-semibold tracking-tight" style={{ color: C.text1 }}>
                Agent roster
              </h1>
              <span className={cn(mono)} style={{ color: C.text3 }}>
                {positioningComplete}/6 committed
              </span>
            </div>
            <p className="text-[12.5px] leading-none" style={{ color: C.text3 }}>
              Six positioning agents fan out in parallel; paid media runs last.
            </p>
          </div>

          <div className="flex items-center gap-5">
            <Stat label="Running" value={String(runningCount)} tone={runningCount > 0 ? C.accent : C.text3} />
            <Stat label="Queued" value={String(queuedCount)} tone={C.text2} />
            <Stat label="Elapsed" value={fmtClock(elapsedMs)} tone={C.text1} sub={`/ ${fmtClock(totalMs)}`} />
          </div>
        </header>

        {/* column legend */}
        <div
          className="flex items-center gap-3 px-4 py-2"
          style={{ borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}
        >
          <span className="w-7 shrink-0" />
          <span className={cn(mono, 'flex-1')} style={{ color: C.text4 }}>
            Agent · live activity
          </span>
          <span className={cn(mono, 'hidden w-28 sm:block')} style={{ color: C.text4 }}>
            Phase
          </span>
          <span className={cn(mono, 'hidden w-16 text-right lg:block')} style={{ color: C.text4 }}>
            Tools
          </span>
          <span className={cn(mono, 'hidden w-44 text-right md:block')} style={{ color: C.text4 }}>
            Trust
          </span>
          <span className={cn(mono, 'w-12 text-right')} style={{ color: C.text4 }}>
            Time
          </span>
        </div>

        {/* split: roster (lanes) + detail pane */}
        <div className="flex min-h-0 flex-col gap-5 pt-1 lg:flex-row">
          {/* LANES — the primary affordance */}
          <div className="flex-1">
            <div
              className="overflow-hidden rounded-[8px]"
              style={{ backgroundColor: C.bg1, border: `1px solid ${C.border}` }}
            >
              {lanes
                .filter((z) => z !== PAID_MEDIA)
                .map((zone, i) => (
                  <LaneRow
                    key={zone}
                    index={i + 1}
                    zone={zone}
                    worker={workerByZone.get(zone)}
                    artifact={artifactByZone.get(zone) ?? null}
                    activity={laneActivity(narrationByZone.get(zone) ?? [])}
                    selected={selected === zone}
                    onSelect={() => setPicked(zone)}
                  />
                ))}

              {/* terminal divider */}
              <div
                className="flex items-center gap-2 px-4 py-1.5"
                style={{ backgroundColor: C.bg0, borderTop: `1px solid ${C.border}` }}
              >
                <span className={cn(mono)} style={{ color: C.text4 }}>
                  Terminal · runs after 6/6
                </span>
                <span className="h-px flex-1" style={{ backgroundColor: C.border }} />
              </div>

              <LaneRow
                key={PAID_MEDIA}
                index={7}
                zone={PAID_MEDIA}
                worker={workerByZone.get(PAID_MEDIA)}
                artifact={artifactByZone.get(PAID_MEDIA) ?? null}
                activity={laneActivity(narrationByZone.get(PAID_MEDIA) ?? [])}
                selected={selected === PAID_MEDIA}
                onSelect={() => setPicked(PAID_MEDIA)}
              />
            </div>
          </div>

          {/* DETAIL PANE */}
          <aside className="w-full shrink-0 lg:w-[380px]">
            <div
              className="flex h-[560px] flex-col overflow-hidden rounded-[8px]"
              style={{ backgroundColor: C.bg1, border: `1px solid ${C.border}` }}
            >
              <DetailPane
                zone={selected}
                worker={selectedWorker}
                artifact={selectedArtifact}
                items={selectedItems}
              />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

function Stat({
  label,
  value,
  tone,
  sub,
}: {
  label: string;
  value: string;
  tone: string;
  sub?: string;
}): React.ReactElement {
  return (
    <div className="flex flex-col items-end gap-1">
      <span className={cn(mono)} style={{ color: C.text4 }}>
        {label}
      </span>
      <span className="flex items-baseline gap-1">
        <span className="font-mono text-[15px] font-semibold tabular-nums leading-none" style={{ color: tone }}>
          {value}
        </span>
        {sub ? (
          <span className="font-mono text-[11px] tabular-nums" style={{ color: C.text4 }}>
            {sub}
          </span>
        ) : null}
      </span>
    </div>
  );
}
