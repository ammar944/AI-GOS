# Codex Hand-off — LIVE validation run (ramp.com) via the Codex browser

> Authored by Claude (HQ) on 2026-06-01 after independently verifying the Phase-1
> commit stack (gates green, dedup behavior-preserving, corpus docs accurate).
> This is the **next action** in the research-quality Pass-2 plan. Drive it with
> the **Codex browser**; do not ask the user to click through manually unless
> Clerk auth blocks you (the one human step — see §4).

---

## GOAL (one sentence)
Drive **one** authenticated GTM audit run for **ramp.com** through the already-running
dev app using the Codex browser, wait for it to commit, then read the committed
section artifacts and produce a written **PASS/FAIL verdict** on the five Phase-1
fixes. The verdict IS the deliverable — not code.

## NON-GOALS (do not do these)
- **No code changes.** This is a validation run, not a feature. If you find a bug, write it up in the verdict; do not fix it in this pass.
- **No push, no deploy.** Push/deploy stays user-gated. Work stays local on the worktree branch.
- **Do not start Phase 2.** The live run *calibrates* Phase 2 (P2.1-JUDGE threshold, ad-probe behavior). Phase 2 begins only after the user reads this verdict.
- **Do not touch `.env.local`** — reading/grepping any `.env*` is denied by hook + security rule. Use the running server's env as-is.
- **No paid-API loops.** One run. Two runs maximum (only if the first errors out mid-fan-out). ~$2/run; the user has already authorized GO for ramp.com.

## Where to work
- **Worktree (v3 system of record):** `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire`, branch `feat/v2-lab-section-wire`, HEAD `c89d46fc`.
- The main checkout `/Users/ammar/Dev-Projects/AI-GOS` is on an unrelated branch (`codex/claude-managed-agents-work`) — **do not work there.**

---

## 1. Current state (why this run matters)
Phase 0 (5 P0 correctness fixes) + Phase 1 (P1.1–P1.4 + G6 goal recitation) + the
interstitial cleanup (boilerplate→builder dedup `a43db2e4`, corpus refresh `c89d46fc`)
are **all committed and gates-green** (build 0 / tsc 0 / lint 0 errors / 1208 tests pass).

But every Phase-1 fix is so far only proven by **unit tests and code review**. None has
been seen working on a **real company in production data**. This run is the behavioral
proof. It is also the calibration input for Phase 2 (verifier-judge threshold, ad-probe
end-to-end, CompetitorLandscape latency).

## 2. Preconditions (verify before you start)
- **Dev server is already up** on `http://localhost:3000`, PID **10486**, cwd =
  this worktree (verified 2026-06-01). Turbopack hot-reloaded the Phase-1 commits.
  **Use it; do not kill or restart it.** If the port is dead when you start, run
  `npm run dev` from the worktree and wait for "Ready", then proceed.
  - Confirm: `lsof -nP -iTCP:3000 -sTCP:LISTEN` shows PID 10486 (or a fresh node), and
    `lsof -a -p <pid> -d cwd` points at `.../AI-GOS-worktrees/v2-lab-section-wire`.
- **SpyFu is FUNDED** — `SPYFU_API_KEY` is present in the running server's env (probe
  proved real data: `crm software` vol≈33,200 / cpc≈$28.45). Treat any "SpyFu dead key"
  language in older audit docs as stale. `keyword_volume` is the funded path.
- **The lab engine runs IN-PROCESS on Vercel/Next**, not in the Railway worker, so the
  run executes inside this dev server. There is **no headless dispatch script** (the only
  scripts are dead managed-agents canaries) — the run must go through the app UI.

## 3. The run procedure (Codex browser)
1. **Open the Codex browser** to `http://localhost:3000/research-v2`.
   *(`/research-v3` also exists as the flipped front door — if `/research-v2` doesn't
   show the URL-entry form, try `/research-v3`. Either lands the same flow; the API
   namespace is `/api/research-v2/*` regardless.)*
2. **Handle Clerk auth (§4)** if you hit the sign-in wall.
3. **Enter `ramp.com`** in the company-URL field and start. The form-driven flow is:
   `URL → auto deepResearchProgram corpus → GTM Brief Review form opens → confirm/edit
   the auto-prefilled fields → submit → POST /api/research-v2/orchestrate fans out the
   six positioning sections (+ Synthesis + PaidMediaPlan).`
   - Accept the auto-prefilled brief as-is unless a field is obviously empty/wrong;
     this is a quality probe of the *engine*, not of brief-editing.
4. **Capture the `run_id`** as soon as the fan-out starts — read it from the page URL
   and/or the network tab (the `orchestrate` / `audit-state` requests carry it). Write it
   down; every read below is keyed on it.
5. **Wait for completion (~13 min).** Sections commit in two waves of three
   (`ORCHESTRATOR_CONCURRENCY=3`). Poll `audit-state` (§5) every ~30–60s — **do not
   busy-loop**. Done when `parent_status === "complete"` and `children_complete === 6`.
   - **`children_complete: 6/6` is correct even with Synthesis present.** Synthesis and
     PaidMediaPlan are additive capstones *outside* `POSITIONING_SECTION_IDS`, so they
     never count toward the parent's 6-section rollup. Look for them as separate section
     rows, not in the 6/6 count.
6. If the run **errors mid-fan-out** (a section stuck non-complete after ~20 min, or a
   parent error), capture the failing section + reason, then you may retry **once** (run #2).
   After two failures, stop and report — do not keep spending.

## 4. Clerk auth — the one human-in-the-loop step
`/research-v2`, `/research-v3`, and `/api/research-v2/*` are Clerk-gated
(`src/middleware.ts`; `audit-state` calls `await auth()`). **You cannot self-serve the
login** — do not attempt to type credentials or automate the Clerk flow.
- **Best case:** the Codex browser inherits the user's existing localhost Clerk session
  (cookies) and `/research-v2` loads straight into the form. Proceed.
- **If you hit the sign-in wall:** pause and ask the user to complete the Clerk login
  once in the Codex browser session (or import their localhost session cookies), then
  continue. This is expected and is the only manual step.

## 5. Reading the artifacts (authenticated)
Two read paths — prefer the endpoint, fall back to Supabase:

- **A) audit-state endpoint (in the authenticated browser):**
  `GET http://localhost:3000/api/research-v2/audit-state?run_id=<RUN_ID>`
  Returns `parent_status`, `children_complete`/`children_total`, and **`sectionsByZone`**
  — the projected per-section artifact body. This is the primary read; the section
  bodies you need for the verdict are in here.
- **B) Supabase fallback (if a body looks truncated/projected):** the raw committed
  artifacts live in the AIGOS Supabase. Resolve `run_id → parent artifact_id` via
  `research_artifacts` (`.eq('run_id', RUN_ID)`), then read child rows from
  `research_artifact_sections` (`.eq('artifact_id', parentId)`) — the `data` column holds
  the full committed artifact JSON per `zone`/`section_run_id`. Use the `supabase` MCP if
  it's connected in your session; otherwise ask the user to run the query.
- The verdict fields below live inside each section's committed artifact under `body.*`.
  If you see one extra wrapper level (`data.body.*` vs `data.*`), locate by the field
  name — the leaf paths are stable.

## 6. THE VERDICT — checks (this is the deliverable)
For each, state **PASS / FAIL / INCONCLUSIVE** with the concrete evidence (the actual
values you saw). Map each to the run's `run_id`.

| # | Fix | Section | Exact path | PASS criteria |
|---|-----|---------|-----------|---------------|
| **P1.4** | VoC self-source ban (the ONE confirmed prior loss) | `positioningVoiceOfCustomer` | `body.painLanguage.quotes[].sourceUrl` | **Zero** pain quotes whose registrable domain == `ramp.com` (no self-sourcing of "pain"). Also: `quotes.length >= 10`, `>= 3` distinct sources, no single source supplying a majority. List any quote that violates this. |
| **P1.3** | Real SpyFu keyword signal | `positioningDemandIntent` | `body.keywordDemand.keywords[].monthlyVolume` | **Every** `monthlyVolume` is a real number (SpyFu-estimated; may be labeled "SpyFu-estimated"). **Zero** values matching `/not disclosed/i`. Also `keywords.length >= 10`. Quote 2–3 sample rows with their volume/CPC. |
| **P1.1** | Cross-section synthesis capstone | `positioningSynthesis` | `body.situationThesis.prose`, `body.positioningOptions.options[].angle`, `body.recommendedMove.optionAngle`, `body.messagingDirections.directions[]` | Synthesis committed; 2–3 positioning options; **`recommendedMove.optionAngle` equals one of the options' `angle`** (IRON LAW); sourced items carry `sourceSection` referencing the six sections; reads coherent (not generic boilerplate). |
| **G6** | Goal recitation / grounding | all 6 | (qualitative) | Output stays on-goal for ramp.com; claims are grounded in fetched evidence or ResearchInput; **no drift** of the homepage-as-pain class (a marketing claim presented as customer pain). Judge by reading, flag any drift. |
| **Latency** | CompetitorLandscape watch | `positioningCompetitorLandscape` | `research_section_runs.started_at` / `telemetry` | Note its wall-clock vs the other sections. Flag if it's a clear outlier (it carries the heaviest tool roster + reserved ad budget). Not pass/fail — a data point for Phase 2. |

**Also report (run health, not pass/fail):**
- Final `parent_status` and `children_complete` (expect `complete`, `6`).
- Whether Synthesis + PaidMediaPlan committed (separate rows, outside the 6).
- **Competitor ad evidence:** how many real creatives CompetitorLandscape surfaced
  (`body` ad-evidence groups). Prior runs got ~0 creatives — note the count so we know if
  the ad probe is producing anything live. (This validates P0.2 ad-probe behavior, which
  shipped "code-complete, behavior-pending.")

## 7. Deliverable format
Write the verdict to **`docs/2026-06-01-live-run-verdict-ramp.md`** in this worktree
(untracked is fine — do **not** commit it unless the user asks). Include:
- `run_id`, parent `artifact_id`, timestamp, target = ramp.com.
- The table above filled in with PASS/FAIL + the actual observed values/quotes.
- A one-paragraph **bottom line**: did Phase 1 hold up on real data, and the single
  biggest issue (if any) the user should know before Phase 2.
- Any errors/retries and their cause.

## 8. Gotchas (don't relearn the hard way)
- **`children_complete: 6/6` ≠ "synthesis missing."** The 6 are `POSITIONING_SECTION_IDS`;
  Synthesis/PaidMediaPlan are additive and never count toward the 6 (`index.ts:27-34` comment).
- **Auth on every read.** `audit-state` is `auth()`-gated — keep the browser session
  authenticated for the polling reads, not just the initial form submit.
- **Registrable domain, not hostname.** For the P1.4 self-source check, compare the
  *registrable* domain (`ramp.com`), so `www.ramp.com` / `blog.ramp.com` all count as
  self-source; a third-party review site quoting ramp does **not**.
- **`monthlyVolume` is a string** (`z.string().min(1)`) — a SpyFu number rendered as text
  (possibly with a "SpyFu-estimated" label) is a PASS; the literal `"not disclosed"` is the
  only hard FAIL the validator already rejects, so if you see it the run shouldn't even have
  committed — flag loudly.
- **Don't busy-poll** the paid run or the audit-state endpoint; ~30–60s cadence, ~13 min total.

---

### Quick reference
- Worktree: `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire` @ `feat/v2-lab-section-wire` (`c89d46fc`)
- Entry: `http://localhost:3000/research-v2` (or `/research-v3`)
- Status/bodies: `GET /api/research-v2/audit-state?run_id=<RUN_ID>` (authenticated)
- Supabase tables: `research_artifacts` (parent, by `run_id`) → `research_artifact_sections.data` (children, by `artifact_id`)
- Target: **ramp.com** · Budget: ~$2, 1 run (2 max) · No push, no deploy, no code changes.
