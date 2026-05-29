// variant-c.tsx — PROTOTYPE "Research Console".
//
// ONE unified vertical narrative thread (Perplexity / Claude-research idiom,
// restyled to the AIGOS industrial dark system). The whole run narrates
// top-to-bottom: per-zone phase steps with searched-source chips and
// "checking / strengthening N claims" moments. The instant a section's worker
// flips to `complete`, its artifact resolves IN-LINE in the thread as a
// collapsible block carrying its verdict + "N verified · M flagged" badge +
// source count + sub-section names. Feels like watching one agent narrate its
// research end-to-end.
//
// Hard rules honoured: replays a FINISHED run, so we stream the PROCESS
// (phases + chips + claim-strengthening) — never token-streamed unverified
// content. We consume only the customer-safe `narration` prop and the
// committed artifact's whitelisted fields (verdict / statusSummary /
// verification / sources / sub-section names). No raw payload, JSON, Zod
// arrays, or schema paths are ever surfaced. Motion is opacity/translate only
// and respects prefers-reduced-motion.
'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  FileText,
  Loader2,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  collapseNarration,
  readVerification,
  sectionTitle,
  type CollapsedNarration,
  type NarrationTone,
  type ProductPhase,
} from './phase-narration';
import { ZONE_ORDER, type VariantProps } from './variant-contract';
import type { FixtureArtifactData } from './fixture-types';

// ---------------------------------------------------------------------------
// Tokens — DESIGN.md dark palette, inlined so the console reads "Bloomberg
// Terminal meets Linear" independent of the active shadcn theme.
// ---------------------------------------------------------------------------

const C = {
  bg0: '#07090e',
  bg1: '#0a0c12',
  bg2: '#0e1018',
  bg3: '#12141c',
  border: 'rgba(255,255,255,0.04)',
  borderStrong: 'rgba(255,255,255,0.08)',
  text1: '#e2e4ea',
  text2: '#8b90a0',
  text3: '#555a6a',
  text4: '#3a3e4c',
  accent: '#365eff',
  accentDim: 'rgba(54,94,255,0.10)',
  green: '#22c55e',
  amber: '#eab308',
  red: '#ef4444',
} as const;

const MONO =
  'var(--font-jetbrains-mono, var(--font-geist-mono, ui-monospace, SFMono-Regular, Menlo, monospace))';

const TONE_COLOR: Record<NarrationTone, string> = {
  active: C.accent,
  neutral: C.text3,
  success: C.green,
  warning: C.amber,
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function fmtClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function hostnameOf(url: string | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function asConfidenceTen(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  // Artifacts store confidence either 0–1 or 0–10; normalise to /10.
  return n <= 1 ? Math.round(n * 100) / 10 : Math.round(n * 10) / 10;
}

function humanizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

// Whitelisted, customer-safe view of a committed artifact. We read only known
// top-level fields and the *names* of body sub-sections — never raw values,
// payloads, or schema internals.
interface CommittedView {
  title: string;
  verdict: string | null;
  statusSummary: string | null;
  confidenceTen: number | null;
  sources: Array<{ url: string; title: string }>;
  subSections: string[];
  verified: number;
  flagged: number;
}

function readCommitted(
  zone: string,
  body: { title?: string; data?: unknown } | undefined,
): CommittedView | null {
  if (!body) return null;
  const data =
    body.data && typeof body.data === 'object' && !Array.isArray(body.data)
      ? (body.data as Record<string, unknown>)
      : null;

  const verification = readVerification(
    (data as FixtureArtifactData | null) ?? undefined,
  );

  const rawSources = Array.isArray(data?.sources) ? data?.sources : [];
  const sources = rawSources
    .map((s) => {
      const rec =
        s && typeof s === 'object' ? (s as Record<string, unknown>) : {};
      const url = typeof rec.url === 'string' ? rec.url : '';
      const title =
        typeof rec.title === 'string' && rec.title.trim()
          ? rec.title
          : hostnameOf(url) || 'Source';
      return { url, title };
    })
    .filter((s) => s.url.length > 0)
    .slice(0, 24);

  const bodyObj =
    data?.body && typeof data.body === 'object' && !Array.isArray(data.body)
      ? (data.body as Record<string, unknown>)
      : null;
  const subSections = bodyObj
    ? Object.keys(bodyObj)
        .filter((k) => bodyObj[k] != null)
        .map(humanizeKey)
        .slice(0, 12)
    : [];

  const title =
    (typeof data?.sectionTitle === 'string' && data.sectionTitle.trim()
      ? (data.sectionTitle as string)
      : body.title) ?? sectionTitle(zone);

  return {
    title: title.split('—')[0].split(' - ')[0].trim(),
    verdict:
      typeof data?.verdict === 'string' && data.verdict.trim()
        ? (data.verdict as string)
        : null,
    statusSummary:
      typeof data?.statusSummary === 'string' && data.statusSummary.trim()
        ? (data.statusSummary as string)
        : null,
    confidenceTen: asConfidenceTen(data?.confidence),
    sources,
    subSections,
    verified: verification?.verified ?? 0,
    flagged: verification?.flagged ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Per-zone thread segment model — collapsed narration grouped by zone, in true
// chronological start order so the thread reads as one interleaved run.
// ---------------------------------------------------------------------------

type ZoneStatus = 'queued' | 'running' | 'complete' | 'error' | 'aborted';

interface ZoneSegment {
  zone: string;
  title: string;
  steps: CollapsedNarration[];
  startedAt: number;
}

function buildSegments(narration: VariantProps['narration']): ZoneSegment[] {
  const collapsed = collapseNarration(narration);
  const byZone = new Map<string, ZoneSegment>();
  const order: string[] = [];

  for (const step of collapsed) {
    let seg = byZone.get(step.zone);
    if (!seg) {
      seg = {
        zone: step.zone,
        title: sectionTitle(step.zone),
        steps: [],
        startedAt: Date.parse(step.at) || 0,
      };
      byZone.set(step.zone, seg);
      order.push(step.zone);
    }
    seg.steps.push(step);
  }

  // Order segments by first-event wall-clock; fall back to canonical pipeline
  // order so a tie (or paid-media terminal) lands where the operator expects.
  return order
    .map((zone) => byZone.get(zone)!)
    .sort((a, b) => {
      if (a.startedAt !== b.startedAt) return a.startedAt - b.startedAt;
      return ZONE_ORDER.indexOf(a.zone as never) - ZONE_ORDER.indexOf(b.zone as never);
    });
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

function MonoLabel({
  children,
  style,
  className,
}: {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}): ReactElement {
  return (
    <span
      className={cn('uppercase', className)}
      style={{
        fontFamily: MONO,
        fontSize: 11,
        letterSpacing: '0.06em',
        color: C.text3,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

function VerificationBadge({
  verified,
  flagged,
}: {
  verified: number;
  flagged: number;
}): ReactElement {
  const clean = flagged === 0;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-[3px]"
      style={{
        fontFamily: MONO,
        fontSize: 11,
        letterSpacing: '0.04em',
        border: `1px solid ${C.border}`,
        background: C.bg2,
        color: C.text2,
      }}
      title={`${verified} claims verified against sources · ${flagged} flagged`}
    >
      <ShieldCheck
        className="size-3"
        style={{ color: clean ? C.green : C.amber }}
        strokeWidth={2.25}
      />
      <span className="tabular-nums" style={{ color: C.text1 }}>
        {verified}
      </span>
      <span>verified</span>
      <span style={{ color: C.text4 }}>·</span>
      <span
        className="tabular-nums"
        style={{ color: flagged > 0 ? C.amber : C.text2 }}
      >
        {flagged}
      </span>
      <span>flagged</span>
    </span>
  );
}

function StatusPill({ status }: { status: ZoneStatus }): ReactElement {
  const map: Record<ZoneStatus, { label: string; color: string }> = {
    queued: { label: 'Queued', color: C.text3 },
    running: { label: 'Researching', color: C.accent },
    complete: { label: 'Verified', color: C.green },
    error: { label: 'Needs review', color: C.red },
    aborted: { label: 'Aborted', color: C.red },
  };
  const { label, color } = map[status];
  return (
    <span
      className="inline-flex items-center gap-1.5"
      style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.06em', color }}
    >
      {status === 'running' ? (
        <Loader2 className="size-3 animate-spin" strokeWidth={2.5} />
      ) : status === 'complete' ? (
        <CheckCircle2 className="size-3" strokeWidth={2.5} />
      ) : (
        <CircleDot className="size-3" strokeWidth={2.5} />
      )}
      <span className="uppercase">{label}</span>
    </span>
  );
}

const PHASE_ICON: Record<ProductPhase, typeof Search> = {
  preparing: CircleDot,
  searching: Search,
  drafting: FileText,
  checking: ShieldCheck,
  refining: Sparkles,
  committing: CheckCircle2,
  done: CheckCircle2,
};

// A single phase step in a zone segment. The `live` step (last step of the
// active running zone) gets a quiet animated label; everything else is settled.
function PhaseStep({
  step,
  live,
  reduceMotion,
}: {
  step: CollapsedNarration;
  live: boolean;
  reduceMotion: boolean;
}): ReactElement {
  const Icon = PHASE_ICON[step.phase] ?? CircleDot;
  const tone = TONE_COLOR[step.tone];
  const showChips = step.chips.length > 0;
  const animate = live && !reduceMotion;

  return (
    <li className="relative pl-7" style={{ paddingBottom: 14 }}>
      {/* rail node */}
      <span
        className="absolute left-[7px] top-[3px] flex size-4 items-center justify-center"
        aria-hidden
      >
        <Icon
          className={cn('size-[14px]', animate && 'animate-pulse')}
          style={{ color: live ? C.accent : tone }}
          strokeWidth={2.25}
        />
      </span>

      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span
          className="text-[13px] leading-[1.5]"
          style={{
            color: live ? C.text1 : C.text2,
            fontWeight: live ? 500 : 400,
            transition: reduceMotion ? undefined : 'color 200ms',
          }}
        >
          {step.label}
        </span>
        {step.count > 1 ? (
          <span
            className="tabular-nums"
            style={{
              fontFamily: MONO,
              fontSize: 11,
              letterSpacing: '0.04em',
              color: C.text3,
            }}
          >
            ×{step.count}
          </span>
        ) : null}
        {animate ? (
          <span
            className="inline-block size-1.5 animate-pulse rounded-full"
            style={{ background: C.accent }}
            aria-hidden
          />
        ) : null}
      </div>

      {step.detail ? (
        <div
          className="mt-1 text-[12.5px] leading-[1.45]"
          style={{ color: step.tone === 'warning' ? C.amber : C.text2 }}
        >
          {step.detail}
        </div>
      ) : null}

      {showChips ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {step.chips.slice(0, 8).map((chip, i) => (
            <span
              key={`${chip}-${i}`}
              className="inline-flex max-w-[260px] items-center gap-1.5 truncate rounded-[5px] px-2 py-1"
              style={{
                fontSize: 11.5,
                background: C.bg2,
                border: `1px solid ${C.border}`,
                color: C.text2,
              }}
              title={chip}
            >
              <Search
                className="size-3 shrink-0"
                style={{ color: C.text3 }}
                strokeWidth={2}
              />
              <span className="truncate">{chip}</span>
            </span>
          ))}
          {step.chips.length > 8 ? (
            <span
              className="inline-flex items-center rounded-[5px] px-2 py-1 tabular-nums"
              style={{
                fontFamily: MONO,
                fontSize: 11,
                background: C.bg2,
                border: `1px solid ${C.border}`,
                color: C.text3,
              }}
            >
              +{step.chips.length - 8}
            </span>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

// In-line resolved artifact block — appears the moment a zone commits.
function CommittedArtifact({
  view,
  reduceMotion,
}: {
  view: CommittedView;
  reduceMotion: boolean;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(reduceMotion);

  useEffect(() => {
    if (reduceMotion) return;
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, [reduceMotion]);

  return (
    <div
      className="ml-7 mt-1 overflow-hidden rounded-[8px]"
      style={{
        background: C.bg2,
        border: `1px solid ${C.border}`,
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(6px)',
        transition: reduceMotion ? undefined : 'opacity 260ms ease-out, transform 260ms ease-out',
      }}
    >
      {/* header */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-3"
        style={{ borderBottom: `1px solid ${C.border}` }}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <FileText className="size-4 shrink-0" style={{ color: C.accent }} strokeWidth={2} />
          <span
            className="truncate text-[13.5px] font-medium"
            style={{ color: C.text1 }}
          >
            {view.title}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <VerificationBadge verified={view.verified} flagged={view.flagged} />
          {view.confidenceTen != null ? (
            <span
              className="inline-flex items-center gap-1 tabular-nums"
              style={{ fontFamily: MONO, fontSize: 11, color: C.text2 }}
            >
              <span style={{ color: C.text1 }}>
                {view.confidenceTen.toFixed(1)}
              </span>
              <MonoLabel style={{ fontSize: 10 }}>conf</MonoLabel>
            </span>
          ) : null}
        </div>
      </div>

      {/* verdict — callout block: 2px left accent, no fill */}
      {view.verdict ? (
        <div className="px-4 py-3.5" style={{ borderLeft: `2px solid ${C.accent}` }}>
          <MonoLabel style={{ fontSize: 10 }}>Verdict</MonoLabel>
          <p
            className="mt-1.5 text-[14px] leading-[1.6]"
            style={{ color: C.text1 }}
          >
            {view.verdict}
          </p>
        </div>
      ) : null}

      {view.statusSummary ? (
        <p
          className="px-4 pb-3 text-[13px] leading-[1.55]"
          style={{ color: C.text2 }}
        >
          {view.statusSummary}
        </p>
      ) : null}

      {/* sub-section names — light fidelity, the names only */}
      {view.subSections.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 px-4 pb-3.5">
          {view.subSections.map((name) => (
            <span
              key={name}
              className="rounded-[5px] px-2 py-1 text-[11.5px]"
              style={{
                background: C.bg3,
                border: `1px solid ${C.border}`,
                color: C.text2,
              }}
            >
              {name}
            </span>
          ))}
        </div>
      ) : null}

      {/* sources disclosure */}
      {view.sources.length > 0 ? (
        <div style={{ borderTop: `1px solid ${C.border}` }}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center gap-2 px-4 py-2.5 transition-colors"
            style={{ background: 'transparent' }}
            aria-expanded={open}
          >
            <ArrowUpRight
              className="size-3.5 transition-transform"
              style={{
                color: C.text3,
                transform: open ? 'rotate(90deg)' : 'none',
              }}
              strokeWidth={2}
            />
            <MonoLabel>{view.sources.length} sources</MonoLabel>
          </button>
          {open ? (
            <ol className="grid gap-x-8 gap-y-2 px-4 pb-4 sm:grid-cols-2">
              {view.sources.map((s, i) => (
                <li key={`${s.url}-${i}`} className="flex gap-2 text-[12.5px] leading-[1.5]">
                  <span
                    className="shrink-0 tabular-nums"
                    style={{ fontFamily: MONO, fontSize: 11, color: C.text4 }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 truncate underline-offset-2 hover:underline"
                    style={{ color: C.text2 }}
                    title={s.url}
                  >
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// One zone block in the thread: segment header → phase steps → resolved artifact.
function ThreadSegment({
  segment,
  status,
  isActive,
  committed,
  reduceMotion,
}: {
  segment: ZoneSegment;
  status: ZoneStatus;
  isActive: boolean;
  committed: CommittedView | null;
  reduceMotion: boolean;
}): ReactElement {
  const liveStepIndex =
    status === 'running' && !committed ? segment.steps.length - 1 : -1;

  return (
    <section className="relative">
      {/* continuous rail behind the steps */}
      <span
        className="absolute bottom-2 left-[14px] top-9 w-px"
        style={{ background: C.border }}
        aria-hidden
      />

      {/* segment header */}
      <div className="flex items-center gap-2.5 pb-3">
        <span
          className="flex size-5 items-center justify-center rounded-full"
          style={{
            border: `1px solid ${isActive ? C.accent : C.borderStrong}`,
            background: C.bg1,
          }}
        >
          <ChevronRight
            className="size-3"
            style={{ color: isActive ? C.accent : C.text3 }}
            strokeWidth={2.5}
          />
        </span>
        <span className="text-[13px] font-medium" style={{ color: C.text1 }}>
          {committed ? committed.title : segment.title}
        </span>
        <span className="ml-auto">
          <StatusPill status={status} />
        </span>
      </div>

      {/* phase steps */}
      <ol className="m-0 list-none p-0">
        {segment.steps.map((step, i) => (
          <PhaseStep
            key={step.id}
            step={step}
            live={i === liveStepIndex}
            reduceMotion={reduceMotion}
          />
        ))}
      </ol>

      {/* in-line resolved artifact */}
      {committed ? (
        <CommittedArtifact view={committed} reduceMotion={reduceMotion} />
      ) : null}

      <div style={{ height: 28 }} />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Variant
// ---------------------------------------------------------------------------

export const VariantC = ({
  state,
  narration,
  elapsedMs,
  totalMs,
  playing,
}: VariantProps): ReactElement => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const segments = useMemo(() => buildSegments(narration), [narration]);

  const statusByZone = useMemo(() => {
    const m = new Map<string, ZoneStatus>();
    for (const w of state.workerStates) m.set(w.section_id, w.status);
    return m;
  }, [state.workerStates]);

  // The active zone = the running worker with the most recent narration step.
  const activeZone = useMemo(() => {
    let best: { zone: string; at: number } | null = null;
    for (const seg of segments) {
      if (statusByZone.get(seg.zone) !== 'running') continue;
      const last = seg.steps[seg.steps.length - 1];
      const at = last ? Date.parse(last.at) || 0 : 0;
      if (!best || at >= best.at) best = { zone: seg.zone, at };
    }
    return best?.zone ?? null;
  }, [segments, statusByZone]);

  const committedByZone = useMemo(() => {
    const m = new Map<string, CommittedView>();
    for (const zone of Object.keys(state.sectionsByZone)) {
      const view = readCommitted(zone, state.sectionsByZone[zone]);
      if (view) m.set(zone, view);
    }
    return m;
  }, [state.sectionsByZone]);

  // Run-level rollups.
  const committedCount = Math.min(state.children_complete, 6);
  const totalVerified = useMemo(() => {
    let n = 0;
    for (const v of committedByZone.values()) n += v.verified;
    return n;
  }, [committedByZone]);
  const totalFlagged = useMemo(() => {
    let n = 0;
    for (const v of committedByZone.values()) n += v.flagged;
    return n;
  }, [committedByZone]);

  const finished = state.parent_status === 'complete' || elapsedMs >= totalMs;
  const progressPct =
    totalMs > 0 ? Math.min(100, Math.round((elapsedMs / totalMs) * 100)) : 0;

  // Auto-follow the live edge while the run is playing forward.
  useEffect(() => {
    if (!playing || reduceMotion) return;
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [narration.length, committedByZone.size, playing, reduceMotion]);

  return (
    <div
      className="flex h-full w-full flex-col"
      style={{ background: C.bg0, color: C.text1 }}
    >
      {/* ---- run header (sticky) ---- */}
      <header
        className="sticky top-0 z-10 shrink-0"
        style={{ background: C.bg0, borderBottom: `1px solid ${C.border}` }}
      >
        <div className="mx-auto flex w-full max-w-[920px] items-center gap-4 px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            <span
              className="flex size-6 items-center justify-center rounded-[6px]"
              style={{ background: C.accentDim, border: `1px solid ${C.border}` }}
            >
              <Sparkles className="size-3.5" style={{ color: C.accent }} strokeWidth={2} />
            </span>
            <div className="leading-tight">
              <div className="text-[13px] font-medium" style={{ color: C.text1 }}>
                Research Console
              </div>
              <MonoLabel style={{ fontSize: 10 }}>Positioning Audit</MonoLabel>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-5">
            <HeaderStat
              label="Sections"
              value={`${committedCount}/6`}
              tone={committedCount === 6 ? C.green : C.text1}
            />
            <HeaderStat
              label="Verified"
              value={String(totalVerified)}
              tone={C.text1}
            />
            <HeaderStat
              label="Flagged"
              value={String(totalFlagged)}
              tone={totalFlagged > 0 ? C.amber : C.text1}
            />
            <HeaderStat label="Elapsed" value={fmtClock(elapsedMs)} tone={C.text1} />
            <span className="inline-flex items-center gap-1.5">
              {finished ? (
                <CheckCircle2 className="size-3.5" style={{ color: C.green }} strokeWidth={2.5} />
              ) : (
                <Loader2 className="size-3.5 animate-spin" style={{ color: C.accent }} strokeWidth={2.5} />
              )}
              <MonoLabel style={{ color: finished ? C.green : C.accent }}>
                {finished ? 'Complete' : 'Running'}
              </MonoLabel>
            </span>
          </div>
        </div>
        {/* hairline progress */}
        <div className="h-px w-full" style={{ background: C.border }}>
          <div
            className="h-px"
            style={{
              width: `${progressPct}%`,
              background: finished ? C.green : C.accent,
              transition: reduceMotion ? undefined : 'width 200ms linear',
            }}
          />
        </div>
      </header>

      {/* ---- the thread ---- */}
      <div ref={scrollerRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[920px] px-6 py-7">
          {/* opening line — sets the "one agent narrating" frame */}
          <div className="mb-6 flex items-start gap-2.5">
            <Sparkles className="mt-0.5 size-4 shrink-0" style={{ color: C.accent }} strokeWidth={2} />
            <p className="text-[14px] leading-[1.6]" style={{ color: C.text2 }}>
              Running the six-part positioning audit. Each section searches live
              sources, drafts against them, then verifies every claim before it
              commits — resolving in-line below as it lands.
            </p>
          </div>

          {segments.length === 0 ? (
            <div
              className="flex items-center gap-2.5 rounded-[8px] px-4 py-4"
              style={{ background: C.bg1, border: `1px solid ${C.border}` }}
            >
              <Loader2 className="size-4 animate-spin" style={{ color: C.accent }} strokeWidth={2.5} />
              <span className="text-[13px]" style={{ color: C.text2 }}>
                Compiling shared context…
              </span>
            </div>
          ) : (
            segments.map((seg) => {
              const committed = committedByZone.get(seg.zone) ?? null;
              const rawStatus = statusByZone.get(seg.zone) ?? 'queued';
              const status: ZoneStatus = committed ? 'complete' : rawStatus;
              return (
                <ThreadSegment
                  key={seg.zone}
                  segment={seg}
                  status={status}
                  isActive={seg.zone === activeZone && !committed}
                  committed={committed}
                  reduceMotion={reduceMotion}
                />
              );
            })
          )}

          {/* terminal line */}
          {finished ? (
            <div
              className="mt-2 flex items-center gap-2.5 rounded-[8px] px-4 py-3.5"
              style={{ background: C.bg1, border: `1px solid ${C.border}` }}
            >
              <ShieldCheck className="size-4 shrink-0" style={{ color: C.green }} strokeWidth={2.25} />
              <span className="text-[13.5px]" style={{ color: C.text1 }}>
                Audit complete — {committedCount} sections committed, {totalVerified}{' '}
                claims verified against sources.
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

function HeaderStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}): ReactElement {
  return (
    <div className="flex flex-col items-end leading-none">
      <span
        className="tabular-nums"
        style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: tone }}
      >
        {value}
      </span>
      <MonoLabel style={{ fontSize: 10, marginTop: 3 }}>{label}</MonoLabel>
    </div>
  );
}
