import { MODELS } from '../src/models';
import {
  PositioningSectionDraftSchema,
  validatePositioningSectionDraft,
  type PositioningSectionDraft,
} from '../src/runners/positioning-draft-artifact';
import type { PositioningSubagentId } from '../src/agents/subagents';
import type { DraftEvalFixture } from './draft-eval-fixtures';

export interface EvalRow {
  fixture: string;
  model: string;
  firstPartialMs: number;
  finalObjectMs: number;
  commitMs: number;
  allSixMs: number;
  qualityScore: number;
  passed: boolean;
}

export function makeFixtureDraft(
  fixture: DraftEvalFixture,
  sectionId: PositioningSubagentId,
  model: string = MODELS.DRAFT,
): PositioningSectionDraft {
  const confidence = model === MODELS.FAST ? 5 : 7;
  return {
    schemaVersion: 1,
    artifactLayer: 'draft',
    sectionId,
    sectionTitle: sectionId.replace(/^positioning/, '').replace(/([A-Z])/g, ' $1').trim(),
    verdict: `${fixture.company} has enough first-pass signal for a draft, with visible evidence gaps.`,
    statusSummary:
      'This draft uses only the Section Context Pack. Deep mode should verify the highest-risk claims before the section is treated as final.',
    coreThesis: `${fixture.company} appears directionally positioned from its public context, but the pack is not enough for final-grade evidence.`,
    findings: [
      {
        finding: 'The context pack supports a directional positioning read.',
        evidence: fixture.context,
        sourceUrl: fixture.url,
      },
      {
        finding: 'Evidence is not deep enough for final claims.',
        evidence: 'The fixture deliberately includes missing market, buyer, and channel proof.',
      },
      {
        finding: 'Deep enrichment targets are explicit.',
        evidence: 'The draft lists gaps instead of hiding missing integrations or source coverage.',
      },
    ],
    evidenceGaps: [
      {
        gap: 'Needs source-level verification beyond the fixture context.',
        impact: 'Deep mode must fill this before final artifact generation.',
      },
    ],
    sources: [
      {
        title: `${fixture.company} website`,
        url: fixture.url,
        whyItMatters: 'Primary public context for the draft eval fixture.',
      },
    ],
    confidence,
    recommendedDeepFillTargets: [
      'Verify category and ICP claims with external sources',
      'Fill source gaps before final Section Artifact generation',
    ],
  };
}

export function scoreDraftQuality(draft: PositioningSectionDraft): number {
  const validation = validatePositioningSectionDraft(
    draft,
    draft.sectionId as PositioningSubagentId,
  );
  const schemaResult = PositioningSectionDraftSchema.safeParse(draft);
  let score = 0;
  if (schemaResult.success) score += 35;
  if (validation.ok) score += 25;
  if (draft.evidenceGaps.length > 0) score += 15;
  if (draft.sources.length > 0) score += 15;
  if (draft.confidence >= 0 && draft.confidence <= 10) score += 10;
  return score;
}

export function printRows(title: string, rows: readonly EvalRow[]): void {
  console.log(`\n${title}`);
  console.log('fixture | model | firstPartialMs | finalObjectMs | commitMs | allSixMs | quality | passed');
  for (const row of rows) {
    console.log(
      [
        row.fixture,
        row.model,
        String(row.firstPartialMs),
        String(row.finalObjectMs),
        String(row.commitMs),
        String(row.allSixMs),
        String(row.qualityScore),
        row.passed ? 'PASS' : 'FAIL',
      ].join(' | '),
    );
  }
}
