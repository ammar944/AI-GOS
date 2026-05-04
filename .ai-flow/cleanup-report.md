# AI-GOS Dirty Worktree Cleanup Report

Date: 2026-05-04 17:22 PKT
Branch: refactor/agent-loop-v1
Base/top commit: aa4dce4e
Total dirty paths: 370 captured before this report was written

## Summary

Current inventory from `git status --porcelain=v1 -uall`:

| Status | Count |
| --- | ---: |
| Modified | 176 |
| Deleted | 29 |
| Untracked | 165 |
| Staged | 0 |
| Total | 370 |

Top-level distribution:

| Top-level path | Total | Modified | Deleted | Untracked |
| --- | ---: | ---: | ---: | ---: |
| `skills` | 199 | 103 | 17 | 79 |
| `research-worker` | 43 | 18 | 6 | 19 |
| `src` | 42 | 28 | 0 | 14 |
| `.omc` | 29 | 2 | 6 | 21 |
| `.claude` | 24 | 20 | 0 | 4 |
| `docs` | 14 | 2 | 0 | 12 |
| `.ai-flow` | 5 | 0 | 0 | 5 |
| `scripts` | 4 | 0 | 0 | 4 |
| `landing-page-generator` | 3 | 0 | 0 | 3 |
| `output` | 2 | 0 | 0 | 2 |
| `.cursor` | 1 | 1 | 0 | 0 |
| `AMMAR-WORKFLOW.md` | 1 | 1 | 0 | 0 |
| `huashu-landing-page-reference.md` | 1 | 0 | 0 | 1 |
| `research` | 1 | 0 | 0 | 1 |
| `tsconfig.json` | 1 | 1 | 0 | 0 |

The dirty tree is not one kind of mess. It contains generated agent state, active GTM/worker implementation work, broad skill rewrites, landing-page prototype work, workflow docs, and older Journey/source fixes. Cleanup should be done by bucket, not by broad delete or revert.

Bucket counts below are for the 370 captured paths before this report was added. This report itself should be kept with the GTM-013 card.

## Bucket 1 — Keep and commit

| Path/group | Why keep | Suggested commit/slice | Risk |
| --- | --- | --- | --- |
| `.ai-flow/current-task.md` | Active GTM-013 task file. It is the session contract for this cleanup report. | Commit with this cleanup report if `.ai-flow` task history is meant to be canonical. Otherwise leave untracked but preserve until GTM-013 closes. | Low. It is session metadata, not runtime code. |
| `.ai-flow/cleanup-report.md` | Output of this card. Added after the 370-path inventory. | `docs: classify dirty worktree cleanup` or include in the cleanup-control-doc slice. | Low. Report-only. |
| `docs/affine/pages/04-backlog-kanban.md` and `docs/affine/gtm-run-kanban.html` | The Markdown board adds the Context Engineering OS section and the HTML mirror reflects it. This matches the current control-doc workflow. | Docs-only board/mirror commit after owner confirms the new section is desired. | Low to medium. Risk is duplication/drift if other AFFiNE pages become canonical accidentally. |
| `scripts/aigos-flow.mjs` | `package.json` already references `npm run aigos:*`; without this untracked script, those committed commands fail in a fresh clone. | Workflow-tooling commit with `.ai-flow` conventions and docs. | Medium. Script launches Codex and writes `.ai-flow` files; review before committing. |
| `research-worker/package.json` | Adds `"test": "vitest run"`, matching AGENTS.md worker command guidance. No dependency change, so no lockfile change is expected. | Worker test-harness commit. | Low. Still verify worker tests before commit. |
| `research-worker/src/gtm/stage-events.ts`, `research-worker/src/gtm/__tests__/stage-events.test.ts`, `research-worker/src/schemas/source-gap.ts`, `research-worker/src/schemas/gtm/ingest-identity-output.ts`, `research-worker/src/schemas/gtm/ingest-url-output.ts` | These look like active GTM worker event/schema files. `AGENTS.md` names worker event writes as part of the active GTM architecture. | Worker GTM observability/schema slice. | Medium. These are untracked implementation files; verify imports, tests, and deployment boundary before commit. |

## Bucket 2 — Generated and gitignored

| Path/group | Why generated | Suggested gitignore rule | Safe after approval? |
| --- | --- | --- | --- |
| `.omc/**` | Agent memory/session/checkpoint/log state. Current status includes modified, deleted, and untracked root `.omc` files. | `.omc/` | Yes, but first decide whether to stop tracking existing `.omc` files with a separate untrack-only cleanup commit. |
| `research-worker/.omc/**` | Worker-local agent logs, sessions, and state. Same generated shape as root `.omc`. | `research-worker/.omc/` | Yes, with the same tracked-file caveat. |
| `.claude/scheduled_tasks.lock` | Lock/state file, not product source. | `.claude/*.lock` or `.claude/scheduled_tasks.lock` | Yes after confirming no scheduled-task workflow needs this tracked. |
| `.ai-flow/codex-prompt.md`, `.ai-flow/implementation-log.md`, `.ai-flow/verification.log` | Runtime/session artifacts from the local AIGOS flow. | `.ai-flow/codex-prompt.md`, `.ai-flow/implementation-log.md`, `.ai-flow/verification.log` | Yes after preserving any needed evidence in a durable report or commit message. |

Note: `git check-ignore -v` returned no ignore match for sampled `.omc`, `research-worker/.omc`, `.ai-flow`, `skills/landing-page/output`, and `output/example-dealflow-01` paths. These are currently visible to Git.

## Bucket 3 — Safe to delete after approval

| Path/group | Why safe | Approval needed from |
| --- | --- | --- |
| `output/example-dealflow-01/**` | Generated example output artifacts, not app source. | Product/engineering owner should confirm no artifact is needed as a fixture. |
| `skills/landing-page/output/**` | Generated landing-page HTML outputs under a prototype skill. These should not ship as source unless explicitly promoted to fixtures/examples. | Product owner for the landing-page prototype. |

These should still be deleted only after approval. If kept as examples, move them into a named fixture/example policy instead of leaving them as ad hoc output.

## Bucket 4 — Needs owner decision

| Path/group | Why unclear | Owner/question |
| --- | --- | --- |
| `skills/**` excluding `skills/landing-page/output/**` | 188 non-output skill paths plus broad modified/deleted/untracked changes. The diffs include schema changes, orchestrators, tests, fixture outputs, deleted TODO placeholders, and large rewrites across research and synthesis skills. | Skill owner: which skill slices are intentional and already validated? Split by skill folder before commit or deletion. |
| `research-worker/src/**` excluding the GTM event/schema files listed in Bucket 1 | 20 other worker source paths are modified. Sampled diffs show local workflow status/blocker behavior, deterministic enrich-brief merge behavior, and broader runner/test changes. | Worker owner: should this land as local GTM runner work, or be split from GTM Run Visibility? |
| `research-worker/fixtures/**` and `research-worker/scripts/validate-on-disk.ts` | Fixtures and validation tooling may be needed for local runs, but they are untracked and not obviously generated. | Worker owner: keep as test fixtures/tooling or regenerate outside Git? |
| `src/**` excluding landing-page prototype paths | 29 app source/test paths changed outside the current GTM workspace slice, mostly older Journey, strategic research, Firecrawl, AI provider, media-plan, storage, and blueprint code. | App owner: are these independent fixes, stale branch drift, or changes to drop later? |
| `src/app/api/landing-page/**`, `src/lib/ai/landing-page/**`, `src/lib/ai/prompts/landing-page-system.ts`, `src/lib/ai/tools/generate-landing-page.ts` | 13 untracked app-source paths introduce a landing-page generation surface, which is explicitly outside Milestone 1 non-goals unless promoted. | Product owner: park, commit as a separate prototype branch, or delete after extracting useful pieces. |
| `skills/landing-page/**` excluding `output/**` | 6 untracked prototype skill files/templates/prompts. Related to the landing-page feature, not current GTM Run Visibility. | Product owner: same decision as landing-page app source. |
| `landing-page-generator/**` | Separate untracked landing-page generator scaffold. Could be scratch or a separate product slice. | Product owner: keep in a branch, move to scratch, or delete. |
| `.claude/commands/**`, `.claude/rules/**`, `.claude/skills/**` | 17 modified Claude workflow/skill files. Sampled diffs update local run-dir command behavior and AI SDK model-routing rules. Useful, but not deploy code. | Workflow owner: should repo-local Claude workflow changes be committed or moved to global/local config? |
| `.claude/architecture/**` and `.claude/workspaces/**` | 6 planning/context files. They may be useful decision records but conflict risk is high because `AGENTS.md` and `program.md` are now canonical. | Product/architecture owner: promote the durable decisions into canonical docs or keep local-only. |
| `docs/affine/pages/00-command-center.md`, `01-product-map.md`, `02-architecture-canvas.md`, `03-data-model.md`, `05-agent-runs.md`, `06-decisions.md`, `07-dev-pipeline.md` | Seven untracked AFFiNE pages. They may be useful, but the current task explicitly avoids broad AFFiNE loading unless needed for ownership. | Product owner: decide whether these become canonical, mirror-only, or local scratch. |
| `docs/LOCAL_AGENT_WORKFLOW.md` and `docs/agent-map/**` | Five untracked docs/maps. Likely useful for local workflow/codebase orientation, but not directly part of GTM-013. | Architecture owner: promote, regenerate, or keep out of Git. |
| `scripts/open-aigos-affine.sh`, `scripts/smoke-gtm-skill-object.ts`, `scripts/smoke-lighthouse-research-icp.ts` | Untracked workflow/smoke scripts. They may belong with the AIGOS flow tooling but need owner review. | Engineering owner: commit with tests/docs or leave local-only. |
| `.ai-flow/chat-shell-codex-overreach.patch` | Patch artifact could be useful evidence or stale local recovery material. Not safe to delete without knowing whether it documents a regression. | Current GTM owner: keep as evidence, move to docs, or delete. |
| `.cursor/rules/project.mdc` | Modified Cursor rule duplicates project convention guidance. It may drift from AGENTS.md/CLAUDE.md. | Tooling owner: keep synchronized or remove from repo control. |
| `AMMAR-WORKFLOW.md` | Single modified workflow doc line about archived sprint docs. | Workflow owner: keep as durable cleanup or drop if obsolete. |
| `huashu-landing-page-reference.md` | Untracked landing-page reference doc. Related to non-goal landing-page work. | Product owner: move to landing-page prototype branch or delete after approval. |
| `research/david-ondrej-hermes-claude-code-workflow.md` | Untracked external workflow/research note. Could be source material, not generated state. | Workflow owner: promote to docs or delete after approval. |
| `tsconfig.json` | Modified root TypeScript config. Most of the diff is formatting, but it also adds `.next/dev/dev/types/**/*.ts` to `include`. | Engineering owner: confirm this is intentional. Config drift can affect build/typecheck behavior. |

## Deploy/Merge blockers

- Root `package.json` already references `scripts/aigos-flow.mjs`, but that script is untracked. A fresh clone can expose broken `npm run aigos:*` commands unless the script is committed or the scripts are removed.
- Root `package.json` already references `skills/landing-page/scripts/generate.ts`, while the landing-page skill is untracked. The landing-page npm commands are not reproducible from Git.
- `research-worker/src/gtm/stage-events.ts` and its test/schema support are untracked even though worker event writes are part of the active GTM architecture.
- `tsconfig.json` is modified. The `.next/dev/dev/types/**/*.ts` include needs review before merging because it may encode local generated-path drift.
- There are 42 `src` dirty paths, including broad non-GTM Journey/research/provider changes and a new landing-page API/lib surface. Do not merge/deploy this mixed source state as one batch.
- There are 199 `skills` dirty paths, including 17 deletions and large schema/orchestrator/fixture changes. Each skill needs isolated validation before any commit.
- `.omc/**` and `research-worker/.omc/**` include tracked generated state. Until these are untracked/ignored, normal agent runs can continue dirtying Git.
- `skills/landing-page/output/**` and `output/example-dealflow-01/**` look generated but are currently unignored; do not accidentally commit generated HTML/output artifacts.
- No dirty `supabase/migrations/**` paths were present in the current inventory, which is a positive change from the older snapshot.

## Recommended cleanup order

1. Commit this GTM-013 report and the active task file if `.ai-flow` task history should be tracked; otherwise keep only the report as the review artifact.
2. Add ignore rules for `.omc/`, `research-worker/.omc/`, `.ai-flow` runtime logs, and generated output folders, then untrack already tracked generated state in a dedicated cleanup commit after approval.
3. Decide the AIGOS workflow tooling slice: either commit `scripts/aigos-flow.mjs` with the package-script contract or remove the committed `npm run aigos:*` references.
4. Decide the worker GTM event/schema slice and run worker tests before committing it.
5. Split skill work by folder. Start with the smallest high-value skill slice and verify it before touching the next one.
6. Triage `src/**` into GTM, Journey legacy, Firecrawl/provider strictness, and landing-page prototype slices. Do not merge these together.
7. Park or delete landing-page prototype artifacts after owner approval, especially generated HTML outputs.
8. Promote only durable `.claude`, `.cursor`, AFFiNE, and workflow-doc decisions into canonical docs; keep local tool state out of source control.

## Commands run

```bash
sed -n '1,240p' AGENTS.md
sed -n '1,260p' program.md
sed -n '1,240p' .ai-flow/current-task.md
git status --short --branch
git status --porcelain=v1 > /tmp/aigos-dirty-status.txt
git rev-parse --abbrev-ref HEAD
git rev-parse --short HEAD
git log -1 --oneline
git status --porcelain=v1 -uall > /tmp/aigos-dirty-status-uall.txt
awk '...' /tmp/aigos-dirty-status-uall.txt
sed -n '1,220p' .gitignore
git ls-files .omc research-worker/.omc .claude
git diff --name-only -- .omc research-worker/.omc .claude .cursor AMMAR-WORKFLOW.md tsconfig.json
git diff --stat -- skills research-worker/src src docs scripts supabase/migrations research-worker/package.json tsconfig.json eslint.config.mjs package.json
git diff --name-only -- skills research-worker/src src docs scripts supabase/migrations research-worker/package.json tsconfig.json eslint.config.mjs package.json
awk 'substr($0,2,1)=="D" {print substr($0,4)}' /tmp/aigos-dirty-status-uall.txt
awk 'substr($0,1,2)=="??" {print substr($0,4)}' /tmp/aigos-dirty-status-uall.txt
git diff -- research-worker/package.json
git diff -- tsconfig.json
git diff -- docs/affine/pages/04-backlog-kanban.md
git diff -- src/lib/ai/providers.ts src/lib/firecrawl/client.ts src/lib/agents/tools/index.ts
git diff -- research-worker/src/jobs/run-gtm-workflow.ts
git diff -- research-worker/src/stages/enrich-brief.ts research-worker/src/dev/run-local-gtm.ts
git diff -- skills/ingest-url/scripts/orchestrate.ts skills/synthesize-scripts/scripts/orchestrate.ts
git diff -- skills/present-workspace/scripts/orchestrate.ts
sed -n '1,180p' src/app/gtm/preview/agent-block/page.tsx
sed -n '1,180p' src/app/api/landing-page/run/route.ts
sed -n '1,180p' research-worker/src/gtm/stage-events.ts
sed -n '1,180p' scripts/aigos-flow.mjs
rg -n "aigos|landing-page|test\"|test:run" package.json research-worker/package.json
git diff -- .claude/commands/research-market.md .claude/rules/ai-sdk-patterns.md .cursor/rules/project.mdc AMMAR-WORKFLOW.md
git diff -- docs/affine/gtm-run-kanban.html
git ls-files scripts/aigos-flow.mjs scripts/open-aigos-affine.sh scripts/smoke-gtm-skill-object.ts scripts/smoke-lighthouse-research-icp.ts src/app/gtm/preview/agent-block/page.tsx src/lib/ai/landing-page/index.ts research-worker/src/gtm/stage-events.ts
git show HEAD:package.json | rg -n "aigos|landing-page"
git ls-files supabase/migrations
git status --short -- supabase/migrations package.json package-lock.json research-worker/package.json research-worker/package-lock.json
git check-ignore -v .omc/sessions/11a80585-0458-48c6-aa6f-52259545ca15.json research-worker/.omc/sessions/5ee8e1a0-7bfe-4779-8b64-4e370f39fd4c.json .ai-flow/current-task.md skills/landing-page/output/codex-nexone-proof-of-concept.html output/example-dealflow-01/brand-spec.json
date '+%Y-%m-%d %H:%M %Z'
test -e .ai-flow/cleanup-report.md
```

## Explicit non-actions

- No files deleted.
- No files reverted.
- No source files edited.
- No files staged.
- No commit created.
- No generated log contents were inspected for secret values.
