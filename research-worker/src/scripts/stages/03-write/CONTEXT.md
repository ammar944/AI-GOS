# stages/03-write — Layer 2 (Stage Contract)

Stage B of the script pipeline. **The only AI call site.** One integrated `generateObject()` call per awareness level, producing 3 complete scripts.

## Inputs

`CreativeWriterInput`:
- `level: AwarenessLevel` — which of the 5 levels this call is for
- `levelPlans: ScriptPlan[]` — the 3 plans Stage A produced for this level
- `companyName`, `targetAudience`, `trimmedResearchContext`, `styleReferences` (pre-formatted)
- `proofPoints?: ProofPoint[]` — sliding-window subset for this level (from `getProofSubset`)
- `usedProofPoints?: Map<string, number>` — cross-level dedup tracking
- `usedAnglesAndHooks: { angle, hook }[]` — running set of already-used angles + hooks across prior levels
- `allClaims: ExtractedClaim[]` — full menu from Stage A.2
- `competitorAdIntel?`, `researchStatsSubset?`, `platformSpecs?`, `adCopyTemplates?`, `brandVoiceNotes?` — optional grounding context

## Process

`writeCreativeLevel(input)` builds an integrated creative prompt that combines:

- v1's full-context creative depth (founder-to-founder voice, audience monologue grounding)
- Haynes frameworks + in-market tier targeting
- Pre-extracted claims as a supplemental grounding menu
- Cross-level angle/hook dedup tracking
- Integrated self-audit (43-check pattern from v1's Pass 2 collapsed into the same call)

The AI conceives hook + body + CTA as ONE integrated thought per script. No separate hook/body/polish stages — they were collapsed back in v2.1 because the split version regressed copy quality.

Single `generateObject()` call per level. Schema: `scriptOutputSchema` (3 scripts each with headline, body, cta, hookVariants, framework, confidenceScore, etc.). Schema is wrapped in `stripNumericConstraints()` because Anthropic API rejects Zod `.min()/.max()` on numbers.

## Checkpoints

- [ ] Exactly 3 scripts returned per call (or rescue/retry kicks in upstream).
- [ ] Every script has a non-empty `body`, `cta`, and `headline`.
- [ ] `hookType` field is set (used by Stage C and the frontend).
- [ ] `framework` matches one of the planned frameworks for the level.
- [ ] `groundedIn[]` cites at least one claim source.
- [ ] No fabricated proof points (model is told `NO VERIFIED PROOF AVAILABLE` when proofPoints is empty).

## Outputs

`CreativeWriterOutput = { scripts: Array<{ headline, body, cta, hookVariants, hookType, designDirection, angle, type, platform, framework, duration, groundedIn, confidenceScore, humanizedPass, patternsFixed, flaggedClaims }> }`.

The pipeline post-processes the output: sanitize (dash stripping, score normalization), dedupe, then assemble into the final `AssembledScript[]`.

## Forbidden

- Splitting the creative call into multiple stages (the 6-stage architecture regressed copy quality — do not reintroduce it).
- Skipping `stripNumericConstraints()` on the schema — Anthropic will reject the request.
- Mutating `usedProofPoints` or `usedAnglesAndHooks` from inside the writer — the pipeline owns that state.
