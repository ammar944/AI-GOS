# Handoff — Research / Media-Plan Leverage of v3 Onboarding Fields

**From:** onboarding-flow-redesign (UI + dispatch wiring, 2026-04-21)
**To:** the research/media-plan leverage agent
**Status:** schema + dispatch + form picker landed; runner/skill leverage is yours

---

## What's already set up for you

The v3 onboarding flow now collects 4 new routing enums from the user:

| Field | Enum values | From doc §1 |
|---|---|---|
| `salesMotion` | `product-led` / `sales-led` / `hybrid` | "How do customers buy?" |
| `pricingModel` (PricingArchetype type) | `subscription` / `usage-based` / `per-seat` / `one-time-plus-subscription` | "What is your pricing model?" |
| `conversionPath` | `free-trial` / `freemium` / `demo-required` / `direct-checkout` | "How do customers convert?" |
| `avgAcv` | `under-1k` / `1k-10k` / `10k-50k` / `50k-plus` | "Average price or ACV" |

**The dispatch route already injects these as metadata tags into every runner's context.** See `src/app/api/journey/dispatch/route.ts` ~line 420 — the injected block is now:

```
[businessModelType:plg]
[awarenessLevel:problem-aware]
[salesMotion:product-led]
[pricingModel:subscription]
[conversionPath:free-trial]
[avgAcv:1k-10k]
```

Every runner sees this block at the TOP of its context. The pattern matches what the media-plan runner already does for `[businessModelType:X]`.

### Parsing precedent

`research-worker/src/runners/media-plan.ts` already parses `[businessModelType:X]` from context (search for `businessModelType:` in the file). Use the same regex pattern for the 4 new tags. Reusable helper:

```typescript
function extractTag(context: string, tag: string): string {
  const m = context.match(new RegExp(`\\[${tag}:([^\\]]+)\\]`));
  return m?.[1]?.trim() ?? 'unknown';
}
```

---

## What the doc says each section UNLOCKS

The v3 onboarding doc (`~/Downloads/AIGOS Onboarding Flow.docx`) has "Why this is the perfect setup" + "What it unlocks" sections. These are the leverage spec — runners and skills should route off these signals rather than re-inferring from narrative.

### §1 Product & Revenue Model (the 4 enums above)

**Why each field matters:**
- `salesMotion` → defines funnel type (signup vs demo vs checkout)
- `pricingModel` → shapes messaging (ROI, efficiency, scalability, cost)
- `conversionPath` → determines CTA + landing page structure
- `avgAcv` → sets CAC targets + channel strategy

**What it unlocks:**
- Generate the correct funnel (PLG vs sales-led vs hybrid)
- Build channel strategy (Meta vs Google vs LinkedIn vs outbound)
- Write high-converting ad angles (trial vs demo vs ROI-driven)
- Design optimized landing pages (product-first vs demo-first vs offer-first)
- Set realistic CAC + conversion expectations
- Align marketing and sales strategy from day one

### §2 ICP + Pain — new fields: `buyingTriggers`, `currentAlternative`

- `buyingTriggers` → fuels trigger-based ad hooks (real events that push prospects into market)
- `currentAlternative` → anchors "switch from X to Y" positioning

### §3 Offer & Product Experience — new fields: `firstValueMoment`, `activationEvent`, `retentionDrivers`

- `firstValueMoment` → determines how aggressively you can convert users
- `activationEvent` → anchors what you optimize for (not vanity metrics)
- `retentionDrivers` → reveals what delivers value, should be emphasized

### §5 Competition & Positioning — new fields: `lossReasons`, `competitorStrengths`

- `lossReasons` → fuels objection-based ad creatives
- `competitorStrengths` → identifies positioning gaps

### §6 Goals & Strategy — new fields: `pipelineTarget`, `keyPromises`

- `pipelineTarget` ($ or # demos) → sets measurable campaign output targets
- `keyPromises` → defines core messaging and value proposition

### §7 Current Marketing & Performance — new structured fields

Replaces the old freeform `currentMarketingActivities`:
- `channels` (multi-select array) → current mix
- `channelBudgetSplit` → where spend is going
- `whatIsWorking` → "double down on" signal
- `whatIsNotWorking` → "cut or fix" signal
- 4 optional funnel % metrics (`visitorToSignupPct`, `signupToActivationPct`, `activationToPaidPct`, `demoToCloseRate`) → funnel leak diagnosis
- `last3to6MoGrowthTrend` (renamed from `last12MoGrowthRate`, still numeric %) → growth momentum

---

## Concrete integration points

### 1. Identity resolver — `research-worker/src/identity/resolve-identity.ts`

**Today:** Infers `businessModelType` (plg/slg/ecommerce/transactional/marketplace) from fuzzy signals — website content, freeform `businessModel` text, product description.

**Recommended change:** When `[salesMotion:X]` is present in context, use it as HARD mapping:
- `salesMotion=product-led` → `businessModelType=plg` (skip inference)
- `salesMotion=sales-led` → `businessModelType=slg`
- `salesMotion=hybrid` → keep inference (could be plg/slg/hybrid depending on other signals)
- For ecommerce/transactional/marketplace — these aren't in salesMotion, so resolver must still infer from website. But `conversionPath=direct-checkout` is a strong ecommerce signal; `conversionPath=demo-required` is a strong B2B SaaS signal.

The resolver's OUTPUT schema stays unchanged — downstream runners still consume `businessModelType` as today. This is a pure input-side enhancement.

### 2. Measurement skill — `research-worker/src/skills/measurement-skill.ts`

**Today:** References `[businessModelType:X]` at line 14/24/83.

**Recommended change:** Add `[avgAcv:X]` tier routing for CAC ceiling:
- `under-1k` → SMB tier (CAC ceiling ~$50–150)
- `1k-10k` → mid-market (CAC ~$200–800)
- `10k-50k` → mid-enterprise (CAC ~$1K–5K)
- `50k-plus` → enterprise (CAC ~$5K+)

### 3. Channel mix skill — `research-worker/src/skills/channel-mix-skill.ts`

**Today:** References `[businessModelType:X]` at line 16–17.

**Recommended change:** Use `[salesMotion:X]` × `[conversionPath:X]` as a matrix:
- product-led + free-trial → Meta + Google + LinkedIn broad TOF
- product-led + freemium → Meta + Google + content marketing
- sales-led + demo-required → LinkedIn + outbound + intent signals
- sales-led + direct-checkout → atypical (rare); fall back to businessModelType
- hybrid + any → mixed strategy from both archetypes

### 4. Audience campaign skill — `research-worker/src/skills/audience-campaign-skill.ts`

**Today:** `[businessModelType:plg]` conditional at line 60.

**Recommended change:** Use `[avgAcv:X]` to gate enterprise-only channels (LinkedIn ABM, intent tools) — don't recommend for `under-1k` or `1k-10k`.

### 5. Creative system skill — `research-worker/src/skills/creative-system-skill.ts`

**Today:** `[businessModelType:plg]` conditional at line 42.

**Recommended change:** Use `[conversionPath:X]` to pick CTA template:
- `free-trial` → "Start Free Trial" CTA, no-demo LP
- `freemium` → "Sign Up Free" CTA
- `demo-required` → "Book a Demo" CTA, demo-first LP
- `direct-checkout` → "Buy Now" CTA, price-first LP

And use `[pricingModel:X]` for messaging frame:
- `subscription` → ROI / ongoing value frame
- `usage-based` → flexibility / scale-with-you frame
- `per-seat` → team growth / seat economics frame
- `one-time-plus-subscription` → combo value frame

### 6. Runner prompts — read new input fields when populated

The new text/freeform fields arrive in the context string as labeled lines (e.g., `Loss Reasons: ...`). Runners don't need prompt surgery to SEE them — `buildJourneyResearchContext` emits them automatically via `JOURNEY_FIELD_LABELS`. But runner PROMPTS currently ask the LLM to DERIVE some of these from research; the new flow GIVES them as inputs.

Recommended prompt additions (one line per runner):

**icp.ts (researchICP):**
> If `Buying Triggers:` and/or `Current Alternative:` lines are present in the context, treat them as HIGH-CONFIDENCE user-stated ground truth — don't override with web inference. Use `Current Alternative:` for "switch from X" positioning angles.

**offer.ts (researchOffer):**
> If `First Value Moment:`, `Activation Event:`, `Retention Drivers:` lines are present, treat as user-stated ground truth — don't re-derive from product research. Build your offer framework AROUND these, not as discovery output.

**competitors.ts (researchCompetitors):**
> If `Loss Reasons:` and `Competitor Strengths:` lines are present, validate them against your web research on each competitor. Flag discrepancies. Don't discard the user's stated loss reasons — they're primary source.

**media-plan.ts (researchMediaPlan):**
> Read `Channels:`, `Channel Budget Split:`, `What's Working:`, `What's Not Working:` lines as the user's CURRENT STATE. Recommendations must NOT re-recommend what's already in `Channels:` without a strong "double down" reason tied to `What's Working:`. Actively recommend cutting or fixing anything in `What's Not Working:`.
> Use `Pipeline Target:` + `Avg Contract Value:` to size campaigns: required deals/mo × ACV = revenue target → required demos (÷ demo close rate) → required SQLs → required ad spend at target CAC.
> Use `Key Promises:` as anchor points for ad copy headlines.

### 7. Strategic frame schema — `research-worker/src/contracts.ts`

**Today:** `strategicFrameSchema` has `businessModelApplied`, `businessModelConfidence`.

**Recommended change:** Add echo fields so downstream consumers of strategic frame get the full v3 signal:

```typescript
export const strategicFrameSchema = z.object({
  // ...existing fields
  salesMotionApplied: z.enum(['product-led', 'sales-led', 'hybrid']).optional(),
  pricingModelApplied: z.enum(['subscription', 'usage-based', 'per-seat', 'one-time-plus-subscription']).optional(),
  conversionPathApplied: z.enum(['free-trial', 'freemium', 'demo-required', 'direct-checkout']).optional(),
  avgAcvApplied: z.enum(['under-1k', '1k-10k', '10k-50k', '50k-plus']).optional(),
});
```

The media-plan runner sets `businessModelApplied` from `[businessModelType:X]` today (see `research-worker/src/runners/media-plan.ts` ~line 186/217). Extend that same block to also set the 4 new fields from the 4 new tags.

---

## What NOT to touch (already done)

- `src/lib/journey/field-catalog.ts` — v3 shape is final per doc
- `src/lib/ai/tools/update-field.ts` — allowlist already has all 41 v3 keys
- `src/app/api/journey/dispatch/route.ts` — metadata block already emits the 6 tags
- `src/lib/journey/research-sandbox.ts` — context field order already includes new signals
- `src/components/journey/field-{card,group}.tsx` — enum/multi-select UI already works

## What to verify after your changes

1. **Identity resolver unit test** with explicit inputs:
   ```
   salesMotion: product-led + conversionPath: free-trial → businessModelType should be 'plg'
   salesMotion: sales-led + conversionPath: demo-required → 'slg'
   ```

2. **Media-plan runner integration** — run the full pipeline on a known fixture (e.g., the FlowMetrics sample in `src/lib/onboarding/types.ts`) with v3 fields populated and verify the output uses the new enum signals for channel selection and CAC targets.

3. **Grep safety** — `grep -rn "\\[businessModelType:" research-worker/src/` shows ALL current consumers of the metadata tag pattern. Extending each to also handle the 4 new tags is mechanical. Don't remove `[businessModelType:X]` — it's still the dispatch key, just with sharper inputs feeding it.

---

## Questions for the human

If any of these interpretations don't match the intent, flag before implementing:

1. For `salesMotion=hybrid`, should we keep inferring `businessModelType` from other signals (current plan) or map to a new `businessModelType=hybrid` enum value?
2. Should `strategicFrameSchema` echo the 4 new enums, or store them elsewhere in `research_results`?
3. For `pricingModel=one-time-plus-subscription` (edge case), which messaging frame wins — ROI or combo-value?

---

## Grep this to start

```bash
# Find every current consumer of metadata tags — these are your primary targets
grep -rn '\[businessModelType:' research-worker/src/
grep -rn '\[awarenessLevel:' research-worker/src/

# Find runner prompts that reference retired fields (clean up opportunistically)
grep -rn 'desiredTransformation\|situationBeforeBuying\|guarantees\|businessModel"' research-worker/src/
```
