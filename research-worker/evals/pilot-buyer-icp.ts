#!/usr/bin/env node
/**
 * Pilot eval for the BuyerICP per-Section Artifact pipeline.
 *
 * Runs `runJourneySectionViaSubagent` directly for positioningBuyerICP only,
 * bypassing the worker HTTP layer, Supabase persistence, and the full
 * orchestrator. This eval checks the new flow: evidence loop first, typed
 * Artifact emission through the runner, then TypeScript minimum validation.
 *
 * Usage:
 *   cd research-worker && npm run eval:pilot:buyer-icp
 *   cd research-worker && npm run eval:pilot:buyer-icp -- --company "Fellow" --url "https://fellow.app"
 */
import 'dotenv/config';

import {
  BuyerICPArtifactSchema,
  validateBuyerICPMinimums,
  type BuyerICPArtifact,
} from '../src/agents/subagents/schemas/buyer-icp';
import { POSITIONING_SECTION_SPECS } from '../src/runners/positioning';
import { runJourneySectionViaSubagent } from '../src/runners/positioning-subagent-runner';

interface CliArgs {
  company: string;
  url: string;
}

interface SubsectionCheck {
  name: string;
  present: boolean;
  proseLength: number;
  proseLongEnough: boolean;
  cardCount: number;
}

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = { company: 'Fellow', url: 'https://fellow.app' };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--company') {
      out.company = argv[index + 1] ?? out.company;
      index += 1;
    } else if (argv[index] === '--url') {
      out.url = argv[index + 1] ?? out.url;
      index += 1;
    }
  }
  return out;
}

function buildMinimalContext(args: CliArgs): string {
  return [
    `Company: ${args.company}`,
    `Website: ${args.url}`,
    '',
    'You have not been given a pre-built shared corpus. Run web_search,',
    'firecrawl, and reviews against the URL above to gather the evidence you',
    'need for Buyer & ICP Validation. The runner will turn your evidence',
    'transcript into the typed Section 02 Artifact after the tool loop ends.',
  ].join('\n');
}

function incrementToolCount(
  counts: Map<string, number>,
  toolName: string,
): void {
  counts.set(toolName, (counts.get(toolName) ?? 0) + 1);
}

function firstSentence(value: string): string {
  const [sentence] = value.split(/(?<=[.!?])\s+/);
  return sentence ?? value;
}

function buildSubsectionChecks(artifact: BuyerICPArtifact): SubsectionCheck[] {
  return [
    {
      name: 'icpExistenceCheck',
      present: !!artifact.icpExistenceCheck,
      proseLength: artifact.icpExistenceCheck.prose.length,
      proseLongEnough: artifact.icpExistenceCheck.prose.length > 100,
      cardCount: artifact.icpExistenceCheck.firmographicCuts.length,
    },
    {
      name: 'personaReality',
      present: !!artifact.personaReality,
      proseLength: artifact.personaReality.prose.length,
      proseLongEnough: artifact.personaReality.prose.length > 100,
      cardCount: artifact.personaReality.personas.length,
    },
    {
      name: 'awarenessDistribution',
      present: !!artifact.awarenessDistribution,
      proseLength: artifact.awarenessDistribution.prose.length,
      proseLongEnough: artifact.awarenessDistribution.prose.length > 100,
      cardCount: artifact.awarenessDistribution.levels.length,
    },
    {
      name: 'buyingContext',
      present: !!artifact.buyingContext,
      proseLength: artifact.buyingContext.prose.length,
      proseLongEnough: artifact.buyingContext.prose.length > 100,
      cardCount: artifact.buyingContext.triggers.length,
    },
    {
      name: 'clusters',
      present: !!artifact.clusters,
      proseLength: artifact.clusters.prose.length,
      proseLongEnough: artifact.clusters.prose.length > 100,
      cardCount: artifact.clusters.venues.length,
    },
  ];
}

function collectSubsectionProse(artifact: BuyerICPArtifact): string {
  return [
    artifact.icpExistenceCheck.prose,
    artifact.personaReality.prose,
    artifact.awarenessDistribution.prose,
    artifact.buyingContext.prose,
    artifact.clusters.prose,
  ].join('\n\n');
}

function validationErrorsAreFlaggedInline(
  artifact: BuyerICPArtifact,
  errors: string[],
): boolean {
  const prose = collectSubsectionProse(artifact);
  return errors.every((error) => prose.includes(error));
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const spec = POSITIONING_SECTION_SPECS.positioningBuyerICP;
  const context = buildMinimalContext(args);

  console.log('=== BuyerICP Pilot Eval ===');
  console.log(`Company: ${args.company}`);
  console.log(`URL: ${args.url}`);
  console.log(`Section: ${spec.section}`);
  console.log(`Started: ${new Date().toISOString()}`);
  console.log('');

  const retiredToolName = ['code', 'execution'].join('_');
  const toolCallCounts = new Map<string, number>([
    ['web_search', 0],
    ['firecrawl', 0],
    ['reviews', 0],
    [retiredToolName, 0],
  ]);
  let progressEventCount = 0;
  let lastEmitMs = Date.now();
  let streamObjectComplete = false;

  const start = Date.now();
  const result = await runJourneySectionViaSubagent(spec, context, (update) => {
    const now = Date.now();
    const dt = now - lastEmitMs;
    lastEmitMs = now;
    const meta = update.meta;
    const tool = meta?.toolName ?? meta?.toolNames;

    if (typeof tool === 'string') {
      incrementToolCount(toolCallCounts, tool);
    } else if (Array.isArray(tool)) {
      for (const toolName of tool) {
        incrementToolCount(toolCallCounts, toolName);
      }
    }

    if (update.message.includes('[runner] streamObject: complete')) {
      streamObjectComplete = true;
    }

    progressEventCount += 1;
    console.log(
      `  [+${(dt / 1000).toFixed(1)}s] ${update.phase}: ${update.message}${tool ? ` (${JSON.stringify(tool)})` : ''}`,
    );
  });
  const walltime = Date.now() - start;

  console.log('');
  console.log('=== Result ===');
  console.log(`Status: ${result.status}`);
  console.log(`Walltime: ${(walltime / 1000).toFixed(1)}s`);
  console.log(`Progress events: ${progressEventCount}`);
  console.log('');
  console.log('Tool call counts:');
  for (const [tool, count] of [...toolCallCounts.entries()].sort()) {
    console.log(`  ${tool.padEnd(20)} x${count}`);
  }
  console.log('');

  if (result.status === 'error') {
    console.error(`ERROR: ${result.error}`);
    console.log('');
    console.log('=== Pilot verdict ===');
    console.log('FAIL: runner returned error status');
    process.exit(1);
  }

  const parsed = BuyerICPArtifactSchema.safeParse(result.data);
  if (!parsed.success) {
    console.error('ERROR: result.data failed BuyerICPArtifactSchema.safeParse');
    console.error(JSON.stringify(parsed.error.issues, null, 2));
    console.log('');
    console.log('=== Pilot verdict ===');
    console.log('FAIL: Artifact shape invalid');
    process.exit(1);
  }

  const artifact = parsed.data;
  const subsectionChecks = buildSubsectionChecks(artifact);
  const validation = validateBuyerICPMinimums(artifact);
  const gapsFlagged =
    !validation.ok && validationErrorsAreFlaggedInline(artifact, validation.errors);
  const confidenceInRange =
    Number.isFinite(artifact.confidence) &&
    artifact.confidence >= 0 &&
    artifact.confidence <= 10;
  const allSubsectionsPresentAndLong = subsectionChecks.every(
    (check) => check.present && check.proseLongEnough,
  );
  const pass =
    streamObjectComplete &&
    allSubsectionsPresentAndLong &&
    (validation.ok || gapsFlagged) &&
    confidenceInRange;

  console.log('Sub-sections:');
  for (const check of subsectionChecks) {
    console.log(
      `  ${check.name.padEnd(23)} present=${check.present ? 'yes' : 'no'} prose>100=${check.proseLongEnough ? 'yes' : 'no'} proseLength=${check.proseLength} cards=${check.cardCount}`,
    );
  }
  console.log('');

  console.log('Validator result:');
  console.log(JSON.stringify(validation, null, 2));
  console.log('');

  console.log(`Verdict:        ${artifact.verdict}`);
  console.log(`Status summary: ${firstSentence(artifact.statusSummary)}`);
  console.log(`Confidence:     ${artifact.confidence}`);
  console.log(`Sources:        ${artifact.sources.length}`);
  console.log('');

  console.log('=== Pilot verdict ===');
  console.log(`streamObject complete:      ${streamObjectComplete ? 'PASS' : 'FAIL'}`);
  console.log(`Sub-section prose complete: ${allSubsectionsPresentAndLong ? 'PASS' : 'FAIL'}`);
  console.log(`Minimums pass or flagged:   ${validation.ok || gapsFlagged ? 'PASS' : 'FAIL'}`);
  console.log(`Confidence range:           ${confidenceInRange ? 'PASS' : 'FAIL'}`);
  console.log(`Overall:                    ${pass ? 'PASS' : 'FAIL'}`);

  process.exit(pass ? 0 : 1);
}

main().catch((err: unknown) => {
  console.error('Pilot eval crashed:', err);
  process.exit(2);
});
