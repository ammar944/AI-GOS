#!/usr/bin/env node
/**
 * Baseline walltime measurement (Phase 0.5).
 *
 * Computes p50/p90/max per-runner walltime and end-to-end pipeline time from
 * the research_telemetry table. Zero API spend — this is a query over data
 * already produced by RESEARCH_TELEMETRY_PERSIST=true runs.
 *
 * Prerequisite: research_telemetry table exists (migration 20260417) AND
 * RESEARCH_TELEMETRY_PERSIST=true has been on in prod long enough to
 * accumulate runs (aim for ≥ 10 runs per section).
 *
 * Usage:
 *   npm run eval:baseline                      # last 7 days, writes baseline json
 *   npm run eval:baseline -- --days 30         # wider window
 *   npm run eval:baseline -- --min-samples 5   # lower the sample gate
 */
import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getClient } from '../src/supabase';

interface CliArgs {
  days: number;
  minSamples: number;
  outPath?: string;
}

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = { days: 7, minSamples: 10 };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--days') out.days = Number(argv[++i]) || 7;
    else if (arg === '--min-samples') out.minSamples = Number(argv[++i]) || 10;
    else if (arg === '--out') out.outPath = argv[++i];
  }
  return out;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx] ?? 0;
}

interface PerSectionStat {
  section: string;
  samples: number;
  p50Ms: number;
  p90Ms: number;
  maxMs: number;
  meanMs: number;
}

interface EndToEndStat {
  samples: number;
  p50Ms: number;
  p90Ms: number;
  maxMs: number;
}

interface BaselineReport {
  generatedAt: string;
  windowDays: number;
  minSamplesGate: number;
  perSection: PerSectionStat[];
  endToEnd: EndToEndStat;
  notes: string[];
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const client = getClient();
  const since = new Date(Date.now() - args.days * 24 * 3600_000).toISOString();

  // Per-runner durations: one row per runner.end event.
  const { data: runnerRows, error: runnerErr } = await client
    .from('research_telemetry')
    .select('run_id, section, duration_ms, event_timestamp')
    .eq('event', 'runner.end')
    .gte('event_timestamp', since)
    .not('duration_ms', 'is', null)
    .not('section', 'is', null);

  if (runnerErr) {
    // eslint-disable-next-line no-console
    console.error('[eval:baseline] runner query failed:', runnerErr.message);
    process.exit(1);
  }

  const bySection = new Map<string, number[]>();
  for (const row of runnerRows ?? []) {
    const s = row.section as string;
    const d = row.duration_ms as number;
    if (!bySection.has(s)) bySection.set(s, []);
    bySection.get(s)!.push(d);
  }

  const notes: string[] = [];
  const perSection: PerSectionStat[] = [];
  for (const [section, durations] of bySection) {
    if (durations.length < args.minSamples) {
      notes.push(
        `section ${section} has only ${durations.length} samples (<${args.minSamples}); recorded but treat as unreliable`,
      );
    }
    perSection.push({
      section,
      samples: durations.length,
      p50Ms: percentile(durations, 0.5),
      p90Ms: percentile(durations, 0.9),
      maxMs: Math.max(...durations),
      meanMs: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
    });
  }
  perSection.sort((a, b) => b.p50Ms - a.p50Ms);

  // End-to-end: per run_id, max(event_timestamp of runner.end) − min(event_timestamp of runner.start).
  const { data: seRows, error: seErr } = await client
    .from('research_telemetry')
    .select('run_id, event, event_timestamp')
    .in('event', ['runner.start', 'runner.end'])
    .gte('event_timestamp', since);

  if (seErr) {
    // eslint-disable-next-line no-console
    console.error('[eval:baseline] start/end query failed:', seErr.message);
    process.exit(1);
  }

  const byRun = new Map<string, { start: number | null; end: number | null }>();
  for (const row of seRows ?? []) {
    const runId = row.run_id as string;
    const ts = new Date(row.event_timestamp as string).getTime();
    const entry = byRun.get(runId) ?? { start: null, end: null };
    if (row.event === 'runner.start') {
      entry.start = entry.start === null ? ts : Math.min(entry.start, ts);
    } else {
      entry.end = entry.end === null ? ts : Math.max(entry.end, ts);
    }
    byRun.set(runId, entry);
  }

  const endToEndDurations: number[] = [];
  for (const v of byRun.values()) {
    if (v.start !== null && v.end !== null && v.end > v.start) {
      endToEndDurations.push(v.end - v.start);
    }
  }

  const endToEnd: EndToEndStat = {
    samples: endToEndDurations.length,
    p50Ms: percentile(endToEndDurations, 0.5),
    p90Ms: percentile(endToEndDurations, 0.9),
    maxMs: endToEndDurations.length > 0 ? Math.max(...endToEndDurations) : 0,
  };

  if (endToEndDurations.length < args.minSamples) {
    notes.push(
      `end-to-end has only ${endToEndDurations.length} complete pipelines in window; widen --days or wait`,
    );
  }

  const report: BaselineReport = {
    generatedAt: new Date().toISOString(),
    windowDays: args.days,
    minSamplesGate: args.minSamples,
    perSection,
    endToEnd,
    notes,
  };

  const outDir = join(__dirname, 'baselines');
  await mkdir(outDir, { recursive: true });
  const dateStr = new Date().toISOString().slice(0, 10);
  const outPath = args.outPath ?? join(outDir, `pipeline-${dateStr}.json`);
  await writeFile(outPath, JSON.stringify(report, null, 2) + '\n', 'utf8');

  // eslint-disable-next-line no-console
  console.log(`\n=== pipeline baseline (${args.days}d window) ===`);
  for (const s of perSection) {
    // eslint-disable-next-line no-console
    console.log(
      `  ${s.section.padEnd(20)} n=${String(s.samples).padStart(4)} p50=${(s.p50Ms / 1000).toFixed(1)}s  p90=${(s.p90Ms / 1000).toFixed(1)}s  max=${(s.maxMs / 1000).toFixed(1)}s`,
    );
  }
  // eslint-disable-next-line no-console
  console.log(
    `  ${'END-TO-END'.padEnd(20)} n=${String(endToEnd.samples).padStart(4)} p50=${(endToEnd.p50Ms / 1000).toFixed(1)}s  p90=${(endToEnd.p90Ms / 1000).toFixed(1)}s  max=${(endToEnd.maxMs / 1000).toFixed(1)}s`,
  );
  for (const n of notes) {
    // eslint-disable-next-line no-console
    console.log(`  note: ${n}`);
  }
  // eslint-disable-next-line no-console
  console.log(`\nwrote ${outPath}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[eval:baseline] fatal:', err);
  process.exit(1);
});
