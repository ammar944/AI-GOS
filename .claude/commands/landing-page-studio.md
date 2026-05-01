---
description: Generate a multi-direction SaaS landing page from a BrandSpec JSON file
argument-hint: <path/to/brand-spec.json> [--run <run-id>]
---

# /landing-page-studio

Landing Page Studio — generates 3 styled HTML landing pages from a BrandSpec, each expressing a distinct design direction (Editorial, Bento, Hero-art, Brutalist, or Eastern-typographic).

## Arguments

```
/landing-page-studio <path/to/brand-spec.json>
/landing-page-studio <path/to/brand-spec.json> --run <run-id>
```

Replace `<path/to/brand-spec.json>` with the path to your BrandSpec JSON file.
`--run <run-id>` is optional — defaults to a timestamp like `2026-05-01T15-30-00`.

## Workflow

When invoked, Claude should:

1. Read `skills/landing-page-studio/SKILL.md` for the full skill spec
2. Validate the BrandSpec at the provided path against `skills/landing-page-studio/contracts/brand-spec.ts`
3. Run the full pipeline via the CLI orchestrator:

```bash
npx tsx skills/landing-page-studio/scripts/generate.ts full \
  --brand $ARGUMENTS \
  --run $(date +%Y-%m-%dT%H-%M-%S)
```

4. Report the output paths when complete:
   - `output/<run-id>/html/direction-A.html`
   - `output/<run-id>/html/direction-B.html`
   - `output/<run-id>/html/direction-C.html`

## Required Environment Variables

- `ANTHROPIC_API_KEY` — for HTML generation (Anthropic Sonnet)
- `OLLAMA_API_KEY` — for direction planning (Ollama cloud)

If either is missing, the CLI exits with code 3 and prints which variable to set.

## Subcommands (advanced)

```bash
# Plan only (pick 3 directions, no HTML)
npx tsx skills/landing-page-studio/scripts/generate.ts plan --brand <path> --run <id>

# Render one direction from existing plan
npx tsx skills/landing-page-studio/scripts/generate.ts generate --run <id> --direction A

# Tweak copy in a section (Ollama, free)
npx tsx skills/landing-page-studio/scripts/generate.ts tweak-text \
  --run <id> --direction A --section hero --instruction "More urgent headline"

# Regenerate a section (Anthropic Sonnet)
npx tsx skills/landing-page-studio/scripts/generate.ts tweak-regen \
  --run <id> --direction A --section hero
```

## BrandSpec Reference

See `skills/landing-page-studio/example/brief.json` for a complete example.
See `skills/landing-page-studio/contracts/brand-spec.ts` for the Zod schema.
