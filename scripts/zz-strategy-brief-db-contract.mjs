#!/usr/bin/env node
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

import { createClient } from '@supabase/supabase-js';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { build } from 'esbuild';

const RUN_ID = process.argv[2];

function fail(message) {
  throw new Error(message);
}

function assertCondition(condition, message) {
  if (!condition) fail(message);
}

function requiredEnv(name) {
  const value = process.env[name];
  if (typeof value !== 'string' || value.trim() === '') {
    fail(`${name} is required`);
  }
  return value;
}

function resolveSrcPath(specifier) {
  const base = join(process.cwd(), 'src', specifier.slice(2));
  for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), base]) {
    if (existsSync(candidate)) return candidate;
  }
  return base;
}

async function loadTsModule(entry) {
  const tmpRoot = join(process.cwd(), 'tmp');
  await mkdir(tmpRoot, { recursive: true });
  const outdir = await mkdtemp(join(tmpRoot, 'aigos-strategy-brief-'));
  const outfile = join(outdir, `${basename(entry, '.ts')}.mjs`);
  await build({
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
    packages: 'external',
    plugins: [
      {
        name: 'aigos-src-alias',
        setup(builder) {
          builder.onResolve({ filter: /^@\// }, (args) => ({
            path: resolveSrcPath(args.path),
          }));
        },
      },
    ],
  });
  return await import(pathToFileURL(outfile).href);
}

function makeBrief(revision, summary) {
  const timestamp = new Date().toISOString();
  return {
    sectionTitle: 'Offer & Angle Brief',
    verdict: `DB contract revision ${revision}: lead with accountable revenue meetings.`,
    statusSummary: 'Fixture brief committed without model spend.',
    confidence: 0.82,
    sources: [{ title: 'Fellow', url: 'https://fellow.app' }],
    body: {
      positioning: {
        oneLiner: 'Fellow turns revenue meetings into owned execution.',
        valueProp: 'Turn meeting chaos into accountable follow-through.',
        mechanism: 'Shared agendas, notes, and follow-up ownership.',
      },
      angles: [
        {
          name: 'The dropped handoff',
          vignette: 'I left the meeting without a clear owner.',
          coreEmotion: 'frustration',
          adFrame: 'Open on the missed follow-up.',
          rank: 1,
          sourceEvidence: ['positioningVoiceOfCustomer'],
        },
      ],
      lexicon: {
        approved: ['accountability', 'owned execution'],
        banned: [{ term: 'AI meeting copilot', reason: 'Too generic.' }],
      },
      funnelStance: 'Demand capture first.',
      gaps: [],
      changelog: [
        {
          revision,
          summary,
          rationale: 'DB contract proof fixture.',
          at: timestamp,
        },
      ],
    },
  };
}

function lastRevision(artifact) {
  const changelog = artifact?.body?.changelog;
  if (!Array.isArray(changelog)) return 0;
  const last = changelog.at(-1);
  return typeof last?.revision === 'number' ? last.revision : 0;
}

async function readParent(sb, runId) {
  const { data, error } = await sb
    .from('research_artifacts')
    .select('id, user_id, run_id, status, children_complete, children_total')
    .eq('run_id', runId)
    .maybeSingle();

  if (error) fail(`parent lookup failed: ${error.message}`);
  if (!data) fail(`no research_artifacts row for run_id ${runId}`);
  return data;
}

async function readStrategyBriefRow(sb, artifactId) {
  const { data, error } = await sb
    .from('research_artifact_sections')
    .select('zone, status, data, counts_toward_rollup')
    .eq('artifact_id', artifactId)
    .eq('zone', 'strategyBrief')
    .maybeSingle();

  if (error) fail(`strategyBrief lookup failed: ${error.message}`);
  return data ?? null;
}

function assertRollupUnchanged(before, after, label) {
  assertCondition(
    before.children_complete === after.children_complete,
    `${label}: children_complete changed ${before.children_complete} -> ${after.children_complete}`,
  );
  assertCondition(
    before.children_total === after.children_total,
    `${label}: children_total changed ${before.children_total} -> ${after.children_total}`,
  );
}

async function main() {
  if (!RUN_ID) {
    fail('Usage: node scripts/zz-strategy-brief-db-contract.mjs <run_id>');
  }

  const sb = createClient(
    requiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } },
  );
  const [{ commitStrategyBrief }, { strategyBriefArtifactSchema }] =
    await Promise.all([
      loadTsModule('src/lib/research-v2/strategy-brief/commit.ts'),
      loadTsModule('src/lib/research-v2/strategy-brief/schema.ts'),
    ]);

  const parentBefore = await readParent(sb, RUN_ID);
  assertCondition(
    parentBefore.status === 'complete',
    `run ${RUN_ID} is not complete (status=${parentBefore.status})`,
  );
  const existingBrief = await readStrategyBriefRow(sb, parentBefore.id);
  const startingRevision = lastRevision(existingBrief?.data);
  const firstRevision = startingRevision + 1;
  const secondRevision = firstRevision + 1;

  await commitStrategyBrief({
    supabase: sb,
    userId: parentBefore.user_id,
    runId: RUN_ID,
    artifact: makeBrief(firstRevision, 'DB contract first commit.'),
  });

  const rowAfterFirst = await readStrategyBriefRow(sb, parentBefore.id);
  assertCondition(rowAfterFirst !== null, 'strategyBrief row missing after commit');
  assertCondition(
    rowAfterFirst.counts_toward_rollup === false,
    `counts_toward_rollup expected false, got ${String(rowAfterFirst.counts_toward_rollup)}`,
  );
  const firstParsed = strategyBriefArtifactSchema.safeParse(rowAfterFirst.data);
  assertCondition(firstParsed.success, 'first committed strategyBrief data failed schema parse');
  assertCondition(
    lastRevision(firstParsed.data) === firstRevision,
    `first commit revision mismatch: expected ${firstRevision}, got ${lastRevision(firstParsed.data)}`,
  );
  assertRollupUnchanged(
    parentBefore,
    await readParent(sb, RUN_ID),
    'after first commit',
  );

  await commitStrategyBrief({
    supabase: sb,
    userId: parentBefore.user_id,
    runId: RUN_ID,
    artifact: makeBrief(secondRevision, 'DB contract second commit.'),
  });

  const rowAfterSecond = await readStrategyBriefRow(sb, parentBefore.id);
  const secondParsed = strategyBriefArtifactSchema.safeParse(rowAfterSecond?.data);
  assertCondition(secondParsed.success, 'second committed strategyBrief data failed schema parse');
  assertCondition(
    lastRevision(secondParsed.data) === secondRevision,
    `second commit revision mismatch: expected ${secondRevision}, got ${lastRevision(secondParsed.data)}`,
  );
  assertRollupUnchanged(
    parentBefore,
    await readParent(sb, RUN_ID),
    'after second commit',
  );

  console.log('PASS zz-strategy-brief-db-contract');
  console.log(`run_id=${RUN_ID}`);
  console.log(`artifact_id=${parentBefore.id}`);
  console.log(`rollup=${parentBefore.children_complete}/${parentBefore.children_total} unchanged`);
  console.log(`strategyBrief counts_toward_rollup=false revision=${secondRevision}`);
}

main().catch((error) => {
  console.error('FAIL zz-strategy-brief-db-contract');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
});
