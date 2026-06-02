# Codex handoff — finish the Phase-0 live E2E audit (notion.so run)

> **For:** Codex CLI (xhigh reasoning), driving the gstack `browse` daemon + Supabase MCP/CLI + tmux logs.
> **Authored by:** Claude (HQ) on 2026-06-01 after verifying the mainstream-bottlenecks handoff against real code.
> **Worktree (system of record):** `/Users/ammar/Dev-Projects/AI-GOS-worktrees/v2-lab-section-wire` · branch `feat/v2-lab-section-wire`.
> **Your job:** manually fill the GTM Brief wizard (DO NOT use the flaky AI auto-fill), submit it, then capture the 6-section fan-out ground truth for B1 (visibility), B3 (ads), B4 (latency). Write a findings doc. **No source edits while the run is live** — hot-reload corrupts the run.

---

## 0. Why this run exists (read first)

We are fixing four bottlenecks in the research-v3 lab engine. Three findings need a **live run** to settle — they cannot be proven read-only:

1. **B3 (headline): do competitor ads actually come back?** Is `SEARCHAPI_KEY` live in this runtime, and do real brands (notion.so's competitors) return creatives, or 0? The lab ad engine is Google+Meta only (LinkedIn+Foreplay are orphaned in the worker).
2. **B4: CompetitorLandscape repair rate** — how many times does the repair loop re-run the full agent? This decides whether the latency fix targets the probe or the repair loop.
3. **B1 (behavioral confirmation):** does the per-section activity feed go silent mid-fan-out, mislabel running sections as "Queued", show the decorative skeleton "weird lines", and fail to follow the active section?
4. **(bonus) Does the DeepSeek/Sonnet provider emit `step.text` reasoning** during section generation (gates how rich the planned B2 streaming feed will be)?

**The deliverable is a findings doc that turns each of these into a resolved fact with evidence** (screenshots + DB rows + dev-log lines).

---

## 1. Current state (where you're picking up)

- **runId:** `a4671da7-6577-43fc-a3a2-d6e9e1a87bf2` (company: **notion.so**).
- **Corpus is DONE** (DB-confirmed). `journey_sessions.job_status` for this run = `runDeepResearchProgram status:complete`, model `claude-sonnet-4-6`, completed 2026-06-01T04:48:09Z. **Do not re-run the corpus.**
- **Brief wizard** is the current phase (`phase='setup'`, `onboarding_data` empty). It is an **8-step** wizard: Product → ICP → Offer → Pricing → Compete → Goals → Marketing → Media. On entry it had "**24 fields still need input**".
- **The gstack `browse` daemon was reset to `about:blank`** at the end of the prior session — you must re-establish the authenticated browser and re-navigate to the run URL.
- **Dev server** is up on `:3000` from this worktree (tmux session `aigos-dev-labwire`). The lab sections run **in-process in the Next dev server** (not the worker) — ad-probe and section logs appear in `aigos-dev-labwire`, NOT `aigos-worker`.

### Findings already captured (do NOT redo these)
- **Corpus took 3min40s, not the promised "30–90s".** Events streamed 04:44:29→04:44:55Z, then a **~3-minute silent gap** during the final synthesis LLM call (Sonnet, 138k tokens, $0.18) with zero progress events, finishing 04:48:09Z. UI was stuck on "Researching company… 30–90 seconds" with a frozen activity log the whole time. (B1-class illegibility at the corpus stage.)
- **The decorative skeleton pulse-bars render on the corpus "Activity log" panel too** (not just per-section LiveActivity).
- **The brief's "Auto-Fill with AI" / "Research & Auto-Fill" is broken/slow:** it runs a *second*, redundant research pass (`POST /api/onboarding/research`, scrapes 12 notion.so pages, ~77s), the UI stays stuck on "Scraping website…" long after the backend returns 200, and **fields never populate**. **THIS IS WHY YOU FILL MANUALLY.** Note it in the findings (onboarding double-research + stuck spinner), but onboarding UI is out of scope to fix — just get past it.

---

## 2. Tooling you'll use

```bash
B="$HOME/.claude/skills/gstack/browse/dist/browse"   # gstack browse CLI (persistent headless/headed Chromium daemon)
```

Key browse commands:
- `$B connect` — launch a **visible** (headed) Chromium so the user can complete login. `$B goto <url>`, `$B url`, `$B screenshot /tmp/x.png`, `$B text`, `$B snapshot -i` (interactive a11y tree with `@e` refs), `$B fill @e<n> "value"`, `$B click @e<n>`, `$B press Enter`, `$B attrs @e<n>`.
- **Refs (`@e1`, `@e2`…) are re-numbered on every navigation/major re-render. Re-run `$B snapshot -i` before each fill/click batch.**
- **Do NOT use `$B wait --networkidle`** — this app polls every ~660ms–2.5s, so networkidle never fires (it always times out). Use `sleep N` + `$B screenshot` + `$B text`.

Supabase (AIGOS project ref `sidrtuxpqftyzwdusdha`): use the Supabase MCP `execute_sql` (pass `project_id: "sidrtuxpqftyzwdusdha"`) or the CLI. Authoritative tables: `journey_sessions` (corpus/brief state, `job_status` jsonb), `research_section_runs` (the 6 sections: `id, artifact_id, zone, status, started_at, completed_at, error jsonb, telemetry jsonb`), `research_section_events`, `research_artifacts` / `research_artifact_sections` (committed cards incl. ad evidence).

Logs: `tmux capture-pane -t aigos-dev-labwire:0 -p -S -2000` (dev server / lab engine / ad probe). Grep, don't dump.

---

## 3. Step A — re-establish auth + resume the run

```bash
$B connect                                                   # visible browser
$B goto "http://localhost:3000/research-v3?runId=a4671da7-6577-43fc-a3a2-d6e9e1a87bf2"
$B url
```

If it redirects to `/sign-in` (session was lost on daemon restart), authenticate (Clerk dev, email-code):
1. `$B snapshot -i`, `$B fill @e<email> "ammarv67@gmail.com"`, focus the email field and `$B press Enter` (the form is email-first; pressing Enter advances to `/sign-in/factor-one`).
2. A 6-digit code is emailed to ammarv67@gmail.com. **Ask the user for the code**, then `$B fill @e<code> "<code>"` — Clerk auto-submits when the code is complete.
3. After login you land on `/research-v3`. **Re-goto the run URL** `…?runId=a4671da7-6577-43fc-a3a2-d6e9e1a87bf2` to resume the brief wizard at Step 1/8.

Confirm you see "Confirm every field" + "Step 1 of 8" + the Product step (Company Name = "Notion" already filled).

---

## 4. Step B — fill the 8-step brief MANUALLY (do not use AI auto-fill)

For **each step**: `$B snapshot -i` → fill the textboxes (`$B fill`) and select the radios (`$B click`) using the values below → click **Continue** (`$B click @e<continue>`) → screenshot. Values are grounded in the completed Notion corpus. Fill every **required** field (marked with `*`); reasonable concise prose is fine. If a step exposes "Go to next field" or shows "N fields still need input", keep filling until Continue is enabled.

**Step 1 — Product**
- Company Name: `Notion` (already filled)
- What does your product/SaaS do?: (already filled — leave it) AI-powered connected workspace (notes, wikis, databases, projects, calendar, mail, AI agents).
- Who is it built for?: `Knowledge workers and cross-functional teams (product, eng, ops, marketing) from individuals and small teams up to mid-market and enterprise — 50%+ of the Fortune 500 use Notion; ~80% of users are outside the US.`
- How do customers buy?: **Product-led (self-serve)**
- Pricing model: **Per seat**
- How do customers convert?: **Freemium**
- Average price / ACV: **<$1K**

**Step 2 — ICP + Pain**
- Target ICP: `Cross-functional teams drowning in tool sprawl — scattered docs, wikis, and point PM tools; want one connected workspace with AI.`
- Top pains: `Tool sprawl & context-switching; scattered knowledge; expensive single-purpose tools; manual workflows; wanting AI assistance grounded in their own data.`
- (Fill any other required ICP fields with concise variants of the above.)

**Step 3 — Offer & Product Experience**
- Core offer: `Single connected workspace: notes/docs, wikis, relational databases, project management, calendar (Notion Calendar), email (Notion Mail), and Notion AI / Agents.`
- Key differentiator: `All-in-one block-based workspace + AI agents that act across your connected data, replacing 4–5 point tools.`

**Step 4 — Pricing & Economics**
- Tiers: `Free $0 · Plus $10/user/mo (annual) · Business $20/user/mo (annual, includes AI) · Enterprise custom.` Per-seat, annual-discounted. AI bundled into Business+ since May 2025.

**Step 5 — Competition & Positioning  ← MOST IMPORTANT for B3**
- Competitors (enter as many as the field allows; these drive the ad probe): `Confluence (Atlassian), Coda, ClickUp, Microsoft Loop, Airtable, Asana, Monday.com`
- Positioning: `The all-in-one connected workspace vs. fragmented point tools; AI-native.`
- **If the competitor field is a single textbox, enter the full comma-separated list. If it's an add-chip input, add at least: Airtable, ClickUp, Coda, Asana, Monday.com, Confluence** (well-known advertisers — gives the ad probe real targets).

**Step 6 — Goals & Strategy**
- Goal: `Expand upmarket (enterprise) and grow AI monetization; sustain ~50% YoY ARR growth toward IPO readiness.`

**Step 7 — Current Marketing & Performance**
- Current motion: `PLG + content/SEO + templates/community; brand-led; light paid search/social.`

**Step 8 — Media Plan Setup**
- Budget/channels: `Test paid search + paid social (Meta + LinkedIn), ~$25K/mo, targeting team admins and ops leaders.` (Fill required budget/channel fields with sane values.)

On the **final step**, the primary button submits the brief → **`POST /api/research-v2/orchestrate`** → the 6-section fan-out begins. **Record the submit timestamp.** From this moment, **do not edit any source file.**

---

## 5. Step C — capture the fan-out ground truth (the actual point of this run)

After submit, the Audit Reader renders. Drive a tight observe-loop for ~5–8 min (sections run as 6 parallel serverless invocations; CompetitorLandscape is the slow one). Every ~20–30s: `$B screenshot /tmp/aigos-fanout-NN.png`, `$B text | head -60`, and tail the dev log. Capture **specifically**:

### B1 — visibility (screenshot the offending states)
- [ ] Does the activity feed **go silent** on a section while others keep emitting? (Confirms the global-`LIMIT` starvation: `audit-state/route.ts:524-530` fetches one global `created_at DESC LIMIT 12*N` across all zones.) Screenshot a silent section next to an active one.
- [ ] Does any **running** section show the label **"Queued"** (with a spinner)? (Confirms `derive-section-phase.ts:40` returning `'Queued'` for running-no-events.) Screenshot it.
- [ ] Do the **decorative skeleton pulse-bars** ("weird lines") render alongside real activity rows? Screenshot.
- [ ] When the first section commits, does the view **stay pinned** to it while others are still running (you have to manually click another tab)? (Confirms the `autoActive` latch, `audit-reader-shell.tsx:1183-1193`.)

### B3 — ads (THE headline; settle it definitively)
- [ ] Open the **Competition & Positioning** card when it commits. **Does it show real ad creatives, or a gap/empty state?** Screenshot the ads sub-section.
- [ ] Authoritative DB check — find the artifact + section, then inspect the committed card and events:
  ```sql
  -- recent section runs for this fan-out (note artifact_id, zones, status, timing)
  select id, artifact_id, zone, status, started_at, completed_at,
         left(coalesce(error::text,''),200) err
  from research_section_runs
  where started_at > now() - interval '15 minutes'
  order by started_at desc;
  -- competitor section's ad evidence (look for ads[] vs dataGaps/sourceErrors/credentialGap)
  select zone, left(message,300) message, meta->>'eventType' et, created_at
  from research_section_events
  where zone = 'positioningCompetitorLandscape'
    and created_at > now() - interval '15 minutes'
  order by created_at;
  ```
- [ ] Dev-log check — distinguish the cause of any 0:
  ```bash
  tmux capture-pane -t aigos-dev-labwire:0 -p -S -3000 | grep -iE 'searchapi|credentialgap|credential|advertiser|ad probe|adlibrary|creatives|NoMatchedAdvertiser|google_ads|meta_ad' | tail -40
  ```
  **Interpretation:** creatives rendered → `SEARCHAPI_KEY` is live and the engine works (the bug is only the missing LinkedIn+Foreplay channels). `credentialGap("SEARCHAPI_KEY")` → key missing from the runtime env (Step-Zero infra fix). Candidates found but `ads:[]` → true-empty / advertiser-match miss. **State which one it is, with the log line.**

### B4 — CompetitorLandscape latency
- [ ] Record per-section wall-clock: `completed_at - started_at` from `research_section_runs` for all zones. Confirm CompetitorLandscape is the outlier.
- [ ] **Repair rate (the key unknown):** grep the dev log for repair attempts:
  ```bash
  tmux capture-pane -t aigos-dev-labwire:0 -p -S -4000 | grep -iE 'repair|evidenceSupportShortfall|validation|attempt|rescue' | tail -40
  ```
  Report how many repair re-runs CompetitorLandscape actually triggered (0, 1, or 2) and roughly what fraction of its wall-clock was probe vs base-gen vs repair. This decides whether we attack the probe (move off critical path) or the repair loop.

### Bonus — provider reasoning
- [ ] Grep the dev log / section_events for any `reasoning` / `step.text` / `thinking` content during section generation, and note which model the sections use (`grep -iE 'deepseek|sonnet|model'`). Tells us if B2's reasoning feed will have content.

---

## 6. Output

Write `docs/2026-06-01-phase0-live-audit-findings.md` with, per bottleneck: the **verdict** (confirmed/refuted/measured), the **evidence** (screenshot path + DB row + dev-log line), and a one-line **so-what** for the fix. Lead with the **B3 answer** (ads: yes/no + which cause) and the **B4 repair count** — those two unblock the most work. Drop the screenshots in `/tmp/aigos-*.png` and reference them.

## 7. Guardrails
- **No source edits while the run is live** (hot-reload restarts Next and corrupts the in-flight run). Observe only; edits come after.
- **Paid APIs:** this run costs ~$2 and hits SearchAPI/Anthropic. Don't loop or re-trigger research. One fan-out is enough.
- If Codex stalls or the browser desyncs: re-`$B connect`, re-`goto` the run URL, re-`snapshot`. Don't drop scope — the findings doc is the definition of done.
- If you must escalate (auth code needed, run errored): tell the user exactly what you need.
