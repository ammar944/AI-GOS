# E2E Gaps → 8/10: Root Causes, Code Fixes, Quality Levers (2026-06-17)

Companion to `docs/reports/2026-06-17-e2e-3subject-findings-gaps.md`. Every root cause below is
**verified against the actual code + the on-disk Ramp artifact** (run `d2abf018`, `tmp/grill/ramp-fresh/`),
not inferred from the symptom. Where this doc contradicts the findings report, the findings report's
*mechanism* was wrong (its *symptoms* were all correct).

---

## 0. The correction that reframes everything

The findings report's leading P0 hypothesis — *"the post-commit agentic review rewrites the body and
drops the additive fields"* — is **refuted in code**. The commit→detached-review→persist path is a clean
passthrough:

- `attachAgenticReview` (`supabase-run-store.ts:610`) does `artifactEnvelopeSchema.parse({ ...input.artifact, review })` — it spreads the committed body untouched and only **adds** a `review` object.
- `buildCommitPatch` (`commit-patch.ts:146`) persists `data: sanitizeArtifactForClientSurface(artifact)` — the whole structured body — and **explicitly bars** `review.upgradedMarkdown` from replacing it.
- The envelope `body` is `z.record(z.string(), z.unknown())` (`artifact-envelope.ts`), so parse strips nothing; `sanitizeNode` drops only `DROP_KEYS={internalDetail}`.
- Ground truth: the post-review Ramp paid-media body still carries 4 intact non-gap rows + `review.tier=needs_review`, yet `evidencePack` count = 0. That is the **never-attached** signature, not attached-then-dropped.

So the two missing fields are **three distinct NEVER-ATTACHED defects** with different fixes. Patching the
review/persist path (the report's fix option a/b) is a **no-op trap** — it already preserves anything attached.

**The 6→8 gap is ~55% mechanical (fields never reach prod) + ~45% research depth.** The three code fixes
get to ~7 and flip `noFabrication:false → true`. Depth earns the 8.

---

## 1. Gap chain — root cause → fix → proof

### P0a — PaidMedia `evidencePack`: wrong code path (NEVER-ATTACHED)
**Root cause (verified):** `withPaidMediaEvidencePack` is called from exactly one place — `run-section.ts:3576`,
inside `saveCompletedArtifact`. But `positioningPaidMediaPlan` is **not** in `answerToolSectionIds`
(`run-section.ts:4551-4558` = the six positioning sections only). `runSection` routes paid-media to the
**inline capstone path**, which commits at `deps.store.saveArtifact(...)` (`run-section.ts:12424`,
`artifact = verifierGate.artifact`) and calls `saveCompletedArtifact` **zero times** (grep-confirmed over
11862-12459). The enrichment helper is **structurally unreachable** for the one section it exists for.

**Fix (one line, surgical):** after `artifact = verifierGate.artifact;` (`~12418`) and before the
`saveArtifact` at `12424`, insert:
```ts
artifact = withPaidMediaEvidencePack({
  artifact,
  committedArtifacts: researchInput.committedPositioningArtifacts,
});
```
`researchInput` is in scope, the helper is already imported (`:182`), `evidencePack` is schema-optional per
row, and the helper no-ops for non-paid-media. **Do NOT** adopt the "stale `.next` compile" theory — the path,
not the build, is wrong; a recompile re-run would burn the sweep and still read `evidencePack=0`.

**Proof (real path, not mocks):** router-level test that drives `runSection` for
`sectionId=positioningPaidMediaPlan`, spies `deps.store.saveArtifact`, asserts persisted
`body.audienceTypes[].evidencePack` present → RED on HEAD → green after. Plus a live re-dump where the grep
flips `0 → >0` on non-gap rows.

### P0b — BuyerICP `acquisitionLedger`: gated out, no schema home (NEVER-ATTACHED) — coupled to P2
**Root cause (verified):** Ramp's BuyerICP took the **blockGap exit, not a success** (on-disk: no
`evidenceGapReport`, `evidenceGap:null`, `personaReality.personas:[]`, `blockGap.foundCount:0`).
`withBuyerICPAcquisitionLedger` runs (BuyerICP *is* answer-tool routed) but no-ops at
`buyer-icp-acquisition-ledger.ts:185-189` — it requires `body.evidenceGapReport` to **already** be an object,
a container only the persona-hard-fail path (`injectPersonaGap`, <3 grounded personas) writes. And the ledger's
**only** schema home is *nested inside* `evidenceGapReportSchema` (`buyer-icp.ts:319`); the top-level body is
`.strict()` with no `acquisitionLedger` slot. On this run the ledger has nowhere to live.

**Fix (schema-correct):** in `withBuyerICPAcquisitionLedger`, when `evidenceGapReport` is absent but
`lookups`/`candidates` exist, **synthesize a COMPLETE `evidenceGapReport`** — every `.strict()` required field:
`reason: z.literal(buyerICPEvidenceGapReason)`, `summary`, `foundNamedPersonaCount` (honest grounded count, 0
for Ramp), `requiredNamedPersonaCount`, `rejectedPersonaLabels:[]`, `sufficiency`, `sourcingPlan:[≥1]` — carrying
the ledger, and set `body.evidenceGap=true` for coherence with `validateBuyerICPMinimums` (`buyer-icp.ts:452-467`).
**REJECT the "default report to `{}` / make `reason` optional" approach** — `reason` is a `z.literal` on a
`.strict()` schema, so a partial report fails parse at `assertSectionArtifactPersistable` (runs at **both**
original save and review) → turns today's silent no-op into a **hard commit failure** that blocks the 6-section
rollup. Higher blast radius.

**Runtime caveat (live-only):** the synthesize branch fires only if `buyerPersonaLookups` is non-empty, which
needs the 70s persona prepass (`buyerPersonaPrepassDeadlineMs=70_000`) to not time out. **Green units do not
prove prod attaches it — gate P0b on a live BuyerICP rerun showing the ledger in the persisted body.**

### P2 — the product premise behind P0b (UNDECIDED — decide before spending the sweep)
Whether the acquisition ledger is *required* on **degraded** (non-persona-gap) runs to clear the 8/10 bar is an
unmade product call. **No** → document-only, zero code, schema-correct absence, P0b leaves the sweep (cheaper).
**Yes** → ship the P0b synthesis above. Do not silently resolve this by shipping code.

### P1 — VoC count padding: missing dedupe on the gap track (the lone fabrication)
**Root cause (verified):** `getAdmissibleVoiceOfCustomerCandidates` (`run-section.ts:8626-8640`) is a bare
`candidates.filter(isAdmissibleQuote)` with **no dedupe**. The four cross-pass merges push the same 2 g2 reviews
in 3× each → 6 rows → `painLanguage.quotes[6]`, `blockGap.foundCount:6`, `foundPainQuoteCount:6` over real
duplicates (on-disk: 6 quotes, **2 distinct URLs**, objections/success/decisionCriteria/switchingStories all
empty). The selection track already dedupes correctly on `sourceInstanceId ?? url`
(`voice-of-customer-candidates.ts:330`) — the gap track simply bypasses it.

**Fix (≤4 lines):** inline a first-seen `Set` dedupe on that **same** `sourceInstanceId ?? url` key at `8633`.
**No per-domain cap, no truncation** (those corrupt honest distinct counts). All three count fields derive from
this one array, so the count collapses to the truth (2) everywhere with zero edits to writers/schema. **Do NOT**
import `selectVoiceOfCustomerCandidates` (it applies `VOC_CANDIDATE_PER_DOMAIN_CAP` + truncation).

**Proof:** extend `run-section-voice-of-customer-candidates.test.ts` (drives real `runSection` w/ mocked tools)
so passes return the same 2 g2 URLs; assert committed `quotes.length===2`, `foundCount===2` → RED on HEAD
reproducing d2abf018 → green. Plus live re-dump: no repeated `sourceUrl`, `foundCount == distinct count`.

### P3 — evidence-pool read error masked as `[object Object]` (logging)
**Root cause (refined):** not `describeErrorForLog` as the findings report named. The live read adapter throws
`EvidencePoolStorageError` whose message is built via `getErrorMessage` (`evidence-pool.ts:199-205`) — the same
defective `error instanceof Error ? error.message : String(error)` shape that yields `[object Object]` for a
Supabase `{message,code,details,hint}` object. **Fix:** make `getErrorMessage` extract `.message`/`.code`/
`.details` from non-Error objects. Best-effort path, so low priority, but it's currently hiding the real failure.

### P4 — test architecture is the meta root cause
99/99 green while both fields are absent in prod = every test called the enrichment helpers **directly**,
bypassing `answerToolSectionIds` routing (P0a) and the prepass precondition (P0b). **Fix the test class:** every
enrichment assertion must drive the **router** (`runSection`/dispatch) and assert the **persisted** body; ≥1
live trace per lane backs the unit. CI tripwire: one end-to-end test pushing `withPaidMediaEvidencePack` output
through real `buildCommitPatch` + `sanitizeArtifactForClientSurface`, asserting `evidencePack` survives.

---

## 2. Quality levers to 8/10 (per section)

| Section | Now | Mechanical (fix the absent field) | Substantive (deepen the research) |
|---|---|---|---|
| **VoiceOfCustomer** | **3** | **Dedupe @8633 → foundCount 6→2, flips `noFabrication`→true (+2).** Highest-yield lever in the audit — the only fabrication, and a padded count poisons trust in the whole deliverable. | Acquire quotes from a 2nd/3rd domain (Capterra/TrustRadius/Reddit) to clear the 3-domain floor honestly + fill objections/success/decisionCriteria (all empty). **+2-3.** Where the real 8 is earned; dedupe only stops the lie. |
| **PaidMediaPlan** | **6** | **Wire `evidencePack` (P0a one-liner) → +1.5.** Content already clears the bar ($833/day↔$25K/mo, 5 grounded angles, falsifiable KPIs); only per-row traceability is missing. | Model the trial→paid bridge (conversion band + provenance) so `projectedResults` connect spend to paid customers. +0.5. |
| **BuyerICP** | **6** | Attach `acquisitionLedger` (P0b, if P2=yes) → +0.5. | **Recover named personas** — `personas:[]`, `foundCount:0` for a subject rich in public finance leaders (case-study bylines, G2 reviewers, webinar speakers). Empty persona layer caps the section ~7 even after the code fix. **+1.0** — the genuine depth gap. |
| **DemandIntent** | **6** | None. | Acquire **non-branded keyword volume** (4/5 evidence blocks empty; only branded `ramp`@27,200 carries a number) + questionMining (PAA/Reddit) + venueMap the orderedMoves already prescribe. **+1.7.** |
| **MarketCategory** | **7** | None. | Quantify the TAM/SAM band w/ explicit method+sources + sharpen `categoryPowerBet` to a non-obvious read. +1.0. |
| **CompetitorLandscape** | **7** | None. | Recover ad creatives for more named competitors (several honest-withheld) + cross-competitor whitespace synthesis. +1.0. **Do not touch the eyeball-verified Ramp ad evidence.** |
| **OfferDiagnostic** | **7** | None. | Expand red flags beyond 2 + source-quantify one core LTV/CAC claim currently operator-reported. +1.0. |

**The substantive levers don't exist in code yet** — commit `6b1bc3ed` shipped the *builders*, not the
*evidence* they consume. Even with perfect wiring, `acquisitionLedger`/`personaReality` render thin until
persona + VoC **acquisition** improves. Code fixes first (cheap, flip the gate), then acquisition (buys the 8).

---

## 3. Sequenced plan forward

All three code fixes are independent (P0a @ `12424`, P0b @ ledger gate, P1 @ `8633`) — no shared edit line.
Batch into **one commit + one sweep.**

1. **Land all three offline, RED-first units (zero API cost).** P0a router-level; P0b real-commit-path
   (synthetic blockGap body + non-empty lookups → assert persisted `evidenceGapReport.acquisitionLedger` +
   `safeParse` success); P1 VoC real-`runSection`. Each must be RED on HEAD then green. Gate: `tsc --noEmit` 0 +
   lab-engine agents/artifacts suites + the two VoC suites (their committed counts drop where dupes existed —
   expected).
2. **Offline schema-parse proof for P0b.** Push the synthesized ledger-only body through
   `assertSectionArtifactPersistable` (`bodySchema.safeParse` AND `validateBuyerICPMinimums`); assert no throw.
   Insurance against the hard-commit-failure regression (this gate runs at both save and review).
3. **RESOLVE P2 before spending the sweep.** Ship P0b synthesis, or document-only. If document-only, only
   P0a + P1 need the live trace (cheaper).
4. **ONE live E2E on confirmed-HEAD code (~$4/24min).** Fresh Ramp audit OR targeted reruns (paid-media +
   BuyerICP + VoC via `/api/research-v2/rerun-section`). Dump persisted bodies as `tmp/grill/ramp-fresh/` was
   produced. **Let the detached review complete before reading** — assert the field is present *after* review.
5. **Single grep gate on the new dump:** (a) PaidMedia `audienceTypes[].evidencePack` present on non-gap rows
   (was 0); (b) if P0b shipped: BuyerICP `evidenceGapReport.acquisitionLedger` present (was absent); (c) VoC
   `painLanguage.quotes` no repeated `sourceUrl`, `foundCount===distinct` (was 6-over-2). Re-judge → expect
   `noFabrication:true`.
6. **3-subject confirm (Ramp/Fathom/Plain)** only after the single-subject gate is green — guards against a
   Ramp-specific fix regressing a quote-rich subject. Target: all three ≥8 with `noFabrication:true`.

**Do NOT touch (judge praised these — regressing them costs more than the gaps):** operator-vs-sourced number
labeling (ACV, $18K LTV, $4,200 CAC, SpyFu-estimated volume); the eyeball-verified competitor ad wall (real
creative + live ad-library permalinks); media-plan budget coherence ($833/day↔$25K/mo); the honest TAM gap in
MarketCategory (quantify it, don't fabricate). **Do not touch the review/persist path. Do not add a
`validateMinimums` hard-gate to the VoC gap builder. Do not add per-domain caps to the VoC admissibility track.**

---

## 4. Open risks / the one trap

- **P0b prepass precondition is live-only.** The synthesize branch fires only if `buyerPersonaLookups` is
  non-empty (70s prepass must not time out). A green unit does not prove prod attaches the ledger — gate on the
  live BuyerICP rerun. If the prepass times out, the ledger still no-ops — a separate, deeper cause.
- **P0b double gap-signal.** Setting `evidenceGap=true` on a body already carrying `personaReality.blockGap`
  advertises two gap signals for one shortfall. No validator error, but audit every reader of `body.evidenceGap`
  vs `personaReality.blockGap` (value-judge, review model, profile rollup) before shipping.
- **P0a sanitizer scrubs verbatim excerpts.** `sanitizeNode` runs `scrubClientSurfaceText` over all string
  leaves; `evidencePack[].excerpt` carries verbatim upstream quotes the coverage-eval anchor match depends on.
  If a deny-token substring (`web_search`, `corpus`) legitimately appears in an excerpt it gets mangled. Low
  probability — spot-check one live excerpt post-persist.
- **VoC over-dedupe edge.** `sourceInstanceId` is undefined on the g2 candidates so the key collapses to `url`;
  confirm no upstream pass assigns the same `sourceInstanceId` to genuinely-distinct quotes. Shared with the
  selection track, so accepted not new.
- **THE ONE TRAP:** declaring any lane "closed" on unit tests. 99/99 went green while both fields were absent in
  prod because the tests bypassed the router and the prepass. **Only a live re-dump of the persisted Supabase
  body — the same grep that returns 0/0 today flipping to non-zero — proves the prod path is closed.**
