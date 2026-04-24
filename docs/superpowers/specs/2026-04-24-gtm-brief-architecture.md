# GTM Brief Architecture

**Date:** 2026-04-24
**Status:** Canonical direction
**Supersedes:** `2026-04-24-business-profile-first-design.md`

## Foundation

AIGOS is a SaaS go-to-market execution system. It is not a generic business profile database, a generic onboarding form, or a collection of unrelated AI reports.

The product spine is:

```text
Inputs
  -> GTM Brief
  -> Research Sections
  -> Strategy Synthesis
  -> Media Plan
  -> Scripts / Creative Assets
```

The core architectural decision:

> The GTM Brief is the source-of-truth object for a client run.

Onboarding is only the user experience that creates and confirms the GTM Brief. It should not remain a core product or data architecture concept.

## External Architecture Alignment

This architecture follows the same direction as Anthropic's public agent guidance:

- Use simple, composable workflows before introducing complex frameworks.
- Keep the workflow spine deterministic and let the agent execute inside bounded stages.
- Treat tools and skills as clear, well-documented interfaces.
- Use progressive disclosure in skills: short `SKILL.md`, deeper methodology in `references/`.
- Use evals and output validation to catch quality drift.

Reference patterns:

- [Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents)
- [Anthropic Skills](https://github.com/anthropics/skills)
- [Claude Cookbooks](https://github.com/anthropics/claude-cookbooks)

## Product Workflow

```text
1. Input Intake
   User provides a company URL.
   User can add docs, transcripts, notes, proof, or constraints.

2. AI Discovery
   The agent researches the URL and extracts SaaS GTM facts.
   It does not ask the user to fill a blank form first.

3. Draft GTM Brief
   The old onboarding fields become structured GTM Brief fields.
   URL research, docs, transcripts, and notes fill the same brief.

4. Human Review
   The user reviews and corrects the draft brief once.
   This is the only required checkpoint before deeper execution.

5. Locked Brief Snapshot
   A run uses an immutable GTM Brief snapshot.
   Downstream stages read the snapshot instead of live mutable fields.

6. Research Sections
   The agent runs bounded research sections from the locked brief.

7. Strategy Synthesis
   The agent converts evidence into GTM decisions.

8. Media Plan
   The agent converts strategy into channel, audience, budget, testing, and measurement decisions.

9. Scripts / Creative Assets
   The agent converts the media plan into executable creative outputs.
```

## Domain Language

Use these terms everywhere in product, code, and docs:

| Term | Meaning |
|---|---|
| `GTM Brief` | Canonical SaaS GTM record filled by AI and confirmed by the user. |
| `Brief Field` | A structured field inside the GTM Brief, with value, source, confidence, and status. |
| `Evidence Source` | URL, document, transcript, manual note, web research, ad library, or tool result. |
| `Run` | One execution pass from locked GTM Brief to research, media plan, and scripts. |
| `Brief Snapshot` | Immutable copy of the GTM Brief used by one run. |
| `Research Section` | Bounded evidence-gathering stage that answers one GTM question. |
| `Strategy Synthesis` | Internal stage that turns section evidence into decisions. |
| `Media Plan` | Execution plan for channels, audiences, budget, tests, and measurement. |
| `Script Pack` | Final copy/script/creative outputs generated from the media plan. |

Legacy language:

| Old term | Replacement |
|---|---|
| Onboarding data | GTM Brief fields |
| Business Profile | Client memory or account record, not the run source of truth |
| Company Snapshot | GTM Brief summary card |
| Cross Analysis | Strategy Synthesis |
| Journey Session | GTM Run |

## GTM Brief Fields

The GTM Brief should be SaaS-specific. Do not make it a generic company profile.

Core field groups:

- Company identity: company name, URL, category, market, geography.
- Product and offer: product description, use cases, core promise, CTA, packaging, pricing model.
- ICP: target segment, roles, company size, buying committee, pains, triggers, objections.
- GTM motion: PLG, sales-led, hybrid, demo-led, trial-led, self-serve, enterprise.
- Funnel: current conversion path, landing pages, sales handoff, lifecycle constraints.
- Economics: ACV, LTV, CAC target, monthly budget, sales cycle, margin assumptions.
- Competitive context: known competitors, alternatives, category frames, differentiation.
- Proof: testimonials, case studies, logos, metrics, claims, style references.
- Brand and constraints: tone, forbidden claims, compliance, geography, timeline.
- Goal: campaign objective, expected output, target market, launch urgency.

Each field needs this minimum state:

```typescript
interface GtmBriefField {
  value: string;
  status: 'missing' | 'suggested' | 'needs_review' | 'confirmed';
  confidence: 'missing' | 'low' | 'medium' | 'high';
  sources: EvidenceSource[];
  updatedBy: 'ai' | 'user' | 'system';
  updatedAt: string;
}
```

The user can override AI-filled fields. User-confirmed values win over later AI suggestions.

## Evidence Model

Every important claim should preserve where it came from.

```typescript
interface EvidenceSource {
  id: string;
  type: 'url' | 'document' | 'transcript' | 'manual_note' | 'web_research' | 'ad_library' | 'tool_result';
  label: string;
  url?: string;
  excerpt?: string;
  capturedAt: string;
}
```

Do not invent market data, competitor facts, pricing, customer quotes, performance benchmarks, or ad claims. If a source is missing, mark the field as missing or assumption-based.

## Run Contract

A run must always know which brief snapshot it used.

```typescript
interface GtmRun {
  id: string;
  userId: string;
  clientId: string;
  briefId: string;
  briefSnapshotId: string;
  status: 'draft' | 'running' | 'needs_review' | 'completed' | 'failed';
  currentStage: GtmStageKey;
  createdAt: string;
  updatedAt: string;
}
```

The brief can evolve after a run. Existing outputs should not silently change. If the brief changes after outputs exist, the system should either create a new run or mark downstream outputs stale.

## Stage Order

```text
discover-url
  -> enrich-brief
  -> review-brief
  -> lock-brief
  -> research-market-category
  -> research-buyer-icp
  -> research-competitors
  -> research-voc
  -> research-demand-intent
  -> research-offer-funnel
  -> synthesize-strategy
  -> generate-media-plan
  -> generate-scripts
```

The workflow decides the order. The agent decides how to complete each bounded stage with the tools and skills available to that stage.

## Research Sections

Each research section has one job and consumes the locked GTM Brief.

| Section | Primary question | Feeds |
|---|---|---|
| Market & Category | What market/category is this SaaS actually competing in? | Positioning, channel framing, competitor set |
| Buyer & ICP | Who buys this, why now, and what segments matter most? | Audience, targeting, scripts |
| Competitors | Who are the credible alternatives and where can we win? | Positioning, ads, offer angles |
| Voice of Customer | What language, pains, objections, and desired outcomes appear in the market? | Scripts, hooks, landing-page copy |
| Demand & Intent | Where does demand show up and what signals/channels matter? | Media plan, search, targeting |
| Offer & Funnel | Is the offer clear enough to convert, and what must be fixed? | Media plan, landing page, CTA, scripts |

Research sections may propose GTM Brief updates, but they must not silently mutate the locked snapshot.

## Strategy Synthesis

Strategy Synthesis is the bridge between research and execution.

It should output:

- ICP priority.
- Positioning decision.
- Core offer angle.
- Messaging pillars.
- Channel priorities.
- Key objections.
- Proof to use.
- Risks and unknowns.
- Assumptions that need validation.

This is the internal decision layer. The media plan should not re-invent strategy from scratch.

## Media Plan Contract

The media plan consumes:

- Locked GTM Brief snapshot.
- Research section outputs.
- Strategy Synthesis.
- Budget and economics fields.
- Channel and funnel constraints.

It outputs:

- Channel mix.
- Budget allocation.
- Audience segments.
- Campaign structure.
- Creative angle map.
- Landing page assumptions.
- Testing roadmap.
- Measurement plan.
- Risks and dependencies.

Every media-plan decision should be traceable back to brief fields or research evidence.

## Script Pack Contract

Scripts consume:

- Media plan.
- Voice of Customer evidence.
- Buyer objections.
- Proof points.
- Brand voice.
- Channel constraints.
- CTA and offer.

Scripts output:

- Hooks.
- Video scripts.
- Static ad copy.
- Landing-page copy blocks.
- Outbound angles.
- Nurture copy.
- Creative briefs.

Scripts should not research from scratch. They are final-mile execution outputs.

## Skill Architecture

Top-level `skills/` contains portable Anthropic-style skills. These are methodology packages, not app runtime code.

```text
skills/
  ingest-url/
  ingest-docs/
  ingest-transcript/
  build-gtm-brief/
  research-market-category/
  research-buyer-icp/
  research-competitors/
  research-voc/
  research-demand-intent/
  research-offer-funnel/
  synthesize-strategy/
  synthesize-media-plan/
  synthesize-scripts/
```

Each skill should use this shape:

```text
skills/research-competitors/
  SKILL.md
  references/
    methodology.md
    source-policy.md
    output-rubric.md
  examples/
    input.json
    output.json
  scripts/
    validate-output.ts
```

Rules:

- `SKILL.md` stays short and trigger-focused.
- Detailed methodology goes in `references/`.
- Examples show realistic input and output.
- Scripts are optional and single-purpose.
- Do not create a package per skill unless the skill truly needs independent dependencies.
- Do not duplicate skills in both `.claude/skills` and top-level `skills/`.

## Folder Structure

Target product structure:

```text
src/
  app/
    gtm/
      page.tsx
    api/
      gtm/
        runs/
        brief/
        research/
        media-plan/
        scripts/

  features/
    gtm/
      intake/
      brief/
      research-workspace/
      media-plan/
      scripts/
      runs/

  lib/
    gtm/
      schemas/
        gtm-brief.ts
        evidence.ts
        research-sections.ts
        strategy-synthesis.ts
        media-plan.ts
        script-pack.ts
      workflow/
        stage-registry.ts
        run-state.ts
        section-order.ts
      contracts/
        stage-inputs.ts
        stage-outputs.ts

    ai/
      anthropic.ts
      structured-output.ts
      citations.ts
      tool-errors.ts

    db/
      repositories/
      supabase/
```

Worker structure:

```text
research-worker/
  src/
    jobs/
      run-gtm-workflow.ts
    stages/
      discover-url.ts
      enrich-brief.ts
      lock-brief.ts
      run-research-section.ts
      synthesize-strategy.ts
      generate-media-plan.ts
      generate-scripts.ts
    runtime/
      skill-loader.ts
      anthropic-runner.ts
      output-validator.ts
      citation-normalizer.ts
    adapters/
      web-search.ts
      firecrawl.ts
      supabase.ts
      ad-library.ts
    evals/
      cases/
      fixtures/
      graders/
```

Boundary rules:

- `src/features/gtm/*` owns UI workflows.
- `src/lib/gtm/schemas/*` owns shared Zod contracts.
- `src/lib/gtm/workflow/*` owns deterministic stage order and run state.
- `src/app/api/gtm/*` stays thin and calls domain services.
- `research-worker/src/stages/*` owns worker execution stages.
- `research-worker/src/runtime/*` owns generic model, skill, validation, and citation plumbing.
- `research-worker/src/adapters/*` owns external services.
- `.claude/` is Claude Code configuration only, not product architecture.

## Minimal Guardrails

Avoid heavy enterprise orchestration. Keep the controls that protect output quality:

- One locked GTM Brief snapshot per run.
- Zod validation for every AI output.
- Source/citation tracking for claims.
- Explicit missing/assumption states.
- User-confirmed brief fields override AI suggestions.
- Stale-output detection when the brief changes.
- Evals for representative URL-only, docs-enriched, transcript-enriched, and weak-source runs.

## What To Retire

Retire these as primary architecture concepts:

- Blank onboarding form as the starting point.
- Business Profile as the run source of truth.
- Company Snapshot as a separate canonical model.
- Independent AI reports that do not share the locked brief.
- Research sections that mutate profile state silently.
- Duplicated skill folders across `.claude/skills`, `skills/`, and worker internals.

## Implementation Order

1. Lock this architecture doc as the new source of truth.
2. Define `gtm-brief`, `evidence`, `run`, and `stage-output` schemas.
3. Create the target folder structure with empty exports and tests.
4. Move old onboarding fields into the GTM Brief schema.
5. Build URL -> draft GTM Brief.
6. Add docs/transcript enrichment into the same brief.
7. Add brief review and lock.
8. Run research sections from the locked brief.
9. Add Strategy Synthesis.
10. Generate Media Plan.
11. Generate Script Pack.
12. Backfill or adapt legacy sessions only after the new spine works.

## Acceptance Criteria

- A new engineer can explain the system as: `Inputs -> GTM Brief -> Research -> Strategy -> Media Plan -> Scripts`.
- No new code treats onboarding as a persistent domain object.
- Every downstream stage receives a `briefSnapshotId`.
- Every AI stage has a Zod output schema.
- Every important research claim has evidence or an assumption marker.
- Skills are portable, short, and aligned to one workflow stage.
- The user reviews the brief once, then the agent executes the rest automatically.
