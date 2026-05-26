#!/usr/bin/env tsx
import { loadEnvConfig } from '@next/env';

import { createAdminClient } from '../src/lib/supabase/server';
import {
  evaluateSoakHealth,
  type SoakArtifactSnapshot,
  type SoakEventSnapshot,
  type SoakHealthResult,
  type SoakSectionRunSnapshot,
} from '../src/lib/research-v3/soak-monitor';

loadEnvConfig(process.cwd());

interface MonitorOptions {
  runId: string;
  intervalMs: number;
  watch: boolean;
  simulateError: boolean;
}

interface ArtifactRow {
  id: string;
  status: string | null;
  children_complete: number | null;
  children_total: number | null;
}

interface SectionRunRow {
  zone: string | null;
  status: string | null;
  updated_at: string | null;
  started_at: string | null;
}

interface EventRow {
  zone: string | null;
  event_type: string | null;
  message: string | null;
  created_at: string | null;
}

interface Snapshot {
  artifact: SoakArtifactSnapshot | null;
  sectionRuns: SoakSectionRunSnapshot[];
  events: SoakEventSnapshot[];
}

function readStringFlag(
  args: string[],
  name: string,
  fallback: string | null,
): string {
  const index = args.indexOf(name);
  if (index === -1) {
    if (fallback !== null) return fallback;
    throw new Error(`${name} is required`);
  }

  const value = args[index + 1];
  if (!value) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

function readNumberFlag(args: string[], name: string, fallback: number): number {
  const raw = readStringFlag(args, name, String(fallback));
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive finite number; received ${raw}`);
  }
  return value;
}

function parseOptions(args: string[]): MonitorOptions {
  return {
    runId: readStringFlag(args, '--run-id', null),
    intervalMs: readNumberFlag(args, '--interval-ms', 30_000),
    watch: args.includes('--watch'),
    simulateError: args.includes('--simulate-error'),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function normalizeArtifact(row: ArtifactRow | null): SoakArtifactSnapshot | null {
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    childrenComplete: row.children_complete ?? 0,
    childrenTotal: row.children_total ?? 6,
  };
}

function normalizeSectionRun(row: SectionRunRow): SoakSectionRunSnapshot | null {
  if (!row.zone) return null;
  return {
    zone: row.zone,
    status: row.status,
    updatedAt: row.updated_at ?? row.started_at,
  };
}

function normalizeEvent(row: EventRow): SoakEventSnapshot | null {
  if (!row.zone || !row.event_type || !row.created_at) return null;
  return {
    zone: row.zone,
    eventType: row.event_type,
    message: row.message,
    createdAt: row.created_at,
  };
}

async function readSnapshot(runId: string): Promise<Snapshot> {
  const supabase = createAdminClient();
  const { data: artifactData, error: artifactError } = await supabase
    .from('research_artifacts')
    .select('id, status, children_complete, children_total')
    .eq('run_id', runId)
    .maybeSingle();

  if (artifactError) {
    throw new Error(
      `research_artifacts read failed for runId=${runId}: ${artifactError.message}`,
    );
  }

  const artifact = normalizeArtifact((artifactData as ArtifactRow | null) ?? null);
  if (!artifact) {
    return {
      artifact: null,
      sectionRuns: [],
      events: [],
    };
  }

  const [runsResponse, eventsResponse] = await Promise.all([
    supabase
      .from('research_section_runs')
      .select('zone, status, updated_at, started_at')
      .eq('artifact_id', artifact.id),
    supabase
      .from('research_section_events')
      .select('zone, event_type, message, created_at')
      .eq('artifact_id', artifact.id)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  if (runsResponse.error) {
    throw new Error(
      `research_section_runs read failed for runId=${runId} artifact=${artifact.id}: ${runsResponse.error.message}`,
    );
  }
  if (eventsResponse.error) {
    throw new Error(
      `research_section_events read failed for runId=${runId} artifact=${artifact.id}: ${eventsResponse.error.message}`,
    );
  }

  return {
    artifact,
    sectionRuns: ((runsResponse.data as SectionRunRow[] | null) ?? [])
      .map(normalizeSectionRun)
      .filter((row): row is SoakSectionRunSnapshot => row !== null),
    events: ((eventsResponse.data as EventRow[] | null) ?? [])
      .map(normalizeEvent)
      .filter((row): row is SoakEventSnapshot => row !== null),
  };
}

function addSimulatedError(snapshot: Snapshot): Snapshot {
  return {
    ...snapshot,
    events: [
      ...snapshot.events,
      {
        zone: 'simulated',
        eventType: 'error',
        message: 'simulated monitor failure',
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

async function evaluateOnce(
  options: MonitorOptions,
  previousChildrenComplete: number | null,
): Promise<SoakHealthResult> {
  const snapshot = options.simulateError
    ? addSimulatedError(await readSnapshot(options.runId))
    : await readSnapshot(options.runId);

  return evaluateSoakHealth({
    now: new Date().toISOString(),
    previousChildrenComplete,
    artifact: snapshot.artifact,
    sectionRuns: snapshot.sectionRuns,
    events: snapshot.events,
  });
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  let previousChildrenComplete: number | null = null;

  while (true) {
    const result = await evaluateOnce(options, previousChildrenComplete);
    console.log(JSON.stringify({ runId: options.runId, ...result }));

    if (result.status === 'failed') {
      process.exitCode = 1;
      return;
    }
    if (!options.watch || result.status === 'complete') {
      return;
    }

    previousChildrenComplete = result.childrenComplete;
    await sleep(options.intervalMs);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
