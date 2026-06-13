#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { build } from 'esbuild';

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
  try {
    return await import(pathToFileURL(outfile).href);
  } finally {
    await rm(outdir, { recursive: true, force: true });
  }
}

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function validBrief(overrides = {}) {
  return {
    sectionTitle: 'Offer & Angle Brief',
    verdict: 'Lead with accountable revenue meetings.',
    statusSummary: 'Ready for media planning.',
    confidence: 0.82,
    sources: [{ title: 'Fellow', url: 'https://fellow.app' }],
    body: {
      positioning: {
        oneLiner: 'Fellow keeps revenue meetings accountable.',
        valueProp: 'Turn meeting chaos into owned execution.',
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
        approved: ['accountability'],
        banned: [{ term: 'AI meeting copilot', reason: 'Too generic.' }],
      },
      funnelStance: 'Demand capture first.',
      gaps: [],
      changelog: [
        {
          revision: 1,
          summary: 'Initial brief.',
          rationale: 'Six committed sections were available.',
          at: '2026-06-13T00:00:00.000Z',
        },
      ],
    },
    ...overrides,
  };
}

async function main() {
  const [
    { buildUserRefinementBlock },
    { buildStrategyBriefPrompt },
    { strategyBriefArtifactSchema },
    { validateStrategyBriefSupport },
  ] = await Promise.all([
    loadTsModule('src/lib/lab-engine/agents/build-prompts.ts'),
    loadTsModule('src/lib/research-v2/strategy-brief/composer.ts'),
    loadTsModule('src/lib/research-v2/strategy-brief/schema.ts'),
    loadTsModule('src/lib/research-v2/strategy-brief/support.ts'),
  ]);

  const committedSectionMarkdown = {
    positioningMarketCategory:
      '# Market\nFellow is meeting automation for revenue teams.',
    positioningBuyerICP: '# ICP\nRevenue operators own the pain.',
    positioningCompetitorLandscape: '# Competitors\nPoint tools fragment work.',
    positioningVoiceOfCustomer:
      '# VoC\n"I left the meeting without a clear owner."',
    positioningDemandIntent: '# Demand\nSearchers compare meeting follow-up.',
    positioningOfferDiagnostic:
      '# Offer\nAccountability is the strongest mechanism.',
  };
  const prompt = buildStrategyBriefPrompt({
    committedSectionMarkdown,
    evidencePoolSlice:
      'Evidence 1: sourceUrl: https://fellow.app\npayload: accountable meetings',
    onboardingFrame: 'Primary objective: improve paid media performance.',
    refinement: 'Rank outbound/cold-call accountability angles first.',
    priorBrief: null,
  });

  assertCondition(
    prompt.includes(committedSectionMarkdown.positioningVoiceOfCustomer),
    'prompt did not include committed section markdown',
  );
  assertCondition(
    prompt.includes('Rank outbound/cold-call accountability angles first.'),
    'prompt did not include refinement text',
  );

  const parsed = strategyBriefArtifactSchema.safeParse(validBrief());
  assertCondition(parsed.success, 'valid strategy brief failed schema parse');

  const unsupported = validBrief({
    body: {
      ...validBrief().body,
      angles: [
        {
          name: 'Unsupported ghost angle',
          vignette: 'I trust a claim with no evidence.',
          coreEmotion: 'false certainty',
          adFrame: 'Open on invented proof.',
          rank: 1,
          sourceEvidence: ['missing-source'],
        },
      ],
    },
  });
  const support = validateStrategyBriefSupport({
    body: unsupported.body,
    committedSectionIds: Object.keys(committedSectionMarkdown),
    evidenceSourceUrls: ['https://fellow.app'],
  });
  assertCondition(!support.ok, 'unsupported angle was not caught');
  assertCondition(
    support.unsupported.some((message) =>
      message.includes('Unsupported ghost angle'),
    ),
    'unsupported angle offender was not named',
  );

  const refinementBlock = buildUserRefinementBlock({
    chatRefinement: 'Apply this operator correction.',
  });
  assertCondition(
    refinementBlock.includes('USER REFINEMENT') &&
      refinementBlock.includes('Apply this operator correction.'),
    'binding refinement block was not emitted',
  );
  assertCondition(
    buildUserRefinementBlock({}) === '',
    'empty refinement should produce an empty block',
  );

  console.log('PASS zz-strategy-brief-logic-prove');
  console.log('prompt: section markdown + refinement present');
  console.log('schema: valid brief parsed');
  console.log('support: unsupported angle caught and named');
  console.log('refinement: binding block emitted and empty case suppressed');
}

main().catch((error) => {
  console.error('FAIL zz-strategy-brief-logic-prove');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
});
