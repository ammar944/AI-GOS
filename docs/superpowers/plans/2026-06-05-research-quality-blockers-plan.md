# Research Quality Blockers Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the current research-quality blockers without fabricating evidence: trust review failures must not downgrade verified artifacts, VoC must deterministically promote only valid acquired quotes, BuyerICP must reject role-label/persona padding, and proof must separate code verification from live rerun evidence.

**Architecture:** Keep the live `/research-v3` flow unchanged: corpus and session orchestration stay as-is, while the in-process lab engine gains stricter deterministic validators and a deterministic VoC synthesis fallback. Each code chunk has a disjoint write scope so workers can implement independently, then run one integrated verification pass.

**Tech Stack:** Next.js 16 App Router, TypeScript strict mode, Vercel AI SDK v6, Zod schemas, Vitest, Supabase-backed live proof scripts.

---

## Current Baseline

- Repo: `/Users/ammar/Dev-Projects/AI-GOS`
- Branch: `feat/research-quality-truthgate`
- Baseline HEAD: `cbc8864e`
- Existing dirty state to preserve: `.gitignore` modified, `docs/2026-06-03-supabase-to-railway-migration-plan.md` untracked. Do not touch either file.
- Focused baseline already passed: `91/91` across models, review, strategic critic, reviews tool, VoC candidates, run-section VoC, live-quality-gate, share-snapshot, supabase-run-store.
- Relevant docs already read: `AGENTS.md`, `CLAUDE.md`, `docs/source-map.md`.

## Target Write Scopes

### Chunk 1: Trust Hygiene

Modify:
- `src/lib/lab-engine/artifacts/artifact-envelope.ts`
- `src/lib/lab-engine/agents/review/agentic-section-review.ts`
- `src/lib/research-v2/commit-patch.ts`
- `src/lib/research-v2/verification-tier.ts`
- `src/lib/lab-engine/agents/strategic-critic.ts`

Test:
- `src/lib/lab-engine/artifacts/__tests__/artifact-envelope.test.ts`
- `src/lib/lab-engine/agents/review/__tests__/agentic-section-review.test.ts`
- `src/lib/research-v2/__tests__/commit-patch.test.ts`
- `src/lib/research-v2/__tests__/verification-tier.test.ts`
- `src/lib/lab-engine/agents/__tests__/strategic-critic.test.ts`

### Chunk 2: Voice Of Customer Deterministic Synthesis

Create:
- `src/lib/lab-engine/agents/voice-of-customer-synthesis.ts`
- `src/lib/lab-engine/agents/__tests__/voice-of-customer-synthesis.test.ts`

Modify:
- `src/lib/lab-engine/agents/run-section.ts`
- `src/lib/lab-engine/agents/voice-of-customer-candidates.ts` only if candidate metadata needed by the synthesizer is missing.

Test:
- `src/lib/lab-engine/agents/__tests__/voice-of-customer-synthesis.test.ts`
- `src/lib/lab-engine/agents/__tests__/run-section-voice-of-customer-candidates.test.ts`
- `src/lib/lab-engine/artifacts/schemas/__tests__/voice-of-customer.test.ts`

### Chunk 3: BuyerICP Grounding Hardening

Modify:
- `src/lib/lab-engine/agents/build-prompts.ts`
- `src/lib/lab-engine/artifacts/schemas/buyer-icp.ts`
- `src/lib/lab-engine/sections/required-evidence.ts`
- `src/lib/lab-engine/sections/section-registry.ts`
- `src/lib/lab-engine/agents/run-section.ts` only for BuyerICP-specific repair triggers if schema/required-evidence errors are not already surfaced into repair issues.

Test:
- `src/lib/lab-engine/agents/__tests__/build-prompts.test.ts`
- `src/lib/lab-engine/artifacts/schemas/__tests__/buyer-icp.test.ts` (create)
- `src/lib/lab-engine/sections/__tests__/required-evidence.test.ts`
- `src/lib/lab-engine/sections/__tests__/section-registry.test.ts`
- Add a small BuyerICP repair-trigger assertion to an existing run-section test only if needed.

### Chunk 4: Proof Workflow

Modify or create docs/scripts only if the executor needs a durable recipe:
- Preferred: add proof recipe section to this plan only.
- Optional create, only if executor wants a checked-in proof helper: `docs/handoffs/2026-06-05-research-quality-live-proof-recipe.md`.

Do not modify source code in Chunk 4.

---

## Chunk 1: Trust Hygiene

### Task 1.1: Add an Explicit Review Availability State

**Problem:** `src/lib/lab-engine/agents/review/agentic-section-review.ts` returns review `tier: "needs_review"` whenever the review model fails on a non-null artifact. `src/lib/research-v2/commit-patch.ts` and `src/lib/research-v2/verification-tier.ts` then treat that as a real review downgrade and can downgrade deterministic `verified` artifacts.

- [ ] **Step 1: Write the failing artifact-envelope test**

Add a test in `src/lib/lab-engine/artifacts/__tests__/artifact-envelope.test.ts` asserting review metadata accepts an explicit unavailable outcome, for example:

```ts
expect(sectionReviewResultSchema.parse({
  upgradedMarkdown: 'Original markdown.',
  tier: 'unavailable',
  tierRationale: 'Agentic review unavailable: Failed to process successful response',
  removedItems: [],
  clientQuestions: [],
  errorDiagnostics: {
    name: 'AI_NoObjectGeneratedError',
    message: 'Failed to process successful response',
  },
}).tier).toBe('unavailable');
```

Run: `npm run test:run -- src/lib/lab-engine/artifacts/__tests__/artifact-envelope.test.ts`

Expected: FAIL because `unavailable` is not in the schema yet.

- [ ] **Step 2: Extend the schema minimally**

In `src/lib/lab-engine/artifacts/artifact-envelope.ts`, extend `sectionReviewResultSchema.tier` to include `"unavailable"` and add optional structured diagnostics:

```ts
errorDiagnostics: z.object({
  name: z.string().min(1).optional(),
  message: z.string().min(1),
  cause: z.string().min(1).optional(),
}).strict().optional()
```

Keep the existing real review tiers: `"verified" | "needs_review" | "insufficient"`.

- [ ] **Step 3: Run the schema test**

Run: `npm run test:run -- src/lib/lab-engine/artifacts/__tests__/artifact-envelope.test.ts`

Expected: PASS.

### Task 1.2: Preserve Model Error Diagnostics In Review Fallback

- [ ] **Step 1: Write failing review tests**

Update `src/lib/lab-engine/agents/review/__tests__/agentic-section-review.test.ts`:

- Existing model-failure and timeout tests should expect `tier: "unavailable"` for non-null artifacts.
- Add an assertion that `tierRationale` and `errorDiagnostics.message` preserve the AI SDK cause string, especially `Failed to process successful response` / `No object generated`.
- Keep null-artifact fallback as `tier: "insufficient"` because no artifact exists.

Run: `npm run test:run -- src/lib/lab-engine/agents/review/__tests__/agentic-section-review.test.ts`

Expected: FAIL on the current `needs_review` fallback.

- [ ] **Step 2: Implement a small diagnostics extractor**

In `agentic-section-review.ts`, add a pure helper such as:

```ts
export interface ModelErrorDiagnostics {
  name?: string;
  message: string;
  cause?: string;
}
```

Rules:
- If `error instanceof Error`, preserve `error.name` and `error.message`.
- If `error.cause instanceof Error`, preserve `error.cause.message`.
- If the error is not an `Error`, use `String(error)`.
- Do not stringify huge provider payloads; cap each string at a conservative length such as 1,000 chars.

- [ ] **Step 3: Return unavailable for non-null fallback**

Change `buildFallbackReview()`:

- `artifact === null` remains `tier: "insufficient"`.
- `artifact !== null` becomes `tier: "unavailable"`.
- Include `errorDiagnostics`.
- Keep `upgradedMarkdown` equal to the original artifact markdown.

- [ ] **Step 4: Run the review tests**

Run: `npm run test:run -- src/lib/lab-engine/agents/review/__tests__/agentic-section-review.test.ts`

Expected: PASS.

### Task 1.3: Do Not Let Unavailable Review Downgrade Deterministic Verification

- [ ] **Step 1: Write failing verification-tier tests**

In `src/lib/research-v2/__tests__/verification-tier.test.ts`, add:

- Base `verified` + review `unavailable` stays `verified`.
- Base `needs_review` + review `unavailable` stays `needs_review`.
- Base `insufficient` + review `unavailable` stays `insufficient`.
- No base flag + review `unavailable` should produce a `needs_review` or `null` flag only if the implementation needs a UI badge; it must not masquerade as deterministic `verified`.

Run: `npm run test:run -- src/lib/research-v2/__tests__/verification-tier.test.ts`

Expected: FAIL because `BuildReviewVerificationFlagInput.tier` currently only supports deterministic tiers.

- [ ] **Step 2: Widen the input but keep output tiers unchanged**

In `src/lib/research-v2/verification-tier.ts`:

- Keep `VerificationTier = "verified" | "needs_review" | "insufficient"` for persisted deterministic UI tiers.
- Add `ReviewTier = VerificationTier | "unavailable"` or import the schema-inferred type if that is cleaner.
- If review tier is `"unavailable"` and `baseFlag` exists, return `baseFlag` unchanged.
- If review tier is `"unavailable"` and no `baseFlag` exists, derive a conservative `needs_review` flag with `verifiedCount: 0`, `unsupportedCount: 0`, `totalClaims: 0`, `confidence: 0`, `evidenceGap: false`, or return `null` if callers can handle it. Prefer the smaller diff that keeps existing return type compatibility.

- [ ] **Step 3: Add commit-patch coverage**

In `src/lib/research-v2/__tests__/commit-patch.test.ts`, add a test:

- Artifact has deterministic verification `{ verifiedCount: 10, unsupportedCount: 0 }`.
- Artifact review has `tier: "unavailable"`.
- Expected `patch.markdown` can still use fallback/upgraded markdown if present.
- Expected `patch.verificationTier === "verified"`.
- Expected `patch.verificationFlag.tier === "verified"`.

Run: `npm run test:run -- src/lib/research-v2/__tests__/commit-patch.test.ts src/lib/research-v2/__tests__/verification-tier.test.ts`

Expected: PASS after the implementation.

### Task 1.4: Preserve Strategic Critic Failure Diagnostics Without Pretending It Ran

**Problem:** `src/lib/lab-engine/agents/strategic-critic.ts` catches provider/parse errors and returns the original artifact without `strategicCritique`, capping the rubric around `8/10`. The current summary can hide useful AI SDK details like `Failed to process successful response`.

- [ ] **Step 1: Write failing critic tests**

In `src/lib/lab-engine/agents/__tests__/strategic-critic.test.ts`, add assertions that a provider/parse failure returns:

- `outcome: "fallback"`
- original artifact unchanged
- a structured diagnostics field on the result, for example `errorDiagnostics.message`
- `summary` includes the exact useful provider/parse message
- no `strategicCritique` is attached to the fallback artifact

Run: `npm run test:run -- src/lib/lab-engine/agents/__tests__/strategic-critic.test.ts`

Expected: FAIL because result diagnostics are not structured.

- [ ] **Step 2: Extend only the result type**

In `strategic-critic.ts`, extend `CrossSectionStrategicCriticResult` with optional `errorDiagnostics`, using the same small diagnostics helper style as review fallback.

Do not attach diagnostics to the artifact body unless a downstream consumer already has a field for it. The fallback artifact should remain the original artifact so absence of `strategicCritique` still means the critic did not run.

- [ ] **Step 3: Run trust-hygiene focused tests**

Run:

```bash
npm run test:run -- \
  src/lib/lab-engine/artifacts/__tests__/artifact-envelope.test.ts \
  src/lib/lab-engine/agents/review/__tests__/agentic-section-review.test.ts \
  src/lib/research-v2/__tests__/verification-tier.test.ts \
  src/lib/research-v2/__tests__/commit-patch.test.ts \
  src/lib/lab-engine/agents/__tests__/strategic-critic.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit Chunk 1**

```bash
git add \
  src/lib/lab-engine/artifacts/artifact-envelope.ts \
  src/lib/lab-engine/artifacts/__tests__/artifact-envelope.test.ts \
  src/lib/lab-engine/agents/review/agentic-section-review.ts \
  src/lib/lab-engine/agents/review/__tests__/agentic-section-review.test.ts \
  src/lib/research-v2/verification-tier.ts \
  src/lib/research-v2/__tests__/verification-tier.test.ts \
  src/lib/research-v2/commit-patch.ts \
  src/lib/research-v2/__tests__/commit-patch.test.ts \
  src/lib/lab-engine/agents/strategic-critic.ts \
  src/lib/lab-engine/agents/__tests__/strategic-critic.test.ts
git commit -m "fix: separate unavailable review from verification downgrade"
```

Expected: atomic commit containing only trust-hygiene files.

---

## Chunk 2: Voice Of Customer Deterministic Synthesis

### Task 2.1: Specify The Pure Synthesizer Contract

**Problem:** `src/lib/lab-engine/agents/voice-of-customer-candidates.ts` can build a valid candidate pack, but `src/lib/lab-engine/agents/run-section.ts` only injects it into the model prompt. When structured synthesis fails with `No object generated: response did not match schema`, current fallback commits `evidenceGap=true` with zero pain/success quotes even when candidate evidence exists.

- [ ] **Step 1: Create failing synthesizer tests**

Create `src/lib/lab-engine/agents/__tests__/voice-of-customer-synthesis.test.ts`.

Test cases:
- A valid candidate pack with at least 10 candidates across at least 3 independent domains returns a complete `VoiceOfCustomerSectionOutput`-compatible artifact body.
- The synthesized artifact has `body.evidenceGap !== true`.
- `body.painLanguage.quotes.length >= 10`.
- Pain quotes use candidate snippets as verbatim text and candidate URLs as `sourceUrl`.
- Top-level `sources` include distinct candidate URLs.
- If a candidate pack has too few quotes, too few domains, audited-company self-sourcing, or single-source majority, the synthesizer returns an explicit gap result, not a non-gap artifact.
- If the synthesized body fails `validateVoiceOfCustomerMinimums()` or `checkVoiceOfCustomerSelfSourcing()`, the result is a gap.

Run: `npm run test:run -- src/lib/lab-engine/agents/__tests__/voice-of-customer-synthesis.test.ts`

Expected: FAIL because the file does not exist yet.

### Task 2.2: Implement `voice-of-customer-synthesis.ts`

- [ ] **Step 1: Build a pure deterministic synthesizer**

Create `src/lib/lab-engine/agents/voice-of-customer-synthesis.ts`.

Export a function with a narrow shape, for example:

```ts
export function synthesizeVoiceOfCustomerFromCandidates(input: {
  candidateResult: VoiceOfCustomerCandidateResult;
  researchInput: ResearchInput;
  now: () => Date;
}): VoiceOfCustomerSynthesisResult
```

Result should be a tagged union:

```ts
type VoiceOfCustomerSynthesisResult =
  | { ok: true; output: VoiceOfCustomerSectionOutput }
  | { ok: false; gap: VoiceOfCustomerGapLike };
```

Rules:
- Do not call models or tools.
- Do not invent quotes, reviewer names, dates, competitors, prices, or statistics.
- Promote only from `candidateResult.ok === true`.
- Use candidate snippets verbatim as quote text after trimming.
- Map candidate source to the existing VoC quote source enum: `g2`, `reddit`, `hackernews`, `support-thread`, or `other`.
- Use candidate domain diversity from `selectVoiceOfCustomerCandidates()`.
- Create only conservative prose derived from counts/domains, for example: "The acquired candidate pack shows repeated buyer-language around <theme> across <n> independent sources."
- Avoid fake success quotes if the pack only contains pain language. Prefer conservative success-language entries only when source snippets actually express an after-state; otherwise return a gap if the schema/minimums cannot be satisfied honestly.

- [ ] **Step 2: Validate before returning `ok: true`**

Before returning non-gap output:

- Parse with `voiceOfCustomerSectionOutputSchema`.
- Wrap/validate through `artifactEnvelopeSchema.extend({ body: voiceOfCustomerBodySchema })` if needed by existing validators.
- Run `validateVoiceOfCustomerMinimums()`.
- Run `checkVoiceOfCustomerSelfSourcing({ subjectDomain })`.
- Ensure no single domain supplies a majority of pain quotes.
- If any check fails, return `ok: false` with the exact failed issues.

- [ ] **Step 3: Run synthesizer tests**

Run: `npm run test:run -- src/lib/lab-engine/agents/__tests__/voice-of-customer-synthesis.test.ts`

Expected: PASS.

### Task 2.3: Wire Deterministic Synthesis Into Both VoC Fallback Paths

- [ ] **Step 1: Write failing run-section tests**

In `src/lib/lab-engine/agents/__tests__/run-section-voice-of-customer-candidates.test.ts`, add coverage for both paths:

- Answer-tool path: model structured generation fails after candidate prepass succeeds; expected committed artifact is non-gap deterministic synthesis when candidate pack passes.
- Structured-body streaming path: same expected behavior.
- If candidate pack is invalid, expected committed artifact remains honest `evidenceGap=true` with `evidenceGapReport`, not a fabricated non-gap body.

Run: `npm run test:run -- src/lib/lab-engine/agents/__tests__/run-section-voice-of-customer-candidates.test.ts`

Expected: FAIL because `run-section.ts` currently falls back to evidence-gap on structured synthesis failure.

- [ ] **Step 2: Add a small fallback helper in `run-section.ts`**

In `src/lib/lab-engine/agents/run-section.ts`, near existing VoC fallback helpers, add a helper like:

```ts
function buildVoiceOfCustomerDeterministicSynthesisArtifact(...)
```

Rules:
- It is only used when `sectionId === "positioningVoiceOfCustomer"` and `voiceOfCustomerPrepass?.result.ok === true`.
- It calls `synthesizeVoiceOfCustomerFromCandidates()`.
- If synthesis returns `ok: true`, convert output to the same `ArtifactEnvelope` shape existing attempts commit.
- If synthesis returns `ok: false`, fall through to existing `buildVoiceOfCustomerStructuredFailureEvidenceGapArtifact()`.

- [ ] **Step 3: Insert in answer-tool fallback**

In the answer-tool fallback block around the existing `buildVoiceOfCustomerStructuredFailureEvidenceGapArtifact()` call, try deterministic synthesis before evidence-gap.

Expected precedence:
1. Existing valid model artifact.
2. Existing attempt evidence-gap artifact.
3. Deterministic VoC synthesis if candidate pack is valid and all validators pass.
4. Existing structured-failure evidence-gap artifact.

- [ ] **Step 4: Insert in structured-body fallback**

Apply the same precedence in the structured-body fallback block where `hasVoiceOfCustomerStructuredSynthesisFailure()` currently leads to evidence gap.

- [ ] **Step 5: Run VoC focused tests**

Run:

```bash
npm run test:run -- \
  src/lib/lab-engine/agents/__tests__/voice-of-customer-candidates.test.ts \
  src/lib/lab-engine/agents/__tests__/voice-of-customer-synthesis.test.ts \
  src/lib/lab-engine/agents/__tests__/run-section-voice-of-customer-candidates.test.ts \
  src/lib/lab-engine/artifacts/schemas/__tests__/voice-of-customer.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Chunk 2**

```bash
git add \
  src/lib/lab-engine/agents/voice-of-customer-synthesis.ts \
  src/lib/lab-engine/agents/__tests__/voice-of-customer-synthesis.test.ts \
  src/lib/lab-engine/agents/run-section.ts \
  src/lib/lab-engine/agents/__tests__/run-section-voice-of-customer-candidates.test.ts \
  src/lib/lab-engine/agents/voice-of-customer-candidates.ts
git commit -m "fix: synthesize voice of customer from acquired candidates"
```

Only include `voice-of-customer-candidates.ts` if it was actually changed.

---

## Chunk 3: BuyerICP Grounding Hardening

### Task 3.1: Remove Role-Label Persona Allowance From Prompt Guidance

**Problem:** `src/lib/lab-engine/agents/build-prompts.ts` currently tells the model: "If evidence has only a role or segment, make `name` a role/segment label..." That allows fake persona rows to satisfy `name`.

- [ ] **Step 1: Write failing prompt test**

In `src/lib/lab-engine/agents/__tests__/build-prompts.test.ts`, add/adjust BuyerICP prompt assertions:

- Prompt must not contain "make `name` a role/segment label".
- Prompt must require `name` to be a named person/handle from source evidence or an explicit evidence gap row that does not count as a valid persona.
- Prompt must say role/segment labels cannot satisfy `personas[].name`.

Run: `npm run test:run -- src/lib/lab-engine/agents/__tests__/build-prompts.test.ts`

Expected: FAIL.

- [ ] **Step 2: Update prompt guidance**

In `src/lib/lab-engine/agents/build-prompts.ts`, replace the allowance with:

- Do not invent named people.
- `personas[].name` must be a real person name, public reviewer handle, or named buyer/source identity present in fetched evidence.
- Role labels, segments, departments, seniority labels, and company names do not satisfy `name`.
- If no named buyer identity is available, write an evidence gap in prose and do not pad persona rows with role labels.

- [ ] **Step 3: Run prompt test**

Run: `npm run test:run -- src/lib/lab-engine/agents/__tests__/build-prompts.test.ts`

Expected: PASS.

### Task 3.2: Tighten BuyerICP Schema Minimums

- [ ] **Step 1: Create failing BuyerICP schema tests**

Create `src/lib/lab-engine/artifacts/schemas/__tests__/buyer-icp.test.ts`.

Use `src/lib/lab-engine/fixtures/buyer-icp-artifact.ts` as the valid base.

Test failures:
- `personas[].name = "Economic buyer"` fails.
- `personas[].name = "Finance leaders"` fails.
- `personas[].name` equal to the persona `role`, `title`, `company`, or known segment label fails.
- Invalid row-level `sourceUrl` fails for firmographic cuts, personas, triggers, and cluster venues.
- Awareness `share` values that are unsupported estimates such as `"42%"` without model-estimate/evidence provenance fail.
- Awareness rows must include either a real `sampleQuery` source/provenance or evidence text that clearly labels the value as `[model estimate - not tool-measured]`.
- Duplicate or empty awareness levels still fail.

Run: `npm run test:run -- src/lib/lab-engine/artifacts/schemas/__tests__/buyer-icp.test.ts`

Expected: FAIL because only persona source URL and counts are currently checked.

- [ ] **Step 2: Add pure helper validators in `buyer-icp.ts`**

Add small pure helpers:

- `isHttpUrl(value: string): boolean` using `new URL()` and protocol check.
- `isRoleOrSegmentLabelName(persona): boolean`.
- `isLikelyNamedBuyerIdentity(name: string): boolean` with conservative rules: accepts multi-token human-like names or handles; rejects generic role/segment phrases.
- `isModelEstimateLabeled(value: string): boolean` for strings containing `[model estimate - not tool-measured]` or an equivalent exact label used elsewhere in the repo.

Keep these helpers local unless another module needs them.

- [ ] **Step 3: Apply minimum checks**

In `validateBuyerICPMinimums()`:

- Reject persona names that are role/segment/title/company labels.
- Reject persona names that are generic labels rather than named identities/handles.
- Validate `sourceUrl` on all row-level source fields: `firmographicCuts[].sourceUrl`, `personas[].sourceUrl`, optional `buyingContext.triggers[].sourceUrl`, and `clusters.venues[].sourceUrl`.
- For awareness rows, reject numeric/percentage-looking `share` values unless evidence labels them as model estimate or cites a fetched query/source. Do not require percentages; qualitative `low|medium|high` style can pass only if evidence explains the basis.
- Keep existing count/distinctness checks.

- [ ] **Step 4: Run BuyerICP schema tests**

Run: `npm run test:run -- src/lib/lab-engine/artifacts/schemas/__tests__/buyer-icp.test.ts`

Expected: PASS.

### Task 3.3: Tighten Required Evidence For BuyerICP

- [ ] **Step 1: Write failing required-evidence tests**

In `src/lib/lab-engine/sections/__tests__/required-evidence.test.ts`, add:

- `icp_persona` fails when personas exist but every name is a role/segment label.
- `icp_quote_or_gap` fails when evidence is generic filler and there is no explicit nested gap.
- `icp_quote_or_gap` passes when an explicit capability/evidence gap is present.

Run: `npm run test:run -- src/lib/lab-engine/sections/__tests__/required-evidence.test.ts`

Expected: FAIL because `hasIcpPersona()` only checks non-empty `name`.

- [ ] **Step 2: Update required-evidence checks**

In `src/lib/lab-engine/sections/required-evidence.ts`:

- Add local generic-label detection for `icp_persona`, or import a named helper from `buyer-icp.ts` if exported.
- Treat persona rows as evidence only when they have a valid-looking name and valid source URL.
- Treat `icp_quote_or_gap` as satisfied only by substantive evidence text, trigger evidence text, or explicit nested gap. Do not count empty/generic text such as "evidence gap" unless it is in an actual gap/report field.

- [ ] **Step 3: Run required-evidence tests**

Run: `npm run test:run -- src/lib/lab-engine/sections/__tests__/required-evidence.test.ts`

Expected: PASS.

### Task 3.4: Add BuyerICP Repair Triggers And Bounded Lookup Increase

- [ ] **Step 1: Decide whether a lookup increase is justified**

Current BuyerICP `maxExternalLookups` in `src/lib/lab-engine/sections/section-registry.ts` is `4`.

If schema/required-evidence tests show the model needs more room for named personas and source URLs, increase only BuyerICP to `5` or `6`. Do not change other sections. Document the exact rationale in the code comment:

```ts
// BuyerICP needs one extra bounded lookup to verify named persona/source rows
// after role-label persona padding was removed.
maxExternalLookups: 5,
```

If not justified by tests, leave the budget unchanged.

- [ ] **Step 2: Add/adjust section-registry test**

In `src/lib/lab-engine/sections/__tests__/section-registry.test.ts`, assert the expected BuyerICP budget and required evidence classes.

Run: `npm run test:run -- src/lib/lab-engine/sections/__tests__/section-registry.test.ts`

Expected: PASS.

- [ ] **Step 3: Ensure repair sees BuyerICP validator issues**

Inspect `src/lib/lab-engine/agents/run-section.ts` around `getAttemptRepairIssues()` and the answer-tool/structured-body repair loops.

If minimum validator errors already flow into repair issues, no code change needed. If BuyerICP validator errors are filtered out or treated as non-repairable, add a narrow BuyerICP repair trigger for:

- invalid persona names,
- invalid row source URLs,
- unsupported awareness shares/estimates.

Do not add broad retries or loops.

- [ ] **Step 4: Run BuyerICP focused tests**

Run:

```bash
npm run test:run -- \
  src/lib/lab-engine/agents/__tests__/build-prompts.test.ts \
  src/lib/lab-engine/artifacts/schemas/__tests__/buyer-icp.test.ts \
  src/lib/lab-engine/sections/__tests__/required-evidence.test.ts \
  src/lib/lab-engine/sections/__tests__/section-registry.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Chunk 3**

```bash
git add \
  src/lib/lab-engine/agents/build-prompts.ts \
  src/lib/lab-engine/agents/__tests__/build-prompts.test.ts \
  src/lib/lab-engine/artifacts/schemas/buyer-icp.ts \
  src/lib/lab-engine/artifacts/schemas/__tests__/buyer-icp.test.ts \
  src/lib/lab-engine/sections/required-evidence.ts \
  src/lib/lab-engine/sections/__tests__/required-evidence.test.ts \
  src/lib/lab-engine/sections/section-registry.ts \
  src/lib/lab-engine/sections/__tests__/section-registry.test.ts \
  src/lib/lab-engine/agents/run-section.ts
git commit -m "fix: tighten buyer icp grounding validators"
```

Only include `run-section.ts` if it changed.

---

## Chunk 4: Proof Workflow

This chunk is post-code/live proof, not unit-test proof. Do not use it to claim code correctness until Chunks 1-3 have passed focused tests and the final verification gates below.

### Task 4.1: Final Local Verification Gates

- [ ] **Step 1: Run all focused blocker tests**

Run:

```bash
npm run test:run -- \
  src/lib/lab-engine/ai/__tests__/models.test.ts \
  src/lib/lab-engine/agents/review/__tests__/agentic-section-review.test.ts \
  src/lib/lab-engine/agents/__tests__/strategic-critic.test.ts \
  src/lib/lab-engine/agents/tools/__tests__/reviews.test.ts \
  src/lib/lab-engine/agents/__tests__/voice-of-customer-candidates.test.ts \
  src/lib/lab-engine/agents/__tests__/voice-of-customer-synthesis.test.ts \
  src/lib/lab-engine/agents/__tests__/run-section-voice-of-customer-candidates.test.ts \
  src/lib/lab-engine/artifacts/schemas/__tests__/voice-of-customer.test.ts \
  src/lib/lab-engine/artifacts/schemas/__tests__/buyer-icp.test.ts \
  src/lib/lab-engine/sections/__tests__/required-evidence.test.ts \
  src/lib/lab-engine/sections/__tests__/section-registry.test.ts \
  src/lib/research-v3/__tests__/live-quality-gate.test.ts \
  src/lib/research-v2/__tests__/share-snapshot.test.ts \
  src/lib/research-v2/__tests__/supabase-run-store.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full Vitest suite**

Run: `npm run test:run`

Expected: PASS. If pre-existing known failures appear, record exact test names and errors; do not hide them.

- [ ] **Step 3: Run TypeScript**

Run: `npx tsc --noEmit --pretty false`

Expected: PASS. If known pre-existing OpenRouter/chat blueprint errors appear, record exact errors and confirm they are unrelated to touched files.

- [ ] **Step 4: Run lint**

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 5: Run production build**

Run: `npm run build`

Expected: PASS with Next.js production build complete.

### Task 4.2: Controlled Rerun Recipe For Existing Session

Use this after code is merged/available in the target runtime and env is configured. This is live proof, not unit-test proof.

Prereqs:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Supabase service/admin env used by `createAdminClient()`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `DEEPSEEK_API_KEY`
- `PERPLEXITY_API_KEY`
- `BRAVE_SEARCH_API_KEY`
- `SEARCHAPI_KEY`
- `LAB_ENGINE_PROVIDER=deepseek-direct`
- `LAB_ENGINE_LIVE_TOOLS` unset or not `"false"`
- Set verifier ceiling intentionally. Do not leave `LAB_VERIFIER_MAX_UNSUPPORTED` ambiguous if strict proof is required.

- [ ] **Step 1: Start local app**

Run: `npm run dev`

Expected: Next.js available at `http://localhost:3000`.

- [ ] **Step 2: Confirm authenticated browser/session**

Open `/research-v3` in an authenticated browser session. Do not start paid/live reruns until auth is confirmed.

- [ ] **Step 3: Rerun BuyerICP and VoC only**

From the authenticated browser or an authenticated script, call:

```http
POST /api/research-v2/rerun-section
{ "runId": "<RUN_ID>", "zone": "positioningBuyerICP" }
```

Then:

```http
POST /api/research-v2/rerun-section
{ "runId": "<RUN_ID>", "zone": "positioningVoiceOfCustomer" }
```

Expected:
- BuyerICP completes with no role-label persona padding.
- VoC either commits a validated non-gap artifact from acquired candidate quotes or an honest `evidenceGap=true` with acquisition facts. It must not commit a non-gap artifact unless schema/minimums/self-source/source-diversity pass.

- [ ] **Step 4: Rerun cross-section and synthesis after six positioning sections are complete**

Call:

```http
POST /api/research-v2/rerun-section
{ "runId": "<RUN_ID>", "zone": "positioningCrossSectionReasoning" }
```

Then:

```http
POST /api/research-v2/rerun-section
{ "runId": "<RUN_ID>", "zone": "positioningSynthesis" }
```

Then, if the paid media plan is part of the accepted proof scope:

```http
POST /api/research-v2/rerun-section
{ "runId": "<RUN_ID>", "zone": "positioningPaidMediaPlan" }
```

Expected:
- Cross-section can include `strategicCritique` only if the critic actually ran.
- If critic fallback occurs, diagnostics are visible in logs/result metadata without pretending a critique exists.
- Synthesis propagates the fixed section bodies already handled in `src/lib/research-v2/supabase-run-store.ts`.

- [ ] **Step 5: Create share snapshot**

Call from authenticated session:

```http
POST /api/share
{ "sessionId": "<RUN_ID>", "title": "<Company> Research Quality Proof" }
```

Expected:
- Response includes `shareUrl` and `shareToken`.
- `src/lib/research-v2/share-snapshot.ts` snapshots `schemaVersion: "research-v3"` from `research_artifact_sections`.

- [ ] **Step 6: Run DB-backed quality gate report**

Run:

```bash
npx tsx scripts/research-quality-gate-report.ts \
  --run-id <RUN_ID> \
  --out tmp/research-quality-gate-<RUN_ID>.md \
  --json-out tmp/research-quality-gate-<RUN_ID>.json
```

Expected:
- Report reads `journey_sessions`, `research_artifacts`, `research_artifact_sections`, `research_section_runs`, profile persistence, and latest share snapshot.
- BuyerICP and VoC gates reflect the new validators.
- Share snapshot includes the fixed committed sections.
- If VoC remains `evidenceGap=true`, the report should classify it as an honest evidence gap, not a failed fabrication.

### Task 4.3: Fresh `/research-v3` One-Shot Proof

- [ ] **Step 1: Start from a fresh `/research-v3` URL entry**

Use a single approved target company. Do not loop paid APIs. Record absolute start time and target URL.

- [ ] **Step 2: Let corpus complete, confirm GTM brief, and run sections once**

Expected:
- `deepResearchProgram` completes.
- GTM brief opens and submits.
- All six positioning sections complete or expose honest gaps.
- BuyerICP and VoC do not pass by padding.

- [ ] **Step 3: Run share + quality report for the fresh run**

Repeat Task 4.2 Steps 5-6 for the fresh run ID.

Expected:
- Fresh one-shot proof is separate from the controlled rerun proof.
- Any failure is reported with exact error strings and DB row evidence.

---

## Final Integrated Verification Checklist

- [ ] Focused blocker tests pass.
- [ ] `npm run test:run` passes or exact unrelated pre-existing failures are recorded.
- [ ] `npx tsc --noEmit --pretty false` passes or exact unrelated pre-existing failures are recorded.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] Controlled BuyerICP + VoC rerun proof completed after code verification.
- [ ] Cross-section + synthesis rerun completed after BuyerICP + VoC.
- [ ] Share snapshot created through `POST /api/share`.
- [ ] DB-backed quality gate report written under `tmp/`.
- [ ] Fresh `/research-v3` one-shot proof completed or explicitly marked blocked with exact blocker.

## Human Clarification

No blocker requires human clarification before implementation. The only live-proof inputs a human may need to provide are the authenticated browser session and the approved target `RUN_ID` / company URL for paid reruns.
