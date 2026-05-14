#!/usr/bin/env node
/**
 * Pilot eval for the Market Category per-Section Artifact pipeline.
 *
 * Runs `runJourneySectionViaSubagent` directly for positioningMarketCategory
 * only, bypassing the worker HTTP layer, Supabase persistence, and the full
 * orchestrator. This eval checks the flow: evidence loop first, typed Artifact
 * emission through the runner, then TypeScript minimum validation.
 *
 * Usage:
 *   cd research-worker && npm run eval:pilot:market-category
 *   cd research-worker && npm run eval:pilot:market-category -- --company "Fellow" --url "https://fellow.app"
 */
import 'dotenv/config';

import {
  MarketCategoryArtifactSchema,
  validateMarketCategoryMinimums,
  type MarketCategoryArtifact,
} from '../src/agents/subagents/schemas/market-category';
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
    'firecrawl, and pagespeed against the URL above to gather the evidence you',
    'need for Market & Category Intelligence. The runner will turn your evidence',
    'transcript into the typed Section 01 Artifact after the tool loop ends.',
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

function buildSubsectionChecks(
  artifact: MarketCategoryArtifact,
): SubsectionCheck[] {
  return [
    {
      name: 'categoryDefinition',
      present: !!artifact.categoryDefinition,
      proseLength: artifact.categoryDefinition.prose.length,
      proseLongEnough: artifact.categoryDefinition.prose.length > 100,
      cardCount: artifact.categoryDefinition.adjacentCategories.length,
    },
    {
      name: 'marketSize',
      present: !!artifact.marketSize,
      proseLength: artifact.marketSize.prose.length,
      proseLongEnough: artifact.marketSize.prose.length > 100,
      cardCount: artifact.marketSize.signals.length,
    },
    {
      name: 'structuralForces',
      present: !!artifact.structuralForces,
      proseLength: artifact.structuralForces.prose.length,
      proseLongEnough: artifact.structuralForces.prose.length > 100,
      cardCount: artifact.structuralForces.forces.length,
    },
    {
      name: 'categoryMaturity',
      present: !!artifact.categoryMaturity,
      proseLength: artifact.categoryMaturity.prose.length,
      proseLongEnough: artifact.categoryMaturity.prose.length > 100,
      cardCount:
        artifact.categoryMaturity.classification.supportingSignals.length,
    },
  ];
}

function collectSubsectionProse(artifact: MarketCategoryArtifact): string {
  return [
    artifact.categoryDefinition.prose,
    artifact.marketSize.prose,
    artifact.structuralForces.prose,
    artifact.categoryMaturity.prose,
  ].join('\n\n');
}

function validationErrorsAreFlaggedInline(
  artifact: MarketCategoryArtifact,
  errors: string[],
): boolean {
  const prose = collectSubsectionProse(artifact);
  return errors.every((error) => prose.includes(error));
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const spec = POSITIONING_SECTION_SPECS.positioningMarketCategory;
  const context = buildMinimalContext(args);

  console.log('=== Market Category Pilot Eval ===');
  console.log(`Company: ${args.company}`);
  console.log(`URL: ${args.url}`);
  console.log(`Section: ${spec.section}`);
  console.log(`Started: ${new Date().toISOString()}`);
  console.log('');

  const retiredToolName = ['code', 'execution'].join('_');
  const toolCallCounts = new Map<string, number>([
    ['web_search', 0],
    ['firecrawl', 0],
    ['pagespeed', 0],
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

  const parsed = MarketCategoryArtifactSchema.safeParse(result.data);
  if (!parsed.success) {
    console.error(
      'ERROR: result.data failed MarketCategoryArtifactSchema.safeParse',
    );
    console.error(JSON.stringify(parsed.error.issues, null, 2));
    console.log('');
    console.log('=== Pilot verdict ===');
    console.log('FAIL: Artifact shape invalid');
    process.exit(1);
  }

  const artifact = parsed.data;
  const subsectionChecks = buildSubsectionChecks(artifact);
  const validation = validateMarketCategoryMinimums(artifact);
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
