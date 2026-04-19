# Bug Triage — Step Zero

When a production bug is reported, STOP. Do not open source files yet. Run Step Zero first.

## Step Zero — Infra Checklist

Before assuming a code bug, verify the boring stuff that breaks most often:

1. **Supabase quotas and health**
   - Is the Supabase project paused, over quota, or in a read-only state?
   - Is the service-role key rotated or expired?
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` present in the env the bug reporter is using?

2. **Environment variables**
   - `ANTHROPIC_API_KEY`, `GROQ_API_KEY`, `SEARCHAPI_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — all present?
   - `RAILWAY_WORKER_URL` + `RAILWAY_API_KEY` — without these, dispatches fail silently.

3. **Upstream rate limits / provider status**
   - Anthropic status page green?
   - Groq, Perplexity, SearchAPI — any 429s in recent logs?
   - Clerk and Supabase status pages green?

4. **Deploy status**
   - Did a deploy land in the last 24h? If yes, check the diff before reading unrelated source.
   - Vercel build passing on `main`? Railway worker deploy healthy?

5. **Worker reachability**
   - `curl $RAILWAY_WORKER_URL/health` — 200?
   - Is the frontend pointing at a worker URL that actually exists?

## Only After Step Zero

If all five check out, THEN open source files. Use the 3-question Bug Fix Protocol from `.claude/rules/verification.md`:
1. Root cause — why does the architecture allow this?
2. Reproduction — exact conditions?
3. Regression risk — what could break this fix later?

## Why

Most "bugs" that get classified as code issues turn out to be env vars, quota, or a silent deploy. The usage report logged 28 wrong-approach incidents — many were the model diving into source when the fix was an infra toggle.
