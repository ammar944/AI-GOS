// PROTOTYPE — throwaway. Deterministic replay of the real run db41a945.
// Reconstructs the EXACT AuditStateResponse shape (the contract useAuditState
// returns) at a virtual clock tick, so variants render against real data and
// the winner folds back into /research-v3 with no shape changes. No live API.
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  AuditStateResponse,
  SectionEvent,
  WorkerStatus,
} from '@/app/api/research-v2/audit-state/route';
import { deriveSectionPhase } from '@/app/api/research-v2/audit-state/derive-section-phase';

import fixtureJson from './fixture.json';
import type { Fixture, FixtureEvent } from './fixture-types';
import { buildNarration, type NarrationItem } from './phase-narration';

const fixture = fixtureJson as unknown as Fixture;
const PAID_MEDIA = 'positioningPaidMediaPlan';

const RUN_START = Date.parse(fixture.meta.createdAt);
const SORTED: FixtureEvent[] = [...fixture.events].sort(
  (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
);
const OFFSETS = SORTED.map((e) => Date.parse(e.createdAt) - RUN_START);
export const TOTAL_MS = Math.max(
  OFFSETS[OFFSETS.length - 1] ?? 0,
  Date.parse(fixture.meta.updatedAt) - RUN_START,
);
export const ZONES = fixture.sections.map((s) => s.zone);
const SECTION_BY_ZONE = new Map(fixture.sections.map((s) => [s.zone, s]));

// First event offset (start) + last section-completed offset (commit) per zone.
const ZONE_START = new Map<string, number>();
const ZONE_COMMIT = new Map<string, number>();
SORTED.forEach((e, i) => {
  if (!ZONE_START.has(e.zone)) ZONE_START.set(e.zone, OFFSETS[i]);
  if (e.eventType === 'section-completed') ZONE_COMMIT.set(e.zone, OFFSETS[i]);
});

function toRouteEvent(e: FixtureEvent): SectionEvent {
  return {
    id: e.id,
    event_type: e.eventType,
    message: e.message,
    payload: (e.payload ?? null) as Record<string, unknown> | null,
    created_at: e.createdAt,
  };
}

type WorkerState = AuditStateResponse['workerStates'][number];

export interface ReplaySnapshot {
  state: AuditStateResponse;
  narration: NarrationItem[];
  visibleEvents: FixtureEvent[];
}

export function buildStateAt(nowMs: number): ReplaySnapshot {
  const now = Math.max(0, Math.min(nowMs, TOTAL_MS));
  const visibleEvents: FixtureEvent[] = [];
  const byZone = new Map<string, FixtureEvent[]>();
  for (let i = 0; i < SORTED.length; i += 1) {
    if (OFFSETS[i] > now) break; // sorted ascending — safe early exit
    const e = SORTED[i];
    visibleEvents.push(e);
    const list = byZone.get(e.zone) ?? [];
    list.push(e);
    byZone.set(e.zone, list);
  }

  const workerStates: WorkerState[] = [];
  const sectionsByZone: AuditStateResponse['sectionsByZone'] = {};
  const eventsByZone: Record<string, SectionEvent[]> = {};
  let positioningComplete = 0;

  for (const zone of ZONES) {
    const zEvents = byZone.get(zone) ?? [];
    const started = zEvents.length > 0;
    const committed = zEvents.some((e) => e.eventType === 'section-completed');
    const status: WorkerStatus = committed ? 'complete' : started ? 'running' : 'queued';
    const latest = zEvents[zEvents.length - 1];
    const phase = deriveSectionPhase({ status, latestEventType: latest?.eventType ?? null });

    const lastTool = [...zEvents].reverse().find(
      (e) => e.eventType === 'tool-started' || e.eventType === 'tool-finished',
    );
    const lastSearch = [...zEvents].reverse().find((e) => e.eventType === 'tool-finished');

    const startOff = ZONE_START.get(zone);
    const commitOff = ZONE_COMMIT.get(zone);
    const elapsedMs = started
      ? committed && commitOff != null
        ? commitOff - (startOff ?? 0)
        : now - (startOff ?? 0)
      : null;

    workerStates.push({
      section_id: zone as WorkerState['section_id'],
      status,
      phase,
      phaseLabel: phase,
      phaseStartedAt: null,
      latestTool: (lastTool?.payload?.metadata?.toolName as string | undefined) ?? null,
      latestSource: (lastSearch?.payload?.metadata?.query as string | undefined) ?? null,
      latestActivity: latest?.message ?? null,
      nextStep: null,
      concurrency: null,
      elapsedMs: elapsedMs != null ? Math.max(0, elapsedMs) : null,
      capabilityGaps: [],
      executionMode: 'lab',
      runtimeTimings: {},
    });

    if (committed) {
      const section = SECTION_BY_ZONE.get(zone);
      sectionsByZone[zone] = {
        title: section?.data?.sectionTitle ?? section?.title ?? undefined,
        data: section?.data ?? undefined,
      };
      if (zone !== PAID_MEDIA) positioningComplete += 1;
    }

    if (zEvents.length > 0) {
      eventsByZone[zone] = zEvents.slice(-12).map(toRouteEvent);
    }
  }

  const parent_status = now >= TOTAL_MS ? 'complete' : now <= 0 ? null : 'running';

  return {
    state: {
      parent_audit_run_id: fixture.runId,
      parent_status,
      children_complete: Math.min(positioningComplete, 6),
      children_total: 6,
      workerStates,
      sectionsByZone,
      eventsByZone,
    },
    narration: buildNarration(visibleEvents),
    visibleEvents,
  };
}

const SPEEDS = [1, 4, 16, 60] as const;
export type ReplaySpeed = (typeof SPEEDS)[number];

export interface ReplayControls {
  play: () => void;
  pause: () => void;
  restart: () => void;
  seek: (ms: number) => void;
  jumpToEnd: () => void;
  setSpeed: (s: ReplaySpeed) => void;
  speeds: readonly ReplaySpeed[];
}

export interface UseReplay extends ReplaySnapshot {
  elapsedMs: number;
  totalMs: number;
  playing: boolean;
  speed: ReplaySpeed;
  controls: ReplayControls;
}

const TICK_MS = 100;

export function useReplayAuditState(opts?: {
  autoPlay?: boolean;
  initialSpeed?: ReplaySpeed;
}): UseReplay {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [playing, setPlaying] = useState(opts?.autoPlay ?? true);
  const [speed, setSpeed] = useState<ReplaySpeed>(opts?.initialSpeed ?? 16);
  const raf = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!playing) return;
    raf.current = setInterval(() => {
      setElapsedMs((prev) => {
        const next = prev + TICK_MS * speed;
        if (next >= TOTAL_MS) {
          setPlaying(false);
          return TOTAL_MS;
        }
        return next;
      });
    }, TICK_MS);
    return () => {
      if (raf.current) clearInterval(raf.current);
    };
  }, [playing, speed]);

  const controls = useMemo<ReplayControls>(
    () => ({
      play: () => setPlaying(true),
      pause: () => setPlaying(false),
      restart: () => {
        setElapsedMs(0);
        setPlaying(true);
      },
      seek: (ms: number) => setElapsedMs(Math.max(0, Math.min(ms, TOTAL_MS))),
      jumpToEnd: () => {
        setElapsedMs(TOTAL_MS);
        setPlaying(false);
      },
      setSpeed: (s: ReplaySpeed) => setSpeed(s),
      speeds: SPEEDS,
    }),
    [],
  );

  const snapshot = useMemo(() => buildStateAt(elapsedMs), [elapsedMs]);

  return { ...snapshot, elapsedMs, totalMs: TOTAL_MS, playing, speed, controls };
}
