// variant-a.tsx — PROTOTYPE (throwaway) — "Mission Control" live-run view.
//
// PRIMARY STRUCTURE: a horizontal orchestration TIMELINE across the top is the
// spine — Corpus (done) → 6 positioning agents (parallel) → Paid Media → Final
// manual. Each node carries running/committed state, a count, and elapsed.
// BELOW the spine: ONE focused live phase-narration feed (ChainOfThought) for
// the single most-active running section, with searched-source chips. Committed
// sections collapse into dense rows underneath, each with verdict + a calm
// "N verified · M flagged" badge.
//
// Bloomberg-terminal density, dark industrial tokens (self-contained — the
// prototype page renders us on a white surface, so we own our own dark shell).
// Streams the agent PROCESS only (phases + chips), never token-streamed content.
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { ChainOfThought } from '@/components/ai-elements/chain-of-thought';
import { cn } from '@/lib/utils';

import type { VariantProps } from './variant-contract';
import { ZONE_ORDER } from './variant-contract';
import {
  PHASE_META,
  collapseNarration,
  readVerification,
  sectionTitle,
  type CollapsedNarration,
  type NarrationItem,
  type ProductPhase,
} from './phase-narration';
import type { FixtureArtifactData } from './fixture-types';

// ---------------------------------------------------------------------------
// Tokens (DESIGN.md dark — restated locally so the variant is self-contained)
// ---------------------------------------------------------------------------

const BG_0 = '#07090e';
const BG_1 = '#0a0c12';
const BG_2 = '#0e1018';
const BG_3 = '#12141c';
const BORDER = 'rgba(255,255,255,0.04)';
const BORDER_HOVER = 'rgba(255,255,255,0.08)';
const TEXT_1 = '#e2e4ea';
const TEXT_2 = '#8b90a0';
const TEXT_3 = '#555a6a';
const TEXT_4 = '#3a3e4c';
const ACCENT = '#365eff';
const GREEN = '#22c55e';
const AMBER = '#eab308';
const RED = '#ef4444';

const MONO =
  'font-mono text-[11px] uppercase tracking-[0.06em] tabular-nums';

type WorkerState = VariantProps['state']['workerStates'][number];
type WorkerLite = { status: string; phase: string; elapsedMs: number | null };

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function fmtElapsed(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return '0:00';
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function toTen(confidence: unknown): number | null {
  const n = typeof confidence === 'number' ? confidence : Number(confidence);
  if (!Number.isFinite(n)) return null;
  // Artifacts store 0–1; display as N/10. Guard already-scaled values.
  const scaled = n <= 1 ? n * 10 : n;
  return Math.round(scaled * 10) / 10;
}

// `sectionsByZone[zone].data` is typed `unknown` on the contract; the replay
// fills it with the fixture artifact. Narrow at the boundary, no casting noise.
function artifactOf(
  state: VariantProps['state'],
  zone: string,
): FixtureArtifactData | null {
  const entry = state.sectionsByZone[zone];
  const data = entry?.data;
  return data && typeof data === 'object'
    ? (data as FixtureArtifactData)
    : null;
}

const PHASE_DOT_TONE: Record<ProductPhase, string> = {
  preparing: TEXT_3,
  searching: ACCENT,
  drafting: ACCENT,
  checking: ACCENT,
  refining: AMBER,
  committing: GREEN,
  done: GREEN,
};

// ---------------------------------------------------------------------------
// Timeline spine
// ---------------------------------------------------------------------------

type NodeState = 'done' | 'running' | 'queued' | 'error';

interface SpineNode {
  key: string;
  label: string;
  state: NodeState;
  /** Right-aligned mono count, e.g. "71 ✓" committed or "12 src" live. */
  count: string | null;
  elapsed: string | null;
  /** Only positioning zones are selectable to focus the feed. */
  zone: string | null;
  isFocusable: boolean;
}

function nodeToneColor(state: NodeState): string {
  if (state === 'done') return GREEN;
  if (state === 'running') return ACCENT;
  if (state === 'error') return RED;
  return TEXT_4;
}

function TimelineNode({
  node,
  active,
  onSelect,
}: {
  node: SpineNode;
  active: boolean;
  onSelect: () => void;
}) {
  const tone = nodeToneColor(node.state);
  const running = node.state === 'running';
  const interactive = node.isFocusable;

  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={interactive ? onSelect : undefined}
      aria-pressed={active}
      className={cn(
        'group relative flex w-[124px] shrink-0 flex-col gap-1.5 rounded-[6px] border px-2.5 py-2 text-left transition-colors',
        interactive ? 'cursor-pointer' : 'cursor-default',
      )}
      style={{
        backgroundColor: active ? BG_3 : BG_2,
        borderColor: active ? BORDER_HOVER : BORDER,
      }}
    >
      {/* active focus rail */}
      <span
        aria-hidden
        className="absolute inset-y-1 left-0 w-[2px] rounded-full transition-opacity"
        style={{ backgroundColor: ACCENT, opacity: active ? 1 : 0 }}
      />
      <div className="flex items-center gap-1.5">
        <span
          aria-hidden
          className={cn(
            'size-[7px] shrink-0 rounded-full',
            running && 'motion-safe:animate-pulse',
          )}
          style={{ backgroundColor: tone }}
        />
        <span
          className={MONO}
          style={{ color: node.state === 'queued' ? TEXT_3 : TEXT_1 }}
        >
          {node.label}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 pl-[15px]">
        <span
          className="font-mono text-[10px] tabular-nums"
          style={{ color: node.count ? TEXT_2 : TEXT_4 }}
        >
          {node.count ?? '—'}
        </span>
        <span
          className="font-mono text-[10px] tabular-nums"
          style={{ color: TEXT_3 }}
        >
          {node.elapsed ?? ''}
        </span>
      </div>
    </button>
  );
}

function TimelineConnector({ filled }: { filled: boolean }) {
  return (
    <span
      aria-hidden
      className="h-[1.5px] w-4 shrink-0 self-start rounded-full"
      style={{
        marginTop: 17,
        backgroundColor: filled ? ACCENT : 'rgba(255,255,255,0.06)',
        opacity: filled ? 0.55 : 1,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Focused live feed (ChainOfThought, restyled to dark tokens)
// ---------------------------------------------------------------------------

// One narration step: phase-toned dot + connector rail (the audit-reader-shell
// timeline grammar), label with repeat count, optional translated detail, and
// searched-source chips. Hand-rolled so the dot can carry phase tone on dark.
function FeedStep({
  row,
  active,
  isLast,
}: {
  row: CollapsedNarration;
  active: boolean;
  isLast: boolean;
}) {
  const meta = PHASE_META[row.phase];
  return (
    <li className="relative flex gap-3 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
      <div className="relative mt-[5px] flex flex-col items-center">
        <span
          aria-hidden
          className={cn(
            'size-2 shrink-0 rounded-full',
            active && 'motion-safe:animate-pulse',
          )}
          style={{ backgroundColor: PHASE_DOT_TONE[row.phase] }}
        />
        {!isLast ? (
          <span
            aria-hidden
            className="mt-1 w-px flex-1"
            style={{ backgroundColor: BORDER_HOVER }}
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1 pb-3">
        <div className="flex items-baseline gap-2">
          <span
            className="text-[13px]"
            style={{ color: active ? TEXT_1 : TEXT_2 }}
          >
            {meta.verb}
          </span>
          {row.count > 1 ? (
            <span
              className="font-mono text-[10px] tabular-nums"
              style={{ color: TEXT_3 }}
            >
              ×{row.count}
            </span>
          ) : null}
        </div>
        {row.detail ? (
          <div className="mt-0.5 text-[12px] leading-[1.45]" style={{ color: TEXT_3 }}>
            {row.detail}
          </div>
        ) : null}
        {row.chips.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {row.chips.slice(-6).map((chip, ci) => (
              <SourceChip key={`${row.id}-${ci}`}>{chip}</SourceChip>
            ))}
            {row.chips.length > 6 ? (
              <span
                className="self-center font-mono text-[10px] tabular-nums"
                style={{ color: TEXT_4 }}
              >
                +{row.chips.length - 6}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}

function SourceChip({ children }: { children: string }) {
  return (
    <span
      className="inline-flex max-w-[280px] items-center truncate rounded-full border px-2 py-[3px] font-mono text-[10px] leading-none"
      style={{ borderColor: BORDER_HOVER, color: TEXT_2, backgroundColor: BG_2 }}
      title={children}
    >
      {children}
    </span>
  );
}

function FocusedFeed({
  zone,
  worker,
  rows,
}: {
  zone: string;
  worker: WorkerState | undefined;
  rows: CollapsedNarration[];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastId = rows[rows.length - 1]?.id ?? null;

  // Pin to newest as the feed grows (process feed, not content).
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastId]);

  const live = worker?.status === 'running';

  return (
    <section
      className="flex min-h-0 flex-1 flex-col rounded-[8px] border"
      style={{ backgroundColor: BG_1, borderColor: BORDER }}
    >
      <header
        className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3"
        style={{ borderColor: BORDER }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              'size-[7px] rounded-full',
              live && 'motion-safe:animate-pulse',
            )}
            style={{ backgroundColor: live ? ACCENT : GREEN }}
          />
          <span className={MONO} style={{ color: TEXT_3 }}>
            Now running
          </span>
          <span
            className="text-[13px] font-medium tracking-tight"
            style={{ color: TEXT_1 }}
          >
            {sectionTitle(zone)}
          </span>
        </div>
        <span className={MONO} style={{ color: TEXT_2 }}>
          {worker?.phaseLabel ?? '—'} · {fmtElapsed(worker?.elapsedMs)}
        </span>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {rows.length === 0 ? (
          <p className="text-[13px]" style={{ color: TEXT_3 }}>
            Compiling context…
          </p>
        ) : (
          <ChainOfThought open className="max-w-none">
            <ol>
              {rows.map((row, i) => (
                <FeedStep
                  key={row.id}
                  row={row}
                  isLast={i === rows.length - 1}
                  active={i === rows.length - 1 && live}
                />
              ))}
            </ol>
          </ChainOfThought>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Committed section rows
// ---------------------------------------------------------------------------

function VerificationBadge({ data }: { data: FixtureArtifactData }) {
  const v = readVerification(data);
  if (!v) return null;
  const hasFlags = v.flagged > 0;
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-[3px] font-mono text-[10px] tabular-nums"
      style={{ borderColor: BORDER_HOVER, backgroundColor: BG_1 }}
    >
      <span style={{ color: GREEN }}>{v.verified} verified</span>
      <span style={{ color: TEXT_4 }}>·</span>
      <span style={{ color: hasFlags ? AMBER : TEXT_3 }}>
        {v.flagged} flagged
      </span>
    </span>
  );
}

function CommittedRow({ zone, data }: { zone: string; data: FixtureArtifactData }) {
  const [open, setOpen] = useState(false);
  const ten = toTen(data.confidence);
  const sourceCount = Array.isArray(data.sources) ? data.sources.length : 0;
  const subKeys = data.body ? Object.keys(data.body) : [];

  return (
    <div
      className="rounded-[6px] border transition-colors motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-200"
      style={{ backgroundColor: BG_2, borderColor: BORDER }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left"
      >
        <span
          aria-hidden
          className="size-[7px] shrink-0 rounded-full"
          style={{ backgroundColor: GREEN }}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span
              className="truncate text-[13px] font-medium tracking-tight"
              style={{ color: TEXT_1 }}
            >
              {data.sectionTitle
                ? data.sectionTitle.split('—')[0].trim()
                : sectionTitle(zone)}
            </span>
            {ten != null ? (
              <span
                className="shrink-0 font-mono text-[10px] tabular-nums"
                style={{ color: TEXT_3 }}
              >
                {ten}/10
              </span>
            ) : null}
          </div>
          {data.verdict ? (
            <span
              className={cn('text-[12px] leading-[1.45]', open ? '' : 'truncate')}
              style={{ color: TEXT_2 }}
            >
              {data.verdict}
            </span>
          ) : null}
        </div>
        <VerificationBadge data={data} />
      </button>

      {open ? (
        <div className="border-t px-3.5 py-3" style={{ borderColor: BORDER }}>
          {data.statusSummary ? (
            <p
              className="mb-3 border-l-2 pl-3 text-[12.5px] leading-[1.5]"
              style={{ borderColor: ACCENT, color: TEXT_2 }}
            >
              {data.statusSummary}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className={MONO} style={{ color: TEXT_3 }}>
              {sourceCount} sources
            </span>
            {subKeys.map((key) => (
              <span
                key={key}
                className="font-mono text-[10px] lowercase tracking-[0.02em]"
                style={{ color: TEXT_4 }}
              >
                {key}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header strip — run-level telemetry
// ---------------------------------------------------------------------------

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className={MONO} style={{ color: TEXT_3 }}>
        {label}
      </span>
      <span
        className="font-mono text-[15px] font-medium tabular-nums"
        style={{ color: tone ?? TEXT_1 }}
      >
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Variant
// ---------------------------------------------------------------------------

export const VariantA = ({ state, narration, elapsedMs, totalMs, playing }: VariantProps) => {
  const workerByZone = useMemo(() => {
    const m = new Map<string, WorkerState>();
    for (const w of state.workerStates) m.set(w.section_id, w);
    return m;
  }, [state.workerStates]);

  // Per-zone narration, collapsed once, keyed for cheap focused-feed lookup.
  const collapsedByZone = useMemo(() => {
    const byZone = new Map<string, NarrationItem[]>();
    for (const item of narration) {
      const list = byZone.get(item.zone) ?? [];
      list.push(item);
      byZone.set(item.zone, list);
    }
    const out = new Map<string, CollapsedNarration[]>();
    for (const [zone, items] of byZone) out.set(zone, collapseNarration(items));
    return out;
  }, [narration]);

  // Last narration timestamp per zone → "most-active" tiebreak.
  const lastAtByZone = useMemo(() => {
    const m = new Map<string, number>();
    for (const item of narration) m.set(item.zone, Date.parse(item.at));
    return m;
  }, [narration]);

  const runningZones = useMemo<string[]>(
    () =>
      (ZONE_ORDER as readonly string[]).filter(
        (z) => workerByZone.get(z)?.status === 'running',
      ),
    [workerByZone],
  );

  // Auto-focus the most-active running section; let the operator override by
  // clicking a node. Clear the override once that zone is no longer running.
  const [pinnedZone, setPinnedZone] = useState<string | null>(null);

  const mostActiveZone = useMemo(() => {
    if (runningZones.length === 0) return null;
    return [...runningZones].sort(
      (a, b) => (lastAtByZone.get(b) ?? 0) - (lastAtByZone.get(a) ?? 0),
    )[0];
  }, [runningZones, lastAtByZone]);

  useEffect(() => {
    if (pinnedZone && !runningZones.includes(pinnedZone)) setPinnedZone(null);
  }, [pinnedZone, runningZones]);

  const focusedZone =
    pinnedZone && runningZones.includes(pinnedZone) ? pinnedZone : mostActiveZone;

  const committedZones = useMemo(
    () => ZONE_ORDER.filter((z) => artifactOf(state, z) !== null),
    [state],
  );

  // Run-level rollup.
  const positioningDone = Math.min(state.children_complete, 6);
  const totalVerified = useMemo(() => {
    let sum = 0;
    for (const z of committedZones) {
      const v = readVerification(artifactOf(state, z));
      if (v) sum += v.verified;
    }
    return sum;
  }, [committedZones, state]);
  const totalFlagged = useMemo(() => {
    let sum = 0;
    for (const z of committedZones) {
      const v = readVerification(artifactOf(state, z));
      if (v) sum += v.flagged;
    }
    return sum;
  }, [committedZones, state]);

  const paidMedia = 'positioningPaidMediaPlan';
  const sixDone = positioningDone >= 6;
  const paidWorker = workerByZone.get(paidMedia);
  const paidArtifact = artifactOf(state, paidMedia);
  const finished = state.parent_status === 'complete';

  // ---- Build the spine -----------------------------------------------------
  const spine: SpineNode[] = useMemo(() => {
    const nodes: SpineNode[] = [];

    // Corpus precedes this run; the fan-out is already underway, so it is done.
    nodes.push({
      key: 'corpus',
      label: 'Corpus',
      state: 'done',
      count: 'ready',
      elapsed: null,
      zone: null,
      isFocusable: false,
    });

    // Six positioning agents.
    const positioning = ZONE_ORDER.filter((z) => z !== paidMedia);
    for (const zone of positioning) {
      const w = workerByZone.get(zone);
      const art = artifactOf(state, zone);
      let nodeState: NodeState = 'queued';
      if (w?.status === 'complete' || art) nodeState = 'done';
      else if (w?.status === 'running') nodeState = 'running';
      else if (w?.status === 'error' || w?.status === 'aborted') nodeState = 'error';

      let count: string | null = null;
      if (nodeState === 'done' && art) {
        const v = readVerification(art);
        count = v ? `${v.verified} ✓` : 'done';
      } else if (nodeState === 'running') {
        const rows = collapsedByZone.get(zone) ?? [];
        const queries = rows
          .filter((r) => r.phase === 'searching')
          .reduce((n, r) => n + r.chips.length, 0);
        count = queries > 0 ? `${queries} src` : 'working';
      }

      nodes.push({
        key: zone,
        label: sectionTitle(zone),
        state: nodeState,
        count,
        elapsed:
          nodeState === 'running' || nodeState === 'done'
            ? fmtElapsed(w?.elapsedMs)
            : null,
        zone,
        isFocusable: nodeState === 'running',
      });
    }

    // Paid media (terminal section).
    let paidState: NodeState = 'queued';
    if (paidWorker?.status === 'complete' || paidArtifact) paidState = 'done';
    else if (paidWorker?.status === 'running') paidState = 'running';
    else if (paidWorker?.status === 'error' || paidWorker?.status === 'aborted')
      paidState = 'error';
    nodes.push({
      key: paidMedia,
      label: 'Paid Media',
      state: paidState,
      count:
        paidState === 'done'
          ? 'committed'
          : sixDone && paidState === 'queued'
            ? 'ready'
            : paidState === 'running'
              ? 'working'
              : null,
      elapsed:
        paidState === 'running' || paidState === 'done'
          ? fmtElapsed(paidWorker?.elapsedMs)
          : null,
      zone: paidState === 'running' ? paidMedia : null,
      isFocusable: paidState === 'running',
    });

    // Final manual assembly — operator step after the engine finishes.
    nodes.push({
      key: 'final',
      label: 'Final',
      state: finished ? 'running' : 'queued',
      count: finished ? 'awaiting you' : null,
      elapsed: null,
      zone: null,
      isFocusable: false,
    });

    return nodes;
  }, [
    workerByZone,
    state,
    collapsedByZone,
    paidWorker,
    paidArtifact,
    sixDone,
    finished,
  ]);

  const focusedRows = focusedZone
    ? (collapsedByZone.get(focusedZone) ?? [])
    : [];
  const focusedWorker = focusedZone ? workerByZone.get(focusedZone) : undefined;

  return (
    <div
      className="flex h-[calc(100vh-110px)] flex-col font-sans"
      style={{ backgroundColor: BG_0, color: TEXT_1 }}
    >
      {/* ── Header rollup ───────────────────────────────────────────────── */}
      <header
        className="flex shrink-0 flex-wrap items-center justify-between gap-6 border-b px-6 py-4"
        style={{ borderColor: BORDER, backgroundColor: BG_1 }}
      >
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'size-2 rounded-full',
              playing && !finished && 'motion-safe:animate-pulse',
            )}
            style={{ backgroundColor: finished ? GREEN : ACCENT }}
          />
          <div className="flex flex-col">
            <span className="text-[15px] font-semibold tracking-tight" style={{ color: TEXT_1 }}>
              Positioning Audit
            </span>
            <span className={MONO} style={{ color: TEXT_3 }}>
              {finished ? 'Run complete' : 'Orchestrating'} · {runningZones.length} running
            </span>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <Stat label="Sections" value={`${positioningDone}/6`} />
          <Stat label="Verified" value={String(totalVerified)} tone={GREEN} />
          <Stat
            label="Flagged"
            value={String(totalFlagged)}
            tone={totalFlagged > 0 ? AMBER : TEXT_1}
          />
          <Stat label="Elapsed" value={fmtElapsed(elapsedMs)} />
          <div className="flex flex-col gap-1">
            <span className={MONO} style={{ color: TEXT_3 }}>
              Progress
            </span>
            <div
              className="h-1 w-28 overflow-hidden rounded-full"
              style={{ backgroundColor: BG_3 }}
            >
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{
                  width: `${Math.min(100, Math.round((elapsedMs / Math.max(totalMs, 1)) * 100))}%`,
                  backgroundColor: ACCENT,
                }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* ── Timeline spine (PRIMARY AFFORDANCE) ─────────────────────────── */}
      <div
        className="shrink-0 border-b px-6 py-3"
        style={{ borderColor: BORDER, backgroundColor: BG_0 }}
      >
        <div className="flex items-start overflow-x-auto pb-1">
          {spine.map((node, i) => (
            <div key={node.key} className="flex items-start">
              {i > 0 ? (
                <TimelineConnector
                  filled={spine[i - 1].state === 'done'}
                />
              ) : null}
              <TimelineNode
                node={node}
                active={node.zone != null && node.zone === focusedZone}
                onSelect={() => node.zone && setPinnedZone(node.zone)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Body: focused feed (left) + committed rows (right) ──────────── */}
      <div className="flex min-h-0 flex-1 gap-4 px-6 py-4">
        <div className="flex min-h-0 w-[58%] flex-col">
          {focusedZone ? (
            <FocusedFeed
              zone={focusedZone}
              worker={focusedWorker}
              rows={focusedRows}
            />
          ) : (
            <section
              className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-[8px] border"
              style={{ backgroundColor: BG_1, borderColor: BORDER }}
            >
              <span className={MONO} style={{ color: TEXT_3 }}>
                {finished ? 'All sections committed' : 'No section running'}
              </span>
              {finished ? (
                <span className="mt-2 text-[13px]" style={{ color: TEXT_2 }}>
                  {totalVerified} claims verified across {committedZones.length}{' '}
                  sections.
                </span>
              ) : null}
            </section>
          )}
        </div>

        {/* Committed sections — dense ledger */}
        <div className="flex min-h-0 w-[42%] flex-col">
          <div
            className="mb-2 flex shrink-0 items-center justify-between"
          >
            <span className={MONO} style={{ color: TEXT_3 }}>
              Committed
            </span>
            <span className={MONO} style={{ color: TEXT_3 }}>
              {committedZones.length} / 7
            </span>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {committedZones.length === 0 ? (
              <div
                className="rounded-[6px] border border-dashed px-4 py-8 text-center"
                style={{ borderColor: BORDER_HOVER }}
              >
                <span className="text-[13px]" style={{ color: TEXT_3 }}>
                  Sections commit here the moment each agent finishes.
                </span>
              </div>
            ) : (
              committedZones.map((zone) => {
                const art = artifactOf(state, zone);
                if (!art) return null;
                return <CommittedRow key={zone} zone={zone} data={art} />;
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
