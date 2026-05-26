import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';

import dotenv from 'dotenv';
import { register } from 'tsconfig-paths';

import {
  runDeepResearchProgram,
  validateDeepResearchMinimums,
} from '../src/runners/deep-research-program';

interface ProofSource {
  title: string;
  url: string;
}

const workerRoot = resolve(__dirname, '..');
const appRoot = resolve(workerRoot, '..');

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function loadEnvFiles(): void {
  [
    resolve(appRoot, '.env'),
    resolve(appRoot, '.env.local'),
    resolve(workerRoot, '.env'),
    resolve(workerRoot, '.env.local'),
  ].forEach((path) => {
    dotenv.config({ path, override: false, quiet: true });
  });
}

function registerAppAliases(): void {
  register({
    baseUrl: appRoot,
    paths: {
      '@/*': ['src/*'],
    },
  });
}

function slugFromUrl(url: string): string {
  return new URL(url).hostname
    .replace(/^www\./, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function getCompanyName(url: string): string {
  const slug = slugFromUrl(url);

  return slug
    .split('-')
    .filter((part) => part.length > 0)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function getCitations(result: {
  citations?: Array<{ title?: string; url: string }>;
}): ProofSource[] {
  return (result.citations ?? []).flatMap((citation) => {
    const url = readString(citation.url);

    if (url === null) {
      return [];
    }

    return [{
      title: readString(citation.title) ?? url,
      url,
    }];
  });
}

function assertRequiredEnv(): void {
  if (!process.env.PERPLEXITY_API_KEY) {
    throw new Error('PERPLEXITY_API_KEY is missing; live sonar corpus proof cannot run.');
  }
}

async function main(): Promise<void> {
  loadEnvFiles();
  registerAppAliases();
  assertRequiredEnv();
  const { researchInputSchema } = await import(
    '../../src/lib/lab-engine/artifacts/artifact-envelope'
  );
  const { corpusToResearchInput } = await import(
    '../../src/lib/research-v2/corpus-to-research-input'
  );

  const url = process.argv[2] ?? 'https://ramp.com';
  const companyName = getCompanyName(url);
  const runId = `live_sonar_${slugFromUrl(url)}_${Date.now()}`;
  const result = await runDeepResearchProgram(
    [
      `Website: ${url}`,
      `Company Name: ${companyName}`,
      'Primary Goal: Build the shared cited corpus for AI-GOS v3 onboarding.',
    ].join('\n'),
    (update) => {
      if (update.phase === 'runner' || update.phase === 'analysis') {
        console.log(`[${update.phase}] ${update.message}`);
      }
    },
  );

  if (result.status !== 'complete' || !isRecord(result.data)) {
    throw new Error(`Live sonar corpus failed: ${result.error ?? result.status}`);
  }

  const citations = getCitations(result);
  const minimums = validateDeepResearchMinimums(result.data, citations);
  const researchInput = corpusToResearchInput({
    runId,
    deepResearchProgramData: result.data,
    onboardingData: {
      websiteUrl: url,
    },
  });
  researchInputSchema.parse(researchInput);

  const outputPath = resolve(
    workerRoot,
    `evals/out/live-sonar-corpus-${slugFromUrl(url)}.json`,
  );
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(
    outputPath,
    JSON.stringify({
      citations,
      data: result.data,
      durationMs: result.durationMs,
      minimums,
      outputPath,
      researchInputParsed: true,
      runId,
      telemetry: result.telemetry,
      url,
    }, null, 2),
  );

  console.log(JSON.stringify({
    durationMs: result.durationMs,
    evidenceCount: minimums.evidenceCount,
    outputPath,
    passed: minimums.passed,
    researchInputParsed: true,
    sourceCount: minimums.sourceCount,
    url,
  }, null, 2));

  if (!minimums.passed) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
