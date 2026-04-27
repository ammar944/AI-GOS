# Codex Orchestrator — Jake Van Clief research × AIGOS v3 office-hours synthesis

You are the orchestrator. Your job: take the external research file `research/jake-van-clief-agent-architecture.md` and run a structured office-hours-style synthesis against the *current AIGOS v3 state*. Use subagent fan-out. Produce one decision doc, not a book report.

## The non-negotiable constraint

**Ignore Section 10 of the research file** ("Direct AI-GOS Relevance Map") and Section 5's mid-paragraph AIGOS opinions. The research author drafted those by guessing what AIGOS looks like. AIGOS today is not what they think.

**Extract Jake's PRINCIPLES only.** Then make our own relations against the actual repo state. The user said: "we already know what AIGOS is, we make our own relations." Honor that.

## Inputs (read in parallel via subagents)

### Subagent A — extract Jake's principles

Read `research/jake-van-clief-agent-architecture.md` sections 1-9, 11-12. Skip section 10. Extract a *flat list* of architectural principles, max 12 items, each:
- one sentence rule
- one quote (when applicable)
- one or two failure modes the rule prevents

Examples of principle distillation (do not copy these verbatim — extract from the file):
- "Folder = workspace = app. The folder structure IS the routing."
- "CLAUDE.md is layer 1: floor plan, always loaded."
- "Context files <100 lines each, loaded on demand. >100 → split."
- "Skills are processes packaged. Wire them into a routing system, do not load globally."

Output: a flat principles list, no commentary.

### Subagent B — snapshot AIGOS v3 state

Read these files directly. Do not interpret; produce a factual snapshot.

- `CLAUDE.md` (root) — the v3 skill-first preamble + behavioral contract
- `.claude/architecture/v3-skill-first.md` if it exists (design doc for the migration)
- `.claude/workspaces/v3-migration/tracker.md` — current state of the 13-skill migration
- `.claude/workspaces/v3-migration/SPEC_TEMPLATE.md` — the contract shape every skill follows
- For each Validated skill (research-icp, research-offer, research-market, research-cross, research-keywords, research-voc, synthesize-positioning, synthesize-media-plan, synthesize-scripts, plus reference research-competitor and ingest-identity), grep the SKILL.md frontmatter `name`/`description` only — do not read the bodies
- `research-worker/src/runners/` — list filenames only, identify which are still production path
- `.claude/rules/` — list filenames + first-line summary
- `skills/research-competitor/SKILL.md` first 30 lines (this is the canonical reference skill)

Output: a snapshot with sections:
- Architecture today (v3 skills + legacy runners side-by-side)
- Routing today (how a request gets to a skill)
- Skill catalog with status
- Rules in force
- Where the chat layer currently sits (`chat-refine` spec status, current chat sidebar in `src/`)

### Subagent C — synthesis (depends on A and B completing first)

Take the principles from A and the snapshot from B. Produce three lists. Be specific — name files, name skills, name decisions. No vague sentences.

1. **ALIGNED — already match Jake's principles, keep**: list each principle that AIGOS already implements, and cite the file/skill that proves it.
2. **MISALIGNED — concrete revision proposals**: for each principle AIGOS violates, propose one specific change. Format: `Principle: <X>. Where AIGOS violates it: <file:line or skill>. Proposal: <concrete edit/decision>. Effort: 10min / half-day / day / week.`
3. **REJECT — where Jake is wrong for AIGOS specifically**: at least 2 items. AIGOS is a productized GTM pipeline whose output goes to client-facing workspace cards, not a personal assistant. Some of Jake's "ignore frameworks, just use folders" advice doesn't apply when buyers like Mahdy review every claim. Name the principles where AIGOS legitimately needs structure Jake's pattern doesn't.

After producing the three lists, produce **5 forcing questions in YC office-hours style** about decisions the team must make this week. Format: question + the option set that would resolve it. Examples of forcing-question style (don't copy):
- "Is chat-refine a sidecar or a front-door? Pick one this week, because synthesize-positioning's input contract depends on knowing where positioning gets locked."
- "Do skill folders move to a separate repo (Jake-style portable) before or after Wave 4 lands?"

## Subagent dispatch pattern

Launch A and B in parallel. Wait for both. Then launch C. C's output depends on A's principles + B's snapshot.

## Office-hours format constraints (encode this directly — the gstack/office-hours skill is not loaded in your CLI session)

The office-hours pattern this user wants is design-thinking, not feature-listing. Honor:

- **Forcing questions, not summaries.** Every section should produce decisions or expose missing decisions, not paraphrase the inputs.
- **Specificity test.** Any sentence that could be true of any AI product → delete. Replace with one that names AIGOS files, skills, or behaviors.
- **Two-side test.** For every "we should do X" recommendation, name the cost. If you can't, the recommendation is not yet earned.
- **Time-bound it.** Every proposal carries an effort tag (10min / half-day / day / week+).

## Final output (you, the orchestrator)

Write **one** file:

`.claude/architecture/jake-synthesis-2026-04-27.md`

Structure:

```
# Jake Van Clief × AIGOS v3 — Office Hours Synthesis (2026-04-27)

## What we read
- (research source + sections used)
- (AIGOS state files surveyed)

## Jake's principles (extracted, our own framing)
1. ...
2. ...
(max 12)

## AIGOS v3 state — factual snapshot
(Subagent B's snapshot, condensed)

## ALIGNED — keep
- (item) → proven by (file/skill)
- ...

## MISALIGNED — revise
- Principle: ... | Violation at: ... | Proposal: ... | Effort: ...
- ...

## REJECT — where Jake is wrong for AIGOS
- ... (at least 2)

## Forcing questions for this week
1. ...
2. ...
3. ...
4. ...
5. ...

## Decisions earned by this synthesis
- (3-5 items, each: decision + the file/skill it changes + when)
```

Keep total under 500 lines. Quality > volume.

## What you must NOT do

- Do NOT copy Section 10 of the research file. Build your own relations.
- Do NOT recommend that AIGOS adopt Jake's pattern wholesale. AIGOS is a productized pipeline with client review; Jake's pattern is for personal workflows. The differences are real.
- Do NOT propose deleting research-worker/src/runners/ until the corresponding v3 skill is `Wired` — the migration tracker tracks this.
- Do NOT modify skill code in this pass. This is synthesis only. The output is a markdown decision doc.
- Do NOT touch any file outside `.claude/architecture/jake-synthesis-2026-04-27.md`.
- Do NOT commit. Do NOT push.

Begin by dispatching subagents A and B in parallel.
