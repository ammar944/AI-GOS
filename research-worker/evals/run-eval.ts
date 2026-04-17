#!/usr/bin/env node
/**
 * Run the golden-set eval against live Supabase data (Phase 0.1).
 *
 * Usage:
 *   npm run eval:research               # run all URLs in golden/urls.json
 *   npm run eval:research -- --slug fellow-ai   # single URL
 *
 * For each URL:
 *   1. Read evals/golden/<slug>/ (snapshot)
 *   2. Read journey_sessions row for metadata.userId (current state)
 *   3. Diff sections + cards
 *   4. Print per-URL summary
 *
 * Exits non-zero on any URL failure so CI can gate on it.
 */
import 'dotenv/config';
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getClient } from '../src/supabase';
import { evaluateUrl, type EvalTargets, type UrlEvalResult } from './diff';

interface UrlSeed {
  slug: string;
  url: string;
  category: string;
  notes?: string;
}

interface UrlsFile {
  schemaVersion: number;
  urls: UrlSeed[];
  targets: EvalTargets;
}

interface SnapshotMetadata {
  slug: string;
  runId: string;
  userId: string;
  capturedAt: string;
}

async function readJson<T>(path: string): Promise<T> {
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw) as T;
}

async function readGoldenDir(
  dir: string,
): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  if (!existsSync(dir)) return out;
  const files = await readdir(dir);
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    const key = f.replace(/\.json$/, '');
    out[key] = await readJson<unknown>(join(dir, f));
  }
  return out;
}

function parseCli(argv: string[]): { slug?: string } {
  const out: { slug?: string } = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--slug') out.slug = argv[++i];
  }
  return out;
}

async function evaluateSingle(
  seed: UrlSeed,
  targets: EvalTargets,
  evalsRoot: string,
): Promise<UrlEvalResult> {
  const slug = seed.slug;
  const dir = join(evalsRoot, 'golden', slug);
  const metadataPath = join(dir, 'metadata.json');

  if (!existsSync(metadataPath)) {
    return {
      slug,
      sectionDiffs: [],
      cardDiffs: [],
      pass: false,
      failures: [`no snapshot found at ${dir} — capture with eval:snapshot first`],
    };
  }

  const metadata = await readJson<SnapshotMetadata>(metadataPath);
  const goldenSections = await readGoldenDir(join(dir, 'sections'));
  const goldenCards = await readGoldenDir(join(dir, 'cards'));

  const client = getClient();
  const { data, error } = await client
    .from('journey_sessions')
    .select('research_results')
    .eq('user_id', metadata.userId)
    .single();

  if (error || !data?.research_results) {
    return {
      slug,
      sectionDiffs: [],
      cardDiffs: [],
      pass: false,
      failures: [`failed to read live journey_sessions: ${error?.message ?? 'no data'}`],
    };
  }

  const live = data.research_results as Record<string, unknown>;
  const liveSections: Record<string, unknown> = {};
  const liveCards: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(live)) {
    if (k.endsWith('Intel')) liveCards[k] = v;
    else liveSections[k] = v;
  }

  // Only evaluate cards that exist in golden — new cards added since snapshot
  // aren't counted as failures (they're opt-in via refreshing the snapshot).
  const evaluableCards: Record<string, unknown> = {};
  for (const cardKey of Object.keys(goldenCards)) {
    if (liveCards[cardKey] !== undefined) {
      evaluableCards[cardKey] = liveCards[cardKey];
    } else {
      // Missing card — counted later in failures list.
      evaluableCards[cardKey] = {};
    }
  }

  return evaluateUrl({
    slug,
    goldenSections,
    liveSections,
    liveCards: evaluableCards,
    targets,
  });
}

function printResult(r: UrlEvalResult): void {
  const header = r.pass ? `PASS ${r.slug}` : `FAIL ${r.slug}`;
  // eslint-disable-next-line no-console
  console.log(`\n=== ${header} ===`);
  // eslint-disable-next-line no-console
  console.log(`  sections: ${r.sectionDiffs.length}, cards: ${r.cardDiffs.length}`);
  for (const s of r.sectionDiffs) {
    // eslint-disable-next-line no-console
    console.log(
      `   - ${s.section}: recall=${(s.recall * 100).toFixed(0)}% (${s.goldenFieldCount - s.missingFields.length}/${s.goldenFieldCount})`,
    );
  }
  for (const c of r.cardDiffs) {
    // eslint-disable-next-line no-console
    console.log(
      `   - ${c.card}: citations=${c.citationCount}, fabrications=${c.fabricationMatches.length}`,
    );
  }
  if (r.failures.length > 0) {
    // eslint-disable-next-line no-console
    console.log('  FAILURES:');
    for (const f of r.failures) {
      // eslint-disable-next-line no-console
      console.log(`    * ${f}`);
    }
  }
}

async function main(): Promise<void> {
  const cli = parseCli(process.argv.slice(2));
  const evalsRoot = __dirname;
  const urlsFile = await readJson<UrlsFile>(join(evalsRoot, 'golden', 'urls.json'));

  const seeds = cli.slug ? urlsFile.urls.filter((u) => u.slug === cli.slug) : urlsFile.urls;
  if (seeds.length === 0) {
    // eslint-disable-next-line no-console
    console.error(`[eval:research] no URLs matched${cli.slug ? ` slug=${cli.slug}` : ''}`);
    process.exit(2);
  }

  const results = await Promise.all(
    seeds.map((seed) => evaluateSingle(seed, urlsFile.targets, evalsRoot)),
  );

  let anyFail = false;
  for (const r of results) {
    printResult(r);
    if (!r.pass) anyFail = true;
  }

  const passCount = results.filter((r) => r.pass).length;
  // eslint-disable-next-line no-console
  console.log(`\n=== eval:research summary: ${passCount}/${results.length} passed ===`);
  if (anyFail) process.exit(1);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[eval:research] fatal:', err);
  process.exit(1);
});
