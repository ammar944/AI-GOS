#!/usr/bin/env node
// zz-value-read.mjs — the value bar for the OFFLINE FULL-RUN HARNESS.
//
// This is the Phase-0 keystone: the autonomous loop's terminator + fabrication
// guard. It reads a harness deck straight off the filesystem
// (tmp/zz-full-run/<run>/) — NOT Supabase — and scores each section's genuine,
// reader-facing VALUE 1-10, with a DETERMINISTIC ceiling underneath the LLM read
// so laundering can never be talked past.
//
// Two layers, deliberately separated:
//   1. DETERMINISTIC CEILING (this script, $0, no model, no key). Reuses the
//      per-section verifier's OWN source-aware verdict already baked into each
//      committed artifact (`verification.{verifiedCount,unsupportedCount,claims}`),
//      plus the deck-ledger gate.json and `.error.json` presence. It is
//      source-class-aware FOR FREE: the in-run verifier already excludes
//      live-tool sources (SpyFu keyword volumes etc.) from unsupportedCount, so
//      a clean live-tool-heavy section (Demand) is NOT falsely capped — the
//      mistake a naive ledger-only gate would make.
//        absent (.error.json / no body)          -> ceiling 2  (no deliverable)
//        refuted claim(s) OR deck-gate violation  -> ceiling 4  (proven laundering / contradiction; the §5 hard cap)
//        unsupported load-bearing claim(s) shipped-> ceiling 7  (overclaim present; cannot be clean-exceptional)
//        no verifier verdict + self-labels gap    -> ceiling 7  (unverified-directional, e.g. VoC apology path)
//        clean (verifier ran, 0 unsupported)      -> ceiling 10 (no deterministic cap)
//   2. LLM VALUE-READ (a LOCAL Codex/Claude Code agent, never an API model).
//      The agent reads ONLY the section bodies + the §5 rubric — it is NOT shown
//      the verifier numbers first (so its value judgment stays independent) —
//      and writes per-section llmScore + the single weakest sentence.
//
//   finalScore = min(llmScore, deterministicCeiling).  Honest gaps are NEUTRAL
//   (they never lower a ceiling); only proven laundering caps.
//
// Flow (mirrors zz-judge-run.mjs):
//   node scripts/zz-value-read.mjs <run>           # GATHER  -> value-read/{facts.json,prompt.txt}
//   node scripts/zz-value-read.mjs <run> --gate    # GATE    -> finalScore = min(llm,ceiling) vs calibration
//   node scripts/zz-value-read.mjs --print-schema  # the verdict shape the agent must write
//
// <run> is a dir name under tmp/zz-full-run/ (e.g. harness-ramp-2e3adf77) or an
// absolute path to a run dir.

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, isAbsolute, basename } from 'node:path';

// True only when this file is the process entrypoint, false when imported (e.g.
// by the unit test). Keeps deterministicCeiling/countRefuted importable without
// booting the CLI / touching process.exit.
const IS_CLI = (() => {
  try {
    return Boolean(process.argv[1]) && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();

const argv = process.argv.slice(2);
const positional = argv.filter((a) => !a.startsWith('--'));
const RUN_ARG = positional[0];
const GATE = argv.includes('--gate');
const PRINT_SCHEMA = argv.includes('--print-schema');
const SECTION_BUDGET = 7000;

function flagValue(name) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : undefined;
}

// The one run whose finalScores are gated against the fixed human read. Every
// OTHER run is gated by an ABSOLUTE value bar (--min-score), never the Ramp
// anchor (else a genuinely-good different deck fails as 'not calibrated').
const CALIBRATION_RUN_BASENAME = 'harness-ramp-2e3adf77';
const ABSOLUTE_MIN_SCORE = Number(flagValue('--min-score') ?? '8'); // §5 ship bar

// ---------------------------------------------------------------------------
// Section roster + the KNOWN human calibration read on the Ramp 2e3adf77 deck.
// P2 trust-calibration target: finalScore must reproduce this within tolerance
// before the agent's scores are trusted to gate any OTHER corpus.
// ---------------------------------------------------------------------------
const POSITIONING_ORDER = [
  'positioningMarketCategory',
  'positioningBuyerICP',
  'positioningCompetitorLandscape',
  'positioningVoiceOfCustomer',
  'positioningDemandIntent',
  'positioningOfferDiagnostic',
  'positioningPaidMediaPlan',
];

const SECTION_LABEL = {
  positioningMarketCategory: 'Market & Category',
  positioningBuyerICP: 'Buyer & ICP',
  positioningCompetitorLandscape: 'Competitor Landscape',
  positioningVoiceOfCustomer: 'Voice of Customer',
  positioningDemandIntent: 'Demand & Intent',
  positioningOfferDiagnostic: 'Offer Diagnostic',
  positioningPaidMediaPlan: 'Paid Media Plan',
};

// The human read on harness-ramp-2e3adf77 (the calibration anchor). Only used to
// REPORT calibration error in --gate; never feeds the deterministic ceiling.
const HUMAN_CALIBRATION = {
  positioningOfferDiagnostic: 8,
  positioningDemandIntent: 7.5,
  positioningBuyerICP: 5.5,
  positioningPaidMediaPlan: 5,
  positioningMarketCategory: 3,
  positioningVoiceOfCustomer: 2,
  positioningCompetitorLandscape: 0,
};

// ---------------------------------------------------------------------------
// The verdict the LOCAL agent must emit to value-read/verdict.json.
// ---------------------------------------------------------------------------
const VERDICT_SCHEMA = {
  type: 'object',
  required: ['perSection', 'overallRead'],
  properties: {
    perSection: {
      type: 'array',
      description: 'one entry per section present in prompt.txt',
      items: {
        type: 'object',
        required: ['sectionId', 'llmScore', 'weakestSentence', 'read'],
        properties: {
          sectionId: { type: 'string' },
          llmScore: {
            type: 'number',
            description:
              'Genuine reader-facing VALUE 1-10. Would a serious $500 GTM buyer find this section sharp, trustworthy, act-on-able? Honest gaps are NEUTRAL (do not punish honesty). Score the VALUE you see in the body — ignore any verifier numbers, they are applied separately as a hard ceiling.',
          },
          weakestSentence: {
            type: 'string',
            description: 'the single sentence/claim a skeptical media buyer would distrust first',
          },
          read: { type: 'string', description: 'what is genuinely good or weak, with specifics' },
        },
      },
    },
    overallRead: { type: 'string', description: 'one paragraph: is this deck worth paying for, and the 3 fixes that raise it most' },
  },
};

const VALUE_RUBRIC = [
  'You are a serious $500 GTM-research buyer (SaaS founder / growth lead / media buyer) doing an OFFLINE VALUE-READ of a positioning deck, section by section.',
  'Score each section 1-10 on GENUINE, reader-facing value:',
  '  - Is the lead insight sharp, specific, and act-on-able — or generic / hedged / buried?',
  '  - Does it read as trustworthy: real evidence behind load-bearing claims, one thesis argued in order, numbers that reconcile?',
  '  - Could the buyer DO something Monday morning with it?',
  'BE FAIR ABOUT HONESTY: a block that states an HONEST GAP plainly (with a reason + a sourcing plan) is GOOD, not a failure — do NOT lower the score for honest absence. Punish FABRICATION, apology-framing that buries real data, defeatist verdicts, and generic filler. Reward earned insight and honest limits.',
  '8 = a serious buyer would pay and act on it. 9-10 = exceptional, best-in-class. 5-6 = useful but thin/hedged. <=3 = not act-on-able as-is (apology, defeatism, or empty).',
  'For each section emit: llmScore (1-10), the single weakest sentence a skeptic distrusts first, and a specific read.',
  'Score the VALUE you actually see in the body. Do NOT try to guess verifier/validator numbers — a separate deterministic layer applies those as a hard ceiling AFTER your read.',
].join('\n');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function resolveRunDir(arg) {
  if (!arg) return null;
  if (isAbsolute(arg)) return arg;
  // A bare run-name (no separator) is canonical under tmp/zz-full-run — resolve
  // there FIRST so a run named 'scripts'/'docs'/'tmp' can't collide with a cwd dir.
  if (!arg.includes('/')) {
    const canonical = join(process.cwd(), 'tmp', 'zz-full-run', arg);
    if (existsSync(canonical)) return canonical;
  }
  const direct = join(process.cwd(), arg);
  if (existsSync(direct)) return direct;
  return join(process.cwd(), 'tmp', 'zz-full-run', arg);
}

function truncate(value, max) {
  const s = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  if (!s) return '';
  return s.length <= max ? s : `${s.slice(0, max)}\n…[truncated ${s.length - max} chars]`;
}

async function readJsonIfExists(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return null;
  }
}

export function countRefuted(verification) {
  const claims = Array.isArray(verification?.claims) ? verification.claims : [];
  return claims.filter(
    (c) => c && (c.entailmentVerdict === 'refuted' || c.status === 'refuted'),
  ).length;
}

// A 'clean' section must verify at least this many load-bearing claims to be
// certifiable as strong — 'verifier ran, 0 unsupported' is hollow if almost
// nothing became a claim (red-team: a 1-verified section reaching 10).
const MIN_SUBSTANTIVE_CLAIMS = 4;

// The clean band tops out at 9, never 10: nothing the DETERMINISTIC layer sees
// (numbers / URLs / quoted spans / 8 named fields) certifies a perfect deck —
// fabricated analytical PROSE is invisible to the verifier, so 10 must be
// unreachable by the floor alone (the LLM read is the only net for prose).
const CLEAN_CEILING = 9;

// Parse a verifier count tolerant of string serialization ("9"), but treat a
// present-but-unparseable count as UNKNOWN (null) — never silently as 0/clean.
function toFiniteCount(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return null;
}

// Body keys that, ALONE, do not constitute a real deliverable (a one-field
// placeholder body must not escape the absent floor into clean-10).
const META_ONLY_KEYS = new Set(['note', 'reason', 'evidenceGap', 'needs_review', 'blockGap', 'status']);

function isSubstantiveBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  const contentKeys = Object.keys(body).filter((k) => !META_ONLY_KEYS.has(k));
  if (contentKeys.length === 0) return false;
  return contentKeys.some((k) => {
    const v = body[k];
    if (Array.isArray(v)) return v.length > 0;
    if (v && typeof v === 'object') return Object.keys(v).length > 0;
    return v !== undefined && v !== null && v !== '';
  });
}

// The deterministic ceiling: reuses the section's OWN in-run verifier verdict
// (source-class-aware) + deck gate + body presence. Honest gaps never lower it,
// but ABSENCE OF PROOF (no verifier, unreadable counts, thin coverage) can never
// reach the clean band — only EARNED, substantively-verified output does.
export function deterministicCeiling({ artifact, errored, gateViolations }) {
  if (errored || !artifact || !isSubstantiveBody(artifact.body)) {
    return { ceiling: 2, band: 'absent', reason: 'no substantive committed body (verifier hard-fail / errored / placeholder-only)' };
  }
  const verification = artifact.verification && typeof artifact.verification === 'object' ? artifact.verification : null;
  const refuted = countRefuted(verification);
  const unsupported = verification ? toFiniteCount(verification.unsupportedCount) : null;
  const verified = verification ? toFiniteCount(verification.verifiedCount) : null;

  // 1. Proven laundering — the §5 hard cap (outranks everything).
  if (refuted > 0 || gateViolations > 0) {
    const why = [];
    if (refuted > 0) why.push(`${refuted} refuted (evidence-contradicted) claim(s)`);
    if (gateViolations > 0) why.push(`${gateViolations} deck-ledger gate violation(s)`);
    return { ceiling: 4, band: 'fabrication-cap', reason: `proven laundering: ${why.join(' + ')}`, verified, unsupported, refuted };
  }

  // 2. Verifier object present but counts unreadable -> cannot certify -> 7.
  if (verification !== null && (unsupported === null || verified === null)) {
    return { ceiling: 7, band: 'unverifiable-count', reason: 'verifier object present but verifiedCount/unsupportedCount not both numeric — cannot certify clean', verified, unsupported, refuted };
  }

  // 3. Unsupported load-bearing claims shipped -> overclaim -> 7.
  if (unsupported !== null && unsupported > 0) {
    return { ceiling: 7, band: 'overclaim', reason: `${unsupported} unsupported load-bearing claim(s) shipped (verified ${verified})`, verified, unsupported, refuted };
  }

  // 4. No verifier verdict at all -> unverified-directional -> 7 (NEVER clean).
  //    A full body with no verifier ran is unproven, not certified.
  if (verification === null) {
    const hedged = artifact.body?.evidenceGap === true || artifact.needs_review === true;
    return {
      ceiling: 7,
      band: 'unverified-directional',
      reason: hedged
        ? 'no verifier verdict; section self-labels evidence-gap / directional'
        : 'no verifier verdict recorded — unverified content, cannot certify clean',
      verified,
      unsupported,
      refuted,
    };
  }

  // 5. Clean — but EARNED by substance, not just absence-of-unsupported.
  if (verified !== null && verified < MIN_SUBSTANTIVE_CLAIMS) {
    return { ceiling: 7, band: 'thin-clean', reason: `verifier clean but only ${verified} load-bearing claim(s) — too thin to certify as exceptional`, verified, unsupported, refuted };
  }
  return { ceiling: CLEAN_CEILING, band: 'clean', reason: `verifier clean (verified ${verified}, 0 unsupported)`, verified, unsupported, refuted };
}

// ---------------------------------------------------------------------------
// GATHER: compute deterministic facts + write the body-only value prompt.
// ---------------------------------------------------------------------------
async function gather(runDir) {
  const gate = (await readJsonIfExists(join(runDir, 'gate.json'))) ?? { blocked: false, violations: [] };
  const gateBySection = {};
  for (const v of gate.violations ?? []) {
    const sid = v?.cell?.sectionId;
    if (sid) gateBySection[sid] = (gateBySection[sid] ?? 0) + 1;
  }

  const sections = [];
  const promptBlocks = [];
  for (const sectionId of POSITIONING_ORDER) {
    const committed = await readJsonIfExists(join(runDir, `${sectionId}.json`));
    const errorDoc = committed ? null : await readJsonIfExists(join(runDir, `${sectionId}.error.json`));
    const errored = !committed;
    const ceiling = deterministicCeiling({
      artifact: committed,
      errored,
      gateViolations: gateBySection[sectionId] ?? 0,
    });
    sections.push({
      sectionId,
      label: SECTION_LABEL[sectionId] ?? sectionId,
      present: Boolean(committed),
      confidence: typeof committed?.confidence === 'number' ? committed.confidence : null,
      gateViolations: gateBySection[sectionId] ?? 0,
      ...ceiling,
    });

    // The prompt deliberately carries ONLY the body + verdict text — never the
    // verifier counts (so the LLM read stays independent of the ceiling).
    if (committed) {
      promptBlocks.push(
        `<section id="${sectionId}" name="${SECTION_LABEL[sectionId]}">\n${truncate(committed.body ?? {}, SECTION_BUDGET)}\n</section>`,
      );
    } else {
      const msg = errorDoc?.error ? truncate(errorDoc.error, 400) : '(no body and no error doc)';
      promptBlocks.push(
        `<section id="${sectionId}" name="${SECTION_LABEL[sectionId]}" status="ABSENT — failed to commit">\n${msg}\n</section>`,
      );
    }
  }

  const outDir = join(runDir, 'value-read');
  await mkdir(outDir, { recursive: true });
  await writeFile(
    join(outDir, 'facts.json'),
    JSON.stringify({ runDir, gateBlocked: gate.blocked === true, sections }, null, 2),
    'utf8',
  );

  const prompt = [
    VALUE_RUBRIC,
    '',
    '=== SECTIONS TO VALUE-READ (score each, in this order) ===',
    '',
    ...promptBlocks,
    '',
    `Write your verdict (shape: --print-schema) to ${join(outDir, 'verdict.json')}. One perSection entry per <section> above (7 total). Then re-run with --gate.`,
  ].join('\n');
  await writeFile(join(outDir, 'prompt.txt'), prompt, 'utf8');

  return { outDir, sections };
}

// ---------------------------------------------------------------------------
// GATE: finalScore = min(llm, ceiling); report vs the human calibration read.
// ---------------------------------------------------------------------------
async function gate(runDir) {
  const factsPath = join(runDir, 'value-read', 'facts.json');
  const verdictPath = join(runDir, 'value-read', 'verdict.json');
  const facts = await readJsonIfExists(factsPath);
  if (!facts) {
    console.error(
      existsSync(factsPath)
        ? `[value-read] facts.json present but UNPARSEABLE (corrupt JSON): ${factsPath}`
        : `[value-read] no facts.json — run GATHER first: node scripts/zz-value-read.mjs ${RUN_ARG}`,
    );
    process.exit(1);
  }
  const verdict = await readJsonIfExists(verdictPath);
  if (!verdict) {
    console.error(
      existsSync(verdictPath)
        ? `[value-read] verdict.json present but UNPARSEABLE (corrupt JSON): ${verdictPath}`
        : `[value-read] no verdict.json at ${join(runDir, 'value-read')}. Have a local agent read prompt.txt and write the verdict (shape: --print-schema), then re-run --gate.`,
    );
    process.exit(1);
  }
  const llmBySection = new Map((verdict.perSection ?? []).map((p) => [p.sectionId, p]));
  const isCalib = basename(runDir) === CALIBRATION_RUN_BASENAME;

  // COVERAGE + RANGE validation FIRST — the LLM cannot game the gate by omitting
  // a present section or emitting a garbage/out-of-range/non-numeric score.
  const missing = [];
  const outOfRange = [];
  for (const s of facts.sections) {
    if (!s.present) continue; // absent sections legitimately have no body to read
    const score = llmBySection.get(s.sectionId)?.llmScore;
    if (typeof score !== 'number' || !Number.isFinite(score)) {
      missing.push(`${s.sectionId}=${JSON.stringify(score ?? null)}`);
    } else if (score < 1 || score > 10) {
      outOfRange.push(`${s.sectionId}=${score}`);
    }
  }
  if (missing.length || outOfRange.length) {
    console.error('');
    if (missing.length) console.error(`[value-read] ❌ COVERAGE FAIL — present sections missing a finite llmScore: ${missing.join(', ')}`);
    if (outOfRange.length) console.error(`[value-read] ❌ RANGE FAIL — llmScore outside [1,10]: ${outOfRange.join(', ')}`);
    console.error('[value-read] every present section needs a numeric llmScore in [1,10]; the gate will not score a partial/garbage verdict.');
    process.exit(2);
  }

  const line = '─'.repeat(78);
  console.log('');
  console.log(line);
  console.log(`  VALUE-READ — ${facts.runDir}`);
  console.log(`  finalScore = min(llmScore, ceiling)  ·  deck-gate blocked: ${facts.gateBlocked ? 'YES' : 'no'}  ·  mode: ${isCalib ? 'CALIBRATION (vs human anchor)' : `ABSOLUTE bar (≥${ABSOLUTE_MIN_SCORE})`}`);
  console.log(line);
  console.log(`  section                 llm   ceil(band)            final${isCalib ? '  human  Δ' : ''}`);
  let maxErr = 0;
  let absErrSum = 0;
  let scored = 0;
  const rows = [];
  for (const s of facts.sections) {
    const score = llmBySection.get(s.sectionId)?.llmScore;
    // present sections are validated above; absent sections default to 1 (no body).
    const llmScore = typeof score === 'number' ? Math.min(Math.max(score, 1), 10) : 1;
    const final = Math.min(llmScore, s.ceiling);
    const human = HUMAN_CALIBRATION[s.sectionId];
    const delta = isCalib && typeof human === 'number' ? +(final - human).toFixed(1) : null;
    if (delta !== null) {
      maxErr = Math.max(maxErr, Math.abs(delta));
      absErrSum += Math.abs(delta);
      scored += 1;
    }
    rows.push({ ...s, llmScore, final, human, delta });
    const band = `${s.ceiling}(${s.band})`;
    console.log(
      `  ${String(s.label).padEnd(22)} ${String(llmScore).padStart(4)}   ${band.padEnd(20)} ${String(final).padStart(5)}` +
        (isCalib ? `  ${String(human ?? '—').padStart(5)}  ${delta === null ? '' : delta > 0 ? '+' + delta : String(delta)}` : ''),
    );
  }
  console.log(line);

  let pass;
  if (isCalib) {
    const meanAbsErr = scored ? +(absErrSum / scored).toFixed(2) : null;
    const anchored = facts.sections.filter((s) => typeof HUMAN_CALIBRATION[s.sectionId] === 'number').length;
    const fullCoverage = scored === anchored; // every anchored section was scored
    const CALIB_MAX = 1.5;
    const CALIB_MEAN = 0.5;
    console.log(`  calibration vs human read:  maxAbsErr=${maxErr.toFixed(1)}  meanAbsErr=${meanAbsErr}  scored ${scored}/${anchored}`);
    pass = fullCoverage && maxErr <= CALIB_MAX && (meanAbsErr ?? 9) <= CALIB_MEAN;
    console.log(
      pass
        ? `  ✅ CALIBRATED — reproduces the human read (maxAbsErr ≤ ${CALIB_MAX}, meanAbsErr ≤ ${CALIB_MEAN}, full coverage). Scores are trustworthy.`
        : `  ⚠️  NOT CALIBRATED — maxAbsErr ${maxErr.toFixed(1)} (≤${CALIB_MAX}?) meanAbsErr ${meanAbsErr} (≤${CALIB_MEAN}?) coverage ${scored}/${anchored}. Fix the agent's read, not the human anchor.`,
    );
  } else {
    const present = rows.filter((r) => r.present);
    const belowBar = present.filter((r) => r.final < ABSOLUTE_MIN_SCORE);
    const meanFinal = present.length ? +(present.reduce((a, r) => a + r.final, 0) / present.length).toFixed(2) : null;
    console.log(`  absolute bar: ${present.length - belowBar.length}/${present.length} present sections ≥ ${ABSOLUTE_MIN_SCORE}  ·  mean final ${meanFinal}`);
    pass = present.length > 0 && belowBar.length === 0;
    console.log(
      pass
        ? `  ✅ AT BAR — every present section finalScore ≥ ${ABSOLUTE_MIN_SCORE}.`
        : `  ⚠️  BELOW BAR — ${belowBar.length} section(s) under ${ABSOLUTE_MIN_SCORE}: ${belowBar.map((r) => `${r.label}=${r.final}`).join(', ') || '(none present)'}.`,
    );
  }
  console.log(line);
  for (const r of rows) {
    // Surface EVERY place the deterministic ceiling bound the LLM, not just hard caps.
    if (r.llmScore > r.ceiling) {
      const icon = r.band === 'fabrication-cap' ? '🔴' : '🟠';
      console.log(`  ${icon} ${r.label}: LLM ${r.llmScore} capped to ${r.ceiling} (${r.band}) — ${r.reason}`);
    }
    const weakest = llmBySection.get(r.sectionId)?.weakestSentence;
    if (weakest) console.log(`  · ${r.label} weakest: "${truncate(weakest, 120)}"`);
  }
  console.log(line);
  process.exit(pass ? 0 : 2);
}

// ---------------------------------------------------------------------------
// Main (CLI-only — importing this module for the pure helpers never runs it)
// ---------------------------------------------------------------------------
if (IS_CLI) {
  if (PRINT_SCHEMA) {
    console.log(JSON.stringify(VERDICT_SCHEMA, null, 2));
    process.exit(0);
  }
  if (!RUN_ARG) {
    console.error('Usage: node scripts/zz-value-read.mjs <run> [--gate] | --print-schema');
    console.error('  <run> = a dir under tmp/zz-full-run/ (e.g. harness-ramp-2e3adf77) or an absolute run-dir path');
    process.exit(1);
  }
  const runDir = resolveRunDir(RUN_ARG);
  if (!existsSync(runDir)) {
    console.error(`[value-read] run dir not found: ${runDir}`);
    process.exit(1);
  }

  if (GATE) {
    await gate(runDir);
  } else {
    const { outDir, sections } = await gather(runDir);
    console.log(`[value-read] gathered ($0, no model): ${outDir}/{facts.json,prompt.txt}`);
    console.log('[value-read] deterministic ceilings:');
    for (const s of sections) {
      console.log(`    ${s.label.padEnd(22)} ceiling ${s.ceiling}  (${s.band})  — ${s.reason}`);
    }
    console.log('[value-read] NEXT: a local agent reads prompt.txt, writes value-read/verdict.json, then: node scripts/zz-value-read.mjs ' + RUN_ARG + ' --gate');
  }
}
