#!/usr/bin/env node
/**
 * Capture a research session's output as a golden snapshot (Phase 0.1).
 *
 * Usage:
 *   npm run eval:snapshot -- --slug fellow-ai --run-id <run_id> --user-id <user_id>
 *
 * Reads the journey_sessions row from Supabase, splits research_results into
 * per-section and per-card JSON files under evals/golden/<slug>/. Idempotent:
 * re-running overwrites existing snapshots.
 */
import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getClient } from '../src/supabase';

interface CliArgs {
  slug: string;
  runId: string;
  userId: string;
}

function parseArgs(argv: string[]): CliArgs {
  const out: Partial<CliArgs> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--slug') out.slug = argv[++i];
    else if (arg === '--run-id') out.runId = argv[++i];
    else if (arg === '--user-id') out.userId = argv[++i];
  }
  if (!out.slug || !out.runId || !out.userId) {
    // eslint-disable-next-line no-console
    console.error('Usage: eval:snapshot -- --slug <slug> --run-id <run_id> --user-id <user_id>');
    process.exit(2);
  }
  return out as CliArgs;
}

const INTEL_SUFFIX = 'Intel';

async function main(): Promise<void> {
  const { slug, runId, userId } = parseArgs(process.argv.slice(2));
  const outDir = join(__dirname, 'golden', slug);
  const sectionsDir = join(outDir, 'sections');
  const cardsDir = join(outDir, 'cards');

  const client = getClient();
  const { data, error } = await client
    .from('journey_sessions')
    .select('research_results, run_id, user_id, updated_at')
    .eq('user_id', userId)
    .single();

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[eval:snapshot] failed to read journey_sessions:', error.message);
    process.exit(1);
  }
  if (!data?.research_results) {
    // eslint-disable-next-line no-console
    console.error('[eval:snapshot] no research_results found for user', userId);
    process.exit(1);
  }

  const results = data.research_results as Record<string, unknown>;
  await mkdir(sectionsDir, { recursive: true });
  await mkdir(cardsDir, { recursive: true });

  let sectionCount = 0;
  let cardCount = 0;

  for (const [key, value] of Object.entries(results)) {
    const outPath = key.endsWith(INTEL_SUFFIX)
      ? join(cardsDir, `${key}.json`)
      : join(sectionsDir, `${key}.json`);
    await writeFile(outPath, JSON.stringify(value, null, 2) + '\n', 'utf8');
    if (key.endsWith(INTEL_SUFFIX)) cardCount += 1;
    else sectionCount += 1;
  }

  const metadata = {
    slug,
    runId,
    userId,
    capturedAt: new Date().toISOString(),
    supabaseUpdatedAt: data.updated_at,
    sectionCount,
    cardCount,
    pipelineCommit: process.env.GIT_COMMIT ?? null,
  };
  await writeFile(
    join(outDir, 'metadata.json'),
    JSON.stringify(metadata, null, 2) + '\n',
    'utf8',
  );

  // eslint-disable-next-line no-console
  console.log(
    `[eval:snapshot] captured ${sectionCount} sections + ${cardCount} cards to ${outDir}`,
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[eval:snapshot] fatal:', err);
  process.exit(1);
});
