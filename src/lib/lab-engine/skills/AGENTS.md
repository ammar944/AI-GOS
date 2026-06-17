# AGENTS.md - src/lib/lab-engine/skills

## Purpose

- Owns prompt skill files for positioning and paid-media lab sections.

## Ownership

- Each `positioning-*` skill folder owns its `SKILL.md` prompt contract and local prompt materials.

## Local Contracts

- Prompt skills must demand source-backed evidence and honest unknowns.
- Prompt changes must stay aligned with the code schemas and verifier expectations.
- Do not encode fake examples as expected live facts.
- Do not move schema enforcement from code into prompt-only requirements.
- The BuyerICP, VoC, and paid-media skills encode the acquisition-ledger + sufficiency contract and the SaaSLaunch fulfillment contract (Perplexity/Sonar = bounded source discovery only; DeepSeek = writer/repair authority). Keep these aligned with `acquisitionSufficiencyFieldSchema` and the coverage eval; sparse acquisition must produce honest gaps, never fabricated rows.

## Work Guidance

- Keep prompts concise enough to be maintainable and concrete enough to drive the expected artifact.
- When prompt output expectations change, update schema/tests/renderers in the same change.

## Verification

- Run section/lab-engine tests relevant to the changed skill.
- For high-risk prompt changes, run a bounded live or fixture-backed section proof when requested.

## Child DOX Index

- No child `AGENTS.md` files yet.
