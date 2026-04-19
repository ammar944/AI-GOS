# Asset Collection Phase — Design Spec

**Date:** 2026-04-14
**Status:** Approved
**Branch:** redesign/v2-command-center

## Problem

The unified journey pipeline goes straight from media plan → scripts. The script runner already supports style references and proof points as inputs (injected into both Pass 1 and Pass 2 prompts), but the journey flow provides no opportunity to collect them. Assets only exist in the profile detail page's "Assets" tab — a place users rarely visit during the journey. Scripts generated without assets lack brand voice calibration and use fabrication guards instead of real proof.

## Solution

Insert an **Asset Collection Phase** between media plan completion and script generation. This is a dedicated full-width workspace view (same pattern as `ScriptsPhaseContent`) where users can add three types of assets:

1. **Style References** — winning ads, VSLs, competitor copy that calibrate voice/tone
2. **Proof Points** — case studies, testimonials, metrics, credentials that prevent fabrication
3. **Brand Voice Notes** (new) — structured tone, constraints, and good/bad examples

The phase is **optional** — users can skip to scripts in one click.

## Pipeline Flow

```
Research (6 sections) → Media Plan → Asset Collection → Scripts
```

| State | What user sees |
|-------|---------------|
| Media plan reaches `review` or `approved` | PhaseTransitionCard: "Enhance Your Scripts" with [Add Assets] and [Skip to Scripts] |
| Click "Add Assets" | Workspace swaps artifact canvas → `AssetCollectionPhase` |
| Click "Skip to Scripts" | Bypasses assets, navigates to `ScriptsPhaseContent` with `autoGenerate=true` |
| Finish adding assets, click "Generate Scripts" | Saves assets to profile → navigates to `ScriptsPhaseContent` with `autoGenerate=true` |

## Data Model

### Existing columns (unchanged)

- `business_profiles.style_references` — JSONB `StyleReference[]`
- `business_profiles.proof_points` — JSONB `ProofPoint[]`

### New column

```sql
ALTER TABLE business_profiles
ADD COLUMN brand_voice_notes JSONB DEFAULT NULL;
```

### TypeScript interfaces

```typescript
// Existing — no changes
interface StyleReference {
  name: string;
  content: string;
  source: string;
}

interface ProofPoint {
  id: string;
  type: 'case_study' | 'testimonial' | 'metric' | 'credential';
  headline: string;
  detail: string;
  clientName?: string;
  verified: boolean;
}

// New
interface BrandVoiceNotes {
  tone: string;        // "Authoritative but approachable, like Alex Hormozi"
  constraints: string; // "Never use exclamation marks. No emojis. Data before emotion."
  goodExample: string; // What the brand sounds like
  badExample: string;  // What the brand should never sound like
}
```

### Supabase type update

Add `brand_voice_notes` to the `BusinessProfile` type in `src/lib/profiles/business-profiles.ts` and update `mapRow()` to parse it.

## Component Architecture

### New components

| Component | File | Purpose |
|-----------|------|---------|
| `AssetCollectionPhase` | `src/components/workspace/asset-collection-phase.tsx` | Full-width workspace phase. Owns tab state (style-refs / proof-points / voice). Header with "Skip" and "Generate Scripts" buttons. Footer with asset count summary. |
| `AssetStyleRefs` | `src/components/assets/asset-style-refs.tsx` | Grid of style reference cards. Add/edit/delete. Dashed "+" card for new entries. Content preview with line clamp. |
| `AssetProofPoints` | `src/components/assets/asset-proof-points.tsx` | Grid of proof point cards. Type badge (case_study/testimonial/metric/credential). Verified toggle. Add/edit/delete. |
| `AssetBrandVoice` | `src/components/assets/asset-brand-voice.tsx` | Three structured fields: tone (textarea), constraints (textarea), good/bad examples (side-by-side textareas with green/red styling). |

### Modified components

| Component | File | Changes |
|-----------|------|---------|
| `WorkspacePage` | `src/components/workspace/workspace-page.tsx` | New `showAssetCollection` state. New `handleNavigateToAssets` handler. Conditionally render `AssetCollectionPhase` instead of artifact canvas. |
| `ArtifactCanvas` | `src/components/workspace/artifact-canvas.tsx` | Update PhaseTransitionCard for scripts to become the asset CTA. Two buttons: "Add Assets" and "Skip to Scripts". Condition: media plan is `review`/`approved` AND scripts not started. |
| `StyleRefsTab` | `src/components/scripts/style-refs-tab.tsx` | Recompose to use shared `AssetStyleRefs` and `AssetProofPoints` sub-components. Add `AssetBrandVoice` as third tab. |

### Props for AssetCollectionPhase

```typescript
interface AssetCollectionPhaseProps {
  runId: string;                    // from workspace, used to fetch session/profile internally
  onGenerateScripts: () => void;    // called after flush-save succeeds, triggers script navigation
  onSkip: () => void;               // bypasses assets, goes to scripts directly
}
```

The component fetches profile data (including existing assets) on mount via `/api/journey/session?runId=` — same pattern as `ScriptsPhaseContent`. No parent threading of profileId or initial asset data needed.

## API Changes

### Existing endpoint (extended)

`PUT /api/profiles/[id]/style-references`

Add support for `brandVoiceNotes` in the request body:

```typescript
// Request body (all optional — send what changed)
{
  styleReferences?: StyleReference[];
  proofPoints?: ProofPoint[];
  brandVoiceNotes?: BrandVoiceNotes;
}
```

Update the route handler to write `brand_voice_notes` column alongside existing columns.

### Script generation route (extended)

`POST /api/scripts/generate` (`src/app/api/scripts/generate/route.ts`)

Add `brand_voice_notes` to the profile select query. Pass `brandVoiceNotes` to the worker alongside existing `styleReferences` and `proofPoints`.

## AI Engineering — Prompt Changes

### Pass 1 (ad-scripts-pass1.ts) — New prompt blocks

Injection order in the prompt (top to bottom):

1. System prompt (role + task)
2. Research context
3. **Brand voice constraints** (hard rules — high attention position)
4. Style references (voice calibration)
5. Proof points (evidence)
6. **Brand voice tone + examples** (calibration, reinforces constraints)

New blocks:

```markdown
## BRAND VOICE — HARD RULES (NEVER VIOLATE)
${brandVoiceNotes.constraints}
These are non-negotiable. Every script must comply.

## BRAND VOICE — TONE
${brandVoiceNotes.tone}
Write in this register. Match this personality throughout.
```

And after style refs + proof points:

```markdown
## BRAND VOICE — EXAMPLES
GOOD (match this): ${brandVoiceNotes.goodExample}
BAD (never this): ${brandVoiceNotes.badExample}
Study the difference. Your output should read like the "good" example.
```

### Pass 2 (ad-scripts-pass2.ts) — Constraint enforcement

Re-inject constraints as a compliance checklist:

```markdown
## BRAND VOICE COMPLIANCE CHECK
Before returning each script, verify it doesn't violate these rules:
${brandVoiceNotes.constraints}
If any script violates a rule, rewrite it.
```

### Worker input type update

Add `brandVoiceNotes?: BrandVoiceNotes` to `AdScriptsInput` in `research-worker/src/runners/ad-scripts.ts`.

### Fallback behavior

When `brandVoiceNotes` is null/undefined (user skipped or hasn't added any), the prompt blocks are omitted entirely. No placeholder text, no "no voice notes available" — just absent from the prompt. This matches the existing pattern for empty style references.

## UX Improvements Over Current StyleRefsTab

1. **Inline edit** — current component only supports add/delete. New sub-components support click-to-edit on any field.
2. **Contextual guidance** — each tab shows a tip explaining exactly how the AI uses that asset type.
3. **Asset count summary** — footer shows running count across all three types.
4. **Auto-save** — debounced save on change (500ms), no separate "save" button. Visual save indicator.
5. **Validation** — content max 5000 chars per style ref, whitespace trimming, ProofPoint.type restricted to enum values.
6. **Brand voice** — entirely new capability. Three structured fields with placeholder text guiding users.

## Profile Page Integration

The profile detail page's "Assets" tab (`StyleRefsTab`) is recomposed to use the same shared sub-components (`AssetStyleRefs`, `AssetProofPoints`, `AssetBrandVoice`). Both the journey and profile views read/write the same Supabase columns. Editing assets on the profile page affects the next script generation.

## Testing Strategy

1. **Unit tests:** `AssetBrandVoice` renders three fields, saves on change. `AssetStyleRefs` add/edit/delete flow. `AssetProofPoints` type badge rendering, verified toggle.
2. **Integration test:** Full flow — media plan approved → CTA appears → click "Add Assets" → add a style ref → click "Generate Scripts" → verify assets passed to script generation API.
3. **Skip path:** Media plan approved → click "Skip to Scripts" → scripts generate without assets.
4. **Profile round-trip:** Add assets in journey → navigate to profile → verify assets appear in profile Assets tab → edit → regenerate scripts → verify updated assets used.
5. **Prompt verification:** Script runner receives `brandVoiceNotes` and injects all three blocks in correct order.

## Adversarial Review Fixes

### Fix 1: Full Worker Boundary Data Path

The brand voice notes must traverse 5 links. Missing any = silently dropped:

```
1. generate/route.ts  → .select('..., brand_voice_notes')
2. generate/route.ts  → dispatch body: { ..., brandVoiceNotes: profile.brand_voice_notes }
3. worker/index.ts    → parse brandVoiceNotes from POST body into AdScriptsInput
4. ad-scripts.ts      → format brandVoiceNotes, pass to buildPass1Prompt/buildPass2Prompt
5. ad-scripts-pass1.ts / pass2.ts → inject into prompt string
```

Each link must be implemented and tested. The worker HTTP handler in `research-worker/src/index.ts` (the `/scripts/generate` endpoint) is an additional modified file not originally listed.

### Fix 2: Race Condition — Generate Button Flushes Saves

The "Generate Scripts" button MUST:
1. Cancel any pending auto-save debounce timer
2. Execute an immediate synchronous save (await the PUT response)
3. Only on success: navigate to ScriptsPhaseContent
4. On failure: show error toast, do not navigate

This prevents the scenario where a user types brand voice notes and immediately clicks Generate before the 500ms debounce fires.

### Fix 3: ProfileId Fetching Strategy

`AssetCollectionPhase` fetches its own `profileId` internally — same pattern as `ScriptsPhaseContent` which calls `/api/journey/session?runId=` to get session info including profileId. No new props needed on WorkspacePage.

Updated props:
```typescript
interface AssetCollectionPhaseProps {
  runId: string;                    // passed from workspace, used to fetch session/profile
  onGenerateScripts: () => void;
  onSkip: () => void;
}
```

The component fetches profile data (including existing assets) on mount via the session endpoint, eliminating the need for parent components to thread profileId and initial asset data.

### Fix 4: State Machine for showAssetCollection

```
States: artifact-canvas (default) | asset-collection | scripts

Transitions:
  artifact-canvas → asset-collection:  user clicks "Add Assets" CTA
  artifact-canvas → scripts:           user clicks "Skip to Scripts" CTA
  asset-collection → scripts:          user clicks "Generate Scripts" (after save flush)
  asset-collection → scripts:          user clicks "Skip" within asset phase

On page refresh:
  showAssetCollection is React state — lost on refresh.
  User lands back on artifact-canvas. The asset CTA re-renders (media plan still approved, scripts not started).
  Any assets saved during the session persist in Supabase — they're not lost.
```

### Fix 5: Brand Voice Snapshot in Script Packs

Add `brandVoiceNotesSnapshot` to `script_packs.generation_context` alongside existing `styleReferencesSnapshot`. This preserves an audit trail of what voice notes were active when scripts were generated.

In `generate/route.ts`:
```typescript
generation_context: {
  ...existingFields,
  brandVoiceNotesSnapshot: profile.brand_voice_notes,
}
```

### Fix 6: Token Budget Caps

Character limits for brand voice fields (enforced in UI + API validation):

| Field | Max chars | Rationale |
|-------|-----------|-----------|
| `tone` | 500 | ~125 tokens. Personality description shouldn't be a novel. |
| `constraints` | 1000 | ~250 tokens. Room for 10-15 specific rules. |
| `goodExample` | 1500 | ~375 tokens. One full ad example. |
| `badExample` | 1500 | ~375 tokens. One full ad example. |

Total worst case: ~1125 tokens added to prompt. The pass 1 prompt is ~4000 tokens of system prompt + variable research context. This is within safe limits for Claude Sonnet/Opus context windows.

Style reference content cap remains 5000 chars per ref (existing).

### Fix 7: Prompt Builder Opts Interface Changes

`buildPass1Prompt` opts — add:
```typescript
brandVoiceNotes?: {
  tone: string;
  constraints: string;
  goodExample: string;
  badExample: string;
} | null;
```

`buildPass2Prompt` opts — add:
```typescript
brandVoiceNotes?: {
  tone: string;
  constraints: string;
  goodExample: string;
  badExample: string;
} | null;
```

Pass 2 gets the full object (not just constraints) so it can use tone + examples for voice calibration during humanization, not just compliance checking.

### Fix 8: Auto-save Error Handling

If auto-save fails:
- Show a subtle warning indicator (amber dot near save status)
- Do NOT block the user from editing
- "Generate Scripts" button still does its own flush-save — the auto-save failure doesn't prevent generation
- If the flush-save also fails, show an error toast and block navigation

## Files Affected

### New files
- `src/components/workspace/asset-collection-phase.tsx`
- `src/components/assets/asset-style-refs.tsx`
- `src/components/assets/asset-proof-points.tsx`
- `src/components/assets/asset-brand-voice.tsx`
- Supabase migration file for `brand_voice_notes` column

### Modified files
- `src/components/workspace/workspace-page.tsx` — asset navigation state + handler
- `src/components/workspace/artifact-canvas.tsx` — asset CTA replaces scripts CTA
- `src/components/scripts/style-refs-tab.tsx` — recompose with shared sub-components + brand voice tab
- `src/app/api/profiles/[id]/style-references/route.ts` — accept + validate brandVoiceNotes
- `src/app/api/scripts/generate/route.ts` — fetch + pass brandVoiceNotes + snapshot
- `src/lib/profiles/business-profiles.ts` — BrandVoiceNotes type, mapRow update
- `research-worker/src/index.ts` — parse brandVoiceNotes from POST body into AdScriptsInput
- `research-worker/src/runners/ad-scripts.ts` — accept + format brandVoiceNotes for prompt builders
- `research-worker/src/prompts/ad-scripts-pass1.ts` — brandVoiceNotes opts + 3 prompt blocks
- `research-worker/src/prompts/ad-scripts-pass2.ts` — brandVoiceNotes opts + compliance + voice calibration blocks

## Out of Scope

- Drag-to-reorder assets (future enhancement)
- Bulk paste / CSV import of proof points
- AI-assisted asset extraction from uploaded documents
- Brand voice presets / templates
