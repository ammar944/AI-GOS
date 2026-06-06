#!/usr/bin/env tsx
import { pathToFileURL } from 'node:url';
import { loadEnvConfig } from '@next/env';

import { createAdminClient } from '../src/lib/supabase/server';
import {
  RESEARCH_QUALITY_GATE_VERSION,
  evaluateRunQualityGate,
  renderReport,
  type ResearchQualityGateReportResult,
} from './research-quality-gate-report';

loadEnvConfig(process.cwd());

const DEFAULT_BACKFILL_LIMIT = 25;
const MAX_BACKFILL_LIMIT = 100;

export interface BackfillOptions {
  dryRun: boolean;
  runId: string | null;
  limit: number;
}

interface BackfillArtifactDbRow {
  run_id: string | null;
}

export interface BackfillRunResult {
  runId: string;
  artifactId: string;
  gateVersion: string;
  verdict: string;
  gates: {
    pipeline: string;
    researchQuality: string;
    actionability: string;
    projectionSync: string;
    projectionTrust: string;
    strategyQuality: string;
  };
  dryRun: boolean;
  upserted: boolean;
}

interface BackfillFailure {
  runId: string;
  error: string;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function readOptionalStringFlag(args: readonly string[], name: string): string | null {
  const index = args.indexOf(name);
  if (index === -1) return null;

  const value = args[index + 1];
  if (!value) {
    throw new Error(`${name} requires a value`);
  }

  return value;
}

function readPositiveIntegerFlag(
  args: readonly string[],
  name: string,
  fallback: number,
): number {
  const raw = readOptionalStringFlag(args, name);
  if (raw === null) return fallback;

  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  if (value > MAX_BACKFILL_LIMIT) {
    throw new Error(`${name} must be <= ${MAX_BACKFILL_LIMIT}`);
  }

  return value;
}

export function parseBackfillOptions(args: readonly string[]): BackfillOptions {
  const knownValueFlags = new Set(['--run-id', '--limit']);
  const knownBooleanFlags = new Set(['--dry-run']);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith('--')) continue;

    if (knownBooleanFlags.has(arg)) continue;
    if (knownValueFlags.has(arg)) {
      index += 1;
      continue;
    }

    throw new Error(`Unknown option ${arg}`);
  }

  return {
    dryRun: args.includes('--dry-run'),
    runId: readOptionalStringFlag(args, '--run-id'),
    limit: readPositiveIntegerFlag(args, '--limit', DEFAULT_BACKFILL_LIMIT),
  };
}

async function readBatchRunIds(limit: number): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('research_artifacts')
    .select('run_id')
    .not('run_id', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(
      `research_artifacts batch read failed for limit=${limit}: ${error.message}`,
    );
  }

  const rows = (data as BackfillArtifactDbRow[] | null) ?? [];
  return rows
    .map((row) => readString(row.run_id))
    .filter((runId): runId is string => runId !== null);
}

function summarizeReport(
  report: ResearchQualityGateReportResult,
  dryRun: boolean,
  upserted: boolean,
): BackfillRunResult {
  if (!report.artifactId) {
    throw new Error(`artifactId is missing for runId=${report.runId}`);
  }

  return {
    runId: report.runId,
    artifactId: report.artifactId,
    gateVersion: report.gateVersion,
    verdict: report.verdict,
    gates: {
      pipeline: report.gates.pipeline.status,
      researchQuality: report.gates.researchQuality.status,
      actionability: report.gates.actionability.status,
      projectionSync: report.gates.projectionSync.status,
      projectionTrust: report.gates.projectionTrust.status,
      strategyQuality: report.gates.strategyQuality.status,
    },
    dryRun,
    upserted,
  };
}

async function upsertGateResult(
  report: ResearchQualityGateReportResult,
): Promise<void> {
  if (!report.artifactId) {
    throw new Error(`artifactId is missing for runId=${report.runId}`);
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('research_quality_gate_results')
    .upsert(
      {
        run_id: report.runId,
        artifact_id: report.artifactId,
        gate_version: report.gateVersion,
        result: report,
        report_markdown: renderReport(report),
        computed_at: new Date().toISOString(),
      },
      { onConflict: 'run_id,gate_version' },
    );

  if (error) {
    throw new Error(
      `research_quality_gate_results upsert failed for runId=${report.runId} gateVersion=${report.gateVersion}: ${error.message}`,
    );
  }
}

export async function backfillResearchQualityGate(input: {
  runId: string;
  dryRun: boolean;
}): Promise<BackfillRunResult> {
  const report = await evaluateRunQualityGate(input.runId);

  if (input.dryRun) {
    return summarizeReport(report, true, false);
  }

  await upsertGateResult(report);
  return summarizeReport(report, false, true);
}

async function main(): Promise<void> {
  const options = parseBackfillOptions(process.argv.slice(2));
  const runIds = options.runId
    ? [options.runId]
    : await readBatchRunIds(options.limit);
  const results: BackfillRunResult[] = [];
  const failures: BackfillFailure[] = [];

  for (const runId of runIds) {
    try {
      results.push(
        await backfillResearchQualityGate({
          runId,
          dryRun: options.dryRun,
        }),
      );
    } catch (error) {
      failures.push({
        runId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        gateVersion: RESEARCH_QUALITY_GATE_VERSION,
        dryRun: options.dryRun,
        requestedRunId: options.runId,
        limit: options.limit,
        processed: results.length,
        failed: failures.length,
        results,
        failures,
      },
      null,
      2,
    ),
  );

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

function isDirectExecution(metaUrl: string, argv: readonly string[]): boolean {
  const scriptPath = argv[1];
  return scriptPath ? metaUrl === pathToFileURL(scriptPath).href : false;
}

if (isDirectExecution(import.meta.url, process.argv)) {
  main().catch((error: unknown): void => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
