---
name: ingest-identity
description: >
  Identity resolution — given raw company data, resolves the canonical identity card: who they are, what they do, core keywords, negative keywords.
version: 0.1.0
---

# ingest-identity

> **Status**: Lane D3 — schema-complete, agent-fragment contract defined, sanity-check gate active. Scaffold output is rejected by default; set `ALLOW_SUSPECT=1` to bypass during dev.

## What this skill does

Given a URL (and optional company name), produces a typed `IdentityCardOutput` describing who the company is, what they do, and how to find them (core keywords) vs. how not to mistarget them (negative keywords). The LLM-driven collector phase gathers sourced facts and writes them to `fragments/identity.json`; the deterministic tail (`scripts/orchestrate.ts`) merges the fragment, validates against `schemas/output.ts`, and emits `output.json`. Consumed by the GTM `enrich-brief` stage and every downstream research skill that needs a canonical company identity.

## Trigger

```
/ingest-identity <url>
```

Invoke when: resolving a company from a URL at onboarding, refreshing an existing identity card, or seeding any downstream research skill that depends on `company_name`, `domain`, `category`, `core_keywords`, or `negative_keywords`.

Do not invoke for: competitor analysis (use `research-competitor`), market sizing (use `research-market`), or deep ICP research (use `research-icp`).

## Tools used

- `web_search` — discover the company's canonical surfaces (homepage, about, pricing, category pages).
- `browser_navigate` + `browser_snapshot` — read source pages when search snippets are insufficient.
- `Write(<runDir>/fragments/identity.json)` — write the collected fragment.
- `Bash(npx tsx scripts/orchestrate.ts <runDir>)` — run the deterministic tail to merge, validate, and sanity-check.

## Workflow

1. **Receive** — `input.json` at `<runDir>/input.json` is parsed against `schemas/input.ts`.
2. **Collect** — agent follows `prompts/collector.md` and writes `<runDir>/fragments/identity.json`.
3. **Merge + Validate + Sanity-check** — `scripts/orchestrate.ts` reads the fragment, assembles `output.json`, runs `scripts/validate.ts` (Zod gate), then runs `scripts/sanity-check.ts` (scaffold-rejection gate).
4. **Present** — caller reads `<runDir>/output.json`.

If no fragment exists when orchestrate runs, the tail writes a scaffold output (domain-as-company_name, category `"unknown"`, `sources: [{ describes: "scaffold_fallback" }]`). The sanity-check gate rejects this by default (exit 1). Set `ALLOW_SUSPECT=1` in the environment to downgrade the failure to a stderr warning — useful during dev loops where the agent-fragment layer is not yet wired.

## Schema reference

- Input: `schemas/input.ts` (`IdentityResolverInputSchema`)
- Output: `schemas/output.ts` (`IdentityCardOutputSchema`)
- Fragment: `schemas/output.ts` (`IdentityFragmentSchema` — partial of output, requires company_name + domain + category + sources)
- Collector prompt: `prompts/collector.md`
- Fixture: `example/input.json`, `example/output.json`

## Hard constraints

- Facts only. No LLM-scored metrics ("7/10" style).
- Every factual claim is anchored to at least one entry in `sources[]` with a real `source_url` + `retrieved_at`. Unsourceable fields are omitted, never fabricated.
- Empty arrays beat fake arrays. An empty `core_keywords` is honest; a hallucinated one corrupts every downstream skill.
- Skill is self-contained: no imports from outside `skills/ingest-identity/`.

## Output

```json
{
  "run_id": "run_xxx",
  "company_name": "Example Inc.",
  "domain": "example.com",
  "category": "B2B SaaS",
  "core_keywords": ["example platform", "example workflow automation"],
  "negative_keywords": ["example movies"],
  "sources": [
    { "source_url": "https://example.com", "retrieved_at": "2026-04-24T12:00:00Z", "describes": "company_name" }
  ],
  "generated_at": "2026-04-24T12:00:00Z"
}
```
