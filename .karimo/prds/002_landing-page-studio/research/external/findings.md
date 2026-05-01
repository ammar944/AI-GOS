---
title: Landing Page Studio — Consolidated External Findings
type: external-findings-consolidated
status: complete
sources: 50+ URLs (see sources.yaml) + user-supplied YouTube transcript
---

# Landing Page Studio — Consolidated External Findings

Synthesis across four external research streams plus the user-supplied 7-levels framework:
- `best-practices.md` — huashu-design audit (Agent B)  *(filename misleading — content is huashu deep read)*
- `references.md` — AI builder competitive analysis (Agent C) *(filename misleading — content is the v0/Lovable/Claude/Replit/Bolt/Framer/tldraw matrix)*
- `libraries.md` — implementation tooling (Agent D)
- `levels-framework.md` — 7-levels framework (user-supplied)

## TL;DR

The user's diagnosis — "we are not mainly missing design assets, we are missing the design system as executable product workflow" — is **correct and supported by 50+ external sources**. The fix is a 4-layer architecture proven across every winning AI design tool:

1. **BrandSpec** (logo, palette, fonts, source URLs, proof claims, inspiration screenshots) — feeds vision model
2. **Direction Planner** (3 named directions from disjoint design vocabularies) — leverages multi-variant pattern proven by v0
3. **Tweaks Contract** (cheap Ollama tool-call edits for text + Anthropic for section regen) — mirrors v0 + Lovable iteration model
4. **Persisted Preview** (Supabase Storage for HTML, sibling table for metadata, sandboxed iframe with strict CSP) — mirrors Claude Artifacts + Replit time-travel

Quality bar = visual QA (Playwright + Anthropic vision verdict on screenshots), **not just regex gates**.

## Architectural patterns to adopt (winning across all 4 streams)

| Pattern | Source | Apply to landing-page-studio |
|---|---|---|
| Sandboxed iframe for preview (NEVER inject into host DOM) | Universal — Claude Artifacts, tldraw makereal, v0, Bolt | `<iframe srcDoc sandbox="allow-scripts" referrerPolicy="no-referrer">` + strict CSP |
| Constrain stack hard (narrow solution space) | Anton Osika (Lovable interview), v0 (shadcn+Tailwind+lucide hard-pin), tldraw (Tailwind cdnjs) | Pin to vanilla HTML + Tailwind cdnjs + lucide for v1 (no React build) |
| Multi-direction first turn, single on tweak | v0 (3 variants, fork to iterate) | 3 named directions per BrandSpec; each forkable; tweaks scoped to one direction |
| Stable IDs for diff target | Lovable (Vite plugin tags JSX), Replit (auto-commit per step) | `data-section` attribute on every generated section; tweaks reference section ID |
| Post-generation AST/text pass | v0 (rewrites imports + inlines lucide SVGs) | Post-gen pass: inject CSP meta tag, inline lucide SVGs from cdnjs, normalize OKLCH |
| Forkable artifacts with persistent IDs | v0, Replit | `gtm_landing_pages.parent_id` + `direction` for fork tree UI |
| Brand Asset Protocol persisted to spec file | Huashu (rebuild as pattern, NOT code copy) | `BrandSpec` schema, persisted as artifact, referenced by direction planner |
| Direction Advisor — 3 from disjoint design schools | Huashu (Phase 0 fallback) | When BrandSpec is thin, planner offers 3 from disjoint design vocabularies |
| Anti-AI-slop checklist baked into prompt + verifier | Huashu (5-dim rubric), v0 (post-gen) | Existing `quality-gates.ts` already has 12 regex gates; add vision verdict layer |
| Side-by-side variant rendering as default UI | Huashu `design_canvas.jsx` (rebuild idea, not code) | Studio canvas shows 3 directions side-by-side before user forks one |
| Playwright `pageerror==0` gate | Huashu `verify.py` (rebuild as pattern) | Visual QA pseudocode in `libraries.md` §3 |
| Vocabulary-teaching direction names | 7-levels framework meta-insight | Each direction NAMED with recognizable design term (Editorial/Linear-Stripe, Bento/Notion-Vercel, Hero-art/Lovable-Anthropic) |
| Inspiration-screenshot ingestion | 7-levels L3 | `inspiration_screenshots` field on BrandSpec (≤10 images, vision-read by planner) |
| Site-teardown ingestion (Phase 2) | 7-levels L4 | Same Playwright instance fetches competitor HTML/CSS/JS as templating reference |
| Hero asset generation (Phase 2) | 7-levels L5 | Optional Midjourney / Nano-Banana / Veo3 hook gated on env var |

## Architectural patterns to reject

- **Per-tenant container** (Bolt's WebContainer) — brilliant infra, wasted spend for an internal-only audit tool. `<iframe srcdoc>` is sufficient.
- **AST-mutation Vite plugin for tweaks** (Lovable) — defer; ship full-section regen + free Ollama text-patch first. Revisit if tweak latency becomes the complaint.
- **Stuffing whole project into context** (Lovable explicitly stopped doing this; quality dropped). Pass only the active direction + the targeted section to a tweak call.
- **`dangerouslySetInnerHTML` for preview** — inherits app CSP; can call Clerk/Supabase. iframe-srcdoc only.
- **Pairing `sandbox="allow-scripts"` with `allow-same-origin`** — MDN explicit: iframe can null its own sandbox. Pick one.
- **Storing HTML in Postgres `text` column at scale** — 3 directions × ~200KB blows row payload sweet spot. Use Supabase Storage; row holds `storage_path`.
- **Running Playwright in a Vercel API route** — 170MB Chromium > 250MB function size cap. Railway worker only.
- **Calling `chrome-devtools-mcp` or `oh-my-claudecode:visual-verdict` from production worker code** — Claude-harness skills, not HTTP APIs. Use during prompt iteration only; production = `@ai-sdk/anthropic` directly with image inputs.
- **Wholesale import of huashu-design** — license ("Huashu Design · Personal Use License", copyright 2026 alchaincyf) explicitly prohibits B2B SaaS, company integration, and commercial-product derivatives without written authorization. Borrow patterns; rebuild from scratch; cite for inspiration only.
- **WebGL / 3D / shader-based directions** — out of reach for AI today (7-levels L7).

## Tooling decisions (from `libraries.md`)

| Area | Choice | Already installed |
|---|---|---|
| Headless render + screenshot | `playwright` core in Railway worker | NO (need install + chromium download) |
| Visual verdict | `@ai-sdk/anthropic` `generateObject` with image input | YES (`^3.0.36`) |
| Asset upload | `/api/gtm/runs/[runId]/landing-pages/assets` → Supabase Storage `landing-page-assets` bucket | YES (`@supabase/supabase-js`) |
| Color palette | LLM vision (no library — `node-vibrant` unmaintained, `colorthief` adds native bindings) | n/a |
| Existing-site screenshot ingestion | Same Playwright instance | (above) |
| Iframe sandbox | Native `<iframe srcDoc sandbox="allow-scripts" referrerPolicy="no-referrer">` | YES |
| Tailwind composition | Raw HTML/CSS for the artifact (existing `skills/landing-page/templates/` pattern); shadcn only for studio chrome | YES |

Schema draft for `gtm_landing_pages` (sibling to `gtm_artifacts`, HTML in Storage, palette/qa_report/screenshot_urls in jsonb) is in `libraries.md` §2.

## Provider routing alignment

Per the 2026-05-01 update to `.claude/rules/ai-sdk-patterns.md`:
- Lighthouse skill bodies route through `generateGtmSkillObject()` in `src/lib/gtm/skill-object.ts` → resolves model via `getGtmSkillLanguageModel()` in `src/lib/gtm/skill-model.ts`. Default = Ollama `deepseek-v4-flash:cloud`.
- Per-skill fallback to Anthropic is permitted when Ollama exhibits schema drift or weak citation discipline.

**Studio recommendation**:
- **Direction planner** (vision-read of inspiration screenshots → 3 named directions): route through `generateGtmSkillObject` (default Ollama) for the planning text; fall back to Anthropic Sonnet vision if Ollama can't reliably read images.
- **HTML generation per direction** (high-quality, costs <$0.10/page at Sonnet): use the per-skill fallback exemption — `anthropic(MODELS.CLAUDE_SONNET)` directly with `generateText` (matches existing `skills/landing-page/scripts/generate.ts` pattern).
- **Tweak `patch_text`** (free, fast): Ollama via existing `patch_artifact` infra.
- **Tweak `regen_section`** (paid, quality-critical): Anthropic Sonnet, scoped to one section's HTML + the tweak request.
- **Visual QA verdict** (paid but cheap, ~$0.005/screenshot): Anthropic Haiku or Sonnet vision via `generateObject`.

## Five concrete recommendations for PRD scope

1. **3-direction planner first turn, single forked direction on tweak.** Each direction NAMED with a design vocabulary anchor. Defaults to a fixed taxonomy (Editorial / Bento / Hero-art / Brutalist / Eastern-typographic) + 1-2 user-supplied if competitor URL is provided.
2. **`<iframe srcDoc sandbox="allow-scripts">` + strict CSP injected into generated HTML head.** `connect-src 'none'` is the QA tripwire that surfaces hallucinated `fetch()` calls as console errors.
3. **Explicit BrandSpec form** with logo URL + hex pair + font pair + hero copy + proof claims + inspiration screenshots (≤10). Persists as its own artifact; referenced by the direction planner. Phase 2 adds `competitor_urls` (site-teardown ingestion) and `generate_hero_art` toggle.
4. **Two-tool tweak contract:** `patch_text` (Ollama, free, per `ai-sdk-patterns.md`) + `regen_section` (Anthropic, paid). Mirrors v0's regen + post-gen split.
5. **Sibling `gtm_landing_pages` table with `parent_id` for fork tree.** HTML in Supabase Storage `landing-page-assets/<run_id>/<id>/index.html`, palette / qa_report / screenshot_urls in jsonb columns. Schema in `libraries.md` §2.

## Open questions blocking implementation

(From `libraries.md` §6 + this consolidation pass)

1. **Worker dispatch for Playwright** — does `src/lib/gtm/dispatch-skill.ts` already have a Railway hook for non-skill jobs (screenshots), or do we add a new `RAILWAY_LANDING_PAGE_URL` env var?
2. **Playwright on Railway** — does the current image support pre-installed Chromium, or do we need a custom Dockerfile?
3. **Asset CSP** — if users paste screenshots of their existing site, those `https:` URLs are allowed by `img-src https:` but loosens the model. Confirm signed-URL approach is acceptable.
4. **Reuse vs sibling table** — alternative is one row in `gtm_artifacts` with `skill='landing-page'` + metadata-encoded HTML pointer. PRD owner pick.
5. **Direction-planner model choice** — vision-capable Anthropic Sonnet (paid) for inspiration-screenshot reading vs Haiku (cheaper) without vision? Affects cost per direction.
6. **Image-gen API choice (Phase 2)** — Midjourney (no public API), Nano-Banana, Veo3, Replicate-hosted SDXL? Cheapest reliable path for hero art generation.

## File map

- `internal/findings.md` — Agent A: codebase audit (current skill, GTM integration points, storage reality, design system inventory, provider menu, 10 concrete gaps)
- `external/best-practices.md` — Agent B: huashu-design deep read (repo structure, license verbatim, 12-row pattern catalog, generation model)
- `external/references.md` — Agent C: AI builder competitive matrix (Lovable / v0 / Bolt / Claude Artifacts / Replit / Framer / tldraw)
- `external/libraries.md` — Agent D: implementation tooling (Playwright + vision verdict + Storage decisions, schema draft, QA pseudocode, sandbox config, anti-patterns, open questions)
- `external/levels-framework.md` — User-supplied: 7-levels framework, MVP/Phase 2/defer mapping
- `external/findings.md` — this file (consolidated external view)
- `external/sources.yaml` — 50+ URLs + transcript citation
- `internal/agent-a-draft-spec.md` — Agent A also drafted a 3-phase implementation spec (out of research scope; preserved as reference for `/karimo:plan`)

## Sources

50+ URLs + the YouTube transcript. See `sources.yaml`. Load-bearing references:

- **Huashu**: `https://raw.githubusercontent.com/alchaincyf/huashu-design/master/LICENSE` — verbatim quote in `best-practices.md` §2
- **Lovable Visual Edits** AST-diff mechanism: `https://lovable.dev/blog/visual-edits`
- **v0 reverse engineering** post-gen AST pass: `https://dev.to/yuyz0112/how-i-reverse-engineered-vercels-v0dev-prompt-and-code-optimization-logic-2cli`
- **v0 system prompt leak** index: `https://simonwillison.net/2024/Nov/25/leaked-system-prompts-from-vercel-v0/`
- **Claude Artifacts** iframe + postMessage architecture: `https://www.reidbarber.com/blog/reverse-engineering-claude-artifacts`
- **tldraw makereal**: `https://tldraw.dev/blog/make-real-the-story-so-far`
- **Replit Agent multi-agent** breakdown: `https://www.langchain.com/breakoutagents/replit`
- **7-levels framework** (user-supplied): `https://www.youtube.com/watch?v=1PXFAFMgdns`

## Caveats on the evidence files

Agents B and C swapped output paths during research:
- `external/best-practices.md` actually contains the **huashu deep read** (Agent B's output)
- `external/references.md` actually contains the **competitive matrix** (Agent C's output)

Findings consolidated in this file are content-correct regardless of which evidence file they came from. Filenames retained as-written to preserve research-trail provenance and avoid breaking citations in commits.
