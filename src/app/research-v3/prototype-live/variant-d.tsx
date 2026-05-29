// variant-d.tsx — PROTOTYPE "Simple Stream".
//
// The DEAD-SIMPLE base to go from. Two panes, full height, DESIGN.md dark
// tokens (same inline approach as variant-c): a compact fixed left nav mirroring
// the current app's section list, and a main pane that streams the live phase
// narration as a plain scrolling list. No artifact rendering, no tabs, no
// timeline — just "watch the agent work".
//
// Customer-safe: renders ONLY the `narration` prop's whitelisted fields
// (label / detail / chip) — never raw payload, JSON, or schema internals.
// Motion is auto-scroll only and respects prefers-reduced-motion.
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

import { PHASE_META, sectionTitle } from './phase-narration';
import { ZONE_ORDER, type VariantProps } from './variant-contract';

// ---------------------------------------------------------------------------
// Tokens — DESIGN.md dark palette, inlined (same set as variant-c).
// ---------------------------------------------------------------------------

const C = {
  bg0: '#07090e',
  bg1: '#0a0c12',
  bg2: '#0e1018',
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

type WorkerStatus = VariantProps['state']['workerStates'][number]['status'];

function fmtClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const STATUS_DOT: Record<WorkerStatus, string> = {
  queued: C.text4,
  running: C.accent,
  complete: C.green,
  error: C.red,
  aborted: C.red,
};

function MonoLabel({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}): ReactElement {
  return (
    <span
      className="uppercase"
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

// ---------------------------------------------------------------------------
// Variant
// ---------------------------------------------------------------------------

export const VariantD = ({
  state,
  narration,
  elapsedMs,
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

  // Section status lookup for the left nav.
  const statusByZone = useMemo(() => {
    const m = new Map<string, WorkerStatus>();
    for (const w of state.workerStates) m.set(w.section_id, w.status);
    return m;
  }, [state.workerStates]);

  const runningZone = useMemo(() => {
    for (const zone of ZONE_ORDER) {
      if (statusByZone.get(zone) === 'running') return zone as string;
    }
    return null;
  }, [statusByZone]);

  const completeCount = Math.min(state.children_complete, 6);

  // Auto-scroll to the newest line while the run plays forward.
  useEffect(() => {
    if (!playing || reduceMotion) return;
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [narration.length, playing, reduceMotion]);

  return (
    <div
      className="flex h-full w-full"
      style={{ background: C.bg0, color: C.text1 }}
    >
      {/* ---- left nav (fixed-width section list) ---- */}
      <nav
        className="flex w-[220px] shrink-0 flex-col gap-0.5 overflow-y-auto px-3 py-4"
        style={{ background: C.bg1, borderRight: `1px solid ${C.border}` }}
        aria-label="Sections"
      >
        <MonoLabel style={{ marginLeft: 8, marginBottom: 8 }}>Sections</MonoLabel>
        {ZONE_ORDER.map((zone) => {
          const status = statusByZone.get(zone) ?? 'queued';
          const active = zone === runningZone;
          return (
            <div
              key={zone}
              className="flex items-center gap-2.5 rounded-[6px] px-2 py-1.5"
              style={{
                background: active ? C.accentDim : 'transparent',
                border: `1px solid ${active ? C.borderStrong : 'transparent'}`,
              }}
            >
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: STATUS_DOT[status] }}
                aria-hidden
              />
              <span
                className="truncate text-[13px]"
                style={{
                  color: active ? C.text1 : C.text2,
                  fontWeight: active ? 500 : 400,
                }}
              >
                {sectionTitle(zone)}
              </span>
            </div>
          );
        })}
      </nav>

      {/* ---- main pane (the streaming) ---- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="flex shrink-0 items-center gap-2 px-5 py-3"
          style={{ borderBottom: `1px solid ${C.border}` }}
        >
          <span
            className="size-1.5 rounded-full"
            style={{ background: completeCount === 6 ? C.green : C.accent }}
            aria-hidden
          />
          <span className="text-[13px]" style={{ color: C.text2 }}>
            Streaming
          </span>
          <span style={{ color: C.text4 }}>·</span>
          <span className="tabular-nums text-[13px]" style={{ color: C.text1 }}>
            {completeCount}/6
          </span>
          <span style={{ color: C.text4 }}>·</span>
          <span
            className="tabular-nums text-[13px]"
            style={{ fontFamily: MONO, color: C.text2 }}
          >
            {fmtClock(elapsedMs)}
          </span>
        </header>

        <div ref={scrollerRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {narration.length === 0 ? (
            <p className="text-[13px]" style={{ color: C.text3 }}>
              Waiting for the run to start…
            </p>
          ) : (
            <ol className="m-0 flex list-none flex-col gap-2 p-0">
              {narration.map((item) => {
                const label = PHASE_META[item.phase].label;
                const warn = item.tone === 'warning';
                return (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[13px] leading-[1.5]"
                  >
                    <span style={{ color: C.text1 }}>{label}</span>
                    {item.detail ? (
                      <span style={{ color: warn ? C.amber : C.text2 }}>
                        {item.detail}
                      </span>
                    ) : null}
                    {item.chip ? (
                      <span
                        className="max-w-[320px] truncate rounded-[5px] px-2 py-0.5 text-[11.5px]"
                        style={{
                          background: C.bg2,
                          border: `1px solid ${C.border}`,
                          color: C.text2,
                        }}
                        title={item.chip}
                      >
                        {item.chip}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
};
