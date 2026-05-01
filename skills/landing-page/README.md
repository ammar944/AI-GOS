> [!WARNING]
> **This skill is deprecated.** Use [`skills/landing-page-studio/`](../landing-page-studio/) instead.
> The new skill supports multiple directions, a structured BrandSpec, and a full CLI with plan/generate/full/tweak-text/tweak-regen subcommands.
> This folder will not receive updates. See the [migration guide](../landing-page-studio/README.md) for details.

# Landing Page Skill — README

Generate production-ready landing pages with one command. Combines 20 design philosophies (Huashu), 18 Impeccable audit rules, 8 Taste Skill flavors, and 60+ brand design systems.

## Quick Start

```bash
# From the AI-GOS project root
npm run landing-page -- "Your product description here"

# Deep mode (uses Opus for higher quality)
npm run landing-page:deep -- "Your product description" --style soft

# Equals syntax is also supported
npm run landing-page -- "Your product description" --style=soft

# List generated pages
npm run landing-page:list
```

## Usage

```bash
npm run landing-page -- "A real estate wholesaling CRM called DealFlow"
npm run landing-page -- "A luxury skincare brand called Lumina for women 30+" --style=minimalist
npm run landing-page:deep -- "An AI coding assistant called CodeCraft for enterprise teams" --style brutalist
```

## Design Philosophy Options

### Information Architecture School
- `pentagram` — Swiss grid, typography as language, 60% whitespace
- `stamen` — Warm data viz, cartographic, organic patterns
- `info-architects` — Content-first, system fonts, blue hyperlinks
- `fathom` — Data narrative, editorial precision

### Motion Poetics School
- `locomotive` — Smooth scrolling, parallax depth, cinematic
- `active-theory` — WebGL, generative, immersive
- `field-io` — Motion-driven, dynamic type, rhythm-first
- `resn` — Digital maximalism, surreal interactions

### Minimalism School
- `experimental-jetset` — Typographic minimalism, Helvetica-only
- `muller-brockmann` — Mathematical grid, object poster style
- `build` — Brutalist minimalism, raw typography
- `kenya-hara` — Eastern minimalism, emptiness as substance

### Experimental School
- `sagmeister` — Bold, provocative, hand-crafted
- `zach-lieberman` — Generative art, code as craft
- `ash-thorp` — Cyberpunk, neon-noir, cinematic
- `territory` — Sci-fi UI, futuristic

### Eastern Philosophy School
- `takram` — Design engineering, poetic technology
- `irma-boom` — Book arts, material-first
- `neo-shen` — Chinese ink aesthetic, negative space

## Taste Flavor Options

- `taste` — Default, high-agency, anti-slop
- `minimalist` — Warm monochrome, invisible motion, editorial restraint
- `brutalist` — Zero radius, CRT terminals, ASCII decoration
- `soft` — $150k agency-tier, double-bezel cards, macro-spaces
- `gpt-taste` — Awwwards GSAP scroll, gapless bento, pinnable sections

## Output

Generated pages are saved to `skills/landing-page/output/` and automatically opened in your browser.

Each generation also saves a `.response.txt` file with the full model response for debugging.

The CLI uses the same hard quality gates as the app API. Failed output is still saved for debugging, but the command exits non-zero.

## Integration With AI-GOS Journey

The landing page skill can be wired into the Journey chat as an additional tool:

```typescript
import { generateLandingPage } from '@/lib/ai/tools/generate-landing-page';
import { LANDING_PAGE_SYSTEM_PROMPT } from '@/lib/ai/prompts/landing-page-system';

// Add to existing streamText tools
streamText({
  tools: {
    ...existingTools,
    generateLandingPage,
  },
});
```

Use the deterministic local-agent API for Codex/local agents:

```bash
curl -X POST http://localhost:3000/api/landing-page/run \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A meditation app called Mindful that sends daily 10-min sessions",
    "mode": "saas-product",
    "preferred_style": "soft",
    "source_facts": []
  }'
```

`/api/landing-page/run` returns JSON with `success`, `file_path`, `html_size`, `qa_report`, `failed_gates`, and `source_facts_used`. It returns HTTP 422 when hard gates fail.

Keep `/api/landing-page/generate` for interactive streaming chat/UI flows.

## Anti-Slop Guardrails (auto-checked)

Every generated page is automatically scanned for:
- ❌ Purple gradients
- ❌ Inter/Roboto fonts as display
- ❌ Emoji as icons
- ❌ Side-stripe borders on cards
- ❌ Gradient text (background-clip)
- ❌ Generic AI filler words
- ❌ Placeholder product artifacts
- ❌ Fake or unsourced proof
- ❌ Missing product artifact
- ❌ Missing responsive/focus/touch-target/reduced-motion basics
- ❌ Mobile nav overflow risk

## Prerequisites

- Node.js 18+
- ANTHROPIC_API_KEY in .env.local
- AI-GOS project installed and running

## Cost Estimates

- Standard mode (Sonnet): ~$0.05-0.15 per page
- Deep mode (Opus): ~$0.30-0.75 per page
