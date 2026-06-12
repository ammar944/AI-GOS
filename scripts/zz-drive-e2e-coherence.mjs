#!/usr/bin/env node
// zz-drive-e2e-airtable.mjs
// Browser-driven, read-only-DB-polled E2E driver for the 2026-06-11 W5 gate.
// Writes only tmp/e2e-2026-06-11-w5/* screenshots/transcripts.
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const CDP_URL = process.env.E2E_CDP_URL ?? 'http://localhost:9222';
const TARGET_URL = 'https://airtable.com';
const OUT_DIR = join(process.cwd(), 'tmp', 'e2e-2026-06-11-coherence');

const CORPUS_TIMEOUT_MS = 10 * 60 * 1000;
const SECTIONS_TIMEOUT_MS = 35 * 60 * 1000;
const BRIEF_TIMEOUT_MS = 5 * 60 * 1000;

const CORPUS = 'deepResearchProgram';
const POSITIONING_SIX = [
  'positioningMarketCategory',
  'positioningBuyerICP',
  'positioningCompetitorLandscape',
  'positioningVoiceOfCustomer',
  'positioningDemandIntent',
  'positioningOfferDiagnostic',
];
const PAID_MEDIA = 'positioningPaidMediaPlan';
const EXPECTED_ZONES = [CORPUS, ...POSITIONING_SIX, PAID_MEDIA];

const SECTION_TEST_IDS = [
  'onboarding-section-product-revenue',
  'onboarding-section-icp-pain',
  'onboarding-section-offer-experience',
  'onboarding-section-pricing-economics',
  'onboarding-section-competition-positioning',
  'onboarding-section-goals-strategy',
  'onboarding-section-current-marketing',
  'onboarding-section-media-plan-setup',
];

const transcript = [];
let activePage = null;
let activeRunId = null;

function stamp() {
  return new Date().toISOString();
}

function log(message, detail = undefined) {
  const line = detail === undefined ? `[${stamp()}] ${message}` : `[${stamp()}] ${message} ${detail}`;
  transcript.push(line);
  console.log(line);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required env ${name}; refusing to start E2E`);
  }
  return value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(startedAt, timeoutMs, label) {
  const elapsedMs = Date.now() - startedAt;
  if (elapsedMs > timeoutMs) {
    throw new Error(`${label} timed out after ${timeoutMs}ms`);
  }
}

function bodyOf(section) {
  return section?.data?.body ?? section?.data ?? {};
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function walk(value, visit) {
  if (!isRecord(value) && !Array.isArray(value)) return;
  visit(value);
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit);
    return;
  }
  for (const item of Object.values(value)) walk(item, visit);
}

function hostnameOf(value) {
  if (typeof value !== 'string' || value.trim().length === 0) return 'missing';
  try {
    return new URL(value).hostname;
  } catch {
    return 'invalid-url';
  }
}

function countWords(value) {
  if (typeof value !== 'string') return 0;
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function safeJson(value) {
  return JSON.stringify(value, null, 2);
}

function extractRunId(url) {
  try {
    return new URL(url).searchParams.get('runId');
  } catch {
    return null;
  }
}

async function writeTranscript(name = 'driver-transcript.log') {
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(join(OUT_DIR, name), `${transcript.join('\n')}\n`, 'utf8');
}

async function assertCdpReady() {
  const response = await fetch(`${CDP_URL.replace(/\/$/, '')}/json/version`);
  if (!response.ok) {
    throw new Error(`CDP endpoint not ready: GET /json/version returned HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (!isRecord(payload) || typeof payload.Browser !== 'string') {
    throw new Error('CDP endpoint did not return Chrome version JSON');
  }
  log('CDP endpoint ready', `browser=${payload.Browser}`);
}

function buildSupabase() {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  log('Supabase env present', `urlLength=${url.length} serviceRoleLength=${key.length}`);
  return createClient(url, key, { auth: { persistSession: false } });
}

async function getJourneySession(supabase, runId) {
  const { data, error } = await supabase
    .from('journey_sessions')
    .select('id, run_id, phase, job_status, updated_at, onboarding_data')
    .eq('run_id', runId)
    .maybeSingle();
  if (error) throw new Error(`journey_sessions read failed for runId=${runId}: ${error.message}`);
  return data ?? null;
}

function getCorpusJob(session) {
  const raw = session?.job_status;
  if (!isRecord(raw)) return null;
  const jobs = Object.values(raw).filter(isRecord);
  return jobs.find((job) => job.tool === 'runDeepResearchProgram') ?? jobs[0] ?? null;
}

async function getArtifactBundle(supabase, runId) {
  const { data: artifactRows, error: artifactError } = await supabase
    .from('research_artifacts')
    .select('id, run_id, status, children_total, children_complete, profile_persisted_at, thesis, created_at, updated_at')
    .eq('run_id', runId);

  if (artifactError) {
    throw new Error(`research_artifacts read failed for runId=${runId}: ${artifactError.message}`);
  }
  const artifact = artifactRows?.[0] ?? null;
  if (!artifact) return { artifact: null, sections: [] };

  const { data: sectionRows, error: sectionError } = await supabase
    .from('research_artifact_sections')
    .select('zone, status, verification_tier, counts_toward_rollup, updated_at, error, data')
    .eq('artifact_id', artifact.id);
  if (sectionError) {
    throw new Error(`research_artifact_sections read failed for artifactId=${artifact.id}: ${sectionError.message}`);
  }

  return { artifact, sections: sectionRows ?? [] };
}

async function pollCorpusComplete(supabase, runId) {
  const startedAt = Date.now();
  let lastStatus = '';
  let loggedStart = false;

  while (true) {
    withTimeout(startedAt, CORPUS_TIMEOUT_MS, 'corpus poll');
    const session = await getJourneySession(supabase, runId);
    const job = getCorpusJob(session);
    const status = String(job?.status ?? 'missing');
    const phase = String(session?.phase ?? 'missing');
    const statusKey = `${status}|${phase}`;

    if (statusKey !== lastStatus) {
      log('Corpus poll', `status=${status} phase=${phase}`);
      lastStatus = statusKey;
    }
    if (!loggedStart && typeof job?.startedAt === 'string') {
      log('Corpus job started', job.startedAt);
      loggedStart = true;
    }
    if (status === 'error' || status === 'failed') {
      throw new Error(`Corpus failed for runId=${runId}: ${safeJson(job?.error ?? job)}`);
    }
    if (status === 'complete') {
      log('Corpus complete', `elapsedMs=${Date.now() - startedAt}`);
      return { session, job, elapsedMs: Date.now() - startedAt };
    }
    await sleep(5_000);
  }
}

async function pollSectionsComplete(supabase, runId) {
  const startedAt = Date.now();
  const logged = new Map();
  let parentLogged = false;

  while (true) {
    withTimeout(startedAt, SECTIONS_TIMEOUT_MS, 'sections poll');
    const { artifact, sections } = await getArtifactBundle(supabase, runId);
    if (!artifact) {
      await sleep(5_000);
      continue;
    }

    if (!parentLogged) {
      log('Artifact row found', `artifactId=${artifact.id} status=${artifact.status}`);
      parentLogged = true;
    }

    const byZone = new Map(sections.map((section) => [section.zone, section]));
    const errored = EXPECTED_ZONES.map((zone) => byZone.get(zone)).filter((section) => section?.status === 'error');
    if (errored.length > 0) {
      throw new Error(`Section row entered error: ${errored.map((section) => `${section.zone}:${safeJson(section.error ?? {})}`).join(' | ')}`);
    }

    for (const zone of EXPECTED_ZONES) {
      const section = byZone.get(zone);
      const status = String(section?.status ?? 'missing');
      if (logged.get(zone) !== status) {
        log('Section status', `${zone}=${status}${section?.updated_at ? ` updatedAt=${section.updated_at}` : ''}`);
        logged.set(zone, status);
      }
    }

    const complete = EXPECTED_ZONES.filter((zone) => byZone.get(zone)?.status === 'complete');
    if (complete.length === EXPECTED_ZONES.length) {
      log('All expected zones complete', `elapsedMs=${Date.now() - startedAt}`);
      return { artifact, sections, elapsedMs: Date.now() - startedAt };
    }

    await sleep(10_000);
  }
}

async function pollExecutiveBrief(supabase, artifactId) {
  const startedAt = Date.now();
  let lastStatus = '';

  while (Date.now() - startedAt <= BRIEF_TIMEOUT_MS) {
    const { data, error } = await supabase
      .from('research_artifacts')
      .select('id, run_id, thesis, updated_at')
      .eq('id', artifactId)
      .maybeSingle();
    if (error) throw new Error(`research_artifacts thesis read failed for artifactId=${artifactId}: ${error.message}`);

    const thesis = data?.thesis ?? null;
    const status = isRecord(thesis) ? String(thesis.status ?? 'present') : 'null';
    if (status !== lastStatus) {
      log('Executive brief poll', `status=${status}`);
      lastStatus = status;
    }

    if (isRecord(thesis) && status === 'complete') {
      log('Executive brief complete', `elapsedMs=${Date.now() - startedAt}`);
      return { thesis, elapsedMs: Date.now() - startedAt, warning: null };
    }
    if (isRecord(thesis) && status === 'error') {
      const warning = `Executive brief wrote error thesis after ${Date.now() - startedAt}ms`;
      log('WARN', warning);
      return { thesis, elapsedMs: Date.now() - startedAt, warning };
    }

    await sleep(5_000);
  }

  const warning = `Executive brief was not complete after ${BRIEF_TIMEOUT_MS}ms`;
  log('WARN', warning);
  const { data } = await supabase
    .from('research_artifacts')
    .select('thesis')
    .eq('id', artifactId)
    .maybeSingle();
  return { thesis: data?.thesis ?? null, elapsedMs: Date.now() - startedAt, warning };
}

async function waitForRunId(page) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 30_000) {
    const runId = extractRunId(page.url());
    if (runId) {
      activeRunId = runId;
      log('runId captured', runId);
      return runId;
    }
    await sleep(250);
  }
  throw new Error(`Timed out waiting for runId in URL; currentUrl=${page.url()}`);
}

async function findResearchPage(browser) {
  const context = browser.contexts()[0];
  if (!context) {
    throw new Error('No default Chrome context found over CDP; refusing to use incognito/new context');
  }
  const existing = context.pages().find((page) => page.url().includes('/research-v3'));
  return existing ?? (await context.newPage());
}

async function assertLoggedInResearchForm(page) {
  await page.goto(`${BASE_URL}/research-v3`, { waitUntil: 'domcontentloaded' });
  const companyUrl = page.getByLabel('Company URL', { exact: true });
  try {
    await companyUrl.waitFor({ state: 'visible', timeout: 20_000 });
  } catch (error) {
    throw new Error(`Authenticated /research-v3 form not visible. currentUrl=${page.url()}. Sign into Clerk in the CDP Chrome window first.`);
  }
}

async function dismissResumeIfPresent(page) {
  const dismiss = page.getByRole('button', { name: 'Dismiss' });
  if ((await dismiss.count()) > 0) {
    await dismiss.first().click();
    log('Dismissed stale resume prompt');
  }
}

async function fillByLabel(page, label, value) {
  const exactControl = page.getByLabel(label, { exact: true });
  const control = (await exactControl.count()) > 0
    ? exactControl
    : page.getByLabel(label, { exact: false });
  await control.scrollIntoViewIfNeeded();
  await control.fill(value);
  log('Filled field', label);
}

async function clickOption(page, fieldKey, role, name) {
  const field = page.getByTestId(`onboarding-field-${fieldKey}`);
  await field.scrollIntoViewIfNeeded();
  const option = field.getByRole(role, { name });
  if (role === 'checkbox') {
    const checked = await option.getAttribute('aria-checked');
    if (checked !== 'true') await option.click();
  } else {
    await option.click();
  }
  log('Selected option', `${fieldKey}=${name}`);
}

async function continueToStep(page, nextStepIndex) {
  await page.getByRole('button', { name: 'Continue' }).click();
  const nextTestId = SECTION_TEST_IDS[nextStepIndex];
  try {
    await page.getByTestId(nextTestId).waitFor({ state: 'visible', timeout: 8_000 });
  } catch (error) {
    const stillRequired = await page.getByTestId('onboarding-still-required').textContent().catch(() => '');
    const alerts = await page.locator('[role="alert"]').allTextContents().catch(() => []);
    throw new Error(`Wizard did not advance to ${nextTestId}. stillRequired=${JSON.stringify(stillRequired)} alerts=${JSON.stringify(alerts)}`);
  }
}

async function fillWizard(page) {
  await page.getByTestId(SECTION_TEST_IDS[0]).waitFor({ state: 'visible', timeout: 120_000 });
  log('Wizard visible');

  await fillByLabel(page, 'Who is it built for?', 'Cross-functional teams at mid-market & enterprise: ops, marketing, product, PM.');
  await clickOption(page, 'salesMotion', 'radio', 'Hybrid');
  await clickOption(page, 'pricingModel', 'radio', 'Per seat');
  await clickOption(page, 'conversionPath', 'radio', 'Free trial');
  await clickOption(page, 'acv', 'radio', /\$1K.*\$10K/);
  await continueToStep(page, 1);

  await fillByLabel(page, 'What are they currently using instead?', 'Google Sheets/Excel, Notion, legacy PM tools (Asana/Jira).');
  await clickOption(page, 'awarenessLevel', 'radio', 'Solution-aware');
  await continueToStep(page, 2);

  await fillByLabel(page, 'What is the first "value moment" users experience?', 'Turn a spreadsheet into a linked base in minutes.');
  await fillByLabel(page, 'What action defines an activated user?', 'Invite a teammate + first automation runs.');
  await fillByLabel(page, 'What keeps your best customers using the product?', "Becomes the team's shared system of record.");
  await continueToStep(page, 3);

  await fillByLabel(page, "What is your target customer's typical plan?", 'Business plan');
  await fillByLabel(page, 'Average LTV', '$18,000');
  await fillByLabel(page, 'Target CAC', '$3,000');
  await fillByLabel(page, 'Monthly ad budget (or planned budget)', '$25,000/month');
  await continueToStep(page, 4);

  await fillByLabel(page, 'Who are your top competitors (minimum 3)?', 'Notion, monday.com, ClickUp, Smartsheet, Coda');
  await fillByLabel(page, 'In deals you lose, what do prospects say before choosing a competitor?', 'Lose on perceived complexity vs Notion; price vs Sheets.');
  await fillByLabel(page, 'What do competitors do better than you?', 'Competitors win on brand familiarity and bundled docs.');
  await continueToStep(page, 5);

  await fillByLabel(page, 'What is your primary goal in the next 90 days?', 'Qualified Business-plan trials from ops/PM teams.');
  await fillByLabel(page, 'Monthly pipeline target ($ or # of demos)', '$400K pipeline / ~120 trials/mo');
  await continueToStep(page, 6);

  await clickOption(page, 'channels', 'checkbox', 'Meta');
  await clickOption(page, 'channels', 'checkbox', 'Google');
  await clickOption(page, 'channels', 'checkbox', 'LinkedIn');
  await clickOption(page, 'channels', 'checkbox', 'Organic');
  await fillByLabel(page, 'Budget split per channel', '60% Google, 25% Meta, 15% LinkedIn');
  await fillByLabel(page, "What's working right now?", 'Branded search converts.');
  await fillByLabel(page, "What's not working?", 'Cold Meta CPL too high.');
  await fillByLabel(page, 'Current CAC', '$4,200');
  await fillByLabel(page, 'Monthly revenue (MRR or ARR)', '$12M MRR');
  await continueToStep(page, 7);

  await clickOption(page, 'creativeCapacity', 'radio', 'Standard (5 static + 5 video)');
  await clickOption(page, 'leadListAvailable', 'radio', 'No');
  log('Wizard fill complete');
}

async function clickRunAudit(page) {
  await page.getByRole('button', { name: 'Run audit' }).click();
  log('Clicked Run audit');
  await page.getByTestId('audit-reader-shell').waitFor({ state: 'visible', timeout: 60_000 }).catch(() => {
    log('WARN', 'audit-reader-shell was not visible within 60s; continuing with DB polling');
  });
}

async function saveScreenshots(page, runId, briefComplete) {
  await mkdir(OUT_DIR, { recursive: true });
  await page.goto(`${BASE_URL}/research-v3?runId=${encodeURIComponent(runId)}`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('audit-reader-shell').waitFor({ state: 'visible', timeout: 45_000 }).catch(() => {
    log('WARN', 'audit-reader-shell not visible before screenshots');
  });

  await page.screenshot({
    path: join(OUT_DIR, 'audit-reader-full.png'),
    fullPage: true,
    timeout: 30_000,
  }).catch(async (error) => {
    log('WARN', `full-page screenshot failed: ${error.message}`);
    await page.screenshot({ path: join(OUT_DIR, 'audit-reader-viewport.png'), timeout: 30_000 });
  });

  const brief = page.getByLabel('Executive brief');
  if (briefComplete) {
    await brief.waitFor({ state: 'visible', timeout: 60_000 }).catch((error) => {
      log('WARN', `ExecutiveBriefCard not visible for screenshot: ${error.message}`);
    });
  }
  if ((await brief.count()) > 0) {
    await brief.first().screenshot({ path: join(OUT_DIR, 'executive-brief-card.png'), timeout: 30_000 });
    log('Screenshot saved', 'executive-brief-card.png');
  } else {
    log('WARN', 'ExecutiveBriefCard screenshot skipped because card was not visible');
  }

  await page.goto(`${BASE_URL}/research-v3?runId=${encodeURIComponent(runId)}&section=positioningCompetitorLandscape`, {
    waitUntil: 'domcontentloaded',
  });
  await page.getByTestId('audit-reader-shell').waitFor({ state: 'visible', timeout: 45_000 }).catch(() => {
    log('WARN', 'competitor reader shell not visible before screenshot');
  });
  const article = page.locator('[data-testid="audit-reader-shell"] main article');
  if ((await article.count()) > 0) {
    await article.first().screenshot({ path: join(OUT_DIR, 'competitor-landscape-card.png'), timeout: 30_000 });
  } else {
    await page.screenshot({ path: join(OUT_DIR, 'competitor-landscape-page.png'), fullPage: true, timeout: 30_000 });
  }
  log('Screenshot saved', 'competitor-landscape-card.png');
}

function collectQuoteUrls(vocBody) {
  const urls = [];
  walk(vocBody, (value) => {
    if (!isRecord(value)) return;
    for (const [key, items] of Object.entries(value)) {
      if (key !== 'quotes' || !Array.isArray(items)) continue;
      for (const item of items) {
        if (isRecord(item) && typeof item.sourceUrl === 'string') urls.push(item.sourceUrl);
      }
    }
  });
  return urls;
}

function countMatchedToolClaims(data, toolNames) {
  let count = 0;
  walk(data, (value) => {
    if (!isRecord(value)) return;
    const toolName = value.matchedSourceRef;
    if (isRecord(toolName) && typeof toolName.toolName === 'string' && toolNames.has(toolName.toolName)) {
      count += 1;
    }
  });
  return count;
}

function extractSpotFacts({ artifact, sections, thesis }) {
  const byZone = new Map(sections.map((section) => [section.zone, section]));
  const vocBody = bodyOf(byZone.get('positioningVoiceOfCustomer'));
  const buyerBody = bodyOf(byZone.get('positioningBuyerICP'));
  const demand = byZone.get('positioningDemandIntent')?.data ?? null;
  const competitor = byZone.get('positioningCompetitorLandscape')?.data ?? null;
  const competitorBody = bodyOf(byZone.get('positioningCompetitorLandscape'));

  const reviewPermalinkPattern = /(g2\.com\/products\/[^/]+\/reviews\/[^/]+-review-\d+|g2\.com\/survey_responses\/|capterra\.com\/p\/\d+\/[^/]+\/reviews\/\d+|trustpilot\.com\/reviews\/[0-9a-f]+)/i;
  const quoteUrls = collectQuoteUrls(vocBody);
  const reviewPermalinkCount = quoteUrls.filter((url) => reviewPermalinkPattern.test(url)).length;

  const personas = Array.isArray(buyerBody?.personaReality?.personas)
    ? buyerBody.personaReality.personas
    : [];

  const keywordVolumeClaims = countMatchedToolClaims(demand, new Set(['keyword_volume']));
  const demandString = JSON.stringify(demand ?? {});
  const spyFuEstimatedRows = (demandString.match(/\(SpyFu-estimated\)/g) ?? []).length;
  const volumeUnavailableRows = (demandString.match(/volume unavailable/gi) ?? []).length;

  const adToolClaims = countMatchedToolClaims(
    competitor,
    new Set(['meta_ads', 'google_ads', 'adlibrary', 'ad_evidence_wall_digest']),
  );
  const advertiserGroups = Array.isArray(competitorBody?.adEvidence?.advertiserGroups)
    ? competitorBody.adEvidence.advertiserGroups
    : [];
  const displayableTotal = advertiserGroups.reduce(
    (sum, group) => sum + (Number(group?.displayableTotal) || 0),
    0,
  );

  const factConflicts = isRecord(thesis) && Array.isArray(thesis.factConflicts) ? thesis.factConflicts : [];
  const resolvedConflictCount = factConflicts.filter(
    (conflict) => isRecord(conflict) && typeof conflict.resolution === 'string' && conflict.resolution.trim().length > 0,
  ).length;

  return {
    artifactId: artifact.id,
    voc: {
      quoteSourceUrlsTotal: quoteUrls.length,
      quoteReviewPermalinkMatches: reviewPermalinkCount,
    },
    buyerICP: {
      personaCount: personas.length,
      personaSourceHosts: personas.map((persona) => hostnameOf(persona?.sourceUrl)),
    },
    demandIntent: {
      spyFuEstimatedRows,
      volumeUnavailableRows,
      keywordVolumeMatchedClaims: keywordVolumeClaims,
    },
    competitor: {
      adToolMatchedClaims: adToolClaims,
      advertiserGroups: advertiserGroups.length,
      displayableTotal,
    },
    thesis: {
      nonNull: isRecord(thesis),
      status: isRecord(thesis) ? thesis.status ?? null : null,
      executiveThesisWordCount: isRecord(thesis) ? countWords(thesis.executiveThesis) : 0,
      factConflicts: factConflicts.length,
      resolvedFactConflicts: resolvedConflictCount,
    },
  };
}

async function writeSummary(summary) {
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(join(OUT_DIR, 'driver-summary.json'), `${safeJson(summary)}\n`, 'utf8');
  await writeTranscript();
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await assertCdpReady();
  const supabase = buildSupabase();

  const browser = await chromium.connectOverCDP(CDP_URL);
  const page = await findResearchPage(browser);
  activePage = page;
  page.setDefaultTimeout(30_000);

  await assertLoggedInResearchForm(page);
  await dismissResumeIfPresent(page);
  await page.getByLabel('Company URL', { exact: true }).fill(TARGET_URL);
  log('Filled Company URL', TARGET_URL);
  await page.getByRole('button', { name: /Start research/i }).click();
  log('Clicked Start research');

  const runId = await waitForRunId(page);
  const corpus = await pollCorpusComplete(supabase, runId);
  await fillWizard(page);
  await clickRunAudit(page);

  const sectionResult = await pollSectionsComplete(supabase, runId);
  const briefResult = await pollExecutiveBrief(supabase, sectionResult.artifact.id);
  const briefComplete = isRecord(briefResult.thesis) && briefResult.thesis.status === 'complete';

  await saveScreenshots(page, runId, briefComplete);

  const spotFacts = extractSpotFacts({
    artifact: sectionResult.artifact,
    sections: sectionResult.sections,
    thesis: briefResult.thesis,
  });

  const summary = {
    status: 'complete',
    runId,
    artifactId: sectionResult.artifact.id,
    collectedAt: stamp(),
    durationsMs: {
      corpus: corpus.elapsedMs,
      sections: sectionResult.elapsedMs,
      executiveBrief: briefResult.elapsedMs,
    },
    briefWarning: briefResult.warning,
    spotFacts,
    outDir: OUT_DIR,
  };
  await writeSummary(summary);
  log('Driver complete', `runId=${runId}`);
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.message : String(error);
  log('ABORT', message);
  await mkdir(OUT_DIR, { recursive: true });
  if (activePage) {
    await activePage.screenshot({
      path: join(OUT_DIR, 'abort-page.png'),
      fullPage: true,
      timeout: 30_000,
    }).catch((screenshotError) => {
      log('WARN', `abort screenshot failed: ${screenshotError.message}`);
    });
  }
  await writeSummary({
    status: 'aborted',
    runId: activeRunId,
    error: message,
    collectedAt: stamp(),
    outDir: OUT_DIR,
  });
  process.exitCode = 1;
});
