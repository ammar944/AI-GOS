# Handoff — v2 Lab-Engine Integration (the "wire" side)

**Date:** 2026-05-25 · **Branch:** `feat/v2-lab-section-wire` · **Status:** READY TO EXECUTE
**Companion doc:** `docs/specs/2026-05-25-v2-lab-section-wire.md` (the original WS1+WS2 spec — read it for the mapping tables and full rationale).

---

## ⚠️ RUN FROM THE RIGHT DIRECTORY

The single most important instruction. WS1 was executed with the terminal sitting in the **lab repo**, so the engine port landed in the wrong repo. Before running anything:

```bash
cd /Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire
pwd   # MUST print /Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire
```

All work happens in this AI-GOS worktree (branch `feat/v2-lab-section-wire`). Deps are already installed. Do NOT run from `/Users/ammar/Dev-Projects/ai-gos-ai-sdk-lab` (that's the lab) or any `.claude/worktrees/*`.

---

## WHERE THINGS STAND

| Piece | Status | Location |
| --- | --- | --- |
| WS1 §1.1 engine port (`lab-engine/` — agents, ai, artifacts, sections, 6 skills; 29 files; Anthropic wired via `createAnthropic({apiKey: process.env.ANTHROPIC_API_KEY})`) | ✅ done, typecheck-green **in the lab repo**, self-contained | `…/ai-gos-ai-sdk-lab/src/lib/lab-engine/` (uncommitted, WRONG repo) |
| WS1 §1.2 corpus→ResearchInput mapper + vitest | ✅ done, test passes | `…/ai-gos-ai-sdk-lab/src/lib/research-v2/corpus-to-research-input.ts` (+ `__tests__/`) |
| WS2 battleship shell (`/research-v3` + 5 components, 3 copied cards) | ✅ done, typecheck+lint clean | worktree `feat/v2-shell` → `…/AI-GOS-worktrees/v2-shell/src/{app/research-v3,components/research-v3}` |
| §1.3 SupabaseRunStore | ⬜ TODO (this handoff) | — |
| §1.4 corpus-only / tools-off | ⬜ TODO | — |
| §1.5 orchestrate `'lab'` branch | ⬜ TODO | — |
| Merge WS2 + smoke + deploy | ⬜ TODO | — |

GOAL: a deployed Vercel **preview URL** where: paste URL → corpus (existing) → 6 sections run through the **lab engine, corpus-only** → artifacts land in Supabase → render live in the **v2 battleship shell**.

NON-GOALS (v1): per-token streaming, live tools (web_search/firecrawl/spyfu off), the 7th media-plan section, DeepSeek, touching `main`/Railway/Managed-Agents/prod.

---

## STEP 0 — Relocate WS1 into AI-GOS + verify portability

```bash
LAB=/Users/ammar/Dev-Projects/ai-gos-ai-sdk-lab
WT=/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire
mkdir -p "$WT/src/lib/research-v2"
cp -R "$LAB/src/lib/lab-engine" "$WT/src/lib/lab-engine"
cp "$LAB/src/lib/research-v2/corpus-to-research-input.ts" "$WT/src/lib/research-v2/"
cp -R "$LAB/src/lib/research-v2/__tests__" "$WT/src/lib/research-v2/" 2>/dev/null || true
```
Then **verify it typechecks IN AI-GOS** (it passed in the lab, where lab-only paths resolve — confirm none leaked):
```bash
cd "$WT" && npm run typecheck
npm run test -- src/lib/research-v2/__tests__/corpus-to-research-input.test.ts   # scope narrowly to avoid lab-worktree test pollution
```
Fix any unresolved imports (the port should be self-contained under `@/lib/lab-engine/*`; the mapper imports the lab `researchInputSchema` from `@/lib/lab-engine/artifacts/...`). Locate exact symbols:
```bash
grep -rn "interface RunStore\|interface RunRecord\|ActivityEvent\|researchInputSchema\|export async function runSection\|interface RunSectionDeps\|interface ArtifactEnvelope" src/lib/lab-engine | grep -v __tests__
```
(After this, the lab repo's uncommitted `src/lib/lab-engine` + `src/lib/research-v2` can be discarded with `git -C $LAB checkout . && git -C $LAB clean -fd src/lib/lab-engine src/lib/research-v2` — optional cleanup, the user's call.)

---

## STEP 1 — §1.3 `src/lib/research-v2/supabase-run-store.ts`

Implement the lab engine's `RunStore` interface (6 methods), Supabase-backed. The engine calls `store.readRun` to get its input and `store.saveArtifact`/`appendEvent`/`markSection*` to report progress. Reuse the existing Next-app Supabase plumbing — do NOT hand-write RPC calls.

**RunStore interface to satisfy** (from ported `lab-engine/.../run-store.ts` — confirm exact `RunRecord`/`ActivityEvent` types there):
```ts
interface RunStore {
  createRun: (input: ResearchInput) => Promise<RunRecord>;
  readRun: (runId: string) => Promise<RunRecord>;
  appendEvent: (runId: string, event: ActivityEvent) => Promise<RunRecord>;
  saveArtifact: (runId: string, artifact: ArtifactEnvelope) => Promise<RunRecord>;
  markSectionRunning: (runId: string, sectionId: SectionId) => Promise<RunRecord>;
  markSectionFailed: (runId: string, sectionId: SectionId, error: string) => Promise<RunRecord>;
}
```

**Design:** an in-memory `RunRecord` is the source of truth for `readRun` (the engine reads `record.input` back); every method also write-throughs to Supabase for UI visibility. Construct it per orchestration with the context the engine can't supply:
```ts
createSupabaseRunStore({
  supabase,                       // createAdminClient() from @/lib/supabase/server
  parentAuditRunId: string,       // = seedOrchestration().parent_audit_run_id (== research_artifacts.id == artifactId)
  sectionRunIdByZone: Record<PositioningSectionId, string>,  // from seedOrchestration().section_run_ids
  researchInput: ResearchInput,   // the mapped input (so readRun returns a RunRecord seeded with it)
}): RunStore
```

- `createRun(input)` / `readRun(runId)` → return the in-memory `RunRecord` (seeded with `researchInput` + per-section status). The engine only needs `record.input` + section state.
- `saveArtifact(runId, artifact)` → reuse `createSupabaseWebhookAdapter(supabase).commitArtifactSection({ artifactId: parentAuditRunId, zone: artifact.sectionId, sectionRunId: sectionRunIdByZone[zone], expectedRevision, patch })` where:
  ```ts
  patch = {
    status: 'complete',
    title: artifact.sectionTitle,
    markdown: `${artifact.verdict}\n\n${artifact.statusSummary}`,   // renderers use `data`, not markdown — keep minimal
    data: artifact,            // FULL envelope (root sectionTitle/verdict/statusSummary/confidence/sources + nested body) — pickPositioningTypedArtifact() validates root fields
    sources: artifact.sources,
    claims: [],                // lab bodies have no keyFindings/claims; empty is fine
  }
  ```
  Get `expectedRevision` from `createSupabaseWebhookAdapter(...).loadSectionRunContext(sectionRunId)` (returns `{artifactId, sectionType, expectedRevision}`), or 0 on first write (seed sets revision 0).
- `appendEvent(runId, event)` → `supabase.rpc('append_section_event', { p_section_run_id: sectionRunIdByZone[zone], p_event_type: event.type ?? 'progress', p_message: event.message ?? null, p_payload: event })`. (Map the lab `ActivityEvent` shape → these params; this is what lights up the v2 activity feed.)
- `markSectionRunning(runId, sectionId)` → `supabase.from('research_section_runs').update({ status: 'running', started_at: now }).eq('id', sectionRunIdByZone[sectionId])`.
- `markSectionFailed(runId, sectionId, error)` → reuse `createSupabaseWebhookAdapter(...).markSectionError({ sectionRunId, error })`.

Every method returns the (updated) in-memory `RunRecord`.

---

## STEP 2 — §1.4 corpus-only synthesis (tools OFF)

v1 sections synthesize purely from the injected corpus — no live tools. Mechanism (no engine rewrite): when invoking the engine, force the section's tool set empty. Inspect the ported `lab-engine/agents/run-section.ts` + `lab-engine/agents/tool-registry.ts` for the exact knob:
- Preferred: pass `allowedTools: []` (or an `externalTools: {}` override) into the section run so `buildToolMap` returns `{}`.
- If the engine reads `allowedTools` only from the registry, add a small option to `runSection`/its deps to override to `[]`, gated by `const LIVE_TOOLS = process.env.LAB_ENGINE_LIVE_TOOLS === 'true'` (default false).
- Escape hatch: if a section fails `validateMinimums` from corpus alone (see Step 5), set `LAB_ENGINE_LIVE_TOOLS=true` to re-enable light `web_search` for that run.

The corpus reaches the model because `corpus-to-research-input.ts` fills `ResearchInput.corpus.excerpts`, and `build-prompts.ts` serializes the whole `ResearchInput` into the system prompt.

---

## STEP 3 — §1.5 orchestrate `'lab'` branch — `src/app/api/research-v2/orchestrate/route.ts`

1. Add `'lab'` to the enum (currently line ~35): `executionMode: z.enum(['draft', 'deep', 'managed', 'lab']).optional()`.
2. After the existing `corpusReady(session)` 409 gate, add a branch when `effectiveExecutionMode === 'lab'` (note: keep the default selection logic; `'lab'` is only chosen via explicit `body.executionMode: 'lab'` for now):
```ts
// 1. seed rows (same as draft path)
const seeded = await seedOrchestration({ userId, runId: body.run_id, zones: POSITIONING_SECTION_IDS });
await freezeReviewedBriefSnapshot({ parentAuditRunId: seeded.parent_audit_run_id,
  gtmBriefSnapshot: session.onboarding_data ?? {}, gtmBriefReview: getOnboardingReviewMetadata(session.metadata) });

// 2. build ResearchInput from the corpus (Step 0 mapper)
const corpus = session.research_results?.['deepResearchProgram'];   // { status, data: { corpus, onboardingFields } }
const researchInput = corpusToResearchInput({ runId: body.run_id, corpus, onboarding: session.onboarding_data });

// 3. build the Supabase-backed store
const sectionRunIdByZone = Object.fromEntries(seeded.section_run_ids.map(r => [r.section_id, r.section_run_id]));
const store = createSupabaseRunStore({ supabase: createAdminClient(), parentAuditRunId: seeded.parent_audit_run_id, sectionRunIdByZone, researchInput });
await store.createRun(researchInput);

// 4. run the 6 sections via the lab engine, corpus-only, concurrency <= 3
//    runSection({ runId, sectionId }, { store, loadSkill, ...corpus-only deps }) for each POSITIONING_SECTION_IDS
//    loadSkill reads lab-engine/skills/<slug>/SKILL.md. Each saveArtifact commits to Supabase.

// 5. return the seeded shape (same as draft) so the client polls audit-state as usual
return NextResponse.json(seeded, { status: 200 });
```
**Runtime placement:** run inline in the route (corpus-only is fast). If Vercel `maxDuration` is a worry, kick a fire-and-forget internal route `src/app/api/research-v2/run-lab-section/route.ts` per section instead. Wrap each section so one failure → `markSectionFailed`, not a whole-run 500.

Map `runSection` deps: `store` (Step 1), `loadSkill: (slug) => read lab-engine/skills/<slug>/SKILL.md`, plus whatever `runAnswerTool`/model deps the ported engine expects (it wires Anthropic itself via `lab-engine/ai/models.ts`).

---

## STEP 4 — Merge WS2 shell into this branch

WS2 lives on `feat/v2-shell` (disjoint files — `src/app/research-v3/**`, `src/components/research-v3/**`). Merge:
```bash
cd /Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire
git add -A && git commit -m "feat(v2): lab-engine wire (steps 0-3)"   # commit the wire first
git merge --no-ff feat/v2-shell -m "merge: v2 battleship shell"        # disjoint → clean
npm run typecheck
```
The shell reads the existing `useAuditState(runId)` → `sectionsByZone[zone].data` (the artifact) + `eventsByZone` (the activity feed) + `workerStates`. Since §1.3 writes the full envelope to `data` and emits `append_section_event`, the shell renders with no further wiring. Verify `pickPositioningTypedArtifact(sectionsByZone[zone], zone)` returns non-null for a committed section.

WS2 follow-ups noted by its builder: confirm `eventsByZone` typing matches `audit-state` route; the right-panel `Sources` currently shows `latestSource` only (artifact sources render in the card); copied cards rely on global CSS vars (`--accent-*`, `--bg-*`) — already defined app-wide.

---

## STEP 5 — Corpus-only validation (the key risk)

Before deploy, confirm corpus-only sections are conformant:
- Unit/offline: run one section through the engine with a corpus fixture + tools off; assert the output passes that section's `sectionOutputSchema` + `validateMinimums`.
- If any section fails minimums from corpus alone → set `LAB_ENGINE_LIVE_TOOLS=true` (light web_search) and re-check, OR enrich the corpus mapper. Document which sections need tools.

---

## STEP 6 — End-to-end smoke (local, real corpus)

```bash
cd /Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire
cp /Users/ammar/Dev-Projects/AI-GOS/.env.local .   # creds (gitignored; not in fresh worktrees)
npm run dev
```
Then, with a `run_id` whose `deepResearchProgram` corpus is `complete` (ask the user for one, or create one via the onboarding flow):
- `POST /api/research-v2/orchestrate` with `{ run_id, executionMode: 'lab' }`.
- Open `/research-v3?runId=<run_id>` → watch the 6 cards build up + the activity feed.
- Confirm 6 rows land in `research_artifact_sections` with `status='complete'` and renderable `data`.

---

## STEP 7 — Deploy preview

```bash
git push -u origin feat/v2-lab-section-wire        # creates a Vercel PREVIEW deployment (does NOT touch prod/main)
```
Share the preview URL. Promote to production only after the user reviews. (Prod env vars already set in Vercel; the lab-engine path is Next-API + Anthropic only — bypasses Railway + Managed Agents.)

---

## CONTRACTS APPENDIX (so this is executable standalone)

**`ArtifactEnvelope`** (lab, per section): `{ id, runId, sectionId, sectionTitle, verdict, statusSummary, confidence:0..1, sources: SourceRef[], body: Record<string,unknown>, createdAt }`. `sectionId` === AI-GOS `zone` (identical strings).

**`commitArtifactSection`** (`@/lib/managed-agents/supabase-adapter` → `createSupabaseWebhookAdapter(supabase)`): `({artifactId, zone, sectionRunId, expectedRevision, patch}) → {ok, conflict, revision, error?}`. RPC `commit_artifact_section(p_artifact_id, p_zone, p_section_run_id, p_expected_revision, p_patch)`.

**`ArtifactSectionPatch`**: `{ status:'idle'|'running'|'complete'|'partial'|'error', title?, markdown?, data?, claims?, sources?, error? }`.

**`seedOrchestration`** (`@/lib/research-v2/orchestrate-db`): `({userId, runId, zones}) → { parent_audit_run_id, section_run_ids: [{section_id, section_run_id, ordinal, reused}] }`. `parent_audit_run_id === research_artifacts.id === artifactId`.

**`append_section_event`** RPC: `(p_section_run_id, p_event_type, p_message, p_payload)`.

**Corpus shape** `journey_sessions.research_results['deepResearchProgram'].data`:
`{ corpus: {company, category, researchSummary, sources:[{title,url,whyItMatters}], evidence:[{claim,source,url,quote,confidence}]}, onboardingFields: { <field>: {value, confidence, sourceUrl, reasoning}, ... } }` (fields: companyName, industryVertical, productDescription, primaryIcpDescription, coreDeliverables, valueProp, topCompetitors, uniqueEdge, situationBeforeBuying, desiredTransformation, commonObjections, brandPositioning, …).

**`ResearchInput`** (lab, strict): `{ runId, fixtureId, company:{id,name,websiteUrl,category,description,stage,targetCustomer}, onboarding:{primaryGoal,targetSegments[],keyOffers[],distributionChannels[],constraints[],notes}, corpus:{excerpts:[{id,sourceUrl,title,text(min80),observedAt,sourceId}](min3)}, sources:[{id,title,url,observedAt}](min1), competitorAds:[…](min3,max5) }`. Mapper (`corpus-to-research-input.ts`) already handles: `company.stage='growth'`, excerpt supplementation to ≥3/≥80, synthetic competitorAds.

**`POSITIONING_SECTION_IDS`** (`@/lib/ai/prompts/positioning-skills`): `positioningMarketCategory, positioningBuyerICP, positioningCompetitorLandscape, positioningVoiceOfCustomer, positioningDemandIntent, positioningOfferDiagnostic`.

**Render contract** (shell): `useAuditState(runId)` polls `/api/research-v2/audit-state` (2500ms) → `sectionsByZone[zone]: {markdown?,title?,data?}` + `eventsByZone[zone]: SectionEvent[]` + `workerStates[]`. `pickPositioningTypedArtifact(data, zone)` + `TypedArtifactRenderer` render `data`. Lab body schemas are byte-for-byte identical to AI-GOS renderer schemas → no transform needed.

## RISKS
1. **Lab body vs renderer schema drift** — verified identical for market-category; spot-check the other 5 after smoke (a misrender = empty card, not a crash).
2. **Corpus-only minimums** — Step 5 gate; `LAB_ENGINE_LIVE_TOOLS` is the escape hatch.
3. **`competitorAds` are synthetic stubs** — Competitor Landscape quality is degraded in v1; flag it; fix when tools re-enable.
4. **Vercel maxDuration** — corpus-only is fast, but if 6 inline sections exceed the function limit, split into per-section internal routes.
5. **`expectedRevision` CAS** — `commit_artifact_section` is compare-and-swap on revision; read current via `loadSectionRunContext` before each commit.
