---
title: Landing Page Studio — Scope Decisions (locked before /karimo:plan)
type: scope-lock
status: locked
locked_date: 2026-05-01
locked_by: ammar
---

# Landing Page Studio — Scope Decisions

This file is a **durable input for `/karimo:plan --prd landing-page-studio`**. It captures scope decisions made between research and planning so they don't drift if conversation context clears. The plan stage reads this as a primary constraint.

## Goal bar

> "Catering 1000 different SaaS companies and creating landing pages for them."

The MVP must **generalize** across 1000+ SaaS companies, not produce a single peak-quality landing page. Generalization beats peak quality. "Good landing page across the long tail" beats "stunning landing page for one company."

## Locked MVP (this is what ships first)

1. **BrandSpec** — schema + form. Fields:
   - Logo URL (string)
   - Palette (2 hex codes — primary + accent)
   - Font pair (display + body, from a curated Google Fonts allowlist)
   - Hero copy (headline + subheadline + CTA label)
   - Proof claims (array of `{ claim: string, source_url: string }`)
   - Inspiration screenshots (≤10, optional, file uploads to Supabase Storage)
   - Sections to include (multi-select from existing 11-section arsenal in `skills/landing-page/prompts/system.md`)

2. **Direction Planner** — generates **3 named directions** from a fixed design-vocabulary taxonomy:
   - Editorial / Linear-Stripe
   - Bento / Notion-Vercel
   - Hero-art / Lovable-Anthropic
   - Brutalist / Are.na
   - Eastern-typographic / Kenya-Hara
   - (~15 total in the taxonomy; planner picks 3 disjoint per BrandSpec)

   Vocabulary names are load-bearing — users learn design terms by selection (per `external/levels-framework.md` meta-insight).

3. **Generation per direction** — Anthropic Sonnet (per-skill Anthropic fallback exemption in `ai-sdk-patterns.md`), single-file HTML + Tailwind via cdnjs + lucide SVGs inlined. Reuses the existing `skills/landing-page/prompts/system.md` as the base; layered with direction-specific style guidance.

4. **Post-generation pass** (deterministic, no LLM call):
   - Inject CSP `<meta>` into `<head>`: `default-src 'self' data: blob:; script-src 'unsafe-inline'; style-src 'unsafe-inline' 'self'; img-src 'self' data: https:; connect-src 'none'; frame-ancestors 'self'`
   - Normalize OKLCH color values
   - Inline lucide SVGs from cdnjs whitelist

5. **Preview iframe** — `<iframe srcDoc sandbox="allow-scripts" referrerPolicy="no-referrer">`. NEVER pair `allow-same-origin` with `allow-scripts` (MDN: iframe escape).

6. **Mobile overflow client-side check** (NEW in this scope lock — replaces Playwright). Studio canvas component runs:
   ```ts
   // pseudo
   const overflow375 = await measureScrollWidthAt(375);
   const overflow1440 = await measureScrollWidthAt(1440);
   if (overflow375 > 375) showWarning("Mobile overflow detected at 375px");
   ```
   Runs in the user's browser via the iframe parent — no worker, no Playwright, no Railway change. Catches ~80% of mobile-breakage Playwright would catch. Warning chip only; non-blocking.

7. **QA gates** — existing 12 regex gates from `src/lib/ai/landing-page/quality-gates.ts`. No vision verdict, no screenshot capture. User is the visual QA via the iframe preview. The CSP `connect-src 'none'` tripwire surfaces hallucinated `fetch()` calls as console errors the user sees in browser DevTools.

8. **Tweak contract** — two tools the orchestrator can call:
   - `patch_text` — Ollama (free, fast). Textual edits to a section's HTML.
   - `regen_section` — Anthropic Sonnet (paid). Re-generates one section given the BrandSpec, direction, section ID, and tweak request.

9. **Persistence** — sibling `gtm_landing_pages` table OR extend `gtm_artifacts` metadata. **OPEN — see Q4 below.** HTML body in Supabase Storage either way (NOT in a Postgres `text` column at scale).

## What's cut (won't be in MVP)

These were in research but explicitly scoped out:

- ❌ **Playwright headless render + screenshot capture in Railway worker** (was research Q1+Q2). Defer indefinitely. The CSP tripwire + browser-side overflow check + user-as-visual-QA cover the bar at MVP scale.
- ❌ **Anthropic vision verdict on rendered screenshots** (was part of `libraries.md` §3 pseudocode). No vision model in QA loop. Vision is still used in #2 above (direction planner reads inspiration_screenshots).
- ❌ **Hero asset image generation** — Midjourney / Nano-Banana / Veo3 / Replicate-SDXL (was research Q6). No third-party image-gen API integration. Hero is plain HTML/CSS/inline-SVG/lucide.

Cuts justified by: simplicity-first, must ship before adding complexity, must generalize across 1000+ SaaS companies (peak-quality features defer until the long-tail base case is solid).

## Deferred-but-on-roadmap (Phase 2)

Keep visible in `tasks.yaml` as future work; do not delete from research:

- 🟡 **Site-teardown ingestion** — paste a competitor URL → fetch HTML/CSS/JS → feed to direction planner as templating reference. Per `external/levels-framework.md` L4. Adds Playwright dependency (in worker), so naturally bundles with any future visual-QA work.
- 🟡 **Hero asset generation** — Midjourney / Veo3 / Nano-Banana hook gated on env var. Per `external/levels-framework.md` L5.
- 🟡 **Video hero with mobile fallback** — Veo3/Kling 15s subtle-motion loop, `<video>` desktop + still image mobile via `<picture>`. Per `external/levels-framework.md` L5.
- 🟡 **Visual QA loop** — Playwright in Railway worker + Anthropic vision verdict. Bundled with site-teardown if/when we add Playwright. Per `external/libraries.md` §3.
- 🟡 **AST-mutation tweak path** — Lovable-style stable JSX IDs + selective AST mutation for tweaks (faster than `regen_section`). Per `external/references.md` row 1.

## Defer indefinitely

- ⛔ **WebGL / 3D / shader-based directions** — out of reach (7-levels L7).
- ⛔ **Stitch / Figma round-trip export** — nice-to-have, never load-bearing.
- ⛔ **Wholesale import of huashu-design** — license blocks B2B SaaS integration. Patterns only, rebuilt from scratch. Permanent rule, not a Phase 2.

## Open questions for /karimo:plan

After the cuts, three of the original six open questions remain plus one new one:

1. **Q3 (was open) — Asset CSP loosening for user screenshots.** Inspiration screenshots are uploaded to Supabase Storage; the iframe's CSP `img-src 'self' data: https:` allows them. Confirm signed-URL approach is acceptable, or restrict to specific Supabase Storage origin only.

2. **Q4 (was open) — Storage strategy.** Sibling `gtm_landing_pages` table (per `libraries.md` §2 schema draft) **OR** extend `gtm_artifacts` with `metadata.html_storage_path` + `metadata.direction` + `metadata.parent_id`. Sibling table is cleaner; extension is less migration. Plan owner picks.

3. **Q5 (was open) — Direction-planner model.** Inspiration screenshots are vision input. Options:
   - Anthropic Sonnet vision (paid, ~$0.003/screenshot, reliable)
   - Anthropic Haiku without vision (cheaper but no screenshot ingestion — falls back to BrandSpec only)
   - Default Ollama via `generateGtmSkillObject` for the planning text + Sonnet vision only when `inspiration_screenshots` is non-empty (hybrid; minimizes paid call surface)

4. **Q7 (NEW) — Skill folder layout.** Per CLAUDE.md v3 skill-first architecture, this is a skill. Three options:
   - **Extend `skills/landing-page/`** — preserve history, add BrandSpec/Direction/Tweaks/Preview layers as new files within. Risk: confusion about "old vs new" until migration completes.
   - **New `skills/landing-page-studio/` + deprecate old skill** — clean slate. Most aligned with skill-first principle (each skill self-contained, will publish as own repo).
   - **Refactor in place: rename `skills/landing-page/` → `skills/landing-page-studio/`** — clean continuity. Risk: breaks any external callers of the old path.

   Plan owner picks. Bias: option 2 (new skill) per skill-first portability rule.

## What `/karimo:plan` should NOT re-ask

These are locked. Don't re-litigate:

- The 4-layer architecture (BrandSpec → Direction Planner → Generation → Preview)
- Tailwind via cdnjs + lucide inlined + single-file HTML output
- `<iframe srcDoc sandbox="allow-scripts">` with strict CSP
- Anthropic Sonnet for HTML generation (per-skill exemption in `ai-sdk-patterns.md`)
- 3 directions per BrandSpec, named with design-vocabulary anchors
- 12 existing regex QA gates (no Playwright, no vision verdict in MVP)
- `patch_text` (Ollama) + `regen_section` (Anthropic) tweak contract
- Mobile overflow client-side check (replaces Playwright at MVP scale)
- License-blocked huashu code/assets — patterns only, rebuilt from scratch

## References

- Research summary: `research/summary.md`
- Codebase audit: `research/internal/findings.md`
- External findings: `research/external/findings.md`
- Huashu deep read: `research/external/best-practices.md`
- Competitive matrix: `research/external/references.md`
- Implementation tooling: `research/external/libraries.md`
- 7-levels framework: `research/external/levels-framework.md`
- All sources (51): `research/external/sources.yaml`
