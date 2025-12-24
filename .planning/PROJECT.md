# AI-GOS Project

## Vision
AI-GOS (AI-powered Go-to-Market Operations System) is a SaaS platform that generates comprehensive media plans and strategic blueprints for businesses using a multi-model AI pipeline.

## Current State
**Version:** 0.2.0 (MVP)
**Status:** Functional with stability issues

### What Works
- Multi-model AI pipeline (Gemini Flash → Perplexity → GPT-4o → Claude)
- 9-step onboarding wizard for full strategic blueprints
- Quick 2-step media plan generation
- Supabase authentication (email/password + Google OAuth)
- LocalStorage persistence for form data and results
- Progress tracking during generation

### Known Issues
- **JSON parsing failures:** AI responses sometimes return malformed JSON that fails extraction
- **Timeouts:** Full plan generation (11 sections) can timeout on slower models
- **No structured output:** Models don't enforce JSON schema, leading to unpredictable formats

## Goals

### Immediate (Milestone 1: Stabilization)
1. **Enforce structured output** - Use OpenRouter/model JSON modes where available
2. **Robust JSON extraction** - Improve fallback strategies, add validation
3. **Timeout handling** - Per-section timeouts with retry logic
4. **Error recovery** - Graceful degradation, partial results when possible
5. **Vercel deployment readiness** - Ensure all routes work within Vercel limits

### Future
- PDF export for generated plans
- Save blueprints to Supabase database
- User project history
- Test coverage for critical paths

## Tech Stack
- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui
- **Backend:** Next.js API Routes (App Router)
- **AI:** OpenRouter gateway (Gemini Flash, Perplexity Sonar Pro, GPT-4o, Claude Sonnet)
- **Auth:** Supabase (SSR)
- **Deployment:** Vercel (target)

## Constraints
- Vercel function timeout: 60s (Pro) or 10s (Hobby)
- OpenRouter rate limits per model
- Total generation cost target: <$0.25 per plan

## Success Criteria
- Zero JSON parsing errors in production
- 95%+ successful plan generations
- All routes complete within Vercel timeout limits
- Clean deployment to Vercel with no runtime errors

---

*Created: 2025-12-24*
