# Collector Prompt - research-cross

## Objective

Synthesize completed AIGOS research cards into one strict `synthesize-strategy` cross-analysis output. The result must match `schemas/output.ts` exactly.

This is not a collection task. Do not search the web, inspect live pages, call provider APIs, or add evidence that is not already present in the locked input. Your job is to compare supplied claims, preserve provenance, expose conflicts, and identify downstream readiness risks.

## Input Contract

Read the sealed input payload first. It must contain:

- `run_id`
- `brief_snapshot_id`
- `stage: "synthesize-strategy"`
- `gtm_brief`
- `ingest_identity`
- `research_market`
- `research_icp`
- `research_offer`
- `research_competitor`
- `research_voc`
- `research_keywords`

If any required upstream output is missing or malformed, stop before writing `output.json`. The output schema allows manifest statuses, but the runnable skill contract is all-or-nothing: this card is only valid when all seven upstream cards are present and valid.

Use `gtm_brief.fields.companyName.value` for `company_name` and `gtm_brief.fields.category.value` for `category`, unless the valid `ingest_identity` output contains a more canonical same-company spelling. Do not invent a corrected name or category.

## Block 1 - Input Manifest

Create exactly one `input_manifest` row for each required upstream skill:

- `ingest-identity`
- `research-market`
- `research-icp`
- `research-offer`
- `research-competitor`
- `research-voc`
- `research-keywords`

For each row:

- Set `status` to `present` only after the card validates and has the expected `skill` and `stage`.
- Copy `generated_at` from the upstream output when present.
- Do not include source URLs, paths, notes, or extra fields in the manifest row.

If a row would be `missing` or `invalid`, do not proceed to a normal output artifact. Raise the failure with the missing skill name, run id, and brief snapshot id.

## Block 2 - Claim Inventory

Build a working inventory before writing output. Pull claims from:

- Every upstream `key_claims` array.
- `research_offer.offer_claims`.
- `research_voc.objection_evidence`.
- `research_keywords.demand_intents`.
- Any upstream `research_gaps` strings as gap candidates, not factual evidence.

For each sourced claim, retain:

- source skill name.
- upstream `output_path`.
- `evidence_id` when available.
- `claim`.
- `source_url`.
- `retrieved_at`.

Group claims by topic:

- category definition and category scope.
- target buyer, persona, roles, and buying committee.
- pain, trigger, status quo, and desired outcome.
- offer promise, first value moment, activation, proof, and funnel.
- competitor alternative, switching context, comparison, and status-quo risk.
- Voice of Customer language, objections, adoption doubts, and proof gaps.
- demand-intent, keyword, content-gap, and negative-keyword implications.

Do not treat the locked brief alone as evidence for `cross_findings`; it can orient the synthesis but findings must derive from upstream skill outputs.

## Block 3 - Cross Findings

Populate `cross_findings` with only material observations that are supported by at least two distinct upstream skills.

Allowed `finding_type` values:

- `overlap`: two or more skills independently support the same pattern.
- `contradiction`: two or more skills make materially conflicting claims.
- `gap`: multiple inputs reveal missing or thin evidence.
- `theme`: repeated evidence creates a useful downstream synthesis anchor.
- `risk`: repeated evidence exposes a downstream safety or readiness concern.

For each finding:

- Write `finding` as a single concise sentence.
- Include at least two `derived_from` provenance objects from distinct skills.
- Include `evidence` claims that directly explain the finding.
- Use the original upstream `source_url` and `retrieved_at`.
- Prefer three to five provenance entries when they materially strengthen the finding.

Do not include single-source observations. If only one upstream skill supports a useful point, leave it in that source skill and do not promote it to cross-analysis.

## Block 4 - Contradictions

Populate `contradictions` when upstream cards disagree on a decision that matters downstream.

Good contradiction topics include:

- Broad category framing versus narrow demand-intent language.
- ICP stated in the brief versus evidence-supported buyer roles.
- Offer promise versus VoC objections or competitor comparisons.
- Competitor set versus current-alternative evidence.
- Keyword demand versus positioning/category language.
- Proof claims versus missing or weak evidence.

For each contradiction:

- `topic`: name the disputed decision area.
- `conflict`: explain the disagreement without choosing a winner.
- `sides`: include at least two claims from distinct upstream skills with exact provenance.
- `resolution_needed`: state the downstream decision that remains unsafe until resolved.

Do not resolve the contradiction unless an upstream card already contains a sourced resolution. Do not soften conflicting claims into a generic theme.

## Block 5 - Research Gaps

Populate `research_gaps` for missing evidence that blocks a concrete downstream decision.

A valid gap includes:

- `gap`: what evidence is missing or too thin.
- `blocked_downstream_decision`: the positioning, media-plan, script, or presentation decision that cannot be made safely.
- `missing_from_skills`: one or more upstream skill names responsible for that evidence surface.

Use upstream `research_gaps` as candidates, but rewrite them into downstream decision language. Do not add vague gaps such as "more research needed." Do not use a gap as a way to request new collection from this skill.

## Block 6 - High-Confidence Themes

Populate `high_confidence_themes` with repeated patterns that should anchor later synthesis. These use the same object shape as `cross_findings`.

A high-confidence theme must:

- Be supported by at least two distinct upstream skills.
- Include sourced evidence, not brief-only statements.
- Be stable enough for downstream positioning or planning to reuse.
- Avoid strategic recommendations, channel choices, budget calls, or copywriting.

Strong examples:

- A repeated buyer pain across ICP, VoC, and competitor evidence.
- A repeated category promise across identity, offer, and keyword evidence.
- A repeated adoption objection across offer, VoC, and competitor evidence.

Weak examples to exclude:

- One interesting quote.
- A category claim repeated only within one skill.
- A recommendation about what to advertise next.

## Block 7 - Readiness Blockers

Populate `readiness_blockers` only when a gap or contradiction makes downstream output unsafe.

Use blockers for:

- unsupported competitor-comparison claims.
- unresolved category framing conflicts.
- missing proof for a promised outcome.
- thin buyer evidence for a proposed ICP.
- demand-intent evidence that conflicts with planned positioning.
- VoC objections that are not addressed by offer or proof evidence.

Do not create scores, priorities, percentages, confidence labels, or severity numbers. The blocker text itself should explain why the issue matters.

## Block 8 - Final JSON Assembly

Write JSON only. Include these top-level keys and no others:

- `run_id`
- `brief_snapshot_id`
- `stage`
- `company_name`
- `category`
- `input_manifest`
- `cross_findings`
- `contradictions`
- `research_gaps`
- `high_confidence_themes`
- `readiness_blockers`
- `generated_at`

Use `stage: "synthesize-strategy"`.

Use an ISO datetime for `generated_at`.

Arrays that can be empty by schema may be empty only when the evidence truly contains no such item:

- `contradictions`
- `research_gaps`
- `readiness_blockers`

`cross_findings` must contain at least one valid finding. If the supplied cards do not support one multi-skill finding, fail rather than fabricating one.

## Rejection Rules

Reject or remove:

- web-search results gathered during this run.
- provider status, tool logs, query logs, raw responses, or trace data.
- readiness scores, numeric priorities, confidence percentages, or ranking scores.
- platform recommendations, budget allocations, campaign plans, scripts, launch plans, or creative copy.
- placeholder text: `unknown`, `TBD`, `n/a`, `none`, empty strings, `Not verified`, scaffold text, TODO text, or sample filler.
- unsupported paraphrases presented as sourced claims.
- source objects missing either `source_url` or `retrieved_at`.
- findings derived from only one upstream skill.

## Validation

After writing a run artifact:

```bash
cd skills/research-cross
npm run validate -- <output.json>
npm run sanity-check <output.json>
```

For fixture verification:

```bash
cd skills/research-cross
npm run validate
npm run sanity-check example/output.json
```

If either gate fails, fix the JSON or the prompt logic before returning the artifact. Do not use `ALLOW_SUSPECT=1`.
