---
status: accepted
date: 2026-06-23
---

# ADR-0012: GLM-5.2 agentic research transport via OpenRouter

## Decision

Use **OpenRouter `z-ai/glm-5.2`** as the production transport for the GLM-5.2
agentic section writer, reached through `@ai-sdk/openai-compatible` over env
(`GLM_BASE_URL` / `GLM_MODEL_ID` / `GLM_API_KEY`). This overrides the repo-wide
first-party-provider-only rule for this one provider.

- Dev keeps the existing Ollama Cloud proxy at `http://localhost:11434/v1`
  serving `glm-5.2:cloud` — identical code path, env-only switch.
- Prod points the same three env vars at OpenRouter
  (`https://openrouter.ai/api/v1`, `z-ai/glm-5.2`, an OpenRouter key).
- The code path is unchanged from the dev Ollama path; only the env differs.
  Provider selection lives in `src/lib/lab-engine/ai/models.ts`
  (`getAgenticGLMModel`).

## Context

The agentic GLM section path (`runAgenticGLMSection` in
`src/lib/lab-engine/agents/run-section.ts`) generates the six projectable
positioning sections from free-markdown + a tool loop. It needs a GLM-5.2
endpoint that is reachable from the Vercel production process and stable under
the ~285s section budget. z.ai/BigModel's first-party endpoint would honor the
repo's first-party-provider-only rule but requires a new, separately-managed key
and has unclear prod stability; the owner is already on OpenRouter and it is
verified working for `z-ai/glm-5.2`.

## Consequences

- The first-party-provider-only rule is now scoped: **OpenRouter `z-ai/glm-5.2`
  is an accepted exception for the agentic section writer only.** Other
  providers/call sites remain first-party-only.
- Failover, cost, and rate-limit behavior are OpenRouter's responsibility for
  this one model. A future switch to z.ai first-party (or another host) is
  env-only — no code change required.
- `.env.example` documents the dev/prod split for the three GLM env vars.

## Alternatives considered

- **z.ai / BigModel first-party** — would honor the first-party-only ban but
  requires a new key and has unverified prod stability/reachability from Vercel.
- **Ollama Cloud in prod** — the dev proxy is Ollama Cloud, but its prod
  stability for this workload is unclear; OpenRouter is the verified-working
  prod path the owner already operates.