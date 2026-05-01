---
title: Landing Page Studio — Research Summary
type: research-summary
status: complete
prd_slug: landing-page-studio
research_date: 2026-05-01
---

# Landing Page Studio — Research Summary

**PRD slug:** `landing-page-studio`
**Research date:** 2026-05-01
**Scope:** Lovable / Claude-artifacts-tier landing page studio integrated with the GTM run pipeline. Replaces (extends, not deletes) the prompt-only `skills/landing-page` surface.
**Methodology:** 4-agent parallel research team (1 internal codebase scan, 3 external streams) + user-supplied 7-levels framework mid-research.

## The user was right

> "We are not mainly missing 'design assets.' We are missing the design system as executable product workflow."

Confirmed by:
- **Codebase audit** (`internal/findings.md`): no executable design system exists; "Huashu / Impeccable / Taste / UIUXProMax" are inline prompt strings only — Huashu is loaded as a flat reference file but not parameterized; Impeccable + UIUXProMax don't exist in the repo at all; Taste is an 8-option CLI flag string.
- **Competitive analysis** (`external/references.md`): every winning AI design tool (Lovable, v0, Bolt, Claude Artifacts, Replit Agent, Framer AI, tldraw makereal) runs the same 4-layer architecture: brand-spec → direction planner → preview sandbox → iteration loop.
- **7-levels framework** (`external/levels-framework.md`): same insight from the user-facing side — the gap from L1 (prompt-only) to L5 (designer with custom assets) is workflow + inputs + iteration tools, not "more taste words in the prompt."

## What's already in the repo (don't rebuild)

- **Functional landing-page skill** at `skills/landing-page/` — 2,012-word system prompt, hard-fail QA gates, two API surfaces (`/api/landing-page/run` + `/api/landing-page/generate`), CLI runner. Single-prompt single-call architecture.
- **12 regex/string QA gates** in `src/lib/ai/landing-page/quality-gates.ts` covering: semantic HTML, OKLCH, focus states, reduced motion, responsive CSS, touch targets, Inter guard, mobile-nav overflow, generic-SaaS copy, placeholder labels, fake-proof guard, product-artifact requirements.
- **GTM artifact infrastructure**: `gtm_artifacts` table (versioning, RLS, FK to runs), dispatch skill router (`src/lib/gtm/dispatch-skill.ts`), orchestrator tool surface (`src/lib/gtm/orchestrator-tools.ts`), ChatShell + ArtifactCanvas UI shell.
- **shadcn/ui + Tailwind v4 + Radix UI**: 34 shadcn components, OKLCH-based design tokens (`DESIGN.md`, locked 2026-04-17).
- **AI provider menu** (`src/lib/ai/providers.ts`): Anthropic (Haiku / Sonnet / Opus), Perplexity (Sonar Pro), Ollama (deepseek-v4-flash, default for skill bodies + orchestrator + `patch_artifact` per `ai-sdk-patterns.md`).

## What's not in the repo (the studio scope)

1. Skill not registered in `dispatch-skill.ts` (currently only the 5 lighthouse skills).
2. No `BrandSpec` schema in `src/lib/gtm/contracts/`.
3. No `gtm_landing_pages` table (sibling to `gtm_artifacts` recommended).
4. No Supabase Storage bucket for binary brand assets (logos, screenshots, hero art).
5. No Playwright in either `package.json` or `research-worker/package.json`.
6. No iframe preview component for HTML artifacts (ArtifactCanvas renders markdown only).
7. No vision-model integration for visual QA (Anthropic vision in providers.ts but not wired into a verdict loop).
8. No direction planner — current skill is one-shot single output.
9. No tweak contract — orchestrator's `patch_artifact` is markdown-only.
10. No site-teardown / inspiration-screenshot ingestion path.

## The 4-layer architecture (consensus across all research)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. BrandSpec                                                     │
│    logo, palette, fonts, hero copy, proof claims,                │
│    inspiration_screenshots, optional competitor_urls             │
│    → persisted as a gtm_artifacts row, FK from gtm_landing_pages │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Direction Planner                                             │
│    3 named directions from disjoint design vocabularies          │
│    (e.g. "Editorial / Linear-Stripe", "Bento / Notion-Vercel",   │
│    "Hero-art / Lovable-Anthropic")                               │
│    → user picks one; each is forkable; chosen direction          │
│      becomes the parent of subsequent versions                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Generation                                                    │
│    Anthropic Sonnet (default) or Opus (deep mode), single-file   │
│    HTML + Tailwind cdnjs + lucide inlined; post-gen pass injects │
│    CSP meta tag and normalizes OKLCH                             │
│    → HTML to Supabase Storage; row to gtm_landing_pages          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Visual QA + Preview                                           │
│    Railway worker: Playwright render → desktop+mobile screenshot │
│    → Anthropic vision verdict → block external network via CSP   │
│    Studio UI: <iframe srcDoc sandbox="allow-scripts"             │
│      referrerPolicy="no-referrer">                               │
│    Tweak contract: patch_text (Ollama, free) +                   │
│      regen_section (Anthropic, paid)                             │
└─────────────────────────────────────────────────────────────────┘
```

## Files in this research folder

- `internal/findings.md` — codebase audit (Agent A)
- `internal/agent-a-draft-spec.md` — Agent A also drafted a 3-phase implementation spec; preserved as reference for `/karimo:plan` (out of research scope)
- `external/best-practices.md` — huashu-design audit (Agent B; filename misleading — content is the huashu deep read incl. license verbatim)
- `external/references.md` — AI builder competitive matrix (Agent C; filename misleading — content is the v0/Lovable/Claude/Replit/Bolt/Framer/tldraw matrix)
- `external/libraries.md` — implementation tooling (Agent D)
- `external/levels-framework.md` — 7-levels framework (user-supplied YouTube transcript)
- `external/findings.md` — consolidated external view (source of truth)
- `external/sources.yaml` — 50+ URLs + transcript citation

## Recommended next action

```
/karimo:plan --prd landing-page-studio
```

The plan agent will:
1. Read `summary.md`, `internal/findings.md`, `external/findings.md` as primary inputs
2. Conduct the 5-round interview informed by this research
3. Rename folder to `NNN_landing-page-studio` and create `PRD_landing-page-studio.md` + `tasks.yaml`
4. Resolve the 6 open implementation questions with the user

## Six questions to resolve in plan

1. **Worker dispatch for Playwright** — new env var (`RAILWAY_LANDING_PAGE_URL`) or extend existing dispatch?
2. **Playwright on Railway** — image support; do we need a custom Dockerfile?
3. **Asset CSP** — loosen `img-src` for user-supplied screenshots — signed URLs sufficient?
4. **Storage strategy** — sibling `gtm_landing_pages` table or extend `gtm_artifacts` metadata?
5. **Direction-planner model** — vision-capable Sonnet (paid) for inspiration-screenshot ingest, or Haiku (cheaper, no vision) with screenshot OCR fallback?
6. **Image-gen API for hero art (Phase 2)** — Midjourney (no public API), Nano-Banana, Veo3, Replicate-hosted SDXL? Cheapest reliable path?

## Resource accounting

- **Research time:** ~12 minutes wall-clock (4 agents in parallel)
- **Tool calls:** ~120 across all agents (within combined budget)
- **External URLs fetched:** 50+ unique sources (no Firecrawl loops; WebFetch + WebSearch only)
- **No source code edited.** Research artifacts only.

## Note on the premature `PRD.md`

Agent A wrote a `PRD.md` at the folder root unprompted (out of research scope; `/karimo:plan` owns the canonical NNN-prefixed PRD). Moved to `internal/agent-a-draft-spec.md` to preserve the content as research evidence without confusing the next stage. The KARIMO spec is explicit: "Create `.karimo/prds/{slug}/` (no NNN prefix yet — plan adds it)."
