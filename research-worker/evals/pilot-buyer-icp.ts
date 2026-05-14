#!/usr/bin/env node
/**
 * Pilot eval for the BuyerICP per-section schema commit (28c83603).
 *
 * Runs `runJourneySectionViaSubagent` directly for positioningBuyerICP only,
 * bypassing: deepResearchProgram corpus, the worker HTTP layer, Supabase
 * persistence, the orchestrator. ~1-2 minutes wall-time vs. ~4 minutes for
 * the full corpus-first flow.
 *
 * What this verifies:
 *   1. The agent actually invokes `code_execution` (the embedded validate.py
 *      workflow) — look for `code_execution` in the progress event toolName.
 *   2. The final envelope contains the rich BuyerICP fields (personas[],
 *      triggers[], clusters{}, awarenessDistribution[], icpAccountCounts{}).
 *   3. The validator's named-error feedback actually drives fix-loops (look
 *      for repeated code_execution calls with text deltas between them).
 *   4. End-to-end walltime + confidence.
 *
 * Usage:
 *   cd research-worker && npm run eval:pilot:buyer-icp
 *   cd research-worker && npm run eval:pilot:buyer-icp -- --company "Fellow" --url "https://fellow.app"
 *
 * Output is human-readable to stdout. Non-zero exit on agent failure only;
 * a "valid: false but flagged in risksOrGaps" run still exits 0 (that's an
 * expected fallback per SKILL.md workflow step 4).
 */
import 'dotenv/config';

import { POSITIONING_SECTION_SPECS } from '../src/runners/positioning';
import { runJourneySectionViaSubagent } from '../src/runners/positioning-subagent-runner';

interface CliArgs {
  company: string;
  url: string;
}

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = { company: 'Fellow', url: 'https://fellow.app' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--company') out.company = argv[++i] ?? out.company;
    else if (argv[i] === '--url') out.url = argv[++i] ?? out.url;
  }
  return out;
}

function buildMinimalContext(args: CliArgs): string {
  // What deepResearchProgram normally produces — collapsed to the bare
  // minimum the BuyerICP runner needs. The runner relies on this prose to
  // know what company to research; the actual research happens via tool
  // calls (web_search / firecrawl / reviews / code_execution).
  return [
    `Company: ${args.company}`,
    `Website: ${args.url}`,
    '',
    'You have not been given a pre-built shared corpus. Run web_search,',
    'firecrawl, and reviews against the URL above to gather the evidence you',
    'need. Follow the Workflow section in your instructions (plan -> validate',
    '-> emit) and use the code_execution tool to run the validator before',
    'emitting your final structured output.',
  ].join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const spec = POSITIONING_SECTION_SPECS.positioningBuyerICP;
  const context = buildMinimalContext(args);

  console.log('=== BuyerICP Pilot Eval ===');
  console.log(`Company: ${args.company}`);
  console.log(`URL: ${args.url}`);
  console.log(`Section: ${spec.section}`);
  console.log(`Started: ${new Date().toISOString()}`);
  console.log('');

  // Progress event tally — we care most about WHICH tools the agent invoked,
  // and how many times code_execution fired (each fire = one validate.py
  // round-trip).
  const toolCallCounts = new Map<string, number>();
  let stepCount = 0;
  let lastEmitMs = Date.now();

  const start = Date.now();
  const result = await runJourneySectionViaSubagent(spec, context, (update) => {
    const now = Date.now();
    const dt = now - lastEmitMs;
    lastEmitMs = now;
    const meta = update.meta as Record<string, unknown> | undefined;
    const tool = meta?.toolName ?? meta?.toolNames;
    if (typeof tool === 'string') {
      toolCallCounts.set(tool, (toolCallCounts.get(tool) ?? 0) + 1);
    } else if (Array.isArray(tool)) {
      for (const t of tool) {
        if (typeof t === 'string') {
          toolCallCounts.set(t, (toolCallCounts.get(t) ?? 0) + 1);
        }
      }
    }
    stepCount += 1;
    console.log(
      `  [+${(dt / 1000).toFixed(1)}s] ${update.phase}: ${update.message}${tool ? ` (${JSON.stringify(tool)})` : ''}`,
    );
  });
  const walltime = Date.now() - start;

  console.log('');
  console.log('=== Result ===');
  console.log(`Status: ${result.status}`);
  console.log(`Walltime: ${(walltime / 1000).toFixed(1)}s`);
  console.log(`Progress events: ${stepCount}`);
  console.log('');
  console.log('Tool call counts:');
  for (const [tool, count] of [...toolCallCounts.entries()].sort()) {
    console.log(`  ${tool.padEnd(20)} x${count}`);
  }
  console.log('');

  if (result.status === 'error') {
    console.error(`ERROR: ${result.error}`);
    process.exit(1);
  }

  const data = (result as unknown as Record<string, unknown>).data as
    | Record<string, unknown>
    | undefined;

  if (!data) {
    console.error('ERROR: result has no data field');
    process.exit(1);
  }

  // Rich-field presence — the whole point of this pilot.
  console.log('Rich fields:');
  console.log(`  personas:              ${Array.isArray(data.personas) ? `[${(data.personas as unknown[]).length}]` : 'MISSING'}`);
  console.log(`  icpAccountCounts:      ${data.icpAccountCounts ? `present (${Object.keys(data.icpAccountCounts as Record<string, unknown>).length} cuts)` : 'MISSING'}`);
  console.log(`  awarenessDistribution: ${Array.isArray(data.awarenessDistribution) ? `[${(data.awarenessDistribution as unknown[]).length}]` : 'MISSING'}`);
  console.log(`  triggers:              ${Array.isArray(data.triggers) ? `[${(data.triggers as unknown[]).length}]` : 'MISSING'}`);
  console.log(`  clusters:              ${data.clusters ? 'present' : 'MISSING'}`);
  console.log('');

  const personas = (data.personas as unknown[]) ?? [];
  if (personas.length > 0) {
    console.log('First persona (sanity check the agent emitted a real one):');
    console.log(JSON.stringify(personas[0], null, 2));
    console.log('');
  }

  console.log(`Verdict:        ${data.verdict}`);
  console.log(`Confidence:     ${data.confidence}`);
  console.log(`Risks/gaps (${Array.isArray(data.risksOrGaps) ? (data.risksOrGaps as unknown[]).length : 0}):`);
  for (const gap of (data.risksOrGaps as unknown[]) ?? []) {
    console.log(`  - ${typeof gap === 'string' ? gap : JSON.stringify(gap)}`);
  }

  // Verdict the pilot is meant to give us:
  const codeExec = toolCallCounts.get('code_execution') ?? 0;
  const richOK =
    Array.isArray(data.personas) &&
    Array.isArray(data.triggers) &&
    Array.isArray(data.awarenessDistribution) &&
    !!data.clusters &&
    !!data.icpAccountCounts;

  console.log('');
  console.log('=== Pilot verdict ===');
  console.log(`Code execution invocations: ${codeExec}  ${codeExec > 0 ? 'OK (validator ran)' : 'WARN (agent never validated!)'}`);
  console.log(`Rich fields present:         ${richOK ? 'OK' : 'FAIL (schema not honored)'}`);

  process.exit(0);
}

main().catch((err) => {
  console.error('Pilot eval crashed:', err);
  process.exit(2);
});
