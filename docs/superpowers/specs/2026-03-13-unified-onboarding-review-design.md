# Unified Onboarding Field Review

## Summary

Replace the split onboarding UI (prefill review card + human context form) with a single progressive-reveal component that shows all 39 fields grouped by category. One group is active at a time. Completed groups collapse to summary rows. Upcoming groups are dim placeholders. When all required blockers are filled, the user clicks "Start Market Overview" which calls the pipeline `/start` route and redirects to `/research/[runId]`.

## Problem

The current onboarding review has three problems:

1. **Split UI**: The "Found X details" card and the "Human Context" form are separate sections with different interaction patterns. The prefill card is a bulk accept/reject, the form is individual field editing.
2. **Hidden fields**: 14 of 39 fields in the catalog have no UI at all. They were previously collected by the lead agent's `askUser` tool, which is being removed as part of the pipeline migration.
3. **Disjointed transition**: After the user fills the human context form and clicks "Start Market Overview," the current code sends a synthetic message to the lead agent chat. The new pipeline replaces this with a direct API call.

## Architecture

### What Gets Removed

- `JourneyPrefillReview` component (`src/components/journey/journey-prefill-review.tsx`) — the "Found X details" card with Accept/Skip buttons
- The "Human Context" form section in `journey/page.tsx` that renders `JOURNEY_MANUAL_BLOCKER_FIELDS`
- The `handleAcceptPrefill` callback that builds a context message for the lead agent

### What Gets Created

Three new components:

- `src/components/journey/unified-field-review.tsx` — orchestrates the progressive-reveal flow across 7 groups
- `src/components/journey/field-group.tsx` — renders a single group in one of three states (active, completed, upcoming)
- `src/components/journey/field-card.tsx` — renders a single editable field with label, tags, input, and helper text

One addition to an existing file:

- `src/lib/journey/field-catalog.ts` — new `JOURNEY_FIELD_GROUPS` constant

### What Gets Modified

- `src/app/journey/page.tsx` — the `journeyPhase === 'review'` branch swaps from the current split UI to `<UnifiedFieldReview>`

## Field Groups

Seven groups, ordered to match the research pipeline's information needs:

### 1. Company Profile (5 fields)

| Field Key | Label | Required | Scrapeable |
|---|---|---|---|
| `companyName` | Company Name | No | Yes |
| `websiteUrl` | Website | No | Yes |
| `businessModel` | Business Model | **Yes** | Yes |
| `industryVertical` | Industry Vertical | No | Yes |
| `headquartersLocation` | Headquarters | No | Yes |

### 2. Product & Offer (7 fields)

| Field Key | Label | Required | Scrapeable |
|---|---|---|---|
| `productDescription` | Product Description | **Yes** | Yes |
| `coreDeliverables` | Core Deliverables | No | Yes |
| `pricingTiers` | Pricing Tiers | **Yes** (group) | Yes |
| `valueProp` | Value Proposition | No | Yes |
| `guarantees` | Guarantees | No | Yes |
| `currentFunnelType` | Current Funnel Type | No | No |
| `monthlyAdBudget` | Monthly Ad Budget | **Yes** (group) | No |

`pricingTiers` and `monthlyAdBudget` form a required group — at least one must be filled.

### 3. Customers & ICP (7 fields)

| Field Key | Label | Required | Scrapeable |
|---|---|---|---|
| `primaryIcpDescription` | Ideal Customer Profile | **Yes** | Yes |
| `jobTitles` | Target Job Titles | No | Yes |
| `companySize` | Company Size | No | Yes |
| `geography` | Geographic Focus | No | Yes |
| `easiestToClose` | Easiest to Close | No | No |
| `buyingTriggers` | Buying Triggers | No | No |
| `bestClientSources` | Best Client Sources | No | No |

### 4. Competition & Market (5 fields)

| Field Key | Label | Required | Scrapeable |
|---|---|---|---|
| `topCompetitors` | Top Competitors | **Yes** | Yes |
| `uniqueEdge` | Unique Edge | **Yes** | Yes |
| `competitorFrustrations` | Competitor Frustrations | No | No |
| `marketBottlenecks` | Market Bottlenecks | No | No |
| `marketProblem` | Market Problem | No | Yes |

### 5. Sales & Positioning (6 fields)

| Field Key | Label | Required | Scrapeable |
|---|---|---|---|
| `situationBeforeBuying` | Before State | No | Yes |
| `desiredTransformation` | Desired Transformation | No | Yes |
| `commonObjections` | Common Objections | No | Yes |
| `salesCycleLength` | Sales Cycle Length | No | No |
| `salesProcessOverview` | Sales Process | No | No |
| `brandPositioning` | Brand Positioning | No | Yes |

### 6. Goals & Targets (4 fields)

| Field Key | Label | Required | Scrapeable |
|---|---|---|---|
| `goals` | Goals | **Yes** | No |
| `campaignDuration` | Campaign Duration | No | No |
| `targetCpl` | Target CPL | No | No |
| `targetCac` | Target CAC | No | No |

### 7. Proof & Assets (5 fields)

| Field Key | Label | Required | Scrapeable |
|---|---|---|---|
| `testimonialQuote` | Testimonial Quote | No | Yes |
| `caseStudiesUrl` | Case Studies URL | No | Yes |
| `testimonialsUrl` | Testimonials URL | No | Yes |
| `pricingUrl` | Pricing URL | No | Yes |
| `demoUrl` | Demo URL | No | Yes |

## Component Design

### `UnifiedFieldReview`

```typescript
interface UnifiedFieldReviewProps {
  extractedFields: Record<string, string>;
  presetFields?: Record<string, string>;
  onStart: (onboardingData: Record<string, string>) => void;
}
```

**State:**

- `activeGroupIndex: number` — which group is currently expanded (0-6)
- `fieldValues: Record<string, string>` — merged from extracted + preset + user edits
- `isStarting: boolean` — true while calling `/start` and waiting for redirect

**Behavior:**

- On mount, merge `extractedFields` and `presetFields` into `fieldValues`. Scraped values take precedence over presets.
- Compute which groups are "complete" (all fields either filled or optional-and-empty). Auto-advance `activeGroupIndex` past any initially-complete groups.
- When a group completes (user tabs past last field or clicks Continue within group), animate it to completed state and advance to next group.
- User can click any completed summary row to re-expand that group for editing. This sets `activeGroupIndex` back to that group.
- "Start Market Overview" button in the bottom bar calls `onStart(fieldValues)` when all required blockers are satisfied.

**Gate logic** (superset of current `JOURNEY_WAVE_TWO_REQUIREMENTS` + `JOURNEY_MANUAL_BLOCKER_FIELDS`):

- `businessModel` must have a value
- `productDescription` must have a value
- `topCompetitors` must have a value
- `primaryIcpDescription` must have a value
- `goals` must have a value
- `uniqueEdge` must have a value
- At least one of `pricingTiers` or `monthlyAdBudget` must have a value

Note: The current `JOURNEY_WAVE_TWO_REQUIREMENTS` only enforces 4 of these (topCompetitors, productDescription, primaryIcpDescription, pricingContext). The unified review adds `businessModel`, `goals`, and `uniqueEdge` to match the full set of `required: true` fields in `JOURNEY_MANUAL_BLOCKER_FIELDS`. The frontend enforces all 7; the `/start` route should also validate them server-side.

### `FieldGroup`

```typescript
interface FieldGroupProps {
  group: JourneyFieldGroup;
  state: 'active' | 'completed' | 'upcoming';
  fieldValues: Record<string, string>;
  summaryPreview: string;
  onFieldChange: (key: string, value: string) => void;
  onContinue: () => void;
  onReopen: () => void;
}
```

Three visual states:

- **Active**: Expanded with all field cards visible, staggered entrance animation. Shows group title + fill count header. "Continue" button at bottom (or auto-advances on last field blur).
- **Completed**: Slim summary row — green checkmark, group title, preview of key values (e.g., "SaaSLaunch · Agency / Services"). Clickable to reopen.
- **Upcoming**: Dim single-line placeholder — dot, group label, field count. Not interactive.

### `FieldCard`

```typescript
interface FieldCardProps {
  fieldKey: string;
  label: string;
  value: string;
  placeholder: string;
  helper?: string;
  isRequired: boolean;
  isScraped: boolean;
  onChange: (value: string) => void;
}
```

- Renders an input (single-line) or textarea (multi-line for description fields) depending on the field
- Shows "required" tag (amber) and/or "scraped" tag (blue) next to the label
- Helper text below the input for manual fields that need guidance
- Focus ring on the card border when the input is focused

## Data Flow

```text
Scraper output (extractedFields)
  + Manual prefill preset (presetFields)
  → UnifiedFieldReview merges into fieldValues state
  → User edits fields across 7 groups
  → User clicks "Start Market Overview"
  → onStart(fieldValues) called
  → journey/page.tsx:
      1. POST /api/research/pipeline/start { onboardingData: fieldValues }
      2. Show "Dispatching Market Overview..." transition (1-2s)
      3. router.push(`/research/${runId}`)
  → Pipeline view takes over
```

## Field Catalog Changes

Add to `src/lib/journey/field-catalog.ts`:

```typescript
export interface JourneyFieldGroup {
  id: string;
  label: string;
  fieldKeys: readonly string[];
}

export const JOURNEY_FIELD_GROUPS: readonly JourneyFieldGroup[] = [
  {
    id: 'companyProfile',
    label: 'Company Profile',
    fieldKeys: ['companyName', 'websiteUrl', 'businessModel', 'industryVertical', 'headquartersLocation'],
  },
  {
    id: 'productOffer',
    label: 'Product & Offer',
    fieldKeys: ['productDescription', 'coreDeliverables', 'pricingTiers', 'valueProp', 'guarantees', 'currentFunnelType', 'monthlyAdBudget'],
  },
  {
    id: 'customersIcp',
    label: 'Customers & ICP',
    fieldKeys: ['primaryIcpDescription', 'jobTitles', 'companySize', 'geography', 'easiestToClose', 'buyingTriggers', 'bestClientSources'],
  },
  {
    id: 'competitionMarket',
    label: 'Competition & Market',
    fieldKeys: ['topCompetitors', 'uniqueEdge', 'competitorFrustrations', 'marketBottlenecks', 'marketProblem'],
  },
  {
    id: 'salesPositioning',
    label: 'Sales & Positioning',
    fieldKeys: ['situationBeforeBuying', 'desiredTransformation', 'commonObjections', 'salesCycleLength', 'salesProcessOverview', 'brandPositioning'],
  },
  {
    id: 'goalsTargets',
    label: 'Goals & Targets',
    fieldKeys: ['goals', 'campaignDuration', 'targetCpl', 'targetCac'],
  },
  {
    id: 'proofAssets',
    label: 'Proof & Assets',
    fieldKeys: ['testimonialQuote', 'caseStudiesUrl', 'testimonialsUrl', 'pricingUrl', 'demoUrl'],
  },
];
```

## Journey Page Changes

In `src/app/journey/page.tsx`, the `journeyPhase === 'review'` rendering branch:

**Current:** Renders `JourneyPrefillReview` (accept/skip) + "Human Context" form with `JOURNEY_MANUAL_BLOCKER_FIELDS` + "Start Market Overview" button that sends a synthetic chat message.

**New:** Renders `<UnifiedFieldReview extractedFields={...} presetFields={...} onStart={handleStartPipeline} />` where `handleStartPipeline`:

1. Sets a loading state ("Dispatching Market Overview...")
2. Calls `POST /api/research/pipeline/start` with `{ onboardingData }`
3. On success, calls `router.push(\`/research/${runId}\`)`
4. On error, shows an error message and re-enables the form

## Animation Spec

All animations use CSS transitions or Framer Motion (already in the project).

- **Group collapse** (active → completed): height collapses over 400ms, `ease-out`. Fields fade out (200ms), summary row fades in (200ms, 200ms delay).
- **Group expand** (upcoming → active): height expands over 400ms, `ease-out`. Field cards stagger in with 50ms delay between each, 350ms duration, `translateY(8px)` → `translateY(0)`.
- **Group reopen** (completed → active): same as expand, but summary row fades out first (150ms).
- **Progress bar**: width transitions over 600ms, `cubic-bezier(0.4, 0, 0.2, 1)`.
- **Bottom bar CTA**: background color transitions when gate condition changes (waiting → ready).

## Performance

- All 39 fields are rendered on mount (no lazy loading needed for this count)
- Field value changes are local state — no network calls until "Start Market Overview"
- The `/start` API call is the only network request in this flow
- Target: under 16ms per keystroke (no debouncing needed for local state updates)

## Edge Cases & Fallbacks

### Empty scraper results

If the scraper returns zero fields (error or empty site), all groups render in upcoming state with the first group auto-expanded. All fields show placeholders. The user fills everything manually. The gate logic is unchanged — required fields must still be filled.

### Scraper error

If the scraper errors before this component mounts, the journey page handles it upstream (existing `PrefillStreamView` error state). The `UnifiedFieldReview` only receives whatever `extractedFields` were successfully scraped (could be an empty object).

### Group with no required fields

Groups without required fields (Sales & Positioning, Proof & Assets) show a "Continue" button that is always enabled. The user can skip them entirely by clicking Continue with all fields empty. Optional empty fields do not block research.

### Reopening a completed group

Clicking a completed summary row re-expands that group with existing values. Edits update `fieldValues` in place. There is no "revert to scraped value" — once edited, the edit persists until the user changes it again or starts over. Navigating away from a reopened group re-collapses it.

### Preset fields

`presetFields` are smart defaults inferred from company domain detection (e.g., `getManualPrefillPreset()` in `journey/page.tsx`). They have lower precedence than scraped values and are overridden by user edits. Merge order: `presetFields` → `extractedFields` (overwrites) → user edits (overwrites).

### Auto-advance timing

When the last field in a group loses focus (blur): wait 300ms, then auto-collapse and advance to the next group. This gives the user a moment to see their input before the transition. Clicking "Continue" advances immediately with no delay.

### Error on `/start` call

If `POST /api/research/pipeline/start` returns an error:
- Show an error message below the bottom bar CTA
- Re-enable the form so the user can retry
- Do not redirect

### Mobile layout

Below 768px: single-column full-width layout. Field cards stack vertically. Bottom bar remains fixed. No behavior changes — same progressive-reveal flow.

## What This Does NOT Change

- The scraper/prefill flow that runs before this component mounts
- The pipeline routes (`/start`, `/advance`, `/chat`, `/section`)
- The pipeline view at `/research/[runId]`
- The field catalog's `category`, `collectionMode`, or `prefillVisible` metadata (kept for backward compatibility but no longer drives UI decisions)
- The `JOURNEY_MANUAL_BLOCKER_FIELDS` array (kept in catalog for reference but no longer rendered separately)
