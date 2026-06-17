#!/usr/bin/env node
// zz-judge-run.mjs — the quality bar: an LLM value-read over a persisted run.
//
// CANONICAL JUDGE = a LOCAL agent (Codex or Claude Code), never an API model.
// Judging is done by the agent that is already running locally — strongest
// reasoning available, no API key, never billed. This script is just the
// deterministic ($0) plumbing around that agent:
//
//   1. GATHER (default)  : DB -> tmp/judge/<slug>/{bundle.json,prompt.txt}
//   2. JUDGE             : a local Codex/Claude Code agent reads prompt.txt and
//                          writes its verdict to tmp/judge/<slug>/verdict.json
//   3. GATE  (--gate)    : read verdict.json, exit 0 (>= threshold, no fab) / 2
//
// The verdict the agent must emit is verdictSchema below (printed by --print-schema).
//
// Usage:
//   node scripts/zz-judge-run.mjs <run_id>            # 1. GATHER (default, $0, no key)
//   node scripts/zz-judge-run.mjs <run_id> --gate     # 3. GATE on the agent's verdict.json
//   node scripts/zz-judge-run.mjs --print-schema       # the verdict shape the agent must write
//   node scripts/zz-judge-run.mjs <run_id> --provider deepseek   # ESCAPE HATCH (non-canonical
//        API judge for headless CI without an agent; owner rule: judging is normally local)
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { generateText, Output } from 'ai';
import { z } from 'zod';

// True only when this file is the process entrypoint, false when imported (e.g.
// by zz-release-gate.mjs reusing judgeGatePasses, or by the unit test). Keeps the
// exported predicate importable without booting the Supabase-reading gather().
const IS_CLI = (() => {
  try {
    return Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();

const argv = process.argv.slice(2);
const positional = argv.filter((a) => !a.startsWith('--'));
const RUN_ID = positional[0];
const GATE = argv.includes('--gate');
const PRINT_SCHEMA = argv.includes('--print-schema');
const PROVIDER = flagValue('--provider'); // unset => canonical local-agent path (no API call)
const WRITE_JSON = argv.includes('--json');
const BUNDLE_DIR = flagValue('--bundle'); // offline: gather from a zz-dump-run-sections.mjs bundle dir (no DB)
const THRESHOLD = Number(flagValue('--threshold') ?? '8');
const DEFAULT_MODEL = PROVIDER === 'deepseek' ? 'deepseek-v4-flash' : 'claude-opus-4-5';
const MODEL_ID = flagValue('--model') ?? process.env.JUDGE_MODEL ?? DEFAULT_MODEL;

function flagValue(name) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined;
}

export const verdictSchema = z.object({
  overallScore: z.number().describe('Holistic value score 1-10. 8+ = the ship bar (a serious buyer would pay and act on it); 9-10 = exceptional, best-in-class.'),
  wouldPay: z.enum(['yes', 'no', 'with-caveats']).describe('Would a serious $500 GTM buyer pay for this as-is?'),
  oneLineVerdict: z.string().describe('One sentence the buyer would say out loud.'),
  mediaPlanNumericallyCoherent: z
    .boolean()
    .describe('TRUE only if the media plan is numerically coherent: per-move/phase budget sub-totals SUM to the stated monthly total (no double-count), CAC units are correct (free-trial cost-per-signup is NOT compared against a paid-customer CAC target without a stated trial->paid bridge), and budget->CPC->clicks->CVR->conversions->CAC closes. FALSE if any budget partition, CAC-unit, or funnel-math defect exists.'),
  noFabrication: z
    .boolean()
    .describe('TRUE only if there are NO fabricated people, invented quotes, padded/uncaptured counts, or placeholder/error-message sections shipped as deliverable content. FALSE if any fabricationFindings exist. Must equal (fabricationFindings.length === 0).'),
  perSection: z
    .array(z.object({
      zone: z.string(),
      score: z.number().describe('1-10 for this section given the evidence it had'),
      read: z.string().describe('What is genuinely good or weak here, with specifics'),
    }))
    .describe('One entry per output zone present'),
  strengths: z.array(z.string()).describe('What is genuinely sharp and trustworthy'),
  problems: z.array(z.string()).describe('What blocks this from being acted on'),
  topFixes: z.array(z.string()).describe('The 3 changes that would most raise the score'),
  fabricationFindings: z
    .array(z.string())
    .describe('Concrete invented people / fabricated quotes / padded counts / placeholder sections / cross-section contradictions a buyer would catch. Empty if none.'),
});

// Single source of truth for the release predicate: a run only passes when the
// score clears the bar AND the media plan is numerically coherent AND nothing is
// fabricated. Exported so zz-release-gate.mjs reuses the exact same predicate.
export function judgeGatePasses(verdict, threshold) {
  return (
    Boolean(verdict) &&
    typeof verdict.overallScore === 'number' &&
    verdict.overallScore >= threshold &&
    verdict.mediaPlanNumericallyCoherent === true &&
    verdict.noFabrication === true &&
    (verdict.fabricationFindings?.length ?? 0) === 0
  );
}

if (IS_CLI && PRINT_SCHEMA) {
  console.log(JSON.stringify(z.toJSONSchema(verdictSchema), null, 2));
  process.exit(0);
}

if (IS_CLI && !RUN_ID) {
  console.error('Usage: node scripts/zz-judge-run.mjs <run_id> [--gate] [--bundle <dir>] [--provider deepseek] [--threshold n] | --print-schema');
  process.exit(1);
}

const slug = (RUN_ID ?? '').slice(0, 8);
const outDir = join(process.cwd(), 'tmp', 'judge', slug);

function printScorecard(verdict, { subjectUrl, modelLabel }) {
  const pass = judgeGatePasses(verdict, THRESHOLD);
  const line = '─'.repeat(64);
  console.log('');
  console.log(line);
  console.log(`  JUDGE VERDICT — run ${slug} — ${subjectUrl ?? ''}`);
  console.log(`  judge: ${modelLabel}  ·  threshold: ${THRESHOLD}/10`);
  console.log(line);
  console.log(`  SCORE: ${verdict.overallScore}/10    WOULD PAY: ${verdict.wouldPay}`);
  console.log(`  MEDIA-PLAN COHERENT: ${verdict.mediaPlanNumericallyCoherent === true ? 'yes' : 'NO'}    NO FABRICATION: ${verdict.noFabrication === true ? 'yes' : 'NO'}`);
  console.log(`  "${verdict.oneLineVerdict}"`);
  console.log('');
  console.log('  Per-section:');
  for (const s of verdict.perSection ?? []) {
    console.log(`    ${String(s.zone).padEnd(32)} ${s.score}/10  ${String(s.read).slice(0, 88)}`);
  }
  console.log('');
  if (verdict.fabricationFindings?.length) {
    console.log(`  🔴 FABRICATION (${verdict.fabricationFindings.length}):`);
    for (const f of verdict.fabricationFindings) console.log(`    - ${f}`);
    console.log('');
  }
  console.log('  Top fixes:');
  for (const f of verdict.topFixes ?? []) console.log(`    → ${f}`);
  console.log('');
  console.log(`  artifacts: ${outDir}/{bundle,verdict}.json + prompt.txt`);
  console.log(line);
  if (pass) {
    console.log(`  PASS — score ${verdict.overallScore} >= ${THRESHOLD}, media plan coherent, no fabrication`);
  } else {
    const reasons = [];
    if (!(verdict.overallScore >= THRESHOLD)) reasons.push(`score ${verdict.overallScore} < ${THRESHOLD}`);
    if (verdict.mediaPlanNumericallyCoherent !== true) reasons.push('media plan NOT numerically coherent');
    if (verdict.noFabrication !== true || (verdict.fabricationFindings?.length ?? 0) > 0) {
      reasons.push(`fabrication present${verdict.fabricationFindings?.length ? ` (${verdict.fabricationFindings.length} finding(s))` : ''}`);
    }
    console.log(`  BELOW BAR — ${reasons.join('; ')}`);
  }
  console.log(line);
  return pass;
}

// ---- MODE 3: GATE on the local agent's verdict.json (no DB, no model) ----
if (IS_CLI && GATE) {
  let verdict;
  try {
    verdict = JSON.parse(await readFile(join(outDir, 'verdict.json'), 'utf8'));
  } catch {
    console.error(`[judge] no verdict.json at ${outDir}. Gather first (node scripts/zz-judge-run.mjs ${RUN_ID}), then have a Codex/Claude Code agent write the verdict, then re-run --gate.`);
    process.exit(1);
  }
  const parsed = verdictSchema.safeParse(verdict);
  if (!parsed.success) {
    console.error('[judge] verdict.json does not match the required shape:', parsed.error.issues.slice(0, 3));
    process.exit(1);
  }
  const pass = printScorecard(parsed.data, { modelLabel: 'local agent (Codex/Claude Code)' });
  if (WRITE_JSON) console.log(JSON.stringify(parsed.data));
  process.exit(pass ? 0 : 2);
}

// ---- MODES 1 & 2 need the persisted run ----
function requireEnv(name) {
  const value = process.env[name];
  if (!value) { console.error(`[judge] ${name} is required but was not configured in .env.local`); process.exit(1); }
  return value;
}
// Lazy so importing this module (for judgeGatePasses) never touches env / exits.
let _sb = null;
function sbClient() {
  if (!_sb) {
    _sb = createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false },
    });
  }
  return _sb;
}

const SECTION_BUDGET = 6000;
const CORPUS_BUDGET = 10000;
const BRIEF_BUDGET = 4000;
const POSITIONING_ORDER = [
  'positioningMarketCategory', 'positioningBuyerICP', 'positioningCompetitorLandscape',
  'positioningVoiceOfCustomer', 'positioningDemandIntent', 'positioningOfferDiagnostic',
  'positioningPaidMediaPlan', 'strategyBrief',
];

function isRecord(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function bodyOf(section) {
  const data = section?.data ?? {};
  if (isRecord(data.body)) return data.body;
  for (const c of [data.data, data.typedArtifact, data.artifact, data.positioningArtifact, data.paidMediaPlanArtifact]) {
    if (isRecord(c?.body)) return c.body;
  }
  return isRecord(data) ? data : {};
}
function truncate(text, max) {
  const s = typeof text === 'string' ? text : JSON.stringify(text, null, 2);
  if (!s) return '';
  return s.length <= max ? s : `${s.slice(0, max)}\n…[truncated ${s.length - max} chars]`;
}

const RUBRIC = [
  'You are TWO readers at once judging a paid GTM research deliverable:',
  '  (1) a serious $500-buyer (SaaS founder / growth lead / media buyer) deciding if this is sharp, trustworthy, and act-on-able;',
  '  (2) a skeptical fabrication auditor hunting invented numbers, dead/uncontained citations, fake quotes, and cross-section contradictions.',
  '',
  'The ship bar (8/10) is met only when a serious buyer reads it and says: "sharp, trustworthy, easy to digest, strategically useful, I can ACT on it." Reserve 9-10 for exceptional, best-in-class work. Score against:',
  '  - Research trust: load-bearing claims are evidenced or an honest gap; no invented numbers; no dead/uncontained URLs.',
  '  - Source quality: VoC quotes are real human-voice permalinks (not nav menus / marketing prose); evidence sits with the claim.',
  '  - Strategic usefulness: ONE thesis argued in order; cross-section facts reconcile (one price, one CAC, one keyword total); insights earned, not padded.',
  '  - Media-plan actionability: budgets are physically buyable — budget→CPC→clicks→CVR→conversions→CAC closes and reconciles with measured demand; budget sub-totals SUM to the stated totals.',
  '  - Structure & readability: decision memo first; no pipeline chrome / internal jargon leaking to the client surface.',
  '',
  'BE FAIR ABOUT EVIDENCE: if the subject was genuinely evidence-poor, an HONEST gap stated plainly is GOOD, not a failure — do not punish honesty. Punish FABRICATION and INCOHERENCE; reward earned insight and honest limits.',
  'BE SKEPTICAL: a fluent paragraph is not evidence. A number with no provenance is a red flag. Contradictions between sections are disqualifying for the contradicted claim.',
  '',
  'TWO QUESTIONS YOU MUST EXPLICITLY ANSWER (they gate the release — answer both deliberately, not reflexively):',
  '  (a) IS THE MEDIA PLAN NUMERICALLY COHERENT? Set mediaPlanNumericallyCoherent. Check, with arithmetic:',
  '      - Do the per-move / per-phase budget sub-totals SUM to the stated monthly total? (Add them up. A row that carries the FULL monthly budget while sibling rows add more on top is a DOUBLE-COUNT → false.)',
  '      - Are CAC units correct? A free-trial / lead / signup cost-per-unit (e.g. "$134 per trial") is NOT a paid-customer CAC. If the plan compares it against a paid-customer CAC target (e.g. "<$3,000") and "beats" it by a large multiple with NO stated trial->paid bridge, the funnel math is self-falsifying → false.',
  '      - Does budget->CPC->clicks->CVR->conversions->CAC close and reconcile with measured demand? If not → false.',
  '      Only set TRUE if ALL three hold. If any fails, set FALSE and put the specific defect in problems/fabricationFindings.',
  '  (b) ARE THERE ANY FABRICATED PEOPLE / QUOTES / COUNTS / PLACEHOLDER SECTIONS? Set noFabrication. Hunt for:',
  '      - Named human personas/buyers asserted as proof points whose names cannot be verified on the cited page (invented people at real companies).',
  '      - Quotes presented as "verified" that are AI paraphrases, nav-menu/marketing prose, or scraper garbage with no per-review permalink.',
  '      - Counts ("N verified ads") that exceed the captured evidence the section actually holds (padded numbers).',
  '      - Sections that are a literal placeholder / error message ("rerun to retry", "Not enough public evidence …" filling every field) shipped as deliverable content.',
  '      List EVERY such item in fabricationFindings. noFabrication MUST equal (fabricationFindings.length === 0).',
  '',
  'Score the OUTPUT given the INPUTS it had to work with. Then answer: would the buyer pay, and what 3 fixes raise it most.',
].join('\n');

// DB source for MODES 1 & 2 — read the persisted run from Supabase.
async function gatherSourceFromDb() {
  const { data: arts, error: ae } = await sbClient()
    .from('research_artifacts')
    .select('id, run_id, status, children_total, children_complete')
    .eq('run_id', RUN_ID);
  if (ae) { console.error('[judge] DB error (artifacts):', ae.message); process.exit(1); }
  if (!arts?.length) { console.error(`[judge] No research_artifacts row for run_id ${RUN_ID}`); process.exit(1); }
  const parent = arts[0];

  const { data: secs, error: se } = await sbClient()
    .from('research_artifact_sections')
    .select('zone, status, counts_toward_rollup, data')
    .eq('artifact_id', parent.id);
  if (se) { console.error('[judge] DB error (sections):', se.message); process.exit(1); }

  const { data: sessionRow } = await sbClient()
    .from('journey_sessions')
    .select('metadata, onboarding_data')
    .eq('run_id', RUN_ID)
    .maybeSingle();
  const subjectUrl = sessionRow?.metadata?.websiteUrl ?? '(unknown subject URL)';
  const briefInput = sessionRow?.onboarding_data ?? {};
  return { parent, secs: secs ?? [], subjectUrl, briefInput };
}

// Offline source — read a zz-dump-run-sections.mjs bundle dir (no DB, no key).
// Each <zone>.json is the section's full `data` object; _manifest.json carries
// artifact metadata + (when freshly dumped) subjectUrl/briefInput/thesis.
async function gatherSourceFromBundle(dir) {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(join(dir, '_manifest.json'), 'utf8'));
  } catch (err) {
    console.error(`[judge] offline bundle: cannot read ${join(dir, '_manifest.json')} — run zz-dump-run-sections.mjs <run_id> ${dir} first. ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
  const secs = [];
  for (const m of manifest.sections ?? []) {
    let data = {};
    try { data = JSON.parse(await readFile(join(dir, `${m.zone}.json`), 'utf8')); } catch { data = {}; }
    secs.push({ zone: m.zone, status: m.status ?? null, counts_toward_rollup: m.counts_toward_rollup ?? null, data });
  }
  const parent = {
    id: manifest.artifact_id ?? null,
    run_id: manifest.run_id ?? RUN_ID,
    status: manifest.status ?? null,
    children_total: manifest.children_total ?? null,
    children_complete: manifest.children_complete ?? null,
  };
  return {
    parent,
    secs,
    subjectUrl: manifest.subjectUrl ?? '(offline bundle — subject URL not captured)',
    briefInput: manifest.briefInput ?? {},
  };
}

async function gather() {
  const { parent, secs, subjectUrl, briefInput } = BUNDLE_DIR
    ? await gatherSourceFromBundle(BUNDLE_DIR)
    : await gatherSourceFromDb();

  const sectionByZone = new Map((secs ?? []).map((s) => [s.zone, s]));
  const corpusBody = sectionByZone.has('deepResearchProgram') ? bodyOf(sectionByZone.get('deepResearchProgram')) : null;
  const outputZones = POSITIONING_ORDER.filter((z) => sectionByZone.has(z));
  if (outputZones.length === 0) { console.error(`[judge] run ${RUN_ID} has no positioning output zones to judge`); process.exit(1); }

  const outputsText = outputZones.map((zone) => {
    const s = sectionByZone.get(zone);
    const sources = s.data?.sources ?? bodyOf(s)?.sources ?? [];
    const n = Array.isArray(sources) ? sources.length : 0;
    return `<output zone="${zone}" status="${s.status}" sourcesRetrieved="${n}">\n${truncate(bodyOf(s), SECTION_BUDGET)}\n</output>`;
  }).join('\n\n');

  const promptText = [
    RUBRIC, '',
    '=== INPUTS the pipeline was given ===',
    `SUBJECT: ${subjectUrl}`, '',
    '<gtm-brief>', truncate(briefInput, BRIEF_BUDGET), '</gtm-brief>', '',
    '<corpus-evidence note="what deepResearchProgram gathered — the raw material">',
    corpusBody ? truncate(corpusBody, CORPUS_BUDGET) : '(no corpus body persisted)',
    '</corpus-evidence>', '',
    '=== OUTPUTS to judge ===', outputsText, '',
    'Render your verdict now. Score the value HONESTLY against the bar. Emit ONLY the verdict JSON (the shape from `--print-schema`) and write it to tmp/judge/' + slug + '/verdict.json.',
  ].join('\n');

  const bundle = {
    runId: RUN_ID, subjectUrl, rollup: `${parent.children_complete}/${parent.children_total}`,
    briefInput, corpusPresent: Boolean(corpusBody), outputZones,
  };
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'bundle.json'), JSON.stringify(bundle, null, 2), 'utf8');
  await writeFile(join(outDir, 'prompt.txt'), promptText, 'utf8');
  return { subjectUrl, promptText, outputZones, rollup: bundle.rollup };
}

// MODES 1 & 2 read the DB and (mode 2) call a model — CLI-only. Importing this
// module (for judgeGatePasses) must not gather or exit.
if (IS_CLI && !GATE) {
  const g = await gather();

  // ---- MODE 1: GATHER (default, canonical) — hand off to a local agent ----
  if (!PROVIDER) {
    console.log(`[judge] bundle gathered ($0, no model call): ${outDir}/{bundle.json,prompt.txt}`);
    console.log(`[judge] subject=${g.subjectUrl}  zones=${g.outputZones.length}  rollup=${g.rollup}`);
    console.log('[judge] CANONICAL JUDGE = a local Codex/Claude Code agent. Next:');
    console.log(`        1. have the agent read ${outDir}/prompt.txt and judge it`);
    console.log(`        2. write its verdict (shape: --print-schema) to ${outDir}/verdict.json`);
    console.log(`        3. node scripts/zz-judge-run.mjs ${RUN_ID} --gate   # pass/fail`);
    process.exit(0);
  }

  // ---- MODE 2: ESCAPE HATCH — non-canonical API judge (headless CI without an agent) ----
  console.error(`[judge] ⚠️ non-canonical API judge (${PROVIDER}:${MODEL_ID}). Owner rule: judging is normally a local agent.`);
  const { createAnthropic } = await import('@ai-sdk/anthropic');
  const { createDeepSeek } = await import('@ai-sdk/deepseek');
  const model = PROVIDER === 'deepseek'
    ? createDeepSeek({ apiKey: requireEnv('DEEPSEEK_API_KEY') })(MODEL_ID)
    : createAnthropic({ apiKey: requireEnv('ANTHROPIC_API_KEY') })(MODEL_ID);

  let result;
  try {
    result = await generateText({
      model,
      output: Output.object({ schema: verdictSchema }),
      prompt: g.promptText,
      maxOutputTokens: 6000,
      ...(PROVIDER === 'deepseek' ? { providerOptions: { deepseek: { thinking: { type: 'disabled' } } } } : {}),
    });
  } catch (err) {
    console.error('[judge] API model call failed:', err instanceof Error ? err.message : String(err));
    console.error(`[judge] bundle is on disk at ${outDir} — judge it with a local agent + --gate instead.`);
    process.exit(1);
  }

  let verdict;
  try { verdict = result.output; } catch {
    console.error('[judge] structured output failed to parse. Raw head:', (result.text ?? '').slice(0, 1500));
    process.exit(1);
  }
  await writeFile(join(outDir, 'verdict.json'), JSON.stringify(verdict, null, 2), 'utf8');
  const pass = printScorecard(verdict, { subjectUrl: g.subjectUrl, modelLabel: `${PROVIDER}:${MODEL_ID} (escape hatch)` });
  if (WRITE_JSON) console.log(JSON.stringify(verdict));
  process.exit(pass ? 0 : 2);
}
