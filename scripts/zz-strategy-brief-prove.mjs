#!/usr/bin/env node
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { build } from 'esbuild';

const RUN_ID = process.argv[2] ?? process.env.E2E_RUN_ID;
const CDP = process.env.E2E_CDP_URL ?? 'http://localhost:9223';
const POLL_ATTEMPTS = Number(process.env.STRATEGY_BRIEF_POLL_ATTEMPTS ?? 36);
const POLL_MS = Number(process.env.STRATEGY_BRIEF_POLL_MS ?? 5000);
const REFINEMENT =
  process.env.STRATEGY_BRIEF_RERUN_REFINEMENT ??
  'Focus voice of customer on outbound/cold-call complaints.';

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function readParent(sb, runId) {
  const { data, error } = await sb
    .from('research_artifacts')
    .select('id, run_id, status, children_complete, children_total')
    .eq('run_id', runId)
    .maybeSingle();

  if (error) fail(`parent lookup failed: ${error.message}`);
  if (!data) fail(`no research_artifacts row for run_id ${runId}`);
  return data;
}

async function readSection(sb, artifactId, zone) {
  const { data, error } = await sb
    .from('research_artifact_sections')
    .select('zone, status, data, counts_toward_rollup, section_run_id, revision')
    .eq('artifact_id', artifactId)
    .eq('zone', zone)
    .maybeSingle();

  if (error) fail(`${zone} lookup failed: ${error.message}`);
  return data ?? null;
}

function assertRollupUnchanged(before, after) {
  assertCondition(
    before.children_complete === after.children_complete,
    `children_complete changed ${before.children_complete} -> ${after.children_complete}`,
  );
  assertCondition(
    before.children_total === after.children_total,
    `children_total changed ${before.children_total} -> ${after.children_total}`,
  );
}

async function findResearchPage(browser) {
  for (const context of browser.contexts()) {
    const page = context.pages().find((candidate) =>
      candidate.url().includes('/research-v3'),
    );
    if (page) return page;
  }
  return null;
}

async function postAuthed(page, path, body) {
  return await page.evaluate(
    async ({ requestPath, requestBody }) => {
      const response = await fetch(requestPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      return {
        status: response.status,
        ok: response.ok,
        body: (await response.text()).slice(0, 500),
      };
    },
    { requestPath: path, requestBody: body },
  );
}

async function pollStrategyBrief(sb, artifactId, schema) {
  for (let attempt = 1; attempt <= POLL_ATTEMPTS; attempt += 1) {
    const row = await readSection(sb, artifactId, 'strategyBrief');
    const parsed = schema.safeParse(row?.data);
    if (
      row?.status === 'complete' &&
      row.counts_toward_rollup === false &&
      parsed.success
    ) {
      return { row, artifact: parsed.data, attempt };
    }
    await sleep(POLL_MS);
  }
  fail(
    `strategyBrief did not commit within ${POLL_ATTEMPTS} attempts (${POLL_MS}ms interval)`,
  );
}

async function main() {
  if (!RUN_ID) {
    fail('Usage: node scripts/zz-strategy-brief-prove.mjs <run_id>');
  }

  const sb = createClient(
    requiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } },
  );
  const { strategyBriefArtifactSchema } = await loadTsModule(
    'src/lib/research-v2/strategy-brief/schema.ts',
  );
  const parentBefore = await readParent(sb, RUN_ID);
  const vocBefore = await readSection(
    sb,
    parentBefore.id,
    'positioningVoiceOfCustomer',
  );

  const browser = await chromium.connectOverCDP(CDP);
  try {
    const page = await findResearchPage(browser);
    if (!page) fail(`research-v3 tab not found via ${CDP}`);

    const draft = await postAuthed(page, '/api/research-v2/strategy-brief', {
      runId: RUN_ID,
      refinement:
        "This subject is a cold-call agent, not a receptionist - reframe around that and ban 'operations hub'.",
    });
    assertCondition(
      draft.status === 202,
      `strategy brief POST expected 202, got ${draft.status}: ${draft.body}`,
    );

    const committed = await pollStrategyBrief(
      sb,
      parentBefore.id,
      strategyBriefArtifactSchema,
    );
    assertRollupUnchanged(parentBefore, await readParent(sb, RUN_ID));

    const rerun = await postAuthed(page, '/api/research-v2/rerun-section', {
      runId: RUN_ID,
      zone: 'positioningVoiceOfCustomer',
      executionMode: 'lab',
      refinement: REFINEMENT,
    });
    assertCondition(
      rerun.status !== 400,
      `refinement rerun should not 400; got ${rerun.status}: ${rerun.body}`,
    );

    const vocAfter = await readSection(
      sb,
      parentBefore.id,
      'positioningVoiceOfCustomer',
    );

    console.log('PASS zz-strategy-brief-prove');
    console.log(`run_id=${RUN_ID}`);
    console.log(
      `strategyBrief committed attempt=${committed.attempt} revision=${committed.row.revision ?? 'unknown'} rollup=${parentBefore.children_complete}/${parentBefore.children_total}`,
    );
    console.log(
      `strategyBrief changelog_revision=${committed.artifact.body.changelog.at(-1)?.revision ?? 'unknown'}`,
    );
    console.log(`rerun_section_status=${rerun.status}`);
    console.log(
      `voc_before_run=${vocBefore?.section_run_id ?? 'none'} voc_after_run=${vocAfter?.section_run_id ?? 'none'}`,
    );
  } finally {
    await browser.close().catch(() => {});
  }
}

main().catch((error) => {
  console.error('FAIL zz-strategy-brief-prove');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
});
