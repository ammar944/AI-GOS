# Codex — chat-refine Wave 4 implementation (final v3 stub skill)

Implement the `chat-refine` skill — the last remaining `Spec'd` skill in the v3 migration. Single-skill dispatch, no subagent fan-out needed.

## Authoritative spec

`/Users/ammar/Dev-Projects/AI-GOS-main/.claude/workspaces/v3-migration/specs/chat-refine.md`

Read it fully. Treat it as the contract.

## Architectural decision (locked, do not revisit)

`chat-refine` is the **sidebar-refinement** variant: emits edit proposals against existing workspace cards or brief fields. It does NOT trigger research, NOT write Supabase, NOT apply edits without user approval. The Jake-AIGOS office-hours synthesis (`.claude/architecture/jake-synthesis-2026-04-27.md`) earned this as a decision: "Treat chat-refine as a sidecar editing skill, not a research front door." Honor it.

## Reference templates

Use as structural templates — do NOT import from any of them.

- `/Users/ammar/Dev-Projects/AI-GOS-main/skills/research-competitor/` — heavy reference (collector + scripts + schemas)
- `/Users/ammar/Dev-Projects/AI-GOS-main/skills/research-icp/` — Wave 1 normalized form
- `/Users/ammar/Dev-Projects/AI-GOS-main/skills/synthesize-positioning/` — closest neighbor: a synthesis-shaped skill that consumes prior outputs

## Existing stub state

`skills/chat-refine/` already has:
- `SKILL.md` (placeholder, REWRITE)
- `README.md` (rewrite if generic)
- `package.json`, `tsconfig.json` (keep, ensure parity)
- `references/rules.md` (real content — keep, refine if needed)
- `references/TODO.md`, `example/TODO.md`, `scripts/TODO.md`, `assets/TODO.md` — DELETE

## Standardized skill shape (matches Wave 1-4 normalized form)

- `package.json` scripts: `check`, `validate`, `sanity-check`, `test`. Use `node --import tsx/esm scripts/<file>.ts`. devDeps: `tsx ^4.19.4`, `typescript ^5.8.3`, `@types/node ^22.15.3`. deps: `zod ^3.24.3` only.
- `tsconfig.json` — copy verbatim from `skills/research-competitor/tsconfig.json`.
- `SKILL.md` — frontmatter + Trigger / What it does / Boundaries / Workflow / Tools / Hard constraints / Output. Under 500 lines.
- `schemas/input.ts`, `schemas/output.ts`.
- `scripts/validate.ts`, `scripts/sanity-check.ts`.
- `references/rules.md`, `references/collector.md`.
- `example/input.json`, `example/output.json`.

## Wave 1 schema lesson (you must honor)

When splitting required vs optional GtmBrief field shapes: do NOT use `.and()` to combine two `.strict()` objects. Use `.merge()` then chain `.strict()` on the merged result. (Found and fixed in `research-offer/schemas/input.ts` during Wave 1.)

## Spec-derived deliverables

Per the spec's FILES TO CREATE and CONFORMANCE TESTS sections:

1. `schemas/input.ts` — sealed input with `run_id`, `request` (the user's free-text edit ask), `section_cards[]` and/or `brief_fields`, plus optional `current_section`, `approved_sections`, `user_selection`, `prior_messages`. The schema should accept prior research/synthesis/ingest outputs as opaque opaque-bag fields; chat-refine reads them but does not validate their internals.
2. `schemas/output.ts` — emits `edit_proposals[]` (each: target ref, before snapshot, after snapshot, rationale citing the upstream sourced claim by source_url, status `pending_review`), plus `messages[]` (user-visible chat messages) and `no_research_triggered: z.literal(true)` as a hard runtime invariant.
3. `scripts/validate.ts` — Zod gate.
4. `scripts/sanity-check.ts` — implement these checks:
   - `no-outside-imports` scanner (skill folder only, skip node_modules)
   - `no-research-trigger` — output schema's `no_research_triggered: true` must hold; reject otherwise
   - `proposal-must-cite-source` — every `edit_proposals[].rationale` must reference at least one `source_url` from the upstream input bundle (or be marked as a user-stated correction with `evidence_origin: 'user'`)
   - `placeholder-rejection` — reject `unknown`/`TBD`/`n/a`/scaffold text in proposal bodies
   - `pending-review-only` — every proposal status must be `pending_review`; never `applied` or `accepted`
   - `ALLOW_SUSPECT=1` override
5. `references/rules.md` — keep the existing content (chat is a refinement sidebar, sanitize tool-call messages for AI SDK v6, no new research). Add the no-research/no-write/proof-of-source constraints.
6. `references/collector.md` — runtime prompt. The "collector" here is misnamed; this is the chat agent's prompt. Each section maps to one output key. Cover: parse the user's edit ask, find which card/field it targets, pull the relevant sourced claims from the input bundle, propose the edit with rationale that cites the source URL, mark `pending_review`.
7. `example/input.json` — realistic Linear/Notion fixture with: a user `request` ("change the positioning hero to lead with X"), one or two `section_cards[]` from prior research, and the relevant `prior_messages`.
8. `example/output.json` — fully populated with at least 2 `edit_proposals`, each citing a source_url from the input. `no_research_triggered: true` at top level.

DELETE all four `TODO.md` files.

## Hard constraints (also stated in spec NON-GOALS)

- Skill is self-contained. No imports from `src/`, `research-worker/`, root `lib/`, or another skill.
- Does NOT trigger research, web search, worker jobs, or provider calls for new facts.
- Does NOT write Supabase rows. `present-workspace` owns writes.
- Does NOT apply edits without explicit `user_approval` flag (which the schema does not provide — every output is `pending_review`).
- Does NOT invent new metrics, claims, quotes, prices, or competitor facts.
- Every edit proposal that introduces an external claim must cite a `source_url` from the upstream input bundle, OR be marked as a user-stated correction.
- AI SDK v6 patterns: if the example involves chat messages, sanitize incomplete tool parts before any conversion (rules.md mentions this).

## Verification

```bash
cd /Users/ammar/Dev-Projects/AI-GOS-main/skills/chat-refine
npm install
npm test
```

All four scripts (check, validate, sanity-check, test) must exit 0 with no `ALLOW_SUSPECT` bypass.

Conformance probes:

```bash
# 1. missing source citation in proposal rationale
node -e "const x=require('./example/output.json');delete x.edit_proposals[0].rationale_sources;require('fs').writeFileSync('/tmp/cr-bad.json',JSON.stringify(x))" && npm run sanity-check /tmp/cr-bad.json && echo FAIL || echo "ok: missing source caught"
# 2. no_research_triggered flipped to false
node -e "const x=require('./example/output.json');x.no_research_triggered=false;require('fs').writeFileSync('/tmp/cr-bad.json',JSON.stringify(x))" && npm run sanity-check /tmp/cr-bad.json && echo FAIL || echo "ok: research-trigger caught"
# 3. proposal status applied
node -e "const x=require('./example/output.json');x.edit_proposals[0].status='applied';require('fs').writeFileSync('/tmp/cr-bad.json',JSON.stringify(x))" && npm run sanity-check /tmp/cr-bad.json && echo FAIL || echo "ok: applied-status caught"
# 4. forbidden import
echo 'import x from "../../research-worker/foo";' > scripts/_probe.ts && npm run sanity-check example/output.json && echo FAIL || echo "ok: forbidden import caught"
rm scripts/_probe.ts
# Confirm clean
npm run sanity-check example/output.json
```

## Tracker update

After all checks pass, update `.claude/workspaces/v3-migration/tracker.md` row 15 (the `chat-refine` row): flip `Spec'd` → `Validated`, owner `Codex gpt-5.5 (2026-04-27)`, append a one-sentence note describing what was shipped.

## Final report

1. Files created/modified.
2. `npm test` output.
3. Conformance probe outputs (4 above).
4. Any spec deviations with one-sentence justification.
5. Confirmation that no other file outside `skills/chat-refine/` and the tracker was modified.

## What you must NOT do

- Do NOT touch any file outside `skills/chat-refine/` and `.claude/workspaces/v3-migration/tracker.md`.
- Do NOT modify any other Wave 1-4 skill.
- Do NOT modify legacy runners or the `src/` chat surfaces.
- Do NOT add `.claude/skills/chat-refine/` bridge content or `.claude/commands/chat-refine.md` — those exist already and are wiring concerns for a separate step.
- Do NOT commit. Do NOT push.

Begin.
