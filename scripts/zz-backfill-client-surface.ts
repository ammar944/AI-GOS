#!/usr/bin/env tsx
/**
 * One-shot backfill: re-applies the PRODUCTION client-surface sanitizers to an
 * already-persisted run so the deterministic buyer-eval gate (DENY-LIST + MEMO)
 * passes without a full re-run. New runs are fixed at the commit boundary
 * (buildCommitPatch + writeThesis); this only repairs runs persisted before
 * those fixes landed.
 *
 * Reuses the exact production code — no logic is duplicated here:
 *   - sanitizeArtifactForClientSurface  (src/lib/research-v2/client-surface-sanitizer)
 *   - sanitizeExecutiveThesis / buildIncompleteExecutiveThesis (executive-thesis-sanitizer)
 *
 * Usage:
 *   npx tsx scripts/zz-backfill-client-surface.ts <run_id>            # dry-run (default)
 *   npx tsx scripts/zz-backfill-client-surface.ts <run_id> --apply    # writes UPDATEs
 *
 * Writes are non-destructive (scrub text / compose a clean memo) and touch only
 * research_artifact_sections.data and research_artifacts.thesis. counts_toward_rollup,
 * verification_tier, and verification_flag are never modified.
 */
import { loadEnvConfig } from '@next/env';

import {
  ALL_POSITIONING_SECTION_LABELS,
  isAllPositioningSectionId,
} from '../src/lib/ai/prompts/positioning-skills';
import {
  findInternalVocabularyToken,
  sanitizeArtifactForClientSurface,
} from '../src/lib/research-v2/client-surface-sanitizer';
import {
  buildIncompleteExecutiveThesis,
  findMemoBlockingToken,
  sanitizeExecutiveThesis,
  type IncompleteThesisSection,
} from '../src/lib/research-v2/executive-thesis-sanitizer';
import { createAdminClient } from '../src/lib/supabase/server';

loadEnvConfig(process.cwd());

const CLIENT_ZONES = new Set([
  'positioningMarketCategory',
  'positioningBuyerICP',
  'positioningCompetitorLandscape',
  'positioningVoiceOfCustomer',
  'positioningDemandIntent',
  'positioningOfferDiagnostic',
  'positioningPaidMediaPlan',
]);
const SKIP_KEYS = new Set(['verifierSummary', 'decodeRepairs', 'verification', 'review']);

function isSkipKey(key: string): boolean {
  return SKIP_KEYS.has(key) || key.startsWith('blockGap');
}

function denyHits(value: unknown): number {
  let count = 0;
  const walk = (node: unknown): void => {
    if (typeof node === 'string') {
      if (findInternalVocabularyToken(node) !== null) count += 1;
      return;
    }
    if (Array.isArray(node)) return node.forEach(walk);
    if (node !== null && typeof node === 'object') {
      for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
        if (isSkipKey(key)) continue;
        walk(child);
      }
    }
  };
  walk(value);
  return count;
}

function memoHits(value: unknown): number {
  let count = 0;
  const walk = (node: unknown): void => {
    if (typeof node === 'string') {
      if (findMemoBlockingToken(node) !== null) count += 1;
      return;
    }
    if (Array.isArray(node)) return node.forEach(walk);
    if (node !== null && typeof node === 'object') {
      for (const child of Object.values(node as Record<string, unknown>)) walk(child);
    }
  };
  walk(value);
  return count;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

interface SectionRow {
  zone: string | null;
  status: string | null;
  data: unknown;
  verification_tier: string | null;
}

async function main(): Promise<void> {
  const runId = process.argv[2];
  const apply = process.argv.includes('--apply');
  if (!runId) {
    console.error('Usage: npx tsx scripts/zz-backfill-client-surface.ts <run_id> [--apply]');
    process.exit(1);
  }

  const supabase = createAdminClient();
  const { data: artifacts, error: artErr } = await supabase
    .from('research_artifacts')
    .select('id, run_id, status, thesis')
    .eq('run_id', runId);
  if (artErr) throw new Error(`research_artifacts read failed: ${artErr.message}`);
  const artifact = artifacts?.[0];
  if (!artifact) throw new Error(`No research_artifacts row for run ${runId}`);

  const { data: sections, error: secErr } = await supabase
    .from('research_artifact_sections')
    .select('zone, status, data, verification_tier')
    .eq('artifact_id', artifact.id)
    .order('zone');
  if (secErr) throw new Error(`research_artifact_sections read failed: ${secErr.message}`);

  console.log(`\n=== backfill ${apply ? 'APPLY' : 'DRY-RUN'} — run ${runId} (artifact ${artifact.id}) ===\n`);

  // --- sections ---
  const rows = (sections ?? []) as SectionRow[];
  const incompleteSections: IncompleteThesisSection[] = [];
  for (const row of rows) {
    if (typeof row.zone !== 'string') continue;
    if (CLIENT_ZONES.has(row.zone)) {
      incompleteSections.push({
        sectionId: row.zone,
        label: isAllPositioningSectionId(row.zone)
          ? ALL_POSITIONING_SECTION_LABELS[row.zone]
          : row.zone,
        verificationTier:
          row.verification_tier === 'verified' ||
          row.verification_tier === 'needs_review' ||
          row.verification_tier === 'insufficient'
            ? row.verification_tier
            : null,
      });
    }

    const before = denyHits(row.data);
    if (before === 0) {
      console.log(`  ${row.zone.padEnd(34)} clean (0 hits)`);
      continue;
    }
    const cleaned = sanitizeArtifactForClientSurface(row.data);
    const after = denyHits(cleaned);
    console.log(`  ${row.zone.padEnd(34)} ${before} -> ${after} deny hits`);
    if (apply) {
      const { error } = await supabase
        .from('research_artifact_sections')
        .update({ data: cleaned })
        .eq('artifact_id', artifact.id)
        .eq('zone', row.zone);
      if (error) throw new Error(`section update failed for ${row.zone}: ${error.message}`);
    }
  }

  // --- thesis ---
  const thesis = artifact.thesis;
  const thesisStatus = isRecord(thesis) ? thesis.status : 'null';
  const thesisIsComplete = isRecord(thesis) && thesis.status === 'complete';
  console.log(
    `\n  thesis status=${String(thesisStatus)}; memoHits=${memoHits(thesis)}; denyHits=${denyHits(thesis)}`,
  );

  let nextThesis: Record<string, unknown>;
  if (thesisIsComplete) {
    // Already a real memo — just scrub it.
    nextThesis = sanitizeExecutiveThesis(thesis);
  } else {
    // Compose-always fallback (the path the fixed production catch now takes).
    const companyName =
      (isRecord(thesis) && typeof thesis.companyName === 'string' && thesis.companyName) ||
      'this company';
    nextThesis = buildIncompleteExecutiveThesis({
      companyName,
      generatedAt: new Date().toISOString(),
      sections: incompleteSections,
    });
  }
  console.log(
    `  -> thesis status=${String(nextThesis.status)}; memoHits=${memoHits(nextThesis)}; denyHits=${denyHits(nextThesis)}`,
  );
  if (apply) {
    const { error } = await supabase
      .from('research_artifacts')
      .update({ thesis: nextThesis })
      .eq('id', artifact.id);
    if (error) throw new Error(`thesis update failed: ${error.message}`);
  }

  console.log(`\n=== ${apply ? 'APPLIED' : 'DRY-RUN complete (re-run with --apply to write)'} ===\n`);
}

main().catch((error) => {
  console.error(`FATAL: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
