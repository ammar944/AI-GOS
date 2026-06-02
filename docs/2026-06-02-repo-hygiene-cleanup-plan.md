# Repo Hygiene Cleanup Plan (2026-06-02)

Branch: `chore/repo-hygiene-cleanup` off `main` (base `4a6a0d27`).
Source: QA pass after the big src/ + claude-flow + worker cleanup. Gates were all green
(FE build 0, FE tests 1367, FE lint 0 err/37 warn, worker build 0, worker tests 313) but
the repo *root* and git's tracked-file set were still full of V2-era cruft, plus several
stale-but-reachable code surfaces survived the dead-code sweep.

**Global rules for every task:**
- Surgical. Touch only what the task names. Do not "improve" adjacent code.
- After any task that changes app code (3, 4, 5): `npm run build` (exit 0), `npm run test:run`
  (1367 pass baseline), and `cd research-worker && npm run build && npm test` if the worker is
  touched. A task is not DONE until its required gate passes.
- One atomic commit per task. Conventional-commit message. Co-author trailer:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Nothing is truly lost: full git history retained + backup bundle at
  `~/aigos-cleanup-backup-2026-06-02/`.

---

## Task 1 — Make `.gitignore` honest: untrack already-ignored files

**Problem:** `.gitignore` was rewritten 2026-06-02 to ignore `*.docx`, `.playwright-mcp/`,
`.superpowers/`, `research-worker/.playwright-cli/`, etc., but the already-committed copies
were never removed from tracking. `git ls-files --cached -i --exclude-standard` reports
**54 files (~4.3 MB)** that the repo's own ignore rules say should not be tracked.

**Do:**
1. `git rm -r --cached` every path returned by `git ls-files --cached -i --exclude-standard`,
   **EXCEPT** `.env.example` and `research-worker/.env.example` (those are intentional commits).
   Use `--cached` so the working-tree files stay on disk — this only stops tracking them.
2. In `.gitignore`, add negations so the example files are never re-flagged:
   `!.env.example` and `!research-worker/.env.example` (place after the `.env*` block).
3. Add `.claude-flow/` to `.gitignore` (currently untracked noise in `git status`; sibling
   runtime dirs `.agents/ .codex/ .omc/` are already ignored).
4. Do NOT delete any files from disk. Do NOT touch app source. No build needed (no code change).

**Verify:** `git ls-files --cached -i --exclude-standard` returns ONLY the two `.env.example`
files (or empty). `git status` shows no untracked `.claude-flow/`. Working-tree files still
present on disk (spot-check one `.docx` and one `.playwright-mcp/*.png`). Commit.

**Acceptance:** repo no longer tracks anything its own `.gitignore` ignores (except the
intentionally-negated example envs); `git status` is clean.

---

## Task 2 — Delete V2-era root artifacts not covered by ignore rules + fix source-map

**Problem:** Beyond the ignored set, the repo root still tracks old V2 artifacts that the
ignore rules don't catch. These are obsolete (V2 era, superseded by the current v3 app).

**Do — `git rm` (delete from repo; history + backup bundle retain them):**
- `AI-GOS-v2-ClickUp-Tasks.xlsx`
- HTML mockups: `aigos-v2-battleship.html`, `aigos-v2-progressive-reveal.html`,
  `design-system-preview.html`, `EGOOS-CHAT-AGENT-V1-OLD.html`, `EGOOS-CHAT-AGENT-V2.html`,
  `section1-mockup.html`
- `aigos-design-system-v2.jsx`
- The 27 extensionless PNG screenshots: every root file matching `phase1-*`, `phase2-*`,
  `phase3-*` (confirm each is `PNG image data` via `file` before removing).
- Tracked `output/` directory (old generated PDFs/HTML reports).
- Stale scratch markdown: `CLAUDE-NEW.md`, `TODOS.md`, `TEST-REPORT.md`,
  `PRE-SPRINT-2-FIXES.md`, `AD-LIBRARY-FIX-SUMMARY.md`, `FIXES-AD-LIBRARY-SERVICE.md`,
  `BATTLESHIP-SPRINT.md`, `GENERATE_HEADER_INTEGRATION.md`, `GENERATE_HEADER_SUMMARY.md`,
  `GENERATE_HEADER_VISUAL_GUIDE.md`, `QUICK_START_GENERATE_HEADER.md`

**Do NOT touch** (legit root files, even if unusual): `README.md`, `CLAUDE.md`, `CONTEXT.md`,
`DESIGN.md`, `AGENTS.md`, `PRIMER.md`, `SOUL.md`, `IDENTITY.md`, `HEARTBEAT.md`, `TOOLS.md`,
`USER.md`, `.cursorrules`, configs, `package*.json`, `.env.example`, `.mcp.json`,
`components.json`. (The persona/agent `.md` files were NOT flagged as cruft — leave them.)

**Guard against return:** add to `.gitignore`:
`*.xlsx`, `/output/`, `aigos-design-system-v2.jsx`, and a pattern for the screenshots
(`/phase[0-9]*-*`). The mockup HTML + scratch MD are being deleted from disk too, so no
ignore rule is strictly required for them — but if any remain on disk after `git rm`,
leave them be (do not force-delete working copies the user may want).

**Also fix:** `docs/source-map.md` references `src/lib/ai/prompts/positioning-skills.ts`
which does not exist. Find the correct path (search `src` for the intended file) and fix the
reference, or remove the stale line if there is no replacement. Keep the edit minimal.

**Verify:** none of the listed paths remain in `git ls-files`. `git status` clean. No app
source touched, so no build required, but run `npm run build` once at the end as a smoke
check since `next.config`/tracing read root files. Commit.

---

## Task 3 — Remove confirmed-dead lab/research-v2 modules

**Problem:** The dead-code sweep missed these. Verified zero non-test importers in `src`:
- `src/lib/research-v2/orchestrate-client.ts`
- `src/lib/research-v2/audit-artifact-view.ts`
- `src/lib/research-v2/confidence-display.ts`
- `src/lib/research-v2/intent-router.ts` — the legacy Anthropic intent classifier. The route
  `src/app/api/research-v2/chat/route.ts` comments state "the legacy intent-router branch is
  gone." **KEEP `src/lib/research-v2/intent-router.types.ts`** — it is still imported by
  `patch-apply.ts` and the chat route.
- `src/lib/media-plan/pipeline.ts` — old wave orchestrator; current paid-media is
  `positioningPaidMediaPlan` in lab-engine. Verified zero importers.

**Do:**
1. For each module: re-confirm zero non-test importers (`grep -rn "<basename>" src --include='*.ts'
   --include='*.tsx' | grep -v __tests__`) BEFORE deleting. If any real importer appears, STOP
   and report — do not delete.
2. `git rm` the module. Also `git rm` any `__tests__` file that exists SOLELY to test that
   module (its imports break once the module is gone). Do not delete shared test helpers.
3. Do NOT delete `intent-router.types.ts`.

**Verify (required gate):** `npm run build` exit 0, `npm run test:run` all pass (expect ~1367
minus any removed module-specific tests; no failures, no broken imports). Commit.

---

## Task 4 — Remove orphaned legacy chat routes

**Problem:** Three legacy chat route files are URL-reachable but called by zero client code
(verified: no `fetch('/api/chat/agent')` etc. anywhere in `src`). One is actively broken.
- `src/app/api/chat/agent/route.ts` — POSTs to `/api/chat/messages/save`, which does not exist.
- `src/app/api/chat/media-plan-agent/route.ts` — orphaned.
- `src/app/api/chat/unified/route.ts` — already returns HTTP 410 ("retired"), and points to
  `/api/chat/.../journey/stream` which does not exist (only `/api/journey/session` does).

The current/kept workspace chat is `src/app/api/research-v2/chat/route.ts` — **do NOT touch it.**

**Do:**
1. Re-confirm no client caller for each route (grep the route path string across `src`,
   excluding the route file itself and `__tests__`). If a real caller appears, STOP and report.
2. `git rm -r` the three route directories: `src/app/api/chat/agent/`,
   `src/app/api/chat/media-plan-agent/`, `src/app/api/chat/unified/`. Remove their
   `__tests__` if any.
3. After removal, do a fresh orphan check on modules those routes *exclusively* imported
   (e.g. `src/lib/ai/chat-tools/`, `src/lib/ai/media-plan-chat-tools/`, `src/lib/media-plan/*`,
   `src/lib/blueprints/`, `src/lib/strategic-blueprint/`). Only delete a module if it now has
   ZERO importers anywhere in `src` (excluding tests) AND removing it keeps the build green.
   If a module is still referenced elsewhere, LEAVE IT and note it. Do not chase cascades that
   risk the build — bound this to obviously-dead, build-verified removals.

**Verify (required gate):** `npm run build` exit 0, `npm run test:run` all pass. Commit.

---

## Task 5 — Remove the dead media-plan dispatch surface

**Problem:** `MediaPlanButton` (rendered at `src/components/research/research-document.tsx:233`,
which appears on the de-listed legacy `/research/[sessionId]` saved-report viewer) calls the
server action `dispatchMediaPlanForSession` (`src/lib/actions/journey-sessions.ts:171`), which
dispatches the worker tool `'researchMediaPlan'`. The worker now only allows
`runDeepResearchProgram | resolveIdentity | extractMeetingTranscript`
(`research-worker/src/index.ts:73-76`) and rejects everything else → runtime failure.

**Decision (controller):** REMOVE the broken button and its now-dead dispatch tail. Do NOT
rewire it to `positioningPaidMediaPlan` — `/research` V1 is a deprecated, de-listed surface and
investing new dispatch wiring into it contradicts the cleanup goal.

**Do:**
1. Remove the `<MediaPlanButton ... />` usage from `src/components/research/research-document.tsx`
   (and any now-unused props/imports/state in that file that existed only to feed the button,
   e.g. `hasMediaPlan`, `onDispatched` plumbing — only what is now genuinely unused).
2. `git rm src/components/research/media-plan-button.tsx`.
3. Remove the `dispatchMediaPlanForSession` function from
   `src/lib/actions/journey-sessions.ts` IF it now has zero callers (grep to confirm).
4. Remove the now-dead `researchMediaPlan` / `mediaPlan` entries from the legacy dispatch
   taxonomy in `src/lib/journey/server/dispatch-research.ts` ONLY if they are no longer
   referenced after step 3. If `dispatchResearchForUser` or the taxonomy is shared with live
   paths, remove only the dead `mediaPlan`/`researchMediaPlan` entries, not the shared machinery.
5. Re-confirm at each step via grep that you are not orphaning a live path. If anything is still
   referenced by a live surface, STOP and report rather than guess.

**Verify (required gate):** `npm run build` exit 0, `npm run test:run` all pass. Manually confirm
`/research/[sessionId]` page still compiles and renders without the button. Commit.

---

## Final QA
- Dispatch a holistic final code-review subagent over the whole branch diff (base `4a6a0d27`..HEAD).
- Run an independent Codex review (`codex review --base main`) as the final external gate.
- Re-run all gates (FE build/test/lint + worker build/test) on the final branch state.
