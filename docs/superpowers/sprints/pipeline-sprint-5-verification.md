# Pipeline Sprint 5: Build Verification + Integration Test

**Branch:** `redesign/v2-command-center`

**Depends on:** Sprints 1-4 (all code must exist)

**What this builds:** Verifies everything compiles, tests pass, and the full pipeline works end-to-end with the real worker.

**Estimated scope:** Fix any build errors from prior sprints + manual E2E test.

---

## Context

Read these before starting:
- **Full plan:** `docs/superpowers/plans/2026-03-12-sequential-research-pipeline.md` (Tasks 12-13)
- **Spec performance targets:** `docs/superpowers/specs/2026-03-12-sequential-research-pipeline-design.md` (Performance Targets table)
- All files created in Sprints 1-4

## Tasks

### Task 12: Build Verification

- [ ] **Step 1:** Run `npm run test:run -- src/lib/research/__tests__/` — all pipeline tests pass
- [ ] **Step 2:** Run `npm run test:run` — no regressions in existing tests
- [ ] **Step 3:** Run `npm run build` — build succeeds with zero new errors
- [ ] **Step 4:** Fix any issues found, commit fixes

### Task 13: Manual Integration Test

**Prerequisites:** Dev server + research worker running (tmux or separate terminals).

- [ ] **Step 1:** Start dev server: `npm run dev`
- [ ] **Step 2:** Start research worker: `cd research-worker && npm run dev`
- [ ] **Step 3:** Test pipeline start:
  ```bash
  curl -X POST http://localhost:3000/api/research/pipeline/start \
    -H "Content-Type: application/json" \
    -d '{"onboardingData":{"companyName":"Test Corp","industry":"SaaS","companyUrl":"https://test.com"}}'
  ```
  Expected: `{ "status": "started", "runId": "...", "section": "industryResearch" }`

- [ ] **Step 4:** Verify worker receives dispatch (check worker terminal)

- [ ] **Step 5:** Advance through all 6 sections sequentially
  Wait for each section to complete in Supabase, then:
  ```bash
  curl -X POST http://localhost:3000/api/research/pipeline/advance \
    -H "Content-Type: application/json" \
    -d '{"runId":"<runId>"}'
  ```
  Pay special attention to sections 4 (strategicSynthesis) and 5 (keywordIntel) — verify context is parsed correctly by the worker.

- [ ] **Step 6:** Navigate to pipeline view at `http://localhost:3000/research/<runId>`
  Verify: 6 cards visible, gate controls work, "Looks good" advances pipeline.

- [ ] **Step 7:** Test chat route
  ```bash
  curl -X POST http://localhost:3000/api/research/chat \
    -H "Content-Type: application/json" \
    -d '{"messages":[{"role":"user","content":"Add more detail about market trends"}],"runId":"<runId>","sectionId":"industryResearch"}'
  ```
  Measure time-to-first-token — target < 1 second.

- [ ] **Step 8:** Test direct edit + downstream invalidation
  ```bash
  curl -X PATCH http://localhost:3000/api/research/section \
    -H "Content-Type: application/json" \
    -d '{"runId":"<runId>","sectionId":"industryResearch","updates":{"marketSize":"$10B"}}'
  ```
  Verify: strategicSynthesis and keywordIntel show "Needs rerun" stale badge.

- [ ] **Step 9:** Verify error handling — simulate worker error in Supabase, verify error card + retry button.

- [ ] **Step 10:** Measure performance targets:

  | Metric | Target |
  |---|---|
  | Pipeline UI first visible | < 1 second from start response |
  | Chat refinement TTFT | < 1 second |

- [ ] **Step 11:** Final commit
  ```bash
  git add -A
  git commit -m "feat: sequential research pipeline — Phase 1 complete"
  ```

## Done Criteria
- Build passes
- All tests green
- Pipeline runs through all 6 sections with real worker
- Chat agent responds in < 1s TTFT
- Direct edit triggers downstream invalidation
