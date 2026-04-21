# Taxonomy (AIGOS scope)

Simon's taxonomy scoped to this project's actual use: engineering + AI knowledge work. The life/personal domains are omitted — re-add them only if the wiki is ever used for personal archives.

## Primary Domains — use exactly one

- `Code & AI` — AIGOS source, AI SDK patterns, model selection, prompts, agents, MCPs, Claude Code, skills, plugins, infra glue.
- `Work & Business` — AIGOS as a product, pricing, positioning, marketing-blueprint pipeline as a domain (not as code), customer work.
- `Learning & Research` — external sources (talks, papers, blog posts), concepts, frameworks, third-party tools, techniques still being evaluated.
- `Life Admin` — only if you decide to keep non-engineering threads here. Leave empty by default.

If an ingest item doesn't fit one of these, put it in the `review` queue. Do not invent new domains — it's better to force a pick or route to review than to let the list drift.

## Intents — use one or two

- `decision` — a choice was made, with reusable reasoning.
- `planning` — a plan or architecture, not yet executed.
- `research` — external scan for an answer.
- `debugging` — root-cause write-up.
- `reflection` — lessons, postmortems, learned patterns.
- `drafting` — a doc, PR description, email, or spec.
- `lookup` — one-off factual question (usually `worth: no`).
- `administrivia` — config, setup, boilerplate (usually `worth: no`).

## Worth-porting — use exactly one

- `yes` — durable project context, reusable reasoning, durable reflection, reusable research, material that updates a long-lived topic.
- `no` — disposable one-off lookup, wording-only help, low-signal factual search.
- `review` — mixed, sensitive, ambiguous, thin-but-possibly-important.

When torn between `yes` and `review`: pick `review`.
When torn between `review` and `no` for disposable lookups: pick `no`.

## Source Note Tier — only `yes` items

- `full` — standalone note worth writing. Triggered by: strong topic density, enough key points, meaningful entities, durable intent (decision / planning / research / debugging / reflection), high confidence.
- `synthesis_only` — contributes to domain/topic/entity pages but does NOT become its own note. Default for borderline `yes`.

Production ratio from Simon's real run: out of 2428 kept, 1112 were `full` and 1316 were `synthesis_only`. Lean toward `synthesis_only` — the vault stays smaller and more useful.
