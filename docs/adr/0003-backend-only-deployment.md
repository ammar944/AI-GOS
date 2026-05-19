---
status: accepted
date: 2026-05-14
---

# Backend-only skill deployment with provider-agnostic agentic framework

We run all skills inside our own research-worker (Railway / local dev), never as Anthropic Platform Skills uploaded to claude.ai. The Subagent runtime is AI SDK v6's `ToolLoopAgent` + `streamObject(SectionArtifactSchema)`, which is provider-agnostic — the same code path works against Anthropic, OpenAI, Mistral, or any model the AI SDK supports. SKILL.md is loaded from local disk at worker boot via `_skill-loader.ts` and injected into the Subagent's system instructions. The `streamObject` Zod schema is enforced at the AI-SDK + provider layer; SKILL.md describes the desired shape in prose for the model to follow. We picked this path because it preserves model-swappability — we can change the underlying model (Opus → Sonnet → an OpenAI model → an open-weights model) without re-authoring skills or shipping through a vendor's distribution channel.

## Considered Options

- **Dual deployment** — Skills loaded by the research-worker AND packaged as `.zip` files uploaded to Anthropic Platform Skills for claude.ai distribution. Rejected because (a) the `.zip` upload channel couples us to a specific vendor's runtime and skill format, (b) on claude.ai there is no `streamObject` enforcement layer, so SKILL.md would have to be self-sufficient (markdown template + JSON-shape hints) — adding authoring overhead with no current user benefit, (c) we have no users on claude.ai consuming our skills today.

- **Anthropic Platform Skills only** — Skills uploaded to Anthropic, users invoke them on claude.ai or via Skills API. Rejected because (a) ties the product to Anthropic-only models permanently, (b) no `streamObject` typed-output enforcement, (c) our research-worker is the actual customer-facing surface for the Pre-Pitch Positioning Audit deliverable.

- **Backend with vendor-specific patterns** — Run inside the research-worker but use Anthropic-specific features (e.g., `code_execution` tool for validators, prompt caching syntax, Anthropic Platform Skill `.zip` upload as a side-channel). Rejected because the moment we evaluate a different provider for cost / latency / capability, each vendor-specific pattern becomes a migration cost. ADR-0002 already removed `code_execution`; this ADR extends that principle to the deployment channel.

## Consequences

- **Distribution channel:** the research-worker is the only place Subagents run. There is no claude.ai marketplace, Skills API, or `.zip` upload distribution.
- **Runtime:** Subagents use AI SDK v6's `ToolLoopAgent` for the agent loop and `streamObject(schema)` for the structured Artifact output. Both are provider-agnostic abstractions in the AI SDK.
- **Model swap path:** to change the underlying model, update the provider config in `src/lib/ai/providers.ts` and `research-worker/src/agents/subagents/index.ts`. No skill or schema changes required. The Zod schemas describe the desired output shape, not vendor-specific tool quirks.
- **SKILL.md role:** describes the role, workflow, output shape, anti-slop rules, Card schemas, and examples for the Subagent in prose. It is loaded as system-instruction text, not as an Anthropic Platform Skill manifest. The `frontmatter.name` is internal-only — it identifies the SKILL.md to `_skill-loader.ts` and does not get registered with any external skill marketplace.
- **`platform-skills/` directory:** the existing `.zip` files (`ai-gos-buyer-icp-validation.zip`, etc.) and `upload-to-anthropic.sh` script are dead artifacts. They can be removed in a future cleanup commit. Keep the `SKILL.md`-shaped directories (unpacked) as the source of truth for skill content.
- **Authoring posture:** lean on the `streamObject` Zod enforcement layer — SKILL.md doesn't have to anticipate every malformed-output case the way a self-sufficient Anthropic Platform Skill would. The schema rejects bad shapes at the provider boundary; the runner post-validates minimums; SKILL.md is "instruction + guidance," not "self-defending program."
- **Provider-portability tax:** avoid Anthropic-specific tool patterns (no `code_execution`, no Anthropic-specific schema decorators). Stick to AI SDK v6's abstractions. Where Anthropic-specific behavior leaks in (e.g., `.min()/.max()` rejection on structured-output schemas), handle it in our runner code, not in skills.
- **Future portability:** if we later want to publish to a public marketplace (Anthropic Platform Skills, OpenAI Skills, an open registry), the existing SKILL.md files can be packaged then. They're not optimized for that path right now, but they're not blocked from it either.
