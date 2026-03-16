# URL-First Worker Journey Design

## Goal

Replace the current chat-led onboarding with a URL-first onboarding flow that:

- uses the website as the primary data source
- captures the full onboarding model before any research starts
- removes `askUser` and the global research Q&A loop
- launches section workers only after onboarding is complete
- lets the user review each artifact with `Looks good` or `Chat with this`

## Why This Direction

This direction is cleaner than the current journey for three reasons:

1. It moves the product from hidden chat orchestration to a deterministic workflow.
2. It front-loads business context collection into one controlled surface instead of scattering it across many turns.
3. It matches Anthropic's current guidance to prefer workflows for well-defined tasks, and to use orchestrator-worker patterns only where decomposition is genuinely useful.

Relevant source guidance:

- Anthropic Engineering, [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)
- Anthropic Engineering, [How we built our multi-agent research system](https://www.anthropic.com/engineering/built-multi-agent-research-system)
- Anthropic Docs, [Reducing latency](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-latency)
- Anthropic Docs, [Prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)

## Product Decision

Research does not begin until the onboarding model is complete.

This is the key constraint. The system should not ask follow-up questions during research and should not launch partial workers based on incomplete onboarding. The user finishes the onboarding model first, confirms it with `Looks good, start research`, and then the worker pipeline begins.

## High-Level Experience

### Entry

The user lands on `/journey` and provides:

- website URL
- optional LinkedIn company URL

There is no `Start without website analysis` path.

### Stage 0: Website Extraction

The system scrapes the website and builds a structured onboarding profile.

The profile should show:

- extracted values
- editable values
- missing required values
- confidence where useful

The user is not dropped into chat. They stay in a structured onboarding workspace.

### Stage 1: Guided Onboarding Review

Instead of one long form, the onboarding is broken into 5 short review steps:

1. Company Context
2. Audience
3. Offer
4. Competition
5. Goals and Commercial Reality

Each step:

- shows extracted values first
- highlights missing required inputs
- allows editing
- prevents core required fields from being left blank

The user can move forward and backward, but cannot start research until the full onboarding model passes validation.

### Stage 2: Research Launch

Once validation passes, the CTA becomes:

- `Looks good, start research`

On click:

- onboarding is frozen into a versioned input snapshot
- orchestrator dispatches workers
- user moves into the research workspace

### Stage 3: Artifact Review Loop

Each section artifact gets:

- `Looks good`
- `Chat with this`

`Chat with this` is section-local. It is not a global onboarding chat. It exists to:

- clarify or correct section assumptions
- refine section output
- trigger targeted reruns of affected workers

### Stage 4: Strategist Mode

Only after synthesis and downstream core outputs are done does the user get a broader strategist chat.

That final chat is for:

- interpreting findings
- asking strategic questions
- generating recommendations

It is not used for onboarding data collection.

## UX Structure

## Step Layout

The onboarding should be a 5-step review flow, not a flat 39-field wall.

### Step 1: Company Context

Purpose:

- establish what the business is
- validate scrape-derived company facts
- lock shared context used by all workers

Fields:

- `companyName`
- `websiteUrl`
- `businessModel`
- `industryVertical`
- `headquartersLocation`
- `marketProblem`
- `pricingUrl`
- `demoUrl`
- `caseStudiesUrl`
- `testimonialsUrl`
- `testimonialQuote`

Validation:

- `companyName`, `websiteUrl`, `businessModel`, and `industryVertical` required

### Step 2: Audience

Purpose:

- define the ICP and buying context before worker research starts

Fields:

- `primaryIcpDescription`
- `jobTitles`
- `companySize`
- `geography`
- `easiestToClose`
- `buyingTriggers`
- `bestClientSources`

Validation:

- `primaryIcpDescription`, `jobTitles`, `companySize`, and `geography` required

### Step 3: Offer

Purpose:

- lock what is being sold, how it is packaged, and what economics matter

Fields:

- `productDescription`
- `coreDeliverables`
- `pricingTiers`
- `monthlyAdBudget`
- `valueProp`
- `currentFunnelType`
- `guarantees`

Validation:

- `productDescription` required
- at least one of `pricingTiers` or `monthlyAdBudget` required
- `valueProp` required

### Step 4: Competition

Purpose:

- define the comparison set and positioning before competitor workers run

Fields:

- `topCompetitors`
- `uniqueEdge`
- `competitorFrustrations`
- `marketBottlenecks`
- `brandPositioning`

Validation:

- `topCompetitors` required
- `uniqueEdge` required
- `brandPositioning` required

### Step 5: Goals and Commercial Reality

Purpose:

- capture commercial constraints and transformation goals needed for synthesis

Fields:

- `goals`
- `situationBeforeBuying`
- `desiredTransformation`
- `commonObjections`
- `salesCycleLength`
- `salesProcessOverview`
- `campaignDuration`
- `targetCpl`
- `targetCac`

Validation:

- `goals`, `situationBeforeBuying`, `desiredTransformation`, and `commonObjections` required

## Core UX Rules

- Users may edit any extracted value.
- Users may remove non-core values.
- Users may not blank required fields.
- Missing required values should appear inline inside the current step, not in a separate error page.
- The CTA should stay disabled until the full onboarding model is valid.
- The UI should show completion state by step, not by raw field count alone.

## Architecture Recommendation

## Recommended Approach

Use a thin deterministic orchestrator plus section workers.

Do not use a lead agent as the primary onboarding conversation surface.

### Why

This is a workflow, not an open-ended agent problem.

Anthropic explicitly distinguishes:

- workflows: predefined code paths
- agents: model-directed behavior for open-ended tasks

This onboarding is now a predefined workflow. The system knows:

- what fields exist
- what steps exist
- what validation rules exist
- when research can start

That makes deterministic orchestration the right pattern.

### Proposed Runtime Roles

#### 1. Onboarding Extractor

Responsible for:

- scrape + normalize website data
- populate onboarding fields
- assign confidence where applicable

This can be one backend pipeline, not a chat agent.

#### 2. Orchestrator

Responsible for:

- validating onboarding completion
- freezing the onboarding snapshot
- dispatching section workers
- tracking worker status
- invalidating and rerunning dependent sections when needed

This should be code-driven.

#### 3. Section Workers

Responsible for:

- generating section-specific research artifacts
- using only the onboarding snapshot + tool results

Primary workers:

- Market Overview worker
- Competitor Intel worker
- ICP Validation worker
- Offer Analysis worker
- Cross-Analysis worker
- Keyword Intelligence worker

#### 4. Section Edit Chat

Responsible for:

- handling `Chat with this`
- staying scoped to one artifact
- requesting changes
- writing back corrected assumptions
- triggering targeted reruns

This is the right place for chat.

#### 5. Final Strategist Chat

Responsible for:

- answering strategic questions after the core artifact set is complete

This is the only broad chat surface in the system.

## Field-to-Section Mapping

There are currently 39 fields in `JOURNEY_FIELDS`. Every field needs an explicit downstream consumer.

### Shared Company Context

These fields are shared inputs used by multiple workers:

- `companyName`
- `websiteUrl`
- `headquartersLocation`
- `marketProblem`
- `pricingUrl`
- `demoUrl`
- `caseStudiesUrl`
- `testimonialsUrl`
- `testimonialQuote`

Primary consumers:

- Market Overview
- Competitor Intel
- Offer Analysis
- Cross-Analysis

### Market Overview

Primary fields:

- `businessModel`
- `industryVertical`
- `marketProblem`
- `headquartersLocation`

Purpose:

- category framing
- macro market context
- buying environment

### ICP Validation

Primary fields:

- `primaryIcpDescription`
- `jobTitles`
- `companySize`
- `geography`
- `easiestToClose`
- `buyingTriggers`
- `bestClientSources`

Purpose:

- audience validation
- reachable target profile
- buying signal quality

### Offer Analysis

Primary fields:

- `productDescription`
- `coreDeliverables`
- `pricingTiers`
- `monthlyAdBudget`
- `valueProp`
- `currentFunnelType`
- `guarantees`

Purpose:

- offer clarity
- packaging analysis
- pricing and economics

### Competitor Intel

Primary fields:

- `topCompetitors`
- `uniqueEdge`
- `competitorFrustrations`
- `marketBottlenecks`
- `brandPositioning`

Purpose:

- comparison set
- strategic differentiation
- positioning pressure test

### Cross-Analysis / Synthesis

Primary fields:

- `goals`
- `situationBeforeBuying`
- `desiredTransformation`
- `commonObjections`
- `salesCycleLength`
- `salesProcessOverview`
- `campaignDuration`
- `targetCpl`
- `targetCac`
- `brandPositioning`

Purpose:

- strategic synthesis
- business objective alignment
- message and funnel implications

## Important Mapping Note

Some fields should be used in more than one section. That is correct and desirable.

Examples:

- `industryVertical` informs Market Overview and ICP Validation
- `brandPositioning` informs Competitor Intel and Cross-Analysis
- `pricingTiers` informs Offer Analysis and later budget/performance modeling
- `goals` should influence Cross-Analysis and all downstream recommendation sections

The requirement is not "one field, one section." The requirement is "every field has a clear primary consumer and no field is unused."

## Research Launch Contract

Research may start only when:

- all required onboarding fields are present
- the user clicks `Looks good, start research`
- the onboarding snapshot is persisted with a version ID

At launch:

- workers receive the same frozen onboarding snapshot
- each section stores which onboarding snapshot version it was generated from
- edits later can invalidate only the dependent sections

## Dependency Model

Suggested dependency graph:

- Market Overview depends on Company Context
- ICP Validation depends on Company Context + Audience
- Offer Analysis depends on Company Context + Offer
- Competitor Intel depends on Company Context + Competition
- Cross-Analysis depends on all prior section outputs + Goals and Commercial Reality
- Keyword Intelligence depends on Cross-Analysis + Competitor Intel + Offer Analysis

## Chat with This

`Chat with this` should open a scoped thread for one artifact.

It should:

- preload the artifact summary
- preload the section inputs that created it
- allow edits or clarifications
- show exactly what will rerun

It should not:

- collect unrelated onboarding data
- mutate unrelated sections silently
- reopen the full onboarding flow unless a core upstream field changes

## Latency and Performance

This design should be faster than the current journey if implemented correctly.

### Why

- deterministic onboarding means fewer model round trips
- worker prompts can be smaller and more specialized
- orchestration turns become code, not chat
- stable system instructions and tool definitions can use prompt caching

Anthropic specifically notes that prompt caching reduces processing time and costs for repetitive prompts and stable prefixes, and that cached prefixes are especially useful for tool-heavy iterative systems and long multi-turn flows.

### Practical Implications

- cache stable worker prompts
- cache tool definitions
- keep section workers specialized
- use lower-effort / lower-thinking settings for extraction and state transitions
- reserve higher-effort inference for synthesis or strategist turns only

## Risks

### Risk 1: The onboarding still feels too long

Mitigation:

- keep it to 5 steps
- prefill aggressively from the website
- collapse advanced fields by default within each step
- show required fields first

### Risk 2: Website extraction is wrong

Mitigation:

- extraction is editable everywhere
- confidence indicators where useful
- no research starts until user confirms

### Risk 3: Section-local edits create inconsistent downstream outputs

Mitigation:

- track snapshot versioning
- show impacted sections before rerun
- invalidate dependents deterministically

### Risk 4: Too many fields are treated as equally important

Mitigation:

- distinguish required vs optional vs enrichment fields
- show enrichment fields in expandable groups, not in the primary completion path

## Success Criteria

- No onboarding chat loop before research
- No research starts until onboarding is complete
- All 39 current onboarding fields have a documented primary consumer
- The onboarding is understandable in 5 steps without feeling like a dump
- The user can edit extracted values inline
- Required core fields cannot be blanked out
- `Chat with this` is scoped to one artifact and one rerun surface
- Global strategist chat appears only after core research artifacts are complete

## Implementation Notes for the Current Codebase

This design implies major changes to these areas:

- `src/app/journey/page.tsx`
- `src/lib/ai/prompts/lead-agent-system.ts`
- `src/lib/ai/tools/ask-user.ts`
- `src/components/journey/chat-message.tsx`
- `src/lib/journey/field-catalog.ts`
- `src/lib/journey/session-state.ts`
- `src/lib/journey/journey-section-orchestration.ts`
- `src/app/api/journey/stream/route.ts`

Likely new concepts needed:

- onboarding step definitions
- onboarding validation schema
- onboarding snapshot versioning
- section dependency graph
- section-local artifact edit threads

## Recommendation

Build this as:

- URL-first onboarding
- 5-step structured review
- deterministic validation gate
- worker-only research launch
- section-local `Chat with this`
- strategist chat only after synthesis

This is cleaner than the current journey, easier to reason about, and more consistent with Anthropic's recommended workflow-first design for predictable tasks.
