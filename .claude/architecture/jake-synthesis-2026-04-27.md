# Jake Van Clief × AIGOS v3 — Office Hours Synthesis (2026-04-27)

## What we read

- Research source: `research/jake-van-clief-agent-architecture.md`, sections 1-9 and 11-12 only. Section 10 was intentionally ignored. Section 5's AIGOS-specific opinions were ignored.
- AIGOS state files surveyed: `CLAUDE.md`, `.claude/architecture/v3-skill-first.md`, `.claude/workspaces/v3-migration/tracker.md`, `.claude/workspaces/v3-migration/SPEC_TEMPLATE.md`, `skills/*/SKILL.md` frontmatter for validated/reference skills, `research-worker/src/runners/`, `.claude/rules/`, `skills/research-competitor/SKILL.md`, `skills/chat-refine/references/rules.md`, `.claude/workspaces/v3-migration/specs/chat-refine.md`, `src/app/journey/page.tsx`, `src/app/api/journey/stream/route.ts`, `src/lib/agents/agent-loop.ts`.
- Subagent pattern used: A extracted Jake principles; B snapshotted AIGOS state; C synthesized after A and B completed.

## Jake's principles (extracted, our own framing)

1. Treat the folder/workspace as the primary app surface, not the agent framework. Quote: "The folder becomes your app." Prevents context loss and overbuilt orchestration.
2. Use one capable agent routed by workspace context instead of many specialized agents. Quote: "Replace agents with folders." Prevents brittle handoffs and duplicated context.
3. Keep routing explicit in a top-level map that tells the agent what to read and when. Quote: "The floor plan on the wall." Prevents token waste and wrong-context guesses.
4. Split work into focused workspace context files rather than one giant instruction file. Quote: "The actual rooms in the building." Prevents context overload and uneditable AI understanding.
5. Load skills at the workspace or task layer, not globally. Quote: "Skills are processes that someone else figured out." Prevents irrelevant instructions and tool bloat.
6. Use naming conventions before databases or vector stores when file paths can encode intent. Quote: "It immediately knows where to look because it knows the naming convention." Prevents unnecessary infrastructure and retrieval ambiguity.
7. Define simple routing tables that bind task, files, and skills. Quote: "This table eliminates all of the problems." Prevents reading everything and guessing what matters.
8. Start by conceptualizing the workspace, not by listing tasks. Quote: "Don't start with tasks. Start by conceptualizing the working space." Prevents shallow automation and poorly scoped systems.
9. Feed real source material into the workspace instead of generic instructions. Quote: "The goal is for it to organize how you're already doing it and make it better." Prevents generic output and invented process.
10. Break large context files apart once they stop being focused. Quote: "Separation of concerns for your AI's brain." Prevents drift and compounding instruction errors.
11. Keep humans in the loop until the workflow has proven repeatability. Quote: "Do we really want to automate it?" Prevents premature automation and unchecked quality failures.
12. Build around durable questions and business deliverables because AI features commoditize quickly. Quote: "In a world full of answers, questions become valuable." Prevents selling obsolete prompts and competing with foundation-model vendors.

## AIGOS v3 state — factual snapshot

### Architecture today

- `CLAUDE.md:3-21` says AIGOS is pivoting to skill-first architecture: each pipeline stage becomes `skills/<name>/` with local `SKILL.md`, schemas, prompts, scripts, assets, and examples.
- `CLAUDE.md:12-17` locks skills as self-contained islands, peer-level, slash-command invoked, portable, and forbidden from importing outside their own folder.
- `CLAUDE.md:19-21` says `.claude/rules/` still applies, `src/lib/agents/agent-loop.ts` is where the dispatcher lives, and legacy `research-worker/src/runners/` remains production path until stub skills are implemented.
- `.claude/architecture/v3-skill-first.md:13-19` locks: worker fate deferred, `chat-refine` as one bundled skill, user-invoked skills only, no layer semantics, no shared libraries, separate `research-voc`, and publishable skill repo portability.
- `.claude/architecture/v3-skill-first.md:27-31` frames skill folders as the product IP; Next.js is the UI shell and Railway becomes a skill executor.
- `.claude/workspaces/v3-migration/SPEC_TEMPLATE.md:75-84` requires self-contained skills, sourced claims, loud API failure, no fabricated fields, and `SKILL.md` under 500 lines.
- `research-worker/src/runners/` still contains `base.ts`, `competitors.ts`, `icp.ts`, `index.ts`, `industry.ts`, `keywords.ts`, `media-plan.ts`, `meeting-extract.ts`, `offer.ts`, and `synthesize.ts`.
- `research-worker/src/runners/index.ts:1-9` still exports the legacy runner set plus identity resolution from `../identity/resolve-identity`.

### Routing today

- Claude Code routing exists through `.claude/commands/<skill>.md` plus `.claude/skills/<skill>/` bridges.
- `.claude/commands/chat-refine.md:21-33` instructs Claude to read `skills/chat-refine/SKILL.md`, read references, collect, run `cd skills/chat-refine && npm run orchestrate <run_id>`, and surface output. The same file says the skill is still a stub.
- `.claude/skills/chat-refine/SKILL.md:12-18` delegates from the bridge to the full skill folder and notes that scripts do not exist yet.
- Production routing is not wired to v3 skills yet. It still uses `/api/journey/dispatch`, `dispatchResearchForUser`, `RAILWAY_WORKER_URL/run`, and worker `TOOL_RUNNERS`.
- `src/lib/agents/agent-loop.ts:28-36` exists but currently calls `streamText` with `researchTools`; it does not load `skills/<name>/SKILL.md`.

### Skill catalog with status

- Validated in `.claude/workspaces/v3-migration/tracker.md:7-14`: `research-icp`, `research-offer`, `research-cross`, `research-keywords`, `research-voc`, `synthesize-media-plan`, `synthesize-positioning`, `synthesize-scripts`.
- Validated outside the main stub table in `.claude/workspaces/v3-migration/tracker.md:33-37`: `research-market`.
- Spec'd Wave 4 in `.claude/workspaces/v3-migration/tracker.md:15-19`: `chat-refine`, `ingest-docs`, `ingest-fathom`, `ingest-url`, `present-workspace`.
- Reference implementation: `skills/research-competitor/SKILL.md:1-30`. It defines sourced competitor research, omits unsourceable fields, uses sealed per-run context, and separates agent collection from TypeScript validation and HTML rendering.
- Outside the 13-skill tracker table: `ingest-identity`, whose skill file is present and describes identity resolution as schema-complete with sanity gates.
- Validated/reference skill frontmatter exists for: `research-icp`, `research-offer`, `research-market`, `research-cross`, `research-keywords`, `research-voc`, `synthesize-positioning`, `synthesize-media-plan`, `synthesize-scripts`, `research-competitor`, and `ingest-identity`.

### Rules in force

- `.claude/rules/ai-sdk-patterns.md` - AI SDK Patterns.
- `.claude/rules/beast-mode.md` - Beast Mode.
- `.claude/rules/bug-triage.md` - Bug Triage Step Zero.
- `.claude/rules/context-management.md` - Context Management Rules.
- `.claude/rules/exploration-budget.md` - Exploration Budget.
- `.claude/rules/hooks-and-automation.md` - Hooks & Automation Patterns.
- `.claude/rules/learned-patterns.md` - Learned Patterns.
- `.claude/rules/mcp-policy.md` - MCP Policy.
- `.claude/rules/model-selection.md` - Model Selection Strategy.
- `.claude/rules/security.md` - Security Rules.
- `.claude/rules/verification.md` - Verification Gate.

### Where the chat layer currently sits

- `.claude/workspaces/v3-migration/specs/chat-refine.md:7-18` defines `chat-refine` as sidebar edit proposals against existing workspace cards or brief fields, with no new research, no direct Supabase writes, no auto-apply, and no invented facts.
- `skills/chat-refine/references/rules.md:7-18` repeats the hard rule: chat is a refinement sidebar, not a research trigger; it must sanitize tool-call messages for AI SDK v6.
- `src/app/journey/page.tsx:29-34` says v3 onboarding is URL-form-driven and chat is a thin refinement sidebar.
- `src/app/api/journey/stream/route.ts:17-26` says the Journey stream prompt edits cards and fields only; research dispatch happens through workspace UI buttons.
- `src/app/journey/page.tsx:2358-2410` still renders the app shell, workspace page, artifact dock, and sidebar from `src/`.

## ALIGNED — keep

- Skill folders as self-contained islands already match "folder/workspace as app." Keep `skills/<name>/` as the unit of capability. Proven by `CLAUDE.md:3-17` and `.claude/architecture/v3-skill-first.md:13-19`.
- `research-competitor` is the right canonical reference because it packages a real process with source, validation, and render boundaries. Keep using it as the template. Proven by `CLAUDE.md:7-9` and `skills/research-competitor/SKILL.md:1-30`.
- `.claude/commands/<skill>.md` plus `.claude/skills/<skill>/` already gives Claude Code explicit task-to-skill routing. Keep that as the human-invoked control plane. Proven by `.claude/commands/chat-refine.md:21-33` and `.claude/skills/chat-refine/SKILL.md:12-18`.
- The migration tracker is acting as the current floor plan for skill state. Keep it as status source, but not as the full runtime routing map. Proven by `.claude/workspaces/v3-migration/tracker.md:7-19` and `.claude/workspaces/v3-migration/tracker.md:33-37`.
- Keeping `research-worker/src/runners/` production until v3 skills are wired matches Jake's "prove repeatability before automation" principle. Do not delete runners before the corresponding skill reaches `Wired`. Proven by `CLAUDE.md:21` and `research-worker/src/runners/index.ts:1-9`.
- `chat-refine` as post-research card editing, not research dispatch, matches the workspace-first product model. Keep the no-new-research boundary. Proven by `.claude/workspaces/v3-migration/specs/chat-refine.md:7-18`, `skills/chat-refine/references/rules.md:7-18`, and `src/app/api/journey/stream/route.ts:17-26`.
- The skill spec template already rejects generic promptware by requiring inputs, outputs, non-goals, verification, conformance tests, and sourced claims. Keep this as the skill contract. Proven by `.claude/workspaces/v3-migration/SPEC_TEMPLATE.md:19-84` and `.claude/workspaces/v3-migration/SPEC_TEMPLATE.md:127-136`.

## MISALIGNED — revise

- Principle: Keep routing explicit in a top-level map. | Violation at: `.claude/workspaces/v3-migration/tracker.md:7-19` only tracks status, not request routing. | Proposal: Add `.claude/workspaces/v3-migration/workspace-map.md` with columns `user task`, `files to read`, `command`, `skill`, `legacy production endpoint`, `status`, and `client card`. | Effort: half-day.
- Principle: Define simple routing tables that bind task, files, and skills. | Violation at: `src/app/api/journey/dispatch/route.ts` production routing is still separate from v3 skill routing. | Proposal: Extract the Journey section-to-runner map into a typed table that also names the future v3 skill for each section; keep dispatch behavior unchanged. | Effort: 10min.
- Principle: Folder/workspace should be the primary app surface. | Violation at: `src/lib/ai/tools/research/dispatch.ts` dispatch context is job/worker-shaped more than workspace-card-shaped. | Proposal: Add workspace/card identifiers to dispatch context before the first v3 production bridge so each run visibly targets a client-facing card. Cost: touches persistence/event payload assumptions. | Effort: half-day.
- Principle: Load skills at task layer, not globally. | Violation at: `src/lib/agents/agent-loop.ts:28-36` generic agent loop calls `streamText` with `researchTools` and does not load skill files. | Proposal: Mark it legacy or upgrade it to require a skill name and load that skill's `SKILL.md`; do not leave it as the implied v3 dispatcher. Cost: may force route and test updates where old imports remain. | Effort: half-day.
- Principle: Use one capable agent routed by context instead of multiplying agent semantics. | Violation at: `research-worker/src/runners/index.ts:1-9` still exposes capability-specific runner exports as the production boundary. | Proposal: During wiring, keep one production runner interface that routes through skill-folder contracts instead of adding more bespoke runner semantics. Cost: bridge code must preserve the current 202/write-back behavior. | Effort: day.
- Principle: Split focused context files instead of loading everything. | Violation at: `.claude/rules/` is listed globally from `CLAUDE.md:19` and `CLAUDE.md:61-64` without a rule-loading index. | Proposal: Add `.claude/rules/README.md` or `.claude/rules/routing.md` saying when to load `ai-sdk-patterns`, `verification`, `bug-triage`, `security`, and `context-management`. Cost: another doc to keep current. | Effort: half-day.
- Principle: Break large context files once they stop being focused. | Violation at: `CLAUDE.md:3-21` mixes v3 architecture, status, guardrails, dispatcher location, and deletion policy. | Proposal: Keep the root preamble under a short routing summary and move detail into `skills-map.md`, `production-legacy-map.md`, `workspace-card-contract.md`, and `migration-status.md`. Cost: more files to route correctly. | Effort: day.
- Principle: Keep humans in the loop until repeatability is proven. | Violation at: `skills/chat-refine/SKILL.md:8-18` is only scaffolded, while the product already has live `src/` chat surfaces. | Proposal: Keep `chat-refine` manual/user-invoked until its edit outputs validate against card schemas and pass UI review state; do not wire silent card updates. Cost: slower first integration. | Effort: day.
- Principle: Start by conceptualizing the workspace before tasks. | Violation at: `src/components/workspace/workspace-page.tsx` and `src/components/chat/unified-chat.tsx` own current chat/workspace behavior, while the v3 spec names operations before the canonical workspace object is fully promoted. | Proposal: Define the canonical workspace objects first: locked brief, card, sourced claim, edit proposal, approval state. Then bind `chat-refine` modes to those objects. Cost: may expose mismatches in existing UI props. | Effort: half-day.
- Principle: Build around durable questions and business deliverables. | Violation at: `.claude/workspaces/v3-migration/specs/chat-refine.md:7-18` defines the operation clearly but not the buyer question or client-facing card it resolves. | Proposal: Add to each v3 spec: `Buyer question answered` and `Workspace card updated`. Cost: small doc churn now; prevents vague skills later. | Effort: day.

## REJECT — where Jake is wrong for AIGOS

- Reject "replace agents with folders" as a wholesale production architecture. AIGOS is not a personal folder assistant; it is a productized GTM pipeline with client-facing workspace cards, async worker execution, typed schemas, source URLs, timestamps, and buyer review. Folders can organize context; they do not replace product contracts.
- Reject "naming conventions before databases/vector stores" as a rule for production data. File names can route skills, but AIGOS must persist brief fields, source-backed claims, edits, approvals, run IDs, and research results in durable product storage. A folder path cannot answer which client approved which card version.
- Reject "one capable agent" as the only runtime model. One user-facing chat surface is good, but competitor research, VoC, keyword intelligence, media planning, and script synthesis have different evidence contracts and validation gates. AIGOS needs bounded skills, not one untyped assistant doing everything.
- Reject permanent manual review as the end state. Mahdy reviewing every claim argues for stronger evidence trails and UI approval gates, not manual operation forever. Once a skill repeatedly passes schema, evidence, and card-update gates, it should become a reliable product workflow.

## Forcing questions for this week

1. Is the v3 routing source of truth a doc, code, or both? Options: A) add `.claude/workspaces/v3-migration/workspace-map.md`; B) promote `tracker.md` into the map; C) create a typed route table and generate docs from it.
2. Does `src/lib/agents/agent-loop.ts` survive the v3 pivot? Options: A) delete/retire it as misleading legacy; B) rename it to `legacy-agent-loop.ts`; C) upgrade it to load `skills/<name>/SKILL.md` and become the real dispatcher.
3. What is the first production skill bridge? Options: A) `research-competitor` because it is the reference implementation; B) `ingest-identity` because identity anchors the locked brief; C) `chat-refine` because it edits existing cards without new research.
4. Where does legacy-to-v3 mapping live while runners remain production? Options: A) only in `/api/journey/dispatch`; B) in a shared typed map imported by dispatch and cited by docs; C) only in `.claude/workspaces/v3-migration/tracker.md`.
5. What is the non-negotiable gate before a skill touches client cards? Options: A) Zod validation; B) Zod plus source URL/retrieved_at evidence; C) Zod, evidence gates, and UI review state before persistence.

## Decisions earned by this synthesis

- Decision: Keep skill folders as the capability boundary. Changes: preserve `skills/<name>/` self-contained contracts and continue using `skills/research-competitor/` as the reference. When: now.
- Decision: Do not delete `research-worker/src/runners/` until matching v3 skills are `Wired`. Changes: `research-worker/src/runners/*` stays production path; migration tracker remains authoritative for status. When: through Wave 4 wiring.
- Decision: Make routing explicit before more runtime wiring. Changes: add a v3 workspace map or typed route table that connects user task, command, skill, legacy endpoint, and client card. When: this week, before first production skill bridge.
- Decision: Treat `chat-refine` as a sidecar editing skill, not a research front door. Changes: preserve `skills/chat-refine/references/rules.md` and `.claude/workspaces/v3-migration/specs/chat-refine.md` no-dispatch constraint. When: through Wave 4.
- Decision: AIGOS adopts Jake's workspace discipline, not Jake's full folder-only architecture. Changes: keep schemas, Supabase/product records, async worker contracts, and UI approval gates as first-class product infrastructure. When: permanent architecture stance.
