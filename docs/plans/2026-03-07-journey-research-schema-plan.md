# Journey Research Schemas Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add typed per-section Journey research schemas and normalization so research cards can render structured data while preserving the existing content fallback and source metadata envelope.

**Architecture:** Keep the shared research result envelope in `generateResearch`, then add a section-aware normalization layer that validates typed `data` per section before persistence. Roll out section schemas in waves, starting with the sections that already align closely with existing cards and legacy schema assets.

**Tech Stack:** TypeScript, Zod, Vercel AI SDK, existing Journey chat flow, existing research card components, Vitest.

**Design doc:** `docs/plans/2026-03-07-journey-research-schema-design.md`

**Execution scope for the first implementation session:** Complete only Tasks 1-5, then stop and report results for review before starting wave 2 or wave 3.

**Repo safety rule:** Do not create git commits unless the user explicitly asks for them. Treat the commit snippets in this plan as optional checkpoint commands, not mandatory actions.

---

## Task 1: Add Journey schema module scaffold

**Files:**
- Create: `src/lib/journey/schemas/base.ts`
- Create: `src/lib/journey/schemas/index.ts`
- Create: `src/lib/journey/schemas/industry-research.ts`
- Create: `src/lib/journey/schemas/competitor-intel.ts`
- Create: `src/lib/journey/schemas/icp-validation.ts`
- Create: `src/lib/journey/schemas/offer-analysis.ts`
- Create: `src/lib/journey/schemas/strategic-synthesis.ts`
- Create: `src/lib/journey/schemas/keyword-intel.ts`
- Create: `src/lib/journey/schemas/media-plan.ts`
- Test: `src/lib/journey/__tests__/research-section-schemas.test.ts`

**Step 1: Write the failing test**

Create a schema smoke test that imports the new section schema map and verifies:

- all 7 canonical section IDs exist
- each schema accepts a representative valid payload
- invalid payloads fail

Use representative minimum fixtures per section, not full production fixtures.

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test:run -- src/lib/journey/__tests__/research-section-schemas.test.ts
```

Expected: FAIL because the schema modules do not exist yet.

**Step 3: Write minimal implementation**

Implement:

- a shared base helper file with common reusable schema fragments
- one schema file per Journey section
- an index file exporting:
  - section payload types
  - schema map keyed by canonical section ID

Schema design rules:

- keep field names aligned with current card expectations
- allow optional carryover fields only when they map cleanly
- avoid importing the legacy schemas wholesale

**Step 4: Run test to verify it passes**

Run:

```bash
npm run test:run -- src/lib/journey/__tests__/research-section-schemas.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/journey/schemas src/lib/journey/__tests__/research-section-schemas.test.ts
git commit -m "feat: add journey research section schemas"
```

---

## Task 2: Add section-aware normalization helper

**Files:**
- Create: `src/lib/journey/normalize-section-data.ts`
- Test: `src/lib/journey/__tests__/normalize-section-data.test.ts`

**Step 1: Write the failing test**

Add tests that verify:

- valid section payload returns typed `data`
- invalid section payload returns `undefined` for `data`
- normalization does not throw when parsing fails
- the helper is section-aware by `sectionId`

Include fixtures for at least:

- `offerAnalysis`
- `strategicSynthesis`
- one negative case

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test:run -- src/lib/journey/__tests__/normalize-section-data.test.ts
```

Expected: FAIL because the helper does not exist.

**Step 3: Write minimal implementation**

Implement a helper that accepts:

- `sectionId`
- raw structured candidate data

And returns:

- typed validated `data` when parsing succeeds
- `undefined` when parsing fails

Keep this helper pure and free of persistence concerns.

**Step 4: Run test to verify it passes**

Run:

```bash
npm run test:run -- src/lib/journey/__tests__/normalize-section-data.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/journey/normalize-section-data.ts src/lib/journey/__tests__/normalize-section-data.test.ts
git commit -m "feat: add journey section data normalizer"
```

---

## Task 3: Extend `generateResearch` normalization contract

**Files:**
- Modify: `src/lib/ai/tools/generate-research.ts`
- Test: `src/lib/ai/tools/__tests__/generate-research.test.ts`

**Step 1: Write the failing test**

Add tests that verify `normalizeGeneratedResearchResult()` now:

- preserves existing metadata behavior
- includes typed `data` when provided and valid
- omits `data` when parsing fails
- still returns a valid result if only `content` + citations exist

Focus first on:

- `offerAnalysis`
- `strategicSynthesis`

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test:run -- src/lib/ai/tools/__tests__/generate-research.test.ts
```

Expected: FAIL because the function does not yet attach typed `data`.

**Step 3: Write minimal implementation**

Update the section result normalizer to:

- keep `content`, `citations`, `provenance`, `claims`, `missingData`, and `fileIds`
- derive typed `data` through the section-aware normalization helper
- return the same outer shape to the tool caller

Do not remove the generic metadata fields.

**Step 4: Run test to verify it passes**

Run:

```bash
npm run test:run -- src/lib/ai/tools/__tests__/generate-research.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/ai/tools/generate-research.ts src/lib/ai/tools/__tests__/generate-research.test.ts
git commit -m "feat: attach typed journey research data"
```

---

## Task 4: Preserve typed `data` through session extraction and persistence

**Files:**
- Modify: `src/lib/journey/session-state.ts`
- Modify: `src/lib/journey/__tests__/session-state.test.ts`

**Step 1: Write the failing test**

Add coverage ensuring `extractResearchOutputs()` preserves a typed `data` object for `tool-generateResearch` outputs instead of collapsing everything back to metadata-only fields.

Add one test using:

- a typed `offerAnalysis` payload
- a typed `strategicSynthesis` payload

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test:run -- src/lib/journey/__tests__/session-state.test.ts
```

Expected: FAIL because the extracted output does not yet preserve section `data`.

**Step 3: Write minimal implementation**

Update `extractResearchOutputs()` so the persisted `research_results[section].data` includes:

- generic metadata fields
- typed section payload when available

Do not change the outer `research_results` record shape.

**Step 4: Run test to verify it passes**

Run:

```bash
npm run test:run -- src/lib/journey/__tests__/session-state.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/journey/session-state.ts src/lib/journey/__tests__/session-state.test.ts
git commit -m "feat: persist typed journey research payloads"
```

---

## Task 5: Tighten card input types for wave 1 sections

**Files:**
- Modify: `src/components/journey/research-cards/types.ts`
- Modify: `src/components/journey/research-cards/offer-analysis-card.tsx`
- Modify: `src/components/journey/research-cards/strategy-summary-card.tsx`
- Test: `src/components/journey/__tests__/chat-message.test.tsx`

**Step 1: Write the failing test**

Add or update rendering tests that verify:

- `OfferAnalysisCard` renders rich UI from typed `data`
- `StrategySummaryCard` renders rich UI from typed `data`
- cards still fall back to `content` when typed `data` is absent

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test:run -- src/components/journey/__tests__/chat-message.test.tsx
```

Expected: FAIL because the cards and shared prop types still treat `data` as an untyped record.

**Step 3: Write minimal implementation**

Introduce stronger prop typing for wave 1 sections:

- allow `ResearchCardCommonProps` to remain compatible with generic cards
- narrow `data` within `OfferAnalysisCard` and `StrategySummaryCard`
- keep fallback rendering untouched

Do not refactor all cards in this task.

**Step 4: Run test to verify it passes**

Run:

```bash
npm run test:run -- src/components/journey/__tests__/chat-message.test.tsx
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/journey/research-cards/types.ts src/components/journey/research-cards/offer-analysis-card.tsx src/components/journey/research-cards/strategy-summary-card.tsx src/components/journey/__tests__/chat-message.test.tsx
git commit -m "refactor: type wave one journey research cards"
```

---

## Task 6: Update wave 1 skills to emit parseable structured sections

**Files:**
- Modify: `src/lib/ai/skills/offer-analysis/SKILL.md`
- Modify: `src/lib/ai/skills/strategic-synthesis/SKILL.md`

**Step 1: Write the failing test**

There is no current automated test harness for skill markdown, so create a lightweight unit test around the normalizer that uses text examples shaped by the new skill instructions.

If a dedicated test is unnecessary, document the exact manual verification prompt in the implementation PR notes for this task.

**Step 2: Run verification to establish baseline**

Run the existing tests that cover the normalizer and `generateResearch` after these prompt changes:

```bash
npm run test:run -- src/lib/ai/tools/__tests__/generate-research.test.ts src/lib/journey/__tests__/normalize-section-data.test.ts
```

Expected: PASS before and after the prompt update.

**Step 3: Write minimal implementation**

Update both skill files to require:

- a short narrative report
- an explicit fenced `journey-data` payload block with stable field labels
- no extra fields outside the documented schema
- citation preservation in the narrative portion

Do not convert the entire skill to JSON-only output.

**Step 4: Run verification again**

Run:

```bash
npm run test:run -- src/lib/ai/tools/__tests__/generate-research.test.ts src/lib/journey/__tests__/normalize-section-data.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/ai/skills/offer-analysis/SKILL.md src/lib/ai/skills/strategic-synthesis/SKILL.md
git commit -m "docs: structure wave one journey research skills"
```

---

## Task 7: Add wave 2 schemas and normalization coverage

**Files:**
- Modify: `src/lib/journey/schemas/industry-research.ts`
- Modify: `src/lib/journey/schemas/competitor-intel.ts`
- Modify: `src/lib/journey/normalize-section-data.ts`
- Test: `src/lib/journey/__tests__/normalize-section-data.test.ts`
- Test: `src/lib/ai/tools/__tests__/generate-research.test.ts`

**Step 1: Write the failing test**

Add normalization tests for:

- `industryResearch`
- `competitorIntel`

Verify the parser returns typed `data` for valid payloads and clean fallback for invalid payloads.

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test:run -- src/lib/journey/__tests__/normalize-section-data.test.ts src/lib/ai/tools/__tests__/generate-research.test.ts
```

Expected: FAIL because these sections are not yet covered.

**Step 3: Write minimal implementation**

Extend the section schema map and normalizer to support wave 2 sections using the current card contract as the source of truth.

**Step 4: Run test to verify it passes**

Run:

```bash
npm run test:run -- src/lib/journey/__tests__/normalize-section-data.test.ts src/lib/ai/tools/__tests__/generate-research.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/journey/schemas/industry-research.ts src/lib/journey/schemas/competitor-intel.ts src/lib/journey/normalize-section-data.ts src/lib/journey/__tests__/normalize-section-data.test.ts src/lib/ai/tools/__tests__/generate-research.test.ts
git commit -m "feat: support wave two journey research schemas"
```

---

## Task 8: Add wave 3 schemas for ICP, keywords, and lightweight media plan

**Files:**
- Modify: `src/lib/journey/schemas/icp-validation.ts`
- Modify: `src/lib/journey/schemas/keyword-intel.ts`
- Modify: `src/lib/journey/schemas/media-plan.ts`
- Modify: `src/lib/journey/normalize-section-data.ts`
- Test: `src/lib/journey/__tests__/normalize-section-data.test.ts`

**Step 1: Write the failing test**

Add tests covering:

- simplified Journey-first ICP payload
- Journey keyword payload
- Journey media plan preview payload

The tests must prove these are not just imports of the legacy schemas.

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test:run -- src/lib/journey/__tests__/normalize-section-data.test.ts
```

Expected: FAIL because wave 3 coverage is missing.

**Step 3: Write minimal implementation**

Implement Journey-specific schemas for:

- `icpValidation`
- `keywordIntel`
- `mediaPlan`

Keep them smaller than the legacy blueprint pipeline models and aligned to the current card renderers.

**Step 4: Run test to verify it passes**

Run:

```bash
npm run test:run -- src/lib/journey/__tests__/normalize-section-data.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/journey/schemas/icp-validation.ts src/lib/journey/schemas/keyword-intel.ts src/lib/journey/schemas/media-plan.ts src/lib/journey/normalize-section-data.ts src/lib/journey/__tests__/normalize-section-data.test.ts
git commit -m "feat: add wave three journey research schemas"
```

---

## Task 9: Add integration safety checks for realtime and chat rendering

**Files:**
- Modify: `src/components/journey/chat-message.tsx`
- Modify: `src/lib/journey/__tests__/session-state.test.ts`
- Modify: `src/lib/ai/__tests__/journey-stream-prep.test.ts`
- Modify: `src/components/journey/__tests__/chat-message.test.tsx`

**Step 1: Write the failing test**

Add tests that verify:

- compacted tool outputs still preserve the shape needed for cards
- chat rendering still handles sections with metadata-only payloads
- chat rendering uses typed `data` when available

**Step 2: Run test to verify it fails**

Run:

```bash
npm run test:run -- src/lib/ai/__tests__/journey-stream-prep.test.ts src/components/journey/__tests__/chat-message.test.tsx
```

Expected: FAIL because typed payload preservation is not fully asserted yet.

**Step 3: Write minimal implementation**

Adjust compacting and rendering logic only as needed to preserve:

- `sectionId`
- `content`
- essential typed `data`
- citations when present

Do not redesign the compacting system in this task.

**Step 4: Run test to verify it passes**

Run:

```bash
npm run test:run -- src/lib/ai/__tests__/journey-stream-prep.test.ts src/components/journey/__tests__/chat-message.test.tsx
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/journey/chat-message.tsx src/lib/journey/__tests__/session-state.test.ts src/lib/ai/__tests__/journey-stream-prep.test.ts src/components/journey/__tests__/chat-message.test.tsx
git commit -m "test: protect typed journey research rendering"
```

---

## Task 10: Final verification pass

**Files:**
- None required

**Step 1: Run focused Journey research tests**

Run:

```bash
npm run test:run -- src/lib/journey/__tests__/research-section-schemas.test.ts src/lib/journey/__tests__/normalize-section-data.test.ts src/lib/ai/tools/__tests__/generate-research.test.ts src/lib/journey/__tests__/session-state.test.ts src/lib/ai/__tests__/journey-stream-prep.test.ts src/components/journey/__tests__/chat-message.test.tsx
```

Expected: PASS

**Step 2: Run lint on touched files or full lint if needed**

Run:

```bash
npm run lint
```

Expected: PASS, or only unrelated pre-existing warnings outside touched files.

**Step 3: Manual product verification**

Verify in `/journey`:

- a section with typed `data` renders rich card content
- a section without typed `data` still renders `content`
- citations still appear
- review controls still work for checkpoint sections

**Step 4: Commit**

```bash
git add .
git commit -m "feat: add typed journey research section outputs"
```

---

## Notes For Execution

- Do not attempt all 7 sections in one unreviewed pass.
- Stop after Tasks 1-5 in the first execution session and ask for feedback.
- Land wave 1 first and confirm the parser shape before expanding.
- Treat current card field usage as the primary contract, not the old blueprint schemas.
- Preserve the current `content` fallback until all sections have proven typed payloads in production.
- If the section agents cannot reliably emit parseable structured payloads, add stronger skill instructions before adding more parser complexity.
- Prefer the `journey-data` fenced payload block over brittle prose parsing.
