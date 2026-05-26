#!/usr/bin/env tsx
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { chromium, type Locator, type Page } from '@playwright/test';

import type { AuditStateResponse } from '../src/app/api/research-v2/audit-state/route';
import {
  buildSoakPlan,
  evaluateRunEvidence,
  serializeSoakRecord,
  type RunEvidenceInput,
  type RunEvidenceResult,
  type SoakPlanInput,
  type SoakRecord,
} from '../src/lib/research-v3/soak-harness';

interface HarnessOptions extends SoakPlanInput {
  baseUrl: string;
  outputPath: string;
  userDataDir: string;
  runTimeoutMs: number;
  dryRun: boolean;
  headless: boolean;
}

interface FetchResult {
  ok: boolean;
  status: number;
  body: unknown;
}

const DEFAULT_URLS = [
  'https://ramp.com',
  'https://vanta.com',
  'https://webflow.com',
] as const;

function readStringFlag(
  args: string[],
  name: string,
  fallback: string,
): string {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const value = args[index + 1];
  if (!value) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

function readNumberFlag(args: string[], name: string, fallback: number): number {
  const raw = readStringFlag(args, name, String(fallback));
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number; received ${raw}`);
  }
  return value;
}

function parseOptions(args: string[]): HarnessOptions {
  const urls = readStringFlag(args, '--urls', DEFAULT_URLS.join(','))
    .split(',')
    .map((url) => url.trim())
    .filter((url) => url.length > 0);

  return {
    baseUrl: readStringFlag(args, '--base-url', 'http://localhost:3000'),
    urls,
    maxRuns: readNumberFlag(args, '--max-runs', 2),
    maxEstimatedCostUsd: readNumberFlag(args, '--max-cost-usd', 0.25),
    estimatedCostPerRunUsd: readNumberFlag(args, '--estimated-cost-usd', 0.1),
    intervalMs: readNumberFlag(args, '--interval-ms', 30 * 60 * 1000),
    startedAt: new Date().toISOString(),
    outputPath: readStringFlag(
      args,
      '--out',
      '/tmp/aigos-v3-soak/v3-soak.ndjson',
    ),
    userDataDir: readStringFlag(
      args,
      '--user-data-dir',
      '.playwright-v3-soak-user',
    ),
    runTimeoutMs: readNumberFlag(args, '--run-timeout-ms', 30 * 60 * 1000),
    dryRun: args.includes('--dry-run'),
    headless: !args.includes('--headful'),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function extractRunIdFromUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.searchParams.get('runId');
  } catch {
    return null;
  }
}

async function waitForRunId(page: Page, timeoutMs: number): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const runId = extractRunIdFromUrl(page.url());
    if (runId) return runId;
    await sleep(250);
  }

  throw new Error(`Timed out waiting ${timeoutMs}ms for runId in /research-v3 URL`);
}

async function fillOnboardingFallbacks(page: Page): Promise<void> {
  const textControls = page.locator('input[type="text"]:not([disabled]), textarea:not([disabled])');
  const textCount = await textControls.count();
  for (let index = 0; index < textCount; index += 1) {
    const control = textControls.nth(index);
    const value = await control.inputValue().catch(() => '');
    if (value.trim().length === 0) {
      await control.fill(await getFallbackValueForControl(control, index));
    }
  }

  const fields = page.locator('[data-testid^="onboarding-field-"]');
  const fieldCount = await fields.count();
  for (let index = 0; index < fieldCount; index += 1) {
    const field = fields.nth(index);
    const radios = field.locator('[role="radio"]');
    if ((await radios.count()) > 0) {
      const checked = field.locator('[role="radio"][aria-checked="true"]');
      if ((await checked.count()) === 0) {
        await radios.first().click();
      }
    }

    const checkboxes = field.locator('[role="checkbox"]');
    if ((await checkboxes.count()) > 0) {
      const checked = field.locator('[role="checkbox"][aria-checked="true"]');
      if ((await checked.count()) === 0) {
        await checkboxes.first().click();
      }
    }
  }
}

async function getFallbackValueForControl(
  control: Locator,
  index: number,
): Promise<string> {
  const [label, placeholder] = await Promise.all([
    control.getAttribute('aria-label'),
    control.getAttribute('placeholder'),
  ]);
  const descriptor = `${label ?? ''} ${placeholder ?? ''}`;
  if (/url|loom|docs\.google/i.test(descriptor)) {
    return `https://example.org/soak-${index + 1}`;
  }
  return `Soak fallback ${index + 1}`;
}

async function completeOnboardingIfPresent(page: Page): Promise<void> {
  const runAudit = page.getByRole('button', { name: /run audit/i });
  if (!(await runAudit.isVisible({ timeout: 1_000 }).catch(() => false))) {
    return;
  }

  await runAudit.click();
  await page.waitForTimeout(1_000);
  if (await runAudit.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await fillOnboardingFallbacks(page);
    await runAudit.click();
  }
}

async function advanceToReader(page: Page, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  const tablist = page.getByRole('tablist', { name: /sections/i });
  const runAudit = page.getByRole('button', { name: /run audit/i });

  while (Date.now() < deadline) {
    if (await tablist.isVisible({ timeout: 1_000 }).catch(() => false)) {
      return;
    }

    if (await runAudit.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await completeOnboardingIfPresent(page);
      continue;
    }

    await sleep(1_000);
  }

  throw new Error(
    `Timed out after ${timeoutMs}ms waiting for onboarding or sections reader`,
  );
}

async function readAuditState(
  page: Page,
  runId: string,
): Promise<AuditStateResponse> {
  const result = (await page.evaluate(async (activeRunId) => {
    const response = await fetch(
      `/api/research-v2/audit-state?run_id=${encodeURIComponent(activeRunId)}`,
      { credentials: 'same-origin' },
    );
    return {
      ok: response.ok,
      status: response.status,
      body: await response.json(),
    };
  }, runId)) as FetchResult;

  if (!result.ok) {
    throw new Error(
      `audit-state read failed for runId=${runId} status=${result.status}`,
    );
  }

  return result.body as AuditStateResponse;
}

async function readErrorBoundaryText(page: Page): Promise<string | null> {
  const bodyText = await page.locator('body').textContent({ timeout: 1_000 });
  if (!bodyText) return null;
  const normalized = bodyText.replace(/\s+/g, ' ').trim();
  if (/application error|something went wrong|error boundary/i.test(normalized)) {
    return normalized.slice(0, 500);
  }
  return null;
}

function toRunEvidenceInput(
  runId: string,
  auditState: AuditStateResponse,
  errorBoundaryText: string | null,
): RunEvidenceInput {
  return {
    runId,
    childrenComplete: auditState.children_complete,
    childrenTotal: auditState.children_total,
    workerStates: auditState.workerStates.map((worker) => ({
      sectionId: worker.section_id,
      status: worker.status,
    })),
    sectionsByZone: auditState.sectionsByZone,
    errorBoundaryText,
  };
}

function isPendingOnlyFailure(failure: string): boolean {
  return (
    failure.startsWith('Only ') ||
    failure === 'Paid media terminal section is not complete'
  );
}

function isCompleteEvidence(input: RunEvidenceInput): boolean {
  return (
    input.childrenComplete >= 6 &&
    (input.sectionsByZone.positioningPaidMediaPlan !== undefined ||
      input.workerStates.some(
        (worker) =>
          worker.sectionId === 'positioningPaidMediaPlan' &&
          worker.status === 'complete',
      ))
  );
}

async function waitForFinalEvidence(
  page: Page,
  runId: string,
  timeoutMs: number,
): Promise<RunEvidenceResult> {
  const deadline = Date.now() + timeoutMs;
  let latestResult: RunEvidenceResult = {
    status: 'failed',
    failures: [`No audit-state sample captured for runId=${runId}`],
  };

  while (Date.now() < deadline) {
    const auditState = await readAuditState(page, runId);
    const errorBoundaryText = await readErrorBoundaryText(page);
    const evidence = toRunEvidenceInput(runId, auditState, errorBoundaryText);
    latestResult = evaluateRunEvidence(evidence);
    const hardFailures = latestResult.failures.filter(
      (failure) => !isPendingOnlyFailure(failure),
    );

    if (hardFailures.length > 0 || isCompleteEvidence(evidence)) {
      return latestResult;
    }

    await sleep(5_000);
  }

  return {
    status: 'failed',
    failures: [
      `Timed out after ${timeoutMs}ms before 6/6 + paid media completed`,
      ...latestResult.failures,
    ],
  };
}

async function runOneSoakCycle(
  page: Page,
  baseUrl: string,
  url: string,
  timeoutMs: number,
  estimatedCostUsd: number,
): Promise<SoakRecord> {
  const startedAt = new Date().toISOString();
  await page.goto(`${baseUrl.replace(/\/$/, '')}/research-v3`, {
    waitUntil: 'domcontentloaded',
  });
  await page.getByLabel(/company url/i).fill(url);
  await page.getByRole('button', { name: /start research/i }).click();

  const runId = await waitForRunId(page, 30_000);
  await advanceToReader(page, timeoutMs);

  const result = await waitForFinalEvidence(page, runId, timeoutMs);
  return {
    runId,
    url,
    status: result.status,
    failures: result.failures,
    startedAt,
    completedAt: new Date().toISOString(),
    estimatedCostUsd,
  };
}

async function appendRecord(path: string, record: SoakRecord): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, serializeSoakRecord(record), 'utf8');
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const plan = buildSoakPlan(options);

  if (options.dryRun) {
    console.log(JSON.stringify({ mode: 'dry-run', plan }, null, 2));
    return;
  }

  const context = await chromium.launchPersistentContext(options.userDataDir, {
    headless: options.headless,
  });
  const page = context.pages()[0] ?? (await context.newPage());

  try {
    for (const run of plan.runs) {
      const waitMs = Math.max(0, Date.parse(run.scheduledAt) - Date.now());
      if (waitMs > 0) await sleep(waitMs);

      const record = await runOneSoakCycle(
        page,
        options.baseUrl,
        run.url,
        options.runTimeoutMs,
        run.estimatedCostUsd,
      );
      await appendRecord(options.outputPath, record);
      console.log(JSON.stringify(record));

      if (record.status === 'failed') {
        throw new Error(
          `Stopping soak after first hard regression for runId=${record.runId}: ${record.failures.join('; ')}`,
        );
      }
    }
  } finally {
    await context.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
