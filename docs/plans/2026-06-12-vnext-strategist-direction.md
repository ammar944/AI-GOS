# vNext Strategist Direction — chat control plane + strategy artifact chain

- **Status:** ACTIVE — direction approved by Ammar 2026-06-12 (evening session). Slice 1 NOT yet implemented. This is a plan, not shipped behavior.
- **Grounding:** 12-agent research workflow over `tmp/team-claude-workflow-corpus/` (DialHawk transcript + 13 Cowork sessions), current app/engine, `~/Dev-Projects/ai-sdk-v5-crash-course`, `~/.claude/skills/{ai-sdk,ai-elements,chat-sdk}`, real SaaSLaunch client deliverables (`~/Downloads/SaaSLaunch_Paid_Media_Plan_TEMPLATE.pdf`, bluops Growth Playbook), and market patterns (Manus/ChatGPT/Devin/Canvas). Full findings archived at `tmp/team-claude-workflow-corpus/vnext-grounding-2026-06-12/`.

## Decision record (Ammar, 2026-06-12)

1. **Direction:** A (Strategist Control Plane — chat drives the existing Audit Reader + lab engine) **with the onboarding intake retained**: keep the WelcomeForm file uploads and the paste-more-context step. Chat becomes the control plane, but structured intake (URL + docs/audio + pasted context + GTM brief review) stays a first-class step, not replaced by pure conversational Q&A.
2. **Artifact chain:** **Offer & Angle Brief → Media Plan**, with the six-section report **demoted to commissioned evidence**. The strategy brief becomes the source-of-truth artifact; the media plan is conformance-checked against it; sections are evidence the agent commissions and cites — no longer the thing the run exists to produce.
3. **Numbers policy:** **Hybrid** — agent proposes from a small codified playbook/benchmark layer where confident, asks the buyer where not; every number carries provenance (`user-supplied` | `source-reported` | `model-estimated`) either way. Mechanism refined after the 2026-06-12 skills-ecosystem research (see "Skills & evidence sourcing" below): (a) budget totals derived arithmetically from client unit economics (auditable math, Haines budget-planning Method 2: `[(New ARR / (ARPC×12)) × CAC] / retention + 10-20% buffer`); (b) channel splits + structure stated as priors-with-provenance (e.g. Brand 10-15% / high-intent 50-60% / retargeting 15-20%; learning-phase conversion minimums dictating minimum viable daily budget per channel) under a NEW provenance class (`benchmark-prior`) so the evidence-support verifier neither strikes them nor lets them masquerade as researched facts — extends the WP7 plan-own-numbers carve-out; (c) CPM/CPC/CPL point estimates fetched at runtime via existing Perplexity/web_search tools (numbers arrive with retrievable citations) and sanity-checked against an in-house authored benchmarks reference file (Haines `benchmarks.md` table format: metric × average/good/excellent × named source × date, every row carrying a sourceUrl).
4. **v1 user:** answered "see the direction" — read as: keep the current URL-first + uploads intake (serves both audiences); working assumption is **internal SaaSLaunch team dogfoods first** on real engagements (the retained paste-context step is their workflow), external users later. Correct here if wrong.

## What AI-GOS becomes

A per-client strategist session where chat is the control plane over the existing Audit Reader: the agent narrates and steers research, then drafts and maintains an evolving, versioned **Offer & Angle Brief** (positioning + mechanism, ranked angle objects, approved/banned lexicon, funnel stance), from which the **Media Plan** derives and against which it is conformance-checked. Research sections become commissioned evidence with citations. Every revision ships with a changelog; feedback becomes scoped patches or refinement-carrying scoped reruns — never cancel-and-restart.

Why (one line each — full evidence in the archived grounding):
- Owner specified this three times (EGOS V2 PRD "Manus, but for media buying"; "work like Claude Code"; accepted "one-shot pipeline pretending to be an agent" audit).
- The six sections were designed (April 2026 rebuild session) as the facts-only half of facts → playbook → synthesis → deliverable; the top half was never built.
- The real client deliverable (bluops Growth Playbook) shipped with its "Strategic Research Blueprint" tab EMPTY while every strategy-derived tab was dense — research is working memory, not the product.
- DialHawk golden transcript: strategist value = conflict detection, judgment-with-tradeoffs, cross-artifact coherence, changelogs, surgical edits. Zero web searches.
- Mr Dre (arXiv 2601.13217): regenerate-on-feedback corrupts 16–27% of untouched content — revision needs versioned artifacts + scoped patches + separate evidence store (we already have the evidence pool + claims ledger).

## Architecture: keep / change / defer

**Keep (verified reusable as-is):**
- Lab engine: `SECTION_REGISTRY`, `runSection`, all 12 `TOOL_CATALOG` tools (already AI SDK v6 `tool()` objects with ToolGap protocol + budgets), verification/provenance stack, wave6 evidence pool, schemas.
- UI: `AuditReaderShell` editorial column, `TypedArtifactRenderer` + `GenericTypedArtifactRenderer` (renders any artifact carrying the 5 meta fields with zero new code), primitives kit, ActivityRail, tier-honesty chrome, share/profiles.
- Intake: WelcomeForm (URL + uploads + mic), corpus step, OnboardingWizard GTM Brief Review (per decision #1).
- Chat skeleton (currently orphaned, zero frontend callers): `/api/research-v2/chat/route.ts` (713 lines), `positioningOrchestratorAgent`, `audit_chat_messages`, `commitChatPatchAuto` CAS patches, dispatch `chatRefinement → "USER REFINEMENT block"` passthrough.
- Worker: `runDeepResearchProgram`, `resolveIdentity`, `extractMeetingTranscript`.

**Change:**
- Mount chat (useChat + DefaultChatTransport + ai-elements) beside the reader; lift the "post-research editing only" quarantine (CLAUDE.md product decision, reversed here).
- Delete `lab_refinement_not_supported` rejection (`src/app/api/research-v2/rerun-section/route.ts:138-143`) so `rerunSection({zone, refinement})` flows into the existing refinement path.
- New artifact type: Offer & Angle Brief (`strategyBrief`) committed as a `research_artifact_sections` row with the 5 meta fields + Zod body; versioned via existing CAS revisions; changelog per revision.
- Retarget chat edit tools at typed body paths (today they dead-end on `kf-<n>` titles and the unrendered `artifact.markdown`); implement `explainSource` against the claims ledger.
- Reposition verification as the agent's self-test narration ("3 of 14 numbers unsupported — re-source?") instead of end-of-run badges only.
- Later slices: `READER_SECTION_IDS` goes dynamic (roster read from committed rows); executive brief becomes continuous conformance view; media-plan gate captures buyer numbers.

**Defer (explicitly out of scope for slices 1–3):**
- Durable long-lived agent runtime (sections stay 285s batch lambdas; conversation happens between jobs; no mid-section interruption).
- Playbook tabs beyond brief→plan (ad scripts, sequences, pricing strategy, sales scripts).
- .docx/.pptx client-styled export (open question on timing).
- Slack/bot delivery (chat-sdk layer), AI Gateway adoption, scheduled refresh runs.

## Slice 1 — "Strategy Brief over a completed run"

On any completed run, mount the chat column and give `positioningOrchestratorAgent` four tools:
1. `draftStrategyBrief` — composes the versioned Offer & Angle Brief from committed section bodies + evidence pool + onboarding; commits as a `research_artifact_sections` row; passes existing verification gates before display; renders via `GenericTypedArtifactRenderer` day one.
2. `reviseStrategyBrief(patch, rationale)` — CAS-versioned scoped patch via `commitChatPatchAuto` + appended changelog entry.
3. `rerunSection({zone, refinement})` — rejection lifted; solo production-path rerun (~2–3 min, proven on run 8081e646).
4. `web_search` + `perplexity_research` mounted from `TOOL_CATALOG`; results accrue to the evidence pool.

**Acceptance test (mirrors DialHawk):** open a finished run, say "this is a cold-call agent, not a receptionist — reframe the brief around that, and ban 'operations hub' everywhere" → v2 strategy brief with changelog + enforced lexicon + scoped VoC re-pull, without restarting the run or touching other sections.

**Built-in probe:** before/after diff of a refinement-carrying rerun on a real run to measure untouched-content regression (Mr Dre risk). Outcome decides whether feedback stays rerun-with-refinement or must become anchor-scoped patches sooner.

**Slice 2:** Media-Plan Gate — intercept paid-media dispatch at 6/6; agent presents findings digest + asks parameterizing questions (budget/platform split, CPL floors, channel constraints, primary KPI, "what is the client already running?"); answers bind via ResearchInput's user-supplied economics-provenance fields; rendered plan lines carry "from you" BasisChips. Hybrid numbers: agent proposes from the codified playbook where confident.
**Slice 3:** run initiation into chat (corpus tool + brief confirm card + needsApproval fan-out), with intake step retained per decision #1.

## Skills & evidence sourcing (researched 2026-06-12)

Three-agent web research over MCP Market, the skills ecosystem, and the Apify marketplace. Full findings: `tmp/team-claude-workflow-corpus/vnext-grounding-2026-06-12/` (skills research output) and the workflow archives.

**Knowledge/skills layer — adopt/adapt verdicts:**
- The MCP Market `voice-of-customer-analysis` listing resolves to `gtmagents/gtm-agents`: 31-line generic process checklist, shallower than our existing skills. SKIP. MCP Market overall = 146k-item low-curation aggregator — use as a discovery index only; always trace to and vendor from the GitHub source.
- **`coreyhaines31/marketingskills` (MIT, 33k stars, active, per-skill evals) is the category anchor — the one repo worth adopting from.** Adapt: `customer-research` (JTBD triad, High/Med/Low confidence criteria, sample-bias corrections, min-5-data-points floors, money-quote synthesis) → VoC + BuyerICP skills; `competitor-profiling` (comparable template, inference labeling, staleness flags) → CompetitorLandscape; `ads` (70/30 proven/testing split, 20-30% scaling increments with 3-5-day learning waits, retargeting windows, optimization decision trees) → PaidMediaPlan; `marketing-plan/references/budget-planning.md` (two auditable budget-derivation methods + forecast-honesty doctrine) → budget math; `cold-email/references/benchmarks.md` → the FORMAT template for our own authored media-benchmarks file.
- **`thatrebeccarae/claude-marketing`** — the only public skill pack embedding real platform-level media-buying numbers (Meta CPM $8-15 / CTR thresholds / LinkedIn CPL bands / learning-phase conversion minimums / waste-threshold formulas). Adapt as a tagged `benchmark-prior` table (uncited author-asserted priors — never as researched evidence). Its `competitor-ads-analyst` message-type/funnel-stage taxonomy is liftable to classify ads our live tools already fetch.
- Selective single-idea lifts (rewrite, never copy): Dunford 5+1 positioning + category-strategy triad and Hormozi value equation from `getagentseal/founder-playbook` (HIGHEST exemplar-leak risk — strip all anecdotes, register motifs); Schwartz awareness mapping + 6-angle taxonomy from `realkimbarrett/advertising-skills`; channel-selection / when-NOT-to-advertise guardrails from `kostja94/marketing-skills`; runtime-benchmark-fetch pattern + Google budget-split priors from majesticlabs' google-ads-strategy-builder (NOASSERTION license — pattern only); universal DR scaling heuristics (kill at >1x loss/3d & >2x/7d, 20% increments, test budget 1.5-2x target CPL) restated in our own words (source repo deleted/unlicensed).
- **No public English skill embeds industry×channel CPM/CPC/CVR matrices**, and the rumored "Anthropic Marketing Kit (32 agents / 68 skills)" does not exist as of 2026-06-12 — do not wait for it. Industry-segmented benchmarks live in vendor datasets (WordStream/LocaliQ, Databox, First Page Sage) → feed the runtime-fetch path.
- **Provenance hygiene law for any vendored skill:** one-time exemplar scrub (the Haines `ads` skill ALREADY contains a leaked Brazilian-client CFM block — live proof contributor client content accretes into public skills), motif registration in `verification/provenance-gate.ts` in the same change (existing learned rule), quarantine worked-exemplar files entirely (`example-quietude.md`, `iclaudioo` examples.md), re-scrub on every upstream sync. Strip interactive/install blocks; rewire `.agents/*.md` context-file conventions to ResearchInput; respect the wholesale-injection token budget.

**Ad/evidence APIs — keep the live wall, add two narrow tools:**
- KEEP SearchAPI ad-library engines (Meta/Google/LinkedIn) + Foreplay (`src/lib/foreplay/service.ts`) as the competitor ad wall. Apify is redundant on Meta (double coverage), negative-value on LinkedIn (actor category has rotted twice), marginal on Google (only targeting-category/surface-stat fields — optional later for "where competitor budget serves" evidence).
- Prior art: `research-worker/src/tools/apify-ads.ts` (typed actors + normalizers, built 2026-03) was removed for OPERATIONAL reasons ("account maxed, actors too slow for parallel pipeline" — free-tier ceiling + 75s actor waits vs the worker's 90s budget), not data quality. `apify-client@^2.22.2` still pinned in research-worker.
- ADD (1) `tiktok_ad_evidence` via lexis-solutions TikTok Ads Scraper ($30/mo rental; EU-DSA-only visibility must surface as a coverage-gap badge) — TikTok is entirely uncovered today; targeting demographics feed BuyerICP + plan audience evidence. ADD (2) `review_retrieval` via focused_vanguard multi-platform reviews scraper ($6.49/1k; G2/Capterra/Trustpilot/Gartner/Reddit by domain) — directly replaces the stale in-house parsers behind VoC 0-quote starvation; **ADOPT-AFTER-PROBE: one ~$1 run must confirm per-review permalinks** (the W5 VoC provenance gate hard-requires them for tier=verified). Cost floor ≈ $60/mo (Starter $29 + TikTok rental) before per-result fees; both tools ship with gap-honest fallbacks per the ToolGap protocol.

## Open questions

- v1 user confirmation (assumption: internal team first — see decision record #4).
- .docx/.pptx export timing (format craft was a large share of DialHawk session value).
- Runtime appetite: confirm deferral of durable runtime through slices 1–3.
- Apify review-scraper permalink probe result (gates the `review_retrieval` adoption).
- Whether TikTok ad evidence is in scope for current client verticals (gates the `tiktok_ad_evidence` adoption and its $30/mo rental).

## Verification gates

- Slice 1 ships only with: tsc 0 new errors, targeted tests for the new tools + patch path, and the acceptance test executed live on a real completed run with before/after artifacts archived under `docs/reports/`.
- Chat-authored artifacts pass the same committable/verification gates as section artifacts (strict-out preserved; V1's free-chat fabrication failure mode is the named risk being guarded).
