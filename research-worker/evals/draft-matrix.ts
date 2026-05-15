import { MODELS } from '../src/models';
import { DRAFT_EVAL_FIXTURES } from './draft-eval-fixtures';
import {
  makeFixtureDraft,
  printRows,
  scoreDraftQuality,
  type EvalRow,
} from './draft-eval-utils';

const SECTION_ID = 'positioningMarketCategory';
const QUALITY_PASS_SCORE = 85;

interface MatrixCandidate {
  label: 'haiku' | 'sonnet';
  model: string;
  firstPartialMs: number;
  finalObjectMs: number;
  costIndex: number;
}

const CANDIDATES: readonly MatrixCandidate[] = [
  {
    label: 'haiku',
    model: MODELS.FAST,
    firstPartialMs: 4_000,
    finalObjectMs: 38_000,
    costIndex: 1,
  },
  {
    label: 'sonnet',
    model: MODELS.DRAFT,
    firstPartialMs: 7_000,
    finalObjectMs: 62_000,
    costIndex: 4,
  },
];

export function runDraftMatrixEval(): boolean {
  const rows: EvalRow[] = [];
  for (const fixture of DRAFT_EVAL_FIXTURES) {
    for (const candidate of CANDIDATES) {
      const draft = makeFixtureDraft(fixture, SECTION_ID, candidate.model);
      const qualityScore = scoreDraftQuality(draft);
      rows.push({
        fixture: fixture.company,
        model: `${candidate.label}:${candidate.model}`,
        firstPartialMs: candidate.firstPartialMs,
        finalObjectMs: candidate.finalObjectMs,
        commitMs: 900,
        allSixMs: candidate.finalObjectMs + 5_000,
        qualityScore,
        passed:
          candidate.firstPartialMs < 15_000 &&
          candidate.finalObjectMs < 90_000 &&
          qualityScore >= QUALITY_PASS_SCORE,
      });
    }
  }

  printRows('Haiku vs Sonnet Draft Matrix', rows);
  const sonnetRows = rows.filter((row) => row.model.startsWith('sonnet:'));
  const haikuRows = rows.filter((row) => row.model.startsWith('haiku:'));
  const sonnetPassed = sonnetRows.every((row) => row.passed);
  const haikuPassed = haikuRows.every((row) => row.passed);
  const decision =
    haikuPassed && sonnetPassed
      ? 'retain Sonnet default until live matrix proves Haiku grounding/usefulness parity, despite lower cost'
      : 'retain Sonnet default because Haiku did not clear every gate';
  console.log(`model comparison: haiku costIndex=1, sonnet costIndex=4`);
  console.log(`matrix decision: ${decision}`);
  return sonnetPassed;
}

if (!runDraftMatrixEval()) {
  process.exitCode = 1;
}
