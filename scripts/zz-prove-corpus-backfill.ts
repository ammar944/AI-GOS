import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { config as loadEnv } from 'dotenv';

import {
  backfillNullOnboardingFields,
  deepResearchCorpusSchema,
  normalizeTopCompetitorsValue,
  type DeepResearchCorpusOutput,
} from '../research-worker/src/runners/deep-research-program';

type OnboardingFields = DeepResearchCorpusOutput['onboardingFields'];
type OnboardingFieldName = keyof OnboardingFields;
type OnboardingFieldValue = OnboardingFields[OnboardingFieldName];
type Evidence = DeepResearchCorpusOutput['corpus']['evidence'][number];

interface CheckResult {
  detail: string;
  name: string;
  passed: boolean;
}

interface FieldView {
  confidence: number;
  reasoning: string;
  sourceUrl: string | null;
  value: string | null;
}

function normalizeUrl(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    url.hash = '';

    return url.toString();
  } catch {
    return null;
  }
}

function readFieldNames(fields: OnboardingFields): OnboardingFieldName[] {
  return Object.keys(fields) as OnboardingFieldName[];
}

function readFieldView(field: OnboardingFieldValue | undefined): FieldView | null {
  if (field === undefined) {
    return null;
  }

  return {
    confidence: field.confidence,
    reasoning: field.reasoning,
    sourceUrl: field.sourceUrl,
    value: field.value,
  };
}

function toFieldViewMap(fields: OnboardingFields): Record<string, FieldView | null> {
  return Object.fromEntries(
    readFieldNames(fields).map((fieldName) => [
      fieldName,
      readFieldView(fields[fieldName]),
    ]),
  );
}

function collectEvidence(parsed: DeepResearchCorpusOutput): Evidence[] {
  return [
    ...parsed.corpus.evidence,
    ...parsed.corpus.intelligenceTopics.flatMap((topic) => topic.evidence),
  ];
}

function buildSourceSet(parsed: DeepResearchCorpusOutput): Set<string> {
  return new Set(
    parsed.corpus.sources
      .map((source) => normalizeUrl(source.url))
      .filter((url): url is string => url !== null),
  );
}

function getChangedNullFields(
  before: DeepResearchCorpusOutput,
  after: DeepResearchCorpusOutput,
): OnboardingFieldName[] {
  return readFieldNames(before.onboardingFields).filter((fieldName) => {
    const beforeField = before.onboardingFields[fieldName];
    const afterField = after.onboardingFields[fieldName];

    return (
      beforeField !== undefined &&
      afterField !== undefined &&
      beforeField.value === null &&
      typeof afterField.value === 'string' &&
      afterField.value.trim().length > 0
    );
  });
}

function sourceChecks(
  after: DeepResearchCorpusOutput,
  changedFields: readonly OnboardingFieldName[],
): CheckResult {
  const sourceSet = buildSourceSet(after);
  const failures = changedFields.filter((fieldName) => {
    const sourceUrl = normalizeUrl(after.onboardingFields[fieldName]?.sourceUrl);

    return sourceUrl === null || !sourceSet.has(sourceUrl);
  });

  return {
    name: 'changed field sourceUrl in corpus.sources',
    passed: failures.length === 0,
    detail: failures.length === 0
      ? `${changedFields.length} changed fields cite corpus sources`
      : `invalid sourceUrl fields: ${failures.join(', ')}`,
  };
}

function evidenceMentionsName(name: string, evidence: readonly Evidence[]): boolean {
  const normalizedName = name.toLowerCase();

  return evidence.some((item) =>
    `${item.claim}\n${item.quote}`.toLowerCase().includes(normalizedName),
  );
}

function competitorEvidenceCheck(after: DeepResearchCorpusOutput): CheckResult {
  const value = after.onboardingFields.topCompetitors.value;
  if (typeof value !== 'string' || value.trim().length === 0) {
    return {
      name: 'topCompetitors names appear in evidence',
      passed: false,
      detail: 'topCompetitors is null or empty',
    };
  }

  const evidence = collectEvidence(after);
  const names = normalizeTopCompetitorsValue(value)
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
  const missing = names.filter((name) => !evidenceMentionsName(name, evidence));

  return {
    name: 'topCompetitors names appear in evidence',
    passed: missing.length === 0,
    detail: missing.length === 0
      ? names.join(', ')
      : `missing from claim/quote text: ${missing.join(', ')}`,
  };
}

function expectedCompetitorsCheck(after: DeepResearchCorpusOutput): CheckResult {
  const value = after.onboardingFields.topCompetitors.value ?? '';
  const normalizedNames = new Set(
    normalizeTopCompetitorsValue(value)
      .split(',')
      .map((name) => name.trim().toLowerCase())
      .filter((name) => name.length > 0),
  );
  const expected = ['notion', 'monday.com', 'clickup'];
  const missing = expected.filter((name) => !normalizedNames.has(name));

  return {
    name: 'expected competitor seeds recovered',
    passed: missing.length === 0,
    detail: missing.length === 0
      ? `topCompetitors=${value}`
      : `missing: ${missing.join(', ')}; topCompetitors=${value || '<null>'}`,
  };
}

function fieldFilledCheck(
  after: DeepResearchCorpusOutput,
  fieldName: OnboardingFieldName,
): CheckResult {
  const value = after.onboardingFields[fieldName]?.value;

  return {
    name: `${fieldName} filled`,
    passed: typeof value === 'string' && value.trim().length > 0,
    detail: typeof value === 'string' && value.trim().length > 0
      ? value
      : 'still null or empty',
  };
}

function fieldRemainsNullCheck(
  after: DeepResearchCorpusOutput,
  fieldName: OnboardingFieldName,
): CheckResult {
  const value = after.onboardingFields[fieldName]?.value;

  return {
    name: `${fieldName} remains honest null`,
    passed: value === null,
    detail: value === null ? 'null' : String(value),
  };
}

async function loadCorpus(corpusPath: string): Promise<DeepResearchCorpusOutput> {
  const raw = await readFile(corpusPath, 'utf8');
  const parsed = JSON.parse(raw) as unknown;

  return deepResearchCorpusSchema.parse(parsed);
}

async function main(): Promise<void> {
  const repoRoot = process.cwd();
  loadEnv({ path: path.join(repoRoot, 'research-worker', '.env'), override: false });
  loadEnv({ path: path.join(repoRoot, '.env.local'), override: false });

  const corpusPath = path.join(repoRoot, 'tmp', 'e2e-2026-06-10', 'deepResearchProgram.json');
  const before = await loadCorpus(corpusPath);

  console.log('=== corpus backfill proof ===');
  console.log(`corpusPath: ${corpusPath}`);
  console.log('provider: Perplexity sonar (research-worker package has no @ai-sdk/deepseek or @ai-sdk/openai-compatible dependency)');
  console.log(`PERPLEXITY_API_KEY present: ${process.env.PERPLEXITY_API_KEY ? 'yes' : 'no'}`);
  console.log('');
  console.log('=== BEFORE onboardingFields ===');
  console.log(JSON.stringify(toFieldViewMap(before.onboardingFields), null, 2));

  const after = await backfillNullOnboardingFields({ parsed: before });
  const changedFields = getChangedNullFields(before, after);

  console.log('');
  console.log('=== AFTER onboardingFields ===');
  console.log(JSON.stringify(toFieldViewMap(after.onboardingFields), null, 2));
  console.log('');
  console.log('=== CHANGED NULL FIELDS ===');
  console.log(changedFields.length > 0 ? changedFields.join(', ') : '<none>');

  const checks: CheckResult[] = [
    sourceChecks(after, changedFields),
    competitorEvidenceCheck(after),
    expectedCompetitorsCheck(after),
    fieldFilledCheck(after, 'pricingTiers'),
    fieldFilledCheck(after, 'headquartersLocation'),
    // companySize: evidence carries customer counts, not employee headcount —
    // honest null is the correct outcome for this corpus (proven 2026-06-10).
    fieldRemainsNullCheck(after, 'companySize'),
    fieldRemainsNullCheck(after, 'acv'),
    fieldRemainsNullCheck(after, 'monthlyAdBudget'),
  ];

  console.log('');
  console.log('=== DETERMINISTIC CHECKS ===');
  for (const check of checks) {
    console.log(`${check.passed ? 'PASS' : 'FAIL'} ${check.name}: ${check.detail}`);
  }

  if (checks.some((check) => !check.passed)) {
    process.exitCode = 1;
  }
}

void main().catch((error: unknown) => {
  console.error('proof script failed');
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
