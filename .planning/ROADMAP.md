# Roadmap

## Milestones

- ✅ **v1.0 Stabilization** - Phases 1-4 (shipped 2025-12-26)
- 🚧 **v1.1 Validation Gate** - Phases 5-7 (in progress)
- 📋 **v1.2 Persistence** - Planned
- 📋 **v1.3 Export** - Planned
- 📋 **v1.4 Testing** - Planned

## Phases

<details>
<summary>✅ v1.0 Stabilization (Phases 1-4) - SHIPPED 2025-12-26</summary>

### Phase 1: Robust JSON Response Handling ✓ COMPLETE
**Priority:** Critical | **Effort:** Medium | **Completed:** 2025-12-24

Fix JSON parsing failures by improving extraction and adding validation.

**Tasks:**
1. Add Zod schemas for all 11 media plan section types
2. Validate AI responses against schemas before accepting
3. Improve JSON extraction to handle edge cases (truncated responses, extra text)
4. Add response repair for common malformations (missing closing braces, trailing commas)
5. Return partial results with clear error when validation fails

**Success:** Zero JSON parse errors on valid model outputs

---

### Phase 2: Timeout and Retry Logic ✓ COMPLETE
**Priority:** Critical | **Effort:** Medium | **Completed:** 2025-12-25

Add per-section timeouts and intelligent retry logic.

**Tasks:**
1. Implement per-section timeout (45s per section, adjustable)
2. Add exponential backoff retry for transient failures (max 2 retries)
3. Track section timing and detect slow sections
4. Add circuit breaker for repeated failures on same section
5. Return partial media plan if later sections fail

**Success:** 95%+ generation completion rate

---

### Phase 3: Vercel Deployment Compatibility ✓ COMPLETE
**Priority:** High | **Effort:** Low | **Completed:** 2025-12-25

Ensure all routes work within Vercel function limits.

**Tasks:**
1. Audit route timeouts against Vercel limits (60s Pro, 10s Hobby)
2. Add streaming response for long-running generations (if needed)
3. Validate environment variable loading on Vercel
4. Test cold start performance
5. Add health check endpoint

**Success:** Clean deployment with no runtime errors

---

### Phase 4: Error Reporting and Recovery ✓ COMPLETE
**Priority:** Medium | **Effort:** Low | **Completed:** 2025-12-26

Better error visibility and graceful degradation.

**Tasks:**
1. Add structured error responses with error codes
2. Surface specific failure reasons to UI (timeout, rate limit, parse error)
3. Allow user to retry from failed section
4. Add error boundary in React UI
5. Log errors with request context for debugging

**Success:** Users see clear error messages and can retry

</details>

---

### 🚧 v1.1 Validation Gate (In Progress)

**Milestone Goal:** Add user validation gate after strategic research before media plan generation, allowing users to review, edit, and approve research before proceeding.

#### Phase 5: Strategic Research Review UI
**Goal**: Display strategic research output in reviewable format with section cards
**Depends on**: Milestone 1 complete
**Research**: Unlikely (internal React patterns)
**Plans**: 2

Plans:
- [x] 05-01: Review Card Foundation (SectionCard component + content renderers)
- [ ] 05-02: Review UI and Integration (StrategicResearchReview + /generate page)

#### Phase 6: Inline Edit Capability
**Goal**: Enable click-to-edit on text fields with save/discard functionality
**Depends on**: Phase 5
**Research**: Unlikely (internal patterns)
**Plans**: TBD

Plans:
- [ ] 06-01: TBD

#### Phase 7: Approval Flow
**Goal**: Add approve/edit mode toggle, store user edits, feed approved data to media plan pipeline
**Depends on**: Phase 6
**Research**: Unlikely (internal state management)
**Plans**: TBD

Plans:
- [ ] 07-01: TBD

---

### 📋 Future Milestones

#### v1.2 Persistence
- Save blueprints and media plans to Supabase
- User project history
- Re-generate from saved inputs

#### v1.3 Export
- PDF export for media plans
- Branded PDF templates

#### v1.4 Testing
- Vitest setup
- Unit tests for JSON extraction
- Integration tests for pipeline stages

---

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1. JSON Handling | v1.0 | 3/3 | Complete | 2025-12-24 |
| 2. Timeout/Retry | v1.0 | 2/2 | Complete | 2025-12-25 |
| 3. Vercel Deploy | v1.0 | 1/1 | Complete | 2025-12-25 |
| 4. Error Reporting | v1.0 | 2/2 | Complete | 2025-12-26 |
| 5. Research Review UI | v1.1 | 1/2 | In progress | - |
| 6. Inline Edit | v1.1 | 0/? | Not started | - |
| 7. Approval Flow | v1.1 | 0/? | Not started | - |

---

*Created: 2025-12-24*
*Updated: 2025-12-26*
