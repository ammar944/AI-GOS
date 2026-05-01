# Landing Page Studio

Generates 3 styled, on-brand HTML landing pages from a BrandSpec — each expressing a distinct design direction — with built-in QA gates and iterative tweak tools.

## Prerequisites

- Node.js 18+
- `ANTHROPIC_API_KEY` environment variable (required for `generate` and `tweak-regen`)
- `OLLAMA_API_KEY` environment variable (required for `plan` and `tweak-text` via Ollama cloud)

## Quickstart

```bash
# 1. Install dependencies
cd skills/landing-page-studio
npm install

# 2. Create your BrandSpec
cp example/brief.json my-brand.json
# Edit my-brand.json with your company details

# 3. Generate 3 landing page variants
npx tsx scripts/generate.ts full --brand my-brand.json --run my-run-001

# 4. Open your pages
open output/my-run-001/html/direction-A.html
open output/my-run-001/html/direction-B.html
open output/my-run-001/html/direction-C.html
```

## Subcommands

<!-- TODO: verify subcommand flags against T10 (generate.ts) after it ships -->

| Command | Description |
|---------|-------------|
| `full` | End-to-end: plan 3 directions + generate all 3 HTML variants |
| `plan` | Pick 3 disjoint directions from the taxonomy (no HTML generation) |
| `generate` | Render HTML for one direction from an existing plan |
| `tweak-text` | Edit copy in a section without regenerating layout (Ollama, free) |
| `tweak-regen` | Regenerate one section with a new instruction (Anthropic Sonnet) |

## BrandSpec Fields

| Field | Required | Description |
|-------|----------|-------------|
| `brandName` | Yes | Company or product name |
| `tagline` | Yes | One-line positioning statement |
| `primaryColor` | Yes | Hex color code, e.g. `#1A2B3C` |
| `accentColor` | Yes | Hex accent color code |
| `voice` | Yes | Tone: `professional`, `playful`, `bold`, `minimal`, `warm` |
| `direction` | Yes | Direction key from the taxonomy (see `references/directions.json`) |
| `industry` | Yes | Industry/vertical, e.g. `SaaS`, `ecommerce` |
| `targetAudience` | Yes | Brief ICP description |
| `keyBenefit` | Yes | Primary value proposition (one sentence) |
| `cta` | Yes | CTA button text, e.g. `Start free trial` |
| `logoUrl` | No | URL to logo asset |
| `customInstructions` | No | Free-text generation override |

See `contracts/brand-spec.ts` for the full Zod schema.

## Output Structure

```
output/<run-id>/
  directions.json         # 3 selected directions with rationale
  brand-spec.json         # Copy of the BrandSpec used
  html/
    direction-A.html      # Direction A variant
    direction-B.html      # Direction B variant
    direction-C.html      # Direction C variant
    direction-A.gen.json  # Generation log (model, tokens, timing)
    direction-B.gen.json
    direction-C.gen.json
```

## Available Directions

15 design directions across 5 families: Editorial, Bento, Hero-art, Brutalist, Eastern-typographic.
See `references/directions.md` for human-readable docs on each direction.
See `references/directions.json` for the machine-readable taxonomy.

## Google Fonts

Font choices are constrained to a curated 40-pair allowlist in `references/google-fonts.json`.
All fonts are verified available on Google Fonts.

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| Exit 1 + "Brand spec not found" | Bad `--brand` path | Check the file path exists |
| Exit 1 + "OLLAMA_API_KEY required" | Missing env var | Set `OLLAMA_API_KEY` for cloud Ollama |
| Exit 1 + Zod parse error | Invalid BrandSpec | Fix the failing fields (see error message) |
| Exit 2 | QA gate failure | Review the failed gates in stderr and regenerate |
| Exit 3 | Anthropic API error | Check `ANTHROPIC_API_KEY` is set and valid |
| Truncated HTML | `maxOutputTokens` hit | Reduce sections in BrandSpec or increase limit |
