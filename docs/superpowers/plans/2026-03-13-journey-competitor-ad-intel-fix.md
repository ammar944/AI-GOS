# Journey Competitor Ad Intelligence Fix Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore rich, clickable competitor ad intelligence in `/journey` by upgrading the worker ad-library path, expanding the competitor contract, and rendering real ad evidence plus platform library links in the journey artifact.

**Architecture:** Keep the existing journey -> worker -> Supabase pipeline, but stop collapsing ad evidence into summary-only fields. The worker competitor tool should emit a canonical ad-evidence payload, the journey schema should preserve it, and the artifact panel should render both summary interpretation and inspectable evidence. `metaAds` remains a media-planning/account-performance tool and must not be pulled into competitor intelligence.

**Tech Stack:** Next.js App Router, TypeScript strict mode, Zod, Vercel AI SDK, Anthropic worker runners, Vitest, React Testing Library

---

**Spec reference:** `docs/superpowers/specs/2026-03-13-journey-competitor-ad-intel-fix-design.md`

## File Structure

| Path | Responsibility |
|---|---|
| `src/lib/journey/schemas/competitor-intel.ts` | Canonical journey competitor schema with preserved ad evidence |
| `src/lib/journey/__tests__/research-section-schemas.test.ts` | Schema contract coverage for enriched competitor payloads |
| `src/lib/journey/research-result-contract.ts` | Validation/storage guardrail for richer competitor results |
| `src/lib/journey/__tests__/research-result-contract.test.ts` | Result-contract regression coverage |
| `research-worker/src/contracts.ts` | Worker-side finalization contract that must preserve enriched competitor evidence |
| `research-worker/src/__tests__/contracts.test.ts` | Worker contract regression coverage for enriched competitor payloads |
| `research-worker/src/tools/adlibrary.ts` | Worker-side public ad-library lookup and normalized evidence payload |
| `research-worker/src/tools/adlibrary-types.ts` | Worker-local normalized ad-evidence interfaces |
| `research-worker/src/__tests__/adlibrary.test.ts` | Unit coverage for ad-library retrieval and link generation |
| `research-worker/src/runners/competitors.ts` | Competitor runner prompt/output contract using richer ad evidence |
| `research-worker/src/__tests__/competitors.test.ts` | Competitor runner regression coverage |
| `src/lib/journey/competitor-ad-links.ts` | Pure helper for Meta/LinkedIn/Google library link generation in the journey UI |
| `src/lib/journey/__tests__/competitor-ad-links.test.ts` | Link helper regression coverage |
| `src/components/journey/competitor-ad-evidence.tsx` | Journey-specific ad evidence renderer for competitor cards |
| `src/components/journey/__tests__/competitor-ad-evidence.test.tsx` | UI coverage for evidence rendering and click targets |
| `src/components/journey/artifact-panel.tsx` | Integrate competitor ad evidence into the live journey artifact |
| `src/components/journey/__tests__/artifact-panel.test.tsx` | End-to-end artifact rendering coverage |
| `src/lib/ai/tools/competitor-fast-hits.ts` | Terminology alignment for fast-hit ad coverage semantics |
| `docs/research-section-audit.md` | Remove stale recommendation that implies `metaAds` belongs in competitor intelligence |

## Chunk 1: Backend Contract And Worker Retrieval

### Task 1: Expand the worker and journey competitor contracts to preserve ad evidence

**Files:**
- Modify: `src/lib/journey/schemas/competitor-intel.ts`
- Modify: `src/lib/journey/__tests__/research-section-schemas.test.ts`
- Modify: `src/lib/journey/research-result-contract.ts`
- Modify: `src/lib/journey/__tests__/research-result-contract.test.ts`
- Modify: `research-worker/src/contracts.ts`
- Modify: `research-worker/src/__tests__/contracts.test.ts`

- [ ] **Step 1: Write the failing schema/result-contract tests**

Add a competitor fixture that includes:

```ts
adCreatives: [
  {
    platform: 'meta',
    id: 'meta-1',
    advertiser: 'Hey Digital',
    headline: 'Pipeline growth without attribution guesswork',
    format: 'image',
    isActive: true,
    imageUrl: 'https://cdn.test/meta-1.jpg',
    detailsUrl: 'https://www.facebook.com/ads/library/?id=123',
  },
],
libraryLinks: {
  metaLibraryUrl: 'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&q=Hey%20Digital',
  linkedInLibraryUrl: 'https://www.linkedin.com/ad-library/search?keyword=Hey%20Digital',
  googleAdvertiserUrl: 'https://adstransparency.google.com/advertiser/AR123?region=US',
},
```

Add:

- one test in `src/lib/journey/__tests__/research-result-contract.test.ts` that proves a stored competitor result with `adCreatives` and `libraryLinks` survives app-side validation,
- one test in `research-worker/src/__tests__/contracts.test.ts` that proves `finalizeRunnerResult()` preserves those same fields on worker output.

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm run test:run -- src/lib/journey/__tests__/research-section-schemas.test.ts src/lib/journey/__tests__/research-result-contract.test.ts
cd research-worker && npm run test:run -- src/__tests__/contracts.test.ts
```

Expected:
- FAIL because the current Zod schemas silently strip `adCreatives` and `libraryLinks` instead of preserving them.
- The regression is data loss at both contract boundaries, not a hard parse failure.

- [ ] **Step 3: Implement the schema changes**

Add these Zod blocks to `src/lib/journey/schemas/competitor-intel.ts`:

```ts
const competitorAdCreativeSchema = z.object({
  platform: z.enum(['linkedin', 'meta', 'google']),
  id: nonEmptyStringSchema,
  advertiser: nonEmptyStringSchema,
  headline: nonEmptyStringSchema.optional(),
  body: nonEmptyStringSchema.optional(),
  imageUrl: nonEmptyStringSchema.optional(),
  videoUrl: nonEmptyStringSchema.optional(),
  format: z.enum(['video', 'image', 'carousel', 'text', 'message', 'unknown']),
  isActive: z.boolean(),
  firstSeen: nonEmptyStringSchema.optional(),
  lastSeen: nonEmptyStringSchema.optional(),
  platforms: nonEmptyStringArraySchema.optional(),
  detailsUrl: nonEmptyStringSchema.optional(),
});

const competitorLibraryLinksSchema = z.object({
  metaLibraryUrl: nonEmptyStringSchema.optional(),
  linkedInLibraryUrl: nonEmptyStringSchema.optional(),
  googleAdvertiserUrl: nonEmptyStringSchema.optional(),
});
```

Then attach them to `competitorRecordSchema`:

```ts
adCreatives: z.array(competitorAdCreativeSchema).default([]),
libraryLinks: competitorLibraryLinksSchema.optional(),
```

Mirror the same nested fields inside `research-worker/src/contracts.ts` so worker finalization preserves them before persistence.

In `research-result-contract.ts`, confirm `normalizeCandidateData()` and safe-parse flow preserve the richer competitor payload once the schema admits it.

In `research-worker/src/contracts.ts`, confirm `normalizeCompetitorIntelPayload()` keeps the new nested fields while still applying the low-confidence platform normalization.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npm run test:run -- src/lib/journey/__tests__/research-section-schemas.test.ts src/lib/journey/__tests__/research-result-contract.test.ts
cd research-worker && npm run test:run -- src/__tests__/contracts.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/journey/schemas/competitor-intel.ts src/lib/journey/__tests__/research-section-schemas.test.ts src/lib/journey/research-result-contract.ts src/lib/journey/__tests__/research-result-contract.test.ts research-worker/src/contracts.ts research-worker/src/__tests__/contracts.test.ts
git commit -m "feat: preserve competitor ad evidence across worker and journey contracts"
```

### Task 2: Upgrade the worker ad-library tool to emit creatives, platform links, and safer advertiser matching

**Files:**
- Create: `research-worker/src/tools/adlibrary-types.ts`
- Modify: `research-worker/src/tools/adlibrary.ts`
- Create: `research-worker/src/__tests__/adlibrary.test.ts`

- [ ] **Step 1: Write the failing worker ad-library tests**

Add tests that mock `fetch` and verify:

1. LinkedIn path uses `engine=linkedin_ad_library` with advertiser filtering.
2. Meta path uses page search then page-based ad fetch.
3. Google path uses advertiser search then ad fetch.
4. The final payload includes:

```ts
{
  summary: { activeAdCount, platforms, themes, evidence, sourceConfidence },
  adCreatives: [{ platform, id, advertiser, headline, detailsUrl }],
  libraryLinks: { metaLibraryUrl, linkedInLibraryUrl, googleAdvertiserUrl },
  sourcesUsed: { linkedin, meta, google, foreplay }
}
```
5. False-positive protection still works for ambiguous advertisers:
   - searching `Funnel.io` does not keep `AR Funnel.io` creatives,
   - exact advertiser/domain matches are retained.

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd research-worker && npm run test:run -- src/__tests__/adlibrary.test.ts
```

Expected:
- FAIL because the tool currently returns only `summary` plus basic source counts.

- [ ] **Step 3: Implement the richer worker tool**

Create `research-worker/src/tools/adlibrary-types.ts` with normalized worker-local interfaces:

```ts
export type WorkerAdPlatform = 'linkedin' | 'meta' | 'google';

export interface WorkerAdCreative {
  platform: WorkerAdPlatform;
  id: string;
  advertiser: string;
  headline?: string;
  body?: string;
  imageUrl?: string;
  videoUrl?: string;
  format: 'video' | 'image' | 'carousel' | 'text' | 'message' | 'unknown';
  isActive: boolean;
  firstSeen?: string;
  lastSeen?: string;
  platforms?: string[];
  detailsUrl?: string;
}
```

Inside `research-worker/src/tools/adlibrary.ts`:

- replace the current Google-only `searchSearchApiAds()` flow with three fetchers:
  - `searchLinkedInAds(companyName)`
  - `searchMetaAds(companyName)`
  - `searchGoogleAds(companyName, domain?)`
- normalize all results to `WorkerAdCreative[]`
- port or mirror the same advertiser-matching and domain-mismatch guards that protect the richer app-side ad-library flow from false positives
- generate platform links:

```ts
function buildLibraryLinks(companyName: string, domain?: string, creatives?: WorkerAdCreative[]) {
  const encodedName = encodeURIComponent(companyName.trim());
  const metaLibraryUrl =
    `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&q=${encodedName}&search_type=keyword_unordered&media_type=all`;
  const linkedInLibraryUrl = `https://www.linkedin.com/ad-library/search?keyword=${encodedName}`;
  const googleAdvertiserUrl = deriveGoogleAdvertiserUrl(creatives, domain);
  return { metaLibraryUrl, linkedInLibraryUrl, googleAdvertiserUrl };
}
```

Keep Foreplay as an optional enrichment/fallback, but do not let it replace SearchAPI-based public library coverage when current ads are available.

Use the existing app-side regressions in `src/lib/ad-library/__tests__/false-positive-prevention.test.ts` and `src/lib/ad-library/__tests__/name-matcher.test.ts` as the reference cases for the worker-side behavior.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
cd research-worker && npm run test:run -- src/__tests__/adlibrary.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add research-worker/src/tools/adlibrary-types.ts research-worker/src/tools/adlibrary.ts research-worker/src/__tests__/adlibrary.test.ts
git commit -m "feat: enrich worker ad library with creatives and links"
```

### Task 3: Update the competitor runner to require and preserve bounded ad evidence coverage

**Files:**
- Modify: `research-worker/src/runners/competitors.ts`
- Modify: `research-worker/src/__tests__/competitors.test.ts`

- [ ] **Step 1: Write the failing runner tests**

Extend `research-worker/src/__tests__/competitors.test.ts` so a successful competitor result must include:

```ts
competitors: [
  {
    adActivity: { ... },
    adCreatives: [{ detailsUrl: 'https://...' }],
    libraryLinks: { metaLibraryUrl: 'https://...' },
  },
]
```

Also add a low-confidence test proving:
- `adActivity.platforms` downgrades to `['Not verified']` when coverage is weak,
- `libraryLinks` are still retained,
- `adCreatives` can be empty without invalidating the artifact.

Add one orchestration-focused regression that proves:
- the runner requests richer ad evidence for the top 3 competitors only,
- the remaining surfaced competitors still retain generated `libraryLinks` and honest limited-coverage messaging.

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd research-worker && npm run test:run -- src/__tests__/competitors.test.ts
```

Expected:
- FAIL because the runner output format does not currently request or preserve `adCreatives` or `libraryLinks`.

- [ ] **Step 3: Implement the runner changes**

In `research-worker/src/runners/competitors.ts`:

- update `COMPETITORS_OUTPUT_FORMAT` to include:

```ts
"adCreatives": [
  {
    "platform": "linkedin | meta | google",
    "id": "string",
    "advertiser": "string",
    "headline": "string",
    "detailsUrl": "string"
  }
],
"libraryLinks": {
  "metaLibraryUrl": "string",
  "linkedInLibraryUrl": "string",
  "googleAdvertiserUrl": "string"
}
```

- replace the current tool guidance with:
  - rank 5 competitors first from web evidence,
  - run `adLibraryTool` for the top 3 competitors only under the primary latency budget,
  - retain raw creatives when returned,
  - if no creatives are found, or lookup is skipped for budget reasons, still return platform links and mark coverage honestly,
  - never mention `metaAds` or account-performance data.

Keep the 120-second primary timeout initially. If the top-3 lookup still proves too slow in manual testing, adjust the timeout only after measuring median and p95 run times.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
cd research-worker && npm run test:run -- src/__tests__/competitors.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add research-worker/src/runners/competitors.ts research-worker/src/__tests__/competitors.test.ts
git commit -m "feat: require rich ad evidence in competitor runner"
```

## Chunk 2: Journey Artifact Evidence UI

### Task 4: Add journey-specific helpers and ad evidence components

**Files:**
- Create: `src/lib/journey/competitor-ad-links.ts`
- Create: `src/lib/journey/__tests__/competitor-ad-links.test.ts`
- Create: `src/components/journey/competitor-ad-evidence.tsx`
- Create: `src/components/journey/__tests__/competitor-ad-evidence.test.tsx`

- [ ] **Step 1: Write the failing helper/component tests**

Add helper tests that verify:

```ts
buildCompetitorLibraryLinks({
  name: 'Hey Digital',
  website: 'https://heydigital.com',
  adCreatives: [{ platform: 'google', detailsUrl: 'https://adstransparency.google.com/advertiser/AR123' }],
})
```

returns:

```ts
{
  metaLibraryUrl: expect.stringContaining('facebook.com/ads/library'),
  linkedInLibraryUrl: expect.stringContaining('linkedin.com/ad-library'),
  googleAdvertiserUrl: 'https://adstransparency.google.com/advertiser/AR123?region=US',
}
```

Add component tests that render:
- creative cards when `adCreatives.length > 0`
- a “Meta Library” link
- a “LinkedIn Ads” link
- a “Google Ads” link

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm run test:run -- src/lib/journey/__tests__/competitor-ad-links.test.ts src/components/journey/__tests__/competitor-ad-evidence.test.tsx
```

Expected:
- FAIL because the helper and component do not exist yet.

- [ ] **Step 3: Implement the helper and component**

In `src/lib/journey/competitor-ad-links.ts`, port the pure URL-building logic from the older strategic-research helper, but make it journey-focused:

```ts
export interface JourneyCompetitorLibraryLinks {
  metaLibraryUrl: string;
  linkedInLibraryUrl: string;
  googleAdvertiserUrl: string;
}

export function buildCompetitorLibraryLinks(input: {
  name: string;
  website?: string;
  adCreatives?: Array<{ platform?: string; detailsUrl?: string }>;
}): JourneyCompetitorLibraryLinks
```

In `src/components/journey/competitor-ad-evidence.tsx`:

- accept:

```ts
interface CompetitorAdEvidenceProps {
  adActivity?: {
    activeAdCount: number;
    platforms: string[];
    themes: string[];
    evidence: string;
    sourceConfidence: 'high' | 'medium' | 'low';
  };
  adCreatives?: Array<{
    platform: 'linkedin' | 'meta' | 'google';
    id: string;
    advertiser: string;
    headline?: string;
    body?: string;
    imageUrl?: string;
    videoUrl?: string;
    format: 'video' | 'image' | 'carousel' | 'text' | 'message' | 'unknown';
    isActive: boolean;
    detailsUrl?: string;
    firstSeen?: string;
    lastSeen?: string;
  }>;
  libraryLinks?: {
    metaLibraryUrl?: string;
    linkedInLibraryUrl?: string;
    googleAdvertiserUrl?: string;
  };
}
```

- render:
  - summary stats first,
  - a compact list/grid of ad creatives second,
  - platform library links third.

Do not import the old strategic-research component tree directly. Reuse its patterns, not its whole dependency surface.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npm run test:run -- src/lib/journey/__tests__/competitor-ad-links.test.ts src/components/journey/__tests__/competitor-ad-evidence.test.tsx
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/journey/competitor-ad-links.ts src/lib/journey/__tests__/competitor-ad-links.test.ts src/components/journey/competitor-ad-evidence.tsx src/components/journey/__tests__/competitor-ad-evidence.test.tsx
git commit -m "feat: add journey competitor ad evidence components"
```

### Task 5: Wire the enriched competitor evidence into the artifact panel

**Files:**
- Modify: `src/components/journey/artifact-panel.tsx`
- Modify: `src/components/journey/__tests__/artifact-panel.test.tsx`

- [ ] **Step 1: Write the failing artifact panel tests**

Extend `artifact-panel.test.tsx` with one enriched competitor fixture containing:

```ts
adCreatives: [
  {
    platform: 'linkedin',
    id: 'li-1',
    advertiser: 'Hey Digital',
    headline: 'Pipeline growth for B2B SaaS',
    format: 'image',
    isActive: true,
    detailsUrl: 'https://www.linkedin.com/ad-library/detail/1',
  },
],
libraryLinks: {
  metaLibraryUrl: 'https://www.facebook.com/ads/library/?...',
  linkedInLibraryUrl: 'https://www.linkedin.com/ad-library/search?keyword=Hey%20Digital',
  googleAdvertiserUrl: 'https://adstransparency.google.com/advertiser/AR123?region=US',
},
```

Assert that:
- the existing summary still renders,
- the creative headline renders,
- each platform link renders.

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm run test:run -- src/components/journey/__tests__/artifact-panel.test.tsx
```

Expected:
- FAIL because the artifact panel ignores the new fields.

- [ ] **Step 3: Implement the artifact panel integration**

In `src/components/journey/artifact-panel.tsx`:

- keep the current competitor summary sections,
- inject `<CompetitorAdEvidence />` inside each competitor block after the summary stats,
- only render the evidence block when `adCreatives.length > 0` or `libraryLinks` exists,
- keep limited-coverage wording for low-confidence summary states.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npm run test:run -- src/components/journey/__tests__/artifact-panel.test.tsx src/components/journey/__tests__/competitor-ad-evidence.test.tsx
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/journey/artifact-panel.tsx src/components/journey/__tests__/artifact-panel.test.tsx
git commit -m "feat: render rich competitor ad evidence in journey artifact"
```

## Chunk 3: Alignment, Documentation, And Verification

### Task 6: Align fast-hits semantics and update the research audit architecture docs

**Files:**
- Modify: `src/lib/ai/tools/competitor-fast-hits.ts`
- Modify: `docs/research-section-audit.md`

- [ ] **Step 1: Add a small regression test or extract a pure prompt builder**

If the prompt body is still inline, extract the coverage guidance into a pure constant/function and test it with:

```ts
expect(FAST_HIT_PROMPT).not.toContain('Meta Ads Manager');
expect(FAST_HIT_PROMPT).toContain('Meta Library');
```

Suggested test file:

```bash
src/lib/ai/__tests__/competitor-fast-hits.test.ts
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run:

```bash
npm run test:run -- src/lib/ai/__tests__/competitor-fast-hits.test.ts
```

Expected:
- FAIL until the prompt is extracted/testable and terminology is updated.

- [ ] **Step 3: Implement the alignment**

In `src/lib/ai/tools/competitor-fast-hits.ts`:
- replace “Meta” wording with “public ad-library coverage” terminology,
- keep it lightweight,
- do not imply it has access to `metaAds`.

In `docs/research-section-audit.md`:
- update the competitor section tool inventory so it reflects public ad libraries instead of `metaAds`,
- update the competitor output schema notes so they describe preserved `adCreatives` and `libraryLinks`,
- add the worker-contract plus journey-contract boundary to the architecture notes,
- explicitly document that `metaAds` is for media-plan account data only.

- [ ] **Step 4: Run the targeted test to verify it passes**

Run:

```bash
npm run test:run -- src/lib/ai/__tests__/competitor-fast-hits.test.ts
```

Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/tools/competitor-fast-hits.ts src/lib/ai/__tests__/competitor-fast-hits.test.ts docs/research-section-audit.md
git commit -m "fix: separate competitor ad library language from meta ads"
```

### Task 7: Run full verification before merging

**Files:**
- No source changes expected

- [ ] **Step 1: Run all targeted app tests**

Run:

```bash
npm run test:run -- src/lib/journey/__tests__/research-section-schemas.test.ts src/lib/journey/__tests__/research-result-contract.test.ts src/lib/journey/__tests__/competitor-ad-links.test.ts src/components/journey/__tests__/competitor-ad-evidence.test.tsx src/components/journey/__tests__/artifact-panel.test.tsx src/lib/ai/__tests__/competitor-fast-hits.test.ts
```

Expected:
- PASS

- [ ] **Step 2: Run all targeted worker tests**

Run:

```bash
cd research-worker && npm run test:run -- src/__tests__/contracts.test.ts src/__tests__/adlibrary.test.ts src/__tests__/competitors.test.ts
```

Expected:
- PASS

- [ ] **Step 3: Run project-wide verification**

Run:

```bash
npm run lint
npm run test:run
cd research-worker && npm run test:run
```

Expected:
- Lint passes
- App and worker test suites pass

- [ ] **Step 4: Run a manual journey smoke test**

Manual checklist:
- start app and worker locally
- trigger competitor research in `/journey`
- verify competitor cards show:
  - ad summary
  - at least one clickable creative when available
  - Meta Library link
  - LinkedIn Ads link
  - Google Ads link
- verify low-confidence competitors still show honest limited-coverage messaging

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: restore rich competitor ad intelligence in journey"
```
