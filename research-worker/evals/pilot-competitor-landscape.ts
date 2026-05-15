#!/usr/bin/env node
/**
 * Pilot eval for the Competitor Landscape per-Section Artifact pipeline.
 *
 * Runs `runJourneySectionViaSubagent` directly for
 * positioningCompetitorLandscape only, bypassing the worker HTTP layer,
 * Supabase persistence, and the full orchestrator.
 *
 * Usage:
 *   cd research-worker && npm run eval:pilot:competitor-landscape
 *   cd research-worker && npm run eval:pilot:competitor-landscape -- --company "Fellow" --url "https://fellow.app"
 */
import 'dotenv/config';

import {
  CompetitorLandscapeArtifactSchema,
  validateCompetitorLandscapeMinimums,
  type CompetitorLandscapeArtifact,
} from '../src/agents/subagents/schemas/competitor-landscape';
import { POSITIONING_SECTION_SPECS } from '../src/runners/positioning';
import { runJourneySectionViaSubagent } from '../src/runners/positioning-subagent-runner';

interface CliArgs {
  company: string;
  url: string;
  model: string;
}

interface SubsectionCheck {
  name: string;
  present: boolean;
  proseLength: number;
  proseLongEnough: boolean;
  cardCount: number;
  minimumCardCount: number;
}

const WALLTIME_LIMIT_MS = 8 * 60 * 1000;

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = {
    company: 'Fellow',
    url: 'https://fellow.app',
    model: 'claude-opus-4-7',
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--company') {
      out.company = argv[index + 1] ?? out.company;
      index += 1;
    } else if (argv[index] === '--url') {
      out.url = argv[index + 1] ?? out.url;
      index += 1;
    } else if (argv[index] === '--model') {
      out.model = argv[index + 1] ?? out.model;
      index += 1;
    }
  }
  return out;
}

function buildMinimalContext(args: CliArgs): string {
  return [
    `Company: ${args.company}`,
    `Website: ${args.url}`,
    `Requested model: ${args.model}`,
    '',
    'You have not been given a pre-built shared corpus. Run web_search,',
    'spyfu, adlibrary, meta_ads, google_ads, and firecrawl against the URL',
    'above to gather the evidence you need for Competitor Landscape &',
    'Positioning. The runner will turn your evidence transcript into the',
    'typed Section 03 Artifact after the tool loop ends.',
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
  artifact: CompetitorLandscapeArtifact,
): SubsectionCheck[] {
  return [
    {
      name: 'competitorSet',
      present: !!artifact.competitorSet,
      proseLength: artifact.competitorSet.prose.length,
      proseLongEnough: artifact.competitorSet.prose.length > 100,
      cardCount: artifact.competitorSet.competitors.length,
      minimumCardCount: 5,
    },
    {
      name: 'positioningTaxonomy',
      present: !!artifact.positioningTaxonomy,
      proseLength: artifact.positioningTaxonomy.prose.length,
      proseLongEnough: artifact.positioningTaxonomy.prose.length > 100,
      cardCount: artifact.positioningTaxonomy.axes.length,
      minimumCardCount: 3,
    },
    {
      name: 'pricingReality',
      present: !!artifact.pricingReality,
      proseLength: artifact.pricingReality.prose.length,
      proseLongEnough: artifact.pricingReality.prose.length > 100,
      cardCount: artifact.pricingReality.dataPoints.length,
      minimumCardCount: 3,
    },
    {
      name: 'shareOfVoice',
      present: !!artifact.shareOfVoice,
      proseLength: artifact.shareOfVoice.prose.length,
      proseLongEnough: artifact.shareOfVoice.prose.length > 100,
      cardCount: artifact.shareOfVoice.slices.length,
      minimumCardCount: 3,
    },
    {
      name: 'publicWeaknesses',
      present: !!artifact.publicWeaknesses,
      proseLength: artifact.publicWeaknesses.prose.length,
      proseLongEnough: artifact.publicWeaknesses.prose.length > 100,
      cardCount: artifact.publicWeaknesses.items.length,
      minimumCardCount: 4,
    },
    {
      name: 'narrativeArcs',
      present: !!artifact.narrativeArcs,
      proseLength: artifact.narrativeArcs.prose.length,
      proseLongEnough: artifact.narrativeArcs.prose.length > 100,
      cardCount: artifact.narrativeArcs.arcs.length,
      minimumCardCount: 3,
    },
  ];
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const spec = POSITIONING_SECTION_SPECS.positioningCompetitorLandscape;
  const context = buildMinimalContext(args);

  console.log('=== Competitor Landscape Pilot Eval ===');
  console.log(`Company: ${args.company}`);
  console.log(`URL: ${args.url}`);
  console.log(`Model arg: ${args.model}`);
  console.log(`Section: ${spec.section}`);
  console.log(`Started: ${new Date().toISOString()}`);
  console.log('');

  const retiredToolName = ['code', 'execution'].join('_');
  const toolCallCounts = new Map<string, number>([
    ['web_search', 0],
    ['spyfu', 0],
    ['adlibrary', 0],
    ['meta_ads', 0],
    ['google_ads', 0],
    ['firecrawl', 0],
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

  const parsed = CompetitorLandscapeArtifactSchema.safeParse(result.data);
  if (!parsed.success) {
    console.error(
      'ERROR: result.data failed CompetitorLandscapeArtifactSchema.safeParse',
    );
    console.error(JSON.stringify(parsed.error.issues, null, 2));
    console.log('');
    console.log('=== Pilot verdict ===');
    console.log('FAIL: Artifact shape invalid');
    process.exit(1);
  }

  const artifact = parsed.data;
  const subsectionChecks = buildSubsectionChecks(artifact);
  const validation = validateCompetitorLandscapeMinimums(artifact);
  const confidenceInRange =
    Number.isFinite(artifact.confidence) &&
    artifact.confidence >= 0 &&
    artifact.confidence <= 10;
  const allSubsectionsPresentAndLong = subsectionChecks.every(
    (check) => check.present && check.proseLongEnough,
  );
  const cardMinimumsMet = subsectionChecks.every(
    (check) => check.cardCount >= check.minimumCardCount,
  );
  const walltimeUnderLimit = walltime < WALLTIME_LIMIT_MS;
  const retiredToolCalls = toolCallCounts.get(retiredToolName) ?? 0;
  const pass =
    streamObjectComplete &&
    allSubsectionsPresentAndLong &&
    cardMinimumsMet &&
    validation.ok &&
    confidenceInRange &&
    walltimeUnderLimit &&
    retiredToolCalls === 0;

  console.log('Sub-sections:');
  for (const check of subsectionChecks) {
    console.log(
      `  ${check.name.padEnd(23)} present=${check.present ? 'yes' : 'no'} prose>100=${check.proseLongEnough ? 'yes' : 'no'} proseLength=${check.proseLength} cards=${check.cardCount}/${check.minimumCardCount}`,
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
  console.log(`Card minimums:              ${cardMinimumsMet ? 'PASS' : 'FAIL'}`);
  console.log(`Minimum validator:          ${validation.ok ? 'PASS' : 'FAIL'}`);
  console.log(`Confidence range:           ${confidenceInRange ? 'PASS' : 'FAIL'}`);
  console.log(`Walltime <8min:             ${walltimeUnderLimit ? 'PASS' : 'FAIL'}`);
  console.log(`0 ${retiredToolName}:       ${retiredToolCalls === 0 ? 'PASS' : 'FAIL'}`);
  console.log(`Overall:                    ${pass ? 'PASS' : 'FAIL'}`);

  process.exit(pass ? 0 : 1);
}

main().catch((err: unknown) => {
  console.error('Pilot eval crashed:', err);
  process.exit(2);
});
