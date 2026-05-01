---
name: landing-page-studio
description: Use when generating a styled, on-brand landing page from a BrandSpec. Supports multi-direction exploration (3 disjoint design families), post-gen quality gates, CSP injection, and iterative text/section tweaking. Invoke when a user wants to produce a landing page HTML from brand identity inputs.
---

# landing-page-studio

Generates styled, on-brand landing pages from a `BrandSpec` input across 3 disjoint design directions.

## Inputs

- `BrandSpec` — brand identity object containing logo URL, color palette, font pairs, hero copy, sections, and optional proof points

## Outputs

- `output/<run>/directions.json` — 3 selected design directions with rationale
- `output/<run>/direction-<id>.html` — one self-contained HTML file per direction (Tailwind CDN + lucide inlined)
- `output/<run>/direction-<id>.gen.json` — generation log (model, tokens, ms elapsed)
- Quality gate pass/fail report per direction

## Workflow

```
plan-directions  →  generate-direction (×3, parallel)  →  post-process  →  quality-gates
```

Tweaking:
- `tweak-text` — Ollama patch for copy-only changes (free)
- `tweak-regen` — Anthropic Sonnet section regeneration (cost: ~$0.01/section)

## Usage

```bash
# Plan 3 directions from a BrandSpec
npx tsx scripts/generate.ts plan --brief example/brief.json

# Generate HTML for a specific direction
npx tsx scripts/generate.ts generate --brief example/brief.json --direction editorial-01

# Full run: plan + generate all 3
npx tsx scripts/generate.ts full --brief example/brief.json

# Tweak copy in a section (free, Ollama)
npx tsx scripts/generate.ts tweak-text --html output/<run>/direction-editorial-01.html --section hero --instruction "Make headline more urgent"

# Regenerate a section (Anthropic Sonnet)
npx tsx scripts/generate.ts tweak-regen --html output/<run>/direction-editorial-01.html --section social-proof --instruction "Use numbered stats instead of logos"
```

## Environment Variables

- `ANTHROPIC_API_KEY` — required for generate-direction and regen-section
- `OLLAMA_API_KEY` — required for plan-directions and patch-text (Ollama cloud)

## References

- `contracts/.gitkeep` — skill manifest
- `references/directions.json` — 15-direction vocabulary taxonomy
- `references/google-fonts.json` — curated font pair allowlist
- `scripts/quality-gates.ts` — 12 vendored QA gate functions

## TODO

- [ ] Implement `scripts/plan-directions.ts` (T4)
- [ ] Implement `scripts/generate-direction.ts` (T5)
- [ ] Implement `scripts/post-process.ts` (T6)
- [ ] Implement `scripts/quality-gates.ts` (T7)
- [ ] Implement `scripts/patch-text.ts` (T8)
- [ ] Implement `scripts/regen-section.ts` (T9)
- [ ] Implement `scripts/generate.ts` orchestrator (T10)
