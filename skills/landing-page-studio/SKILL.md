---
name: landing-page-studio
description: Use when generating landing page HTML for SaaS products from a BrandSpec, picking design directions (editorial / bento / hero-art / brutalist / eastern-typographic), rendering 3 HTML variants, or tweaking a generated landing page section. Produces single-file HTML + Tailwind cdnjs + lucide inline. Output goes to output/<run-id>/html/.
---

# Landing Page Studio

Generates 3 styled, on-brand HTML landing pages from a `BrandSpec` input, each expressing a distinct design direction chosen from a 15-direction vocabulary taxonomy. Supports full pipeline execution, plan-only, render-only, and iterative section tweaking.

## Inputs

**BrandSpec** — a JSON object validated against `contracts/brand-spec.ts`:

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `brandName` | Yes | string | Company or product name |
| `tagline` | Yes | string | One-line positioning statement |
| `primaryColor` | Yes | string | Hex color, e.g. `#1A2B3C` |
| `accentColor` | Yes | string | Hex accent color |
| `voice` | Yes | enum | `professional` / `playful` / `bold` / `minimal` / `warm` |
| `direction` | Yes | string | Direction key from `references/directions.json` |
| `industry` | Yes | string | Industry/vertical, e.g. `B2B SaaS` |
| `targetAudience` | Yes | string | Brief ICP description |
| `keyBenefit` | Yes | string | Primary value proposition (one sentence) |
| `cta` | Yes | string | CTA button text, e.g. `Start free trial` |
| `logoUrl` | No | string | URL to logo asset |
| `customInstructions` | No | string | Free-text generation override |

See `example/brief.json` for a complete validated example.

## Outputs

```
output/<run-id>/
  directions.json              # 3 selected directions with rationale (from Ollama)
  brand-spec.json              # Copy of BrandSpec used
  html/
    direction-A.html           # Direction A — complete self-contained HTML
    direction-B.html           # Direction B
    direction-C.html           # Direction C
    direction-A.gen.json       # Generation log (model, tokens, ms)
    direction-B.gen.json
    direction-C.gen.json
```

Each HTML file is:
- Single-file, self-contained (Tailwind via cdnjs CDN, Lucide icons inline SVG)
- CSP meta tag injected
- All colors in OKLCH format
- `data-section` attributes on every major section (for tweaking)

## Pipeline Architecture

```
BrandSpec JSON
      │
      ▼
[1] plan-directions.ts  ──► Ollama (free)
      │                     Picks 3 disjoint directions from 15-direction taxonomy
      │                     Output: output/<run>/directions.json
      ▼
[2] generate-html.ts ×3 ──► Anthropic Sonnet (per-skill exemption)
      │                     Generates one full HTML page per direction
      │                     Output: output/<run>/html/direction-{A,B,C}.html
      ▼
[3] post-process.ts     ──► Deterministic (no LLM)
      │                     CSP injection + OKLCH normalization + Lucide CDN removal
      ▼
[4] quality-gates.ts    ──► Deterministic (12 regex gates)
      │                     Validates HTML against structural + copy quality rules
      ▼
[5a] patch-text.ts      ──► Ollama (free) — text-only copy tweaks
[5b] regen-section.ts   ──► Anthropic Sonnet — full section regeneration
```

LLM calls: steps 1 (Ollama), 2 (Anthropic ×3), 5a (Ollama), 5b (Anthropic).
Deterministic steps: 3, 4.

## Subcommands (CLI Interface)

```bash
# Full pipeline: plan + generate all 3 HTML variants
npx tsx scripts/generate.ts full --brand <path> --run <run-id>

# Plan only: pick 3 directions, write directions.json (no HTML)
npx tsx scripts/generate.ts plan --brand <path> --run <run-id>

# Render one direction from existing plan
npx tsx scripts/generate.ts generate --run <run-id> --direction <A|B|C>

# Tweak copy in a section without regenerating layout (Ollama, free)
npx tsx scripts/generate.ts tweak-text \
  --run <run-id> --direction <A|B|C> \
  --section <section-name> --instruction "<text>"

# Regenerate one section with Anthropic Sonnet
npx tsx scripts/generate.ts tweak-regen \
  --run <run-id> --direction <A|B|C> \
  --section <section-name> [--instruction "<text>"]
```

The `full` subcommand is idempotent: if `directions.json` already exists in the run directory, it skips planning and re-renders from the existing plan.

## Invocation

**Via CLI (any agent or shell):**
```bash
npx tsx skills/landing-page-studio/scripts/generate.ts full \
  --brand path/to/brand-spec.json \
  --run my-run-001
```

**Via slash command (Claude Code interactive only):**
```
/landing-page-studio path/to/brand-spec.json
```

## Environment Variables

| Variable | Required For | Purpose |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | `generate`, `full`, `tweak-regen` | Anthropic Sonnet HTML generation |
| `OLLAMA_API_KEY` | `plan`, `full`, `tweak-text` | Ollama cloud direction planning |

Local Ollama (no `OLLAMA_API_KEY`): point `OLLAMA_BASE_URL` at your local instance.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | User error — bad args, missing required flag, file not found |
| 2 | Pipeline step failure — one of the underlying scripts returned non-zero |
| 3 | Missing environment variable — set `ANTHROPIC_API_KEY` or `OLLAMA_API_KEY` |

## Design Direction Taxonomy

15 directions across 5 disjoint families. The direction planner picks 3 from different families per BrandSpec run:

| Family | Directions |
|--------|-----------|
| Editorial | editorial-linear-stripe, editorial-stripe-press, editorial-apple-newsroom |
| Bento | bento-notion-vercel, bento-vercel-edge, bento-linear-cards |
| Hero-art | hero-art-lovable-anthropic, hero-art-anthropic-claude, hero-art-vercel-ai |
| Brutalist | brutalist-arena, brutalist-bold-sans, brutalist-mono-grid |
| Eastern-typographic | eastern-kenya-hara, eastern-muji-editorial, eastern-tokyo-type |

Full taxonomy: `references/directions.json`. Human-readable docs: `references/directions.md`.

## Quality Gates (12 Vendored Gates)

The QA runner (`scripts/quality-gates.ts`) checks every generated HTML for:

1. `missing_semantic_html` — `<header>`, `<nav>`, `<main>`, `<footer>` present
2. `missing_oklch_colors` — oklch() color syntax used
3. `missing_focus_states` — `:focus-visible` or `:focus` styles present
4. `missing_reduced_motion` — `prefers-reduced-motion` media query if animations used
5. `missing_responsive_css` — `@media` queries present
6. `missing_touch_targets` — `min-height: 44px` on interactive elements
7. `inter_as_display_or_global_font` — Inter not used as global display font
8. `mobile_nav_overflow_risk` — nav links not overflow-scrolled
9. `generic_saas_copy` — no banned filler words (seamless, unlock, etc.)
10. `placeholder_product_artifact` — no Lorem ipsum or Dashboard placeholder text
11. `fake_or_unverified_proof` — no famous logo strips without sourced facts
12. `missing_product_artifact` — product-specific terminology present

## Limitations (v1)

- Does not deploy to any hosting provider — HTML output only
- Does not generate images, illustrations, or hero assets
- Does not integrate with Figma or export design tokens
- Does not support multi-page sites — single-page HTML only
- Does not support non-SaaS page types in v1 (ecommerce, portfolio, etc.)
- Inspiration screenshots accepted as text descriptions in `customInstructions` only
- Playwright-based visual QA deferred to Phase 2

## How an Agent Uses This Skill

**Flow 1 — Generate from scratch:**
```
1. Collect or create BrandSpec JSON
2. Run full pipeline: npx tsx scripts/generate.ts full --brand <spec> --run <id>
3. Report output/<run-id>/html/ paths to user
```

**Flow 2 — Tweak existing output:**
```
1. User selects direction (A, B, or C) from a previous run
2. Copy change → tweak-text (Ollama, free)
3. Layout change → tweak-regen (Anthropic Sonnet)
```

**Flow 3 — Re-render from existing plan:**
```
1. directions.json already exists from previous plan run
2. npx tsx scripts/generate.ts generate --run <id> --direction A
3. Skips LLM planning — uses existing direction selection
```
