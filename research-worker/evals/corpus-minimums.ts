import { readFileSync } from 'fs';
import { resolve } from 'path';

import { validateDeepResearchMinimums } from '../src/runners/deep-research-program';

interface EvalSource {
  title: string;
  url: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readSourceArray(value: unknown): EvalSource[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const url = readString(item.url);
    if (url === null) {
      return [];
    }

    return [{
      title: readString(item.title) ?? url,
      url,
    }];
  });
}

function getCorpusData(input: Record<string, unknown>): Record<string, unknown> {
  return isRecord(input.data) ? input.data : input;
}

function getCitations(input: Record<string, unknown>): EvalSource[] {
  const data = getCorpusData(input);
  const corpus = isRecord(data.corpus) ? data.corpus : {};

  return [
    ...readSourceArray(input.sonarSources),
    ...readSourceArray(input.citations),
    ...readSourceArray(corpus.sources),
  ];
}

function main(): void {
  const fixturePath = resolve(
    process.argv[2] ?? 'evals/golden/perplexity-corpus-ramp.json',
  );
  const parsed = JSON.parse(readFileSync(fixturePath, 'utf8')) as unknown;

  if (!isRecord(parsed)) {
    throw new Error(`Corpus eval fixture must be a JSON object: ${fixturePath}`);
  }

  const report = validateDeepResearchMinimums(
    getCorpusData(parsed),
    getCitations(parsed),
  );

  console.log(JSON.stringify({
    evidenceCount: report.evidenceCount,
    errors: report.errors,
    fixturePath,
    passed: report.passed,
    sourceCount: report.sourceCount,
  }, null, 2));

  if (!report.passed) {
    process.exitCode = 1;
  }
}

main();
