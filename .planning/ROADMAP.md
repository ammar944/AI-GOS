# Roadmap

## Milestone 1: Stabilization

**Goal:** Harden AI pipeline for reliable generation and Vercel deployment

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

### Phase 2: Timeout and Retry Logic
**Priority:** Critical | **Effort:** Medium

Add per-section timeouts and intelligent retry logic.

**Tasks:**
1. Implement per-section timeout (45s per section, adjustable)
2. Add exponential backoff retry for transient failures (max 2 retries)
3. Track section timing and detect slow sections
4. Add circuit breaker for repeated failures on same section
5. Return partial media plan if later sections fail

**Success:** 95%+ generation completion rate

---

### Phase 3: Vercel Deployment Compatibility
**Priority:** High | **Effort:** Low

Ensure all routes work within Vercel function limits.

**Tasks:**
1. Audit route timeouts against Vercel limits (60s Pro, 10s Hobby)
2. Add streaming response for long-running generations (if needed)
3. Validate environment variable loading on Vercel
4. Test cold start performance
5. Add health check endpoint

**Success:** Clean deployment with no runtime errors

---

### Phase 4: Error Reporting and Recovery
**Priority:** Medium | **Effort:** Low

Better error visibility and graceful degradation.

**Tasks:**
1. Add structured error responses with error codes
2. Surface specific failure reasons to UI (timeout, rate limit, parse error)
3. Allow user to retry from failed section
4. Add error boundary in React UI
5. Log errors with request context for debugging

**Success:** Users see clear error messages and can retry

---

## Future Milestones

### Milestone 2: Persistence
- Save blueprints and media plans to Supabase
- User project history
- Re-generate from saved inputs

### Milestone 3: Export
- PDF export for media plans
- Branded PDF templates

### Milestone 4: Testing
- Vitest setup
- Unit tests for JSON extraction
- Integration tests for pipeline stages

---

*Created: 2025-12-24*
