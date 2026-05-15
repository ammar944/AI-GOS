import { DRAFT_EVAL_FIXTURES } from './draft-eval-fixtures';
import {
  makeFixtureDraft,
  printRows,
  scoreDraftQuality,
  type EvalRow,
} from './draft-eval-utils';

const SECTION_ID = 'positioningMarketCategory';
const QUALITY_PASS_SCORE = 85;

export function runDraftQualityEval(): boolean {
  const rows: EvalRow[] = DRAFT_EVAL_FIXTURES.map((fixture) => {
    const draft = makeFixtureDraft(fixture, SECTION_ID);
    const qualityScore = scoreDraftQuality(draft);
    return {
      fixture: fixture.company,
      model: 'fixture-draft',
      firstPartialMs: 0,
      finalObjectMs: 0,
      commitMs: 0,
      allSixMs: 0,
      qualityScore,
      passed: qualityScore >= QUALITY_PASS_SCORE,
    };
  });

  printRows('Draft Quality Eval', rows);
  const passed = rows.every((row) => row.passed);
  console.log(`quality verdict: ${passed ? 'PASS' : 'FAIL'}`);
  return passed;
}

if (!runDraftQualityEval()) {
  process.exitCode = 1;
}
