# v3 UI Integration — Codex Handoff (light Audit Reader → v3 backend)

> **Date:** 2026-05-26 · **Target branch:** `feat/v2-lab-section-wire` · **Author:** Claude (spec) → Codex (execute)
> **Goal in one line:** bring the approved **light "Audit Reader" UI** (commit `f9abec6f` on `codex/claude-managed-agents-work`) onto the **v3 backend** (`feat/v2-lab-section-wire`), so the shipping app has BOTH the proven engine and the locked design on one branch.

---

## The gap (why this handoff exists)

The two branches forked on **`f8e229c4` (May 20)** and never met:

| Branch | Has | Missing |
|---|---|---|
| `codex/claude-managed-agents-work` (UI) | the light reader re-skin (`f9abec6f`, +1 commit) | all 65 v3 backend commits (Perplexity corpus, DeepSeek, paid-media 7th, Phase S); still runs managed-agents-default |
| `feat/v2-lab-section-wire` (v3) | the proven backend (+65 commits) | the light UI — still on the old reader styling |

This integration lands the UI on v3. **It must run BEFORE the 48h soak** — you soak the real shipping app (v3 backend + light UI), not the backend alone. New sequencing: **UI integration → soak → teardown → promote.**

---

## Why this is tractable (not a rebuild)

Both branches share the **same render architecture** from the May-20 base. `f9abec6f` is a **re-skin of 16 shared files** against the **same data contract** — not a new data model.

**Shared & unchanged on both sides (DO NOT diverge these — reuse v3's):**
- `useAuditState(runId)` hook + `AuditStateResponse` (`src/lib/research-v2/use-audit-state.ts`, `src/app/api/research-v2/audit-state/route.ts`)
- `pickPositioningTypedArtifact()` + `PositioningTypedArtifact` (`src/types/positioning-artifact.ts`)
- the 6 managed-agents schema types (`@/lib/managed-agents/schemas/*` — on the teardown **keep-list**, so safe)
- zone dispatch via `typed-artifact-renderer.tsx`

So: **take f9abec6f's light styling; preserve v3's data + feature layer.**

---

## The 16-file conflict surface

`f9abec6f` touched exactly these (all also evolved on v3 → expect conflicts on each):
- `src/components/research-v2/audit-reader-shell.tsx` — **the hard one** (full re-skin vs v3's phase-B/paid-media/auto-dispatch shell; ~576/446-line divergence)
- `src/components/research-v2/primitives/*` — 8 files (bar-breakdown, data-table, inline-stats, milestone-timeline, narrative-block, positioning-axis-stack, quote-callout, subsection-block)
- `src/components/research-v2/section-renderers/*` — 6 files (buyer-icp, competitor-landscape, demand-intent, market-category, offer-diagnostic, voice-of-customer)
- `src/components/research-v2/typed-artifact-renderer.tsx`

### The 3 catches the merge MUST handle
1. **Confidence scale.** Light shell uses inline `score.toFixed(1)` + its own 0–10 tone thresholds. v3 centralizes this in `src/lib/research-v2/confidence-display.ts` (`normalizeConfidenceToTen` handles the lab 0..1 contract). → The light shell must route ALL confidence display through `confidence-display.ts`. Drop the inline assumption or a 0..1 lab value renders as "0.7/10".
2. **The 7th section (paid-media).** Light shell loops only `POSITIONING_SECTION_IDS` (6) and hardcodes "X of 6"; it has no paid-media. v3 renders the paid-media terminal (the `paidMediaPlanArtifact`, 12 sub-sections, unlock-after-6, auto-dispatch to `POST /api/research-v2/orchestrate`) in `src/components/research-v3/battleship-shell.tsx` (`PaidMediaPlanTerminalPanel`, ~L271–318; auto-dispatch ~L104–121). → Port that into the light shell as a 7th rail item + terminal panel.
3. **Shell topology.** `/research-v3/page.tsx` (~L547) currently mounts `BattleshipShell` (tab paradigm). The locked design is **rail + single reading column** — which is exactly the light `audit-reader-shell.tsx`. → Switch `/research-v3` to the light shell; fold BattleshipShell's paid-media/auto-dispatch logic into it; retire BattleshipShell.

Minor: `executionMode` gains `'lab'` on v3 (light shell knows only `'draft'|'deep'`) — add a fallback. Re-apply any v3 data-handling deltas in the 6 renderers (e.g. the s16 confidence centralization in buyer-icp) ON TOP of the re-skin.

---

## Branch mechanics (important)

**Do NOT `git merge codex/claude-managed-agents-work`** — it would drag the old May-20 base + managed-agents-default backend onto v3. Instead **cherry-pick the single UI commit**:

```
git switch feat/v2-lab-section-wire
git cherry-pick f9abec6f        # expect conflicts across the 16 files
```

Resolve each conflict by the rule: **keep f9abec6f's light styling/layout; keep v3's data-handling and features.** Use `git show f9abec6f -- <file>` as the reference for "what the approved light version looks like."

---

## Spec — phased

### Phase U1 — re-skin the leaf render layer (14 files)
```
GOAL: the 8 primitives + 6 section-renderers + typed-artifact-renderer carry the light styling,
      still bound to v3's PositioningTypedArtifact.
NON-GOALS: no shell work yet; no data-contract changes.
STEPS:
  1. Cherry-pick f9abec6f (or apply per-file). For these 14 files, take the LIGHT version.
  2. Diff each against lab-wire pre-merge; RE-APPLY any v3 data-handling deltas the re-skin would
     clobber (notably confidence routing via confidence-display.ts in renderers that show scores).
  3. Confirm every renderer still imports its @/lib/managed-agents/schemas/* type unchanged.
VERIFY: npx tsc --noEmit = 0; targeted renderer tests green; no renderer reads confidence inline.
```

### Phase U2 — the light shell + graft v3 features
```
GOAL: audit-reader-shell.tsx = light layout (top bar + reading column + w-[320px] rail) WITH v3's
      data + features intact.
FILES: src/components/research-v2/audit-reader-shell.tsx (resolve the big conflict here)
STEPS:
  1. Keep f9abec6f's light layout + sub-components (ConfidenceBadge, VerdictCard, SourcesList,
     LiveActivity, SectionStatusIcon, rail).
  2. Route confidence through confidence-display.ts (normalizeConfidenceToTen / formatConfidenceToTen /
     getConfidenceToneClass) — replace the inline 0–10 logic.
  3. Add the paid-media 7th: extend the section list to include the paid-media terminal, port
     unlock-after-6 + auto-dispatch (POST orchestrate) + the PaidMediaPlanTerminalPanel render from
     battleship-shell.tsx; render paidMediaPlanArtifact (12 sub-sections) via TypedArtifactRenderer.
  4. Handle executionMode 'lab' (fallback phase label).
VERIFY: tsc 0; shell renders 6 positioning + paid-media; a 0..1 lab confidence shows correct 0–10.
```

### Phase U3 — wire /research-v3, retire BattleshipShell
```
GOAL: /research-v3 'sections' state renders the light audit-reader-shell.
FILES: src/app/research-v3/page.tsx (~L547), src/components/research-v3/battleship-shell.tsx
STEPS:
  1. Mount <AuditReaderShell runId=...> where BattleshipShell was.
  2. Remove battleship-shell.tsx. Keep section-card.tsx ONLY if the light shell reuses it; else remove.
     Sweep orphan tests for both (tsc/vitest will catch dangling imports — see learned-patterns).
VERIFY: tsc 0; /research-v3 renders the light shell; no dead imports.
```

### Phase U4 — full verify + live proof
```
GATES: npx tsc --noEmit 0 · npm run test:run (≥1086 pass/1 skip) · npm run build exit 0 ·
       npm run lint 0 errors/known warnings · cd research-worker && npm run build = baseline.
LIVE PROOF (authenticated /research-v3, fresh URL):
  - light reader renders all 6 positioning sections + the paid-media terminal (12 sub-sections)
  - confidence displays correct 0–10 (not 0.x); rail navigation + keyboard arrows work
  - no error boundary; the Phase-S runId rehydrate still works on a hard refresh (don't regress it)
```

---

## Decisions to confirm (within execution)
- **Light shell replaces BattleshipShell** as the `/research-v3` reader — recommended (it IS the locked design). Confirm before U3 deletes BattleshipShell.
- **BattleshipShell + section-card retirement** — remove now in U3, or defer the deletes into the Phase F teardown. Default: remove what's unused in U3, since tsc/tests gate it.

## Interaction with the other handoffs
- Re-sequences the soak: **this integration lands before** `docs/2026-05-26-v3-soak-teardown-promotion-handoff.md`'s soak. Soak the integrated app.
- Teardown keep-list already preserves the managed-agents **schema mirrors** this UI depends on — no conflict.

## Codex contract
- `-c model_reasoning_effort=xhigh`; atomic commit per phase (U1→U4); worker-build "green" = the 6-error baseline (no 7th); capture it before touching the worker (the worker shouldn't be touched here — this is frontend-only).
