# Business Profile-First AIGOS

**Date:** 2026-04-24
**Status:** Superseded
**Selected direction:** Profile-First Operating Record

> Superseded by `docs/superpowers/specs/2026-04-24-gtm-brief-architecture.md`.
> The canonical direction is now GTM Brief-first: inputs -> GTM Brief -> research sections -> strategy synthesis -> media plan -> scripts.

## Problem

AIGOS currently has the pieces for a strong company-understanding flow, but they are split across onboarding metadata, `business_profiles`, `identityResolution`, research results, and workspace state. Product-wise, that makes identity feel like an implementation detail instead of a trust checkpoint.

The product bar is:

> AIGOS understands my company correctly before it researches.

Do not start by building a portable identity skill. Identity is not the user-facing feature. The canonical Business Profile is the user-facing feature; identity resolution is the foundation underneath it.

## Decision

Make the Business Profile the canonical operating record for every journey.

Every research run, media plan, and script pack must read from a confirmed Business Profile and write evidence back to it. The onboarding review screen becomes a preflight editor for this profile, not a one-time form. The Company Snapshot becomes a reusable, confidence-aware card shown inside profile, onboarding, workspace, media plan, and scripts.

## Product Flow

```text
Business Profile
  -> Onboarding Review / Preflight
  -> Company Snapshot Card
  -> Research Workspace
  -> Media Plan Workspace
  -> Scripts Workspace
```

### 1. Business Profile Page

This is the canonical page for the company.

It shows:

- Current company identity: name, website, category, offer, ICP, geography, pricing/economics.
- Source inputs: URLs, uploaded docs, meeting transcripts, manually edited fields.
- Current Company Snapshot: compact, confidence-aware, editable.
- Research sessions explicitly linked to this profile.
- Assets, proof points, style references, and brand voice notes.

Primary action: approve the company understanding and start research.

### 2. Onboarding Review Screen

This becomes a preflight checklist before research starts.

It shows:

- URL prefill results.
- Document extraction results.
- Transcript extraction results.
- Search suggestions.
- Missing blockers.
- Weak fields that can run but should be improved.

The user edits the same canonical profile fields here. Nothing important should live only in transient onboarding state.

### 3. Company Snapshot Card

This is a small reusable component, not a separate workflow.

It shows:

- Company name and URL.
- Category and market label.
- Offer description.
- ICP summary.
- Pricing/economics summary.
- Competitor seed list.
- Confidence state per field.
- Source count and last-updated timestamp.

The card must be editable wherever it appears, but edits save to the Business Profile.

### 4. Research Workspace

The visible research workspace uses six sections:

| Visible order | New label | Current/root key |
|---|---|---|
| 01 | Market & Category Intelligence | `industryMarket` / `marketIntelligence` |
| 02 | Buyer & ICP Validation | `icpValidation` / `buyerValidation` |
| 03 | Competitor Landscape & Positioning | `competitors` / `competitorLandscape` |
| 04 | Voice of Customer & Objection Evidence | new `voiceOfCustomer` |
| 05 | Demand & Intent Signals | `keywordIntel` / `demandSignals` |
| 06 | Offer & Performance Diagnostic | `offerAnalysis` / `offerDiagnostic` |

`crossAnalysis` becomes an internal bridge, not a big visible research tab. It prepares media-plan synthesis from the six approved evidence sections.

### 5. Media Plan Workspace

The media plan consumes:

- Confirmed Business Profile.
- Six research sections.
- Internal strategic synthesis.
- Profile assets and constraints.

It should not generate generic strategy text. It should show which research evidence drove channel choice, budget allocation, audience choice, and campaign sequencing.

### 6. Scripts Workspace

Scripts consume:

- Approved media plan.
- Voice of Customer and objection language.
- Proof points.
- Style references.
- Brand voice notes.

Scripts must preserve the evidence chain back to research and profile sources.

## Data Model

### Canonical Snapshot

Add a dedicated profile snapshot object instead of burying confidence metadata in `all_fields` or `ai_insights`.

```typescript
interface ProfileFieldEvidence {
  sourceType: 'url' | 'document' | 'meeting' | 'manual' | 'research';
  sourceLabel: string;
  extractedAt: string;
}

interface ProfileFieldState {
  value: string;
  confidence: 'high' | 'medium' | 'low' | 'missing';
  status: 'confirmed' | 'suggested' | 'needs_review' | 'missing';
  evidence: ProfileFieldEvidence[];
}

interface CompanySnapshot {
  companyName: ProfileFieldState;
  websiteUrl: ProfileFieldState;
  category: ProfileFieldState;
  offer: ProfileFieldState;
  primaryIcp: ProfileFieldState;
  pricingEconomics: ProfileFieldState;
  geography: ProfileFieldState;
  competitors: ProfileFieldState;
  updatedAt: string;
}
```

Recommended persistence:

```sql
ALTER TABLE business_profiles
ADD COLUMN company_snapshot JSONB DEFAULT NULL;
```

Keep existing typed columns and `all_fields` for compatibility. The snapshot is the canonical UI read model with source and confidence metadata.

### Session Linkage

Research runs must be created with an explicit `profile_id`.

Current fallback behavior in `getProfileSessions()` links unlinked sessions after the fact. That is not safe for a profile-first product because a research run can be attached to the wrong company. The new flow should set `journey_sessions.profile_id` at run creation and treat missing `profile_id` as legacy-only.

## Architecture

```text
URL / docs / transcript / manual edits
  -> extraction proposals
  -> Onboarding Review edits CompanySnapshot
  -> business_profiles.company_snapshot
  -> start research with profile_id + snapshot
  -> worker receives profile context
  -> six evidence sections write to journey_sessions.research_results
  -> approved sections update business_profiles.ai_insights / company_snapshot evidence
  -> internal cross-analysis prepares media plan
  -> media plan and scripts preserve evidence chain
```

### Current Files Affected

- `src/lib/profiles/business-profiles.ts`
- `src/app/profiles/[id]/page.tsx`
- `src/components/journey/unified-field-review.tsx`
- `src/app/journey/page.tsx`
- `src/lib/workspace/types.ts`
- `src/lib/workspace/pipeline.ts`
- `src/lib/journey/section-meta.ts`
- `src/components/workspace/*`
- `src/lib/agents/types.ts`
- `src/lib/agents/prompts/agent-system.ts`
- `research-worker/src/runners/*`
- `research-worker/src/contracts.ts`

## Section Pipeline Changes

Current visible pipeline:

```text
industryMarket -> icpValidation -> competitors -> offerAnalysis -> keywordIntel -> crossAnalysis -> mediaPlan
```

Target visible pipeline:

```text
industryMarket -> icpValidation -> competitors -> voiceOfCustomer -> keywordIntel -> offerAnalysis -> mediaPlan -> scripts
```

Internal bridge:

```text
six approved research sections -> crossAnalysis/internal synthesis -> mediaPlan
```

Important changes:

- Add `voiceOfCustomer` as a first-class `SectionKey`.
- Move `offerAnalysis` after the first five research sections where possible.
- Keep legacy alias support for old sessions.
- Remove `crossAnalysis` from visible research approval gates.
- Keep `crossAnalysis` as internal synthesis data for media-plan generation.
- Rename labels without breaking old stored keys.

## UI Design

### Profile Page

Use a dense editable record layout, not marketing cards.

Structure:

- Header: company name, URL, category, last updated.
- Snapshot strip: confidence, source count, missing blockers.
- Editable profile record: grouped fields with confidence badges and source chips.
- Source inputs panel: website, docs, meetings, manual notes.
- Linked runs: table of research sessions tied by `profile_id`.
- Assets tab remains, but it is clearly part of the company operating record.

### Preflight Review

Use a checklist, not a wizard.

Rows:

- URL extracted.
- Documents parsed.
- Meetings parsed.
- Required blockers complete.
- Pricing/economics confidence.
- Competitor seed strength.
- Research search suggestions.

Each row has `ready`, `partial`, `missing`, or `blocked` state. The primary CTA is disabled only for hard blockers.

### Research Workspace

Use section tabs/cards exactly in the six-section structure.

Each section should show:

- Evidence summary.
- Key claims.
- Source/citation pane.
- Data gaps.
- User approval state.

Voice of Customer must be a dedicated tab because objection language and verbatim buyer phrasing are directly reusable by scripts.

### Media Plan Workspace

Use research-backed strategy blocks:

- Channel mix.
- Budget split.
- Audience strategy.
- Campaign phases.
- Creative angle system.
- Measurement plan.
- Risk flags.

Every recommendation should be traceable to a section or profile field.

### Scripts Workspace

Use output workbench layout:

- Awareness-level tabs.
- Script list.
- Evidence chain panel.
- VoC phrase bank.
- Proof point selector.
- Style reference controls.

## Error Handling

- Missing profile: block research start with a specific error containing `userId`, `profileId`, and `runId` if available.
- Missing hard blocker: show the exact missing fields and keep the user on preflight.
- Low-confidence field: allow research start, but mark it visibly in Company Snapshot and inject it as uncertain context.
- Extraction failure: preserve other extracted fields; show source-specific error with status and file/URL label.
- Research without `profile_id`: allow legacy rendering, but do not backfill automatically unless the company name and website match the profile exactly.

## Testing Strategy

Unit tests:

- Company snapshot merge preserves manual confirmations over later low-confidence extraction.
- Snapshot field states compute `missing`, `suggested`, `needs_review`, and `confirmed` correctly.
- Pipeline readiness includes `voiceOfCustomer` and excludes visible `crossAnalysis`.
- Legacy aliases still render old sessions.

Component tests:

- Profile page renders snapshot confidence and source chips.
- Preflight checklist blocks only hard missing fields.
- Company Snapshot Card edits save through the profile API.
- Research tabs render six visible sections in the target order.

Integration tests:

- URL prefill -> preflight edit -> profile save -> research start includes `profile_id`.
- Research run writes six sections and media plan is gated behind their completion.
- Media plan consumes Business Profile plus research evidence.
- Scripts consume media plan plus VoC objection language.

Regression tests:

- Old sessions with `crossAnalysis` still open.
- Old sessions without `voiceOfCustomer` show legacy compatibility state instead of crashing.
- Profile sessions are not auto-linked to unrelated companies.

## Implementation Phases

### Phase 1: Contract and Labels

- Add `voiceOfCustomer` to `SectionKey`.
- Update section metadata labels.
- Update `SECTION_PIPELINE`, readiness, and visible research sections.
- Add legacy alias handling.

### Phase 2: Company Snapshot

- Add `company_snapshot` persistence.
- Add snapshot merge/read helpers.
- Add reusable Company Snapshot Card.
- Update profile API and profile page.

### Phase 3: Preflight Review

- Convert onboarding review to write the Business Profile snapshot.
- Show source extraction and missing blockers as a preflight checklist.
- Start research only after profile is saved and linked.

### Phase 4: Research Workspace

- Add first-class Voice of Customer UI and result contract.
- Reorder visible research tabs.
- Move `crossAnalysis` to internal media-plan preparation.
- Move offer diagnostic after the evidence sections where the dispatch model allows.

### Phase 5: Media Plan and Scripts

- Inject profile snapshot and approved research bundle into media plan synthesis.
- Preserve evidence links into scripts.
- Add VoC phrase bank and objection evidence to scripts workspace.

## Open Decisions

1. Whether to backfill `company_snapshot` for existing profiles immediately or generate it lazily on first open.
2. Whether `voiceOfCustomer` should be produced by a new worker runner first or by the new agent-loop schema first.
3. Whether the Business Profile page should become `/profiles/[id]` only, or whether Journey should also get a profile-focused route before `/journey`.

## Approval

Option A was selected: Profile-First Operating Record. This spec assumes Business Profile is the canonical source of truth for all downstream AIGOS work.
