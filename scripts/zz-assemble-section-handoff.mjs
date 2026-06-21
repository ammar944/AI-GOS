#!/usr/bin/env node
// One-shot assembler: turns the section-build-megaspec workflow output into an
// executable handoff markdown. Read-only over the workflow result JSON.
import { readFile, writeFile } from 'node:fs/promises';

const SRC = process.argv[2];
const OUT = process.argv[3] ?? 'docs/plans/2026-06-21-section-build-handoff.md';
const o = JSON.parse(await readFile(SRC, 'utf8')).result;

const LABEL = {
  keystone: 'Phase-1 Keystone — confidence-split + adaptive envelope',
  positioningCompetitorLandscape: '§4.1 Competitor Landscape',
  positioningVoiceOfCustomer: '§4.2 Voice of Customer',
  positioningMarketCategory: '§4.3 Market & Category',
  positioningBuyerICP: '§4.4 Buyer & ICP',
  positioningOfferDiagnostic: '§4.5 Offer Diagnostic',
  positioningDemandIntent: '§4.6 Demand & Intent',
  positioningPaidMediaPlan: '§4.7 Paid Media Plan',
};
const RD = { ready: '🟢 READY', 'needs-revision': '🟡 NEEDS-REVISION', blocked: '🔴 BLOCKED' };

const L = [];
L.push('# Section-Build Handoff — the 7-Section Honest-Ceiling Climb to 9/10');
L.push('');
L.push('> Generated 2026-06-21 by the `section-build-megaspec` workflow (`wf_15d0cb81-edd`, 91 agents: per-item recon → 3-angle spec → 4-lens adversarial vet → synthesis, + cross-section integration). Each spec is read-only-derived and adversarially vetted; apply with judgment, not blindly.');
L.push('');
L.push('## Execution contract (read first)');
L.push('- **Terminator + bar:** `scripts/zz-value-read.mjs` — after each section, run a paid harness section run (`--live`, budget-gated) then `node scripts/zz-value-read.mjs <run> --gate`. The deterministic ceiling + calibrated value-read is the bar. A section is "done" when its finalScore ≥ its honest target with NO fabrication-cap.');
L.push('- **Brake:** the harness defaults to corpus-only; paid runs are `--live` and budget-gated (`_budget.json`, `_ABORT` file). One paid run at a time, no loops.');
L.push('- **Honesty:** honest gaps are NEUTRAL; never invent a number/quote/person not traceable to the frozen corpus or a fetched source. The deterministic floor is BLIND to prose fabrication — a human reviews any value-jump without new structured evidence.');
L.push('- **Additive only:** schema changes are optional fields; never break a prior committed artifact, an existing test (esp. the `section-registry` allowedTools contract), or a renderer.');
L.push('- **`src/` untouched by Phase 0** — this is net-new section work on top of commit `6d8ce161`.');
L.push('');

// Readiness overview
L.push('## Readiness overview');
L.push('');
L.push('| Item | Target | Edits | Tests | Fab-risks | Readiness |');
L.push('|---|---|---|---|---|---|');
for (const s of o.specs) {
  const f = s.finalSpec;
  if (!f) { L.push(`| ${LABEL[s.id] ?? s.id} | — | — | — | — | 🔴 NO SPEC |`); continue; }
  L.push(`| ${LABEL[s.id] ?? s.id} | ${f.honestTarget} | ${(f.edits || []).length} | ${(f.tests || []).length} | ${(f.fabricationRisks || []).length} | ${RD[f.readiness] ?? f.readiness} |`);
}
L.push('');

// Build order + integration
L.push('## Build order & cross-section integration');
L.push('');
const orderLens = o.integration.find((i) => /order/i.test(i.lens)) ?? o.integration[1];
if (orderLens?.recommendedOrder?.length) {
  L.push('**Verified execution order** (keystone first so every section rebases onto the shared `run-section.ts`/`verdict-hero.tsx` edits; Competitor unblocks PaidMedia; PaidMedia last):');
  L.push('');
  orderLens.recommendedOrder.forEach((step, i) => L.push(`${i + 1}. ${step}`));
  L.push('');
}
// Conflicts (dedup across lenses by file)
const seen = new Set();
const conflicts = [];
for (const i of o.integration) for (const c of i.conflicts || []) {
  const key = `${c.file}::${(c.sections || []).join(',')}`;
  if (seen.has(key)) continue; seen.add(key); conflicts.push(c);
}
if (conflicts.length) {
  L.push('**Shared-file conflict surface** (apply-order / isolation):');
  L.push('');
  L.push('| File | Touched by | Risk | Resolution |');
  L.push('|---|---|---|---|');
  for (const c of conflicts) L.push(`| \`${c.file}\` | ${(c.sections || []).join(', ')} | ${(c.risk || '').replace(/\|/g, '\\|').slice(0, 180)} | ${(c.resolution || '').replace(/\|/g, '\\|').slice(0, 200)} |`);
  L.push('');
}
// Completeness gaps
const compLens = o.integration.find((i) => /complete/i.test(i.lens));
if (compLens?.findings) {
  L.push('**Completeness critic — gaps before one-shot autonomous execution:**');
  L.push('');
  L.push('> ' + compLens.findings.replace(/\n/g, '\n> ').slice(0, 1400));
  L.push('');
}

// Per-section detail
L.push('---');
L.push('');
L.push('## Per-item build specs');
for (const s of o.specs) {
  const f = s.finalSpec;
  if (!f) continue;
  L.push('');
  L.push(`### ${LABEL[s.id] ?? s.id} — target ${f.honestTarget}${typeof f.currentScore === 'number' ? ` (from ${f.currentScore})` : ''} · ${RD[f.readiness] ?? f.readiness}`);
  L.push('');
  L.push(`**Root cause.** ${f.rootCause}`);
  L.push('');
  if ((f.edits || []).length) {
    L.push('**Edits** (additive-safe flagged):');
    L.push('');
    for (const e of f.edits) {
      L.push(`- **\`${e.file}\`**${e.locator ? ` — \`${e.locator}\`` : ''}${e.additiveSafe === false ? '  ⚠️ NOT additive-safe — review' : ''}`);
      L.push(`  - *Change:* ${e.change}`);
      if (e.why) L.push(`  - *Why:* ${e.why}`);
    }
    L.push('');
  }
  if (f.skillChanges) { L.push(`**SKILL.md.** ${f.skillChanges}`); L.push(''); }
  if ((f.tests || []).length) { L.push('**Tests.**'); for (const t of f.tests) L.push(`- ${t}`); L.push(''); }
  if ((f.verifyCommands || []).length) { L.push('**Verify.**'); L.push('```bash'); for (const v of f.verifyCommands) L.push(v); L.push('```'); L.push(''); }
  if ((f.fabricationRisks || []).length) { L.push('**Fabrication risks to guard.**'); for (const r of f.fabricationRisks) L.push(`- ${r}`); L.push(''); }
  if ((f.sharedFiles || []).length) { L.push(`**Shared files:** ${f.sharedFiles.map((x) => `\`${x}\``).join(', ')}`); L.push(''); }
  if (f.sequencing) { L.push(`**Sequencing.** ${f.sequencing}`); L.push(''); }
  if ((f.openQuestions || []).length) { L.push('**Open questions.**'); for (const q of f.openQuestions) L.push(`- ${q}`); L.push(''); }
}

await writeFile(OUT, L.join('\n'), 'utf8');
console.log(`wrote ${OUT} (${L.join('\n').length} bytes, ${o.specs.length} specs, ${conflicts.length} conflicts)`);
