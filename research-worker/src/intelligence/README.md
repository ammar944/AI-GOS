# Intelligence Layer

Validated synthesis cards that consume wiki entries and produce grounded output.

## Purpose

The research pipeline's 4 synthesis cards (opportunity, white-space-gap, offer-statement, strategic-synthesis) used to run inline inside each runner's single `generateObject` call. They read summarized context, not the wiki, and had no validator. This layer replaces that with a deterministic, validated, fan-out pipeline:

```
wiki entries
    │
    ▼
buildEvidencePack(card, section, entries)   ← zero LLM calls, pure filter+sort
    │
    ▼
cards/<card>.synthesize(pack)                ← Haiku (Sonnet for strategic-synthesis)
    │
    ▼
validateCardClaims(card, draft, pack)        ← batch Haiku claim auditor
    │
    ▼
Supabase write — `research_results.<section>Intelligence.<cardName>`
```

## Key Principles

- **Empty beats fabricated.** Cards gate rendering when evidence is insufficient.
- **Every claim cites evidenceIds.** The validator kills claims that don't.
- **Deterministic packing.** Same wiki input → identical evidence pack.
- **Parallel fan-out.** Cards run via Promise.allSettled; one failure never blocks siblings.

## Kill Switches (env)

| Var | Effect |
|-----|--------|
| `INTELLIGENCE_PIPELINE=false` | Dispatcher no-ops; runners own synthesis (legacy behavior) |
| `INTELLIGENCE_CARDS=<csv>` | Only the listed cards run (e.g. `opportunity,offer-statement`) |
| `INTELLIGENCE_PARALLEL=false` | Run cards serially — diagnostic only |
| `INTELLIGENCE_VALIDATOR=false` | Skip validator pass — emergency rollback |

## Constraints

- No tool calls from cards. Wiki + methodology is the only input.
- Card stubs in `cards/` throw `Not implemented` until Phase 6.2 fills them in.
- Event bus wiring happens in Phase 7.1 (`../events.ts`).

## File Map

| File | Purpose |
|------|---------|
| `types.ts` | `EvidencePack`, `CardResult`, `EvidenceCited<T>` |
| `evidence-packer.ts` | `buildEvidencePack`, `formatEvidencePack`, `CARD_TOPIC_FILTERS` |
| `validator.ts` | `validateCardClaims` with kill switch |
| `dispatcher.ts` | `dispatchIntelligenceCards` — fan-out + gating |
| `schemas/base.ts` | `evidenceCitedSchema<T>` — shared Zod primitive |
| `schemas/*` | Per-card Zod schemas (opportunity, gap, offer-statement, synthesis) |
| `cards/*` | Per-card synthesize functions (stubs until 6.2) |
| `__tests__/*` | Deterministic pack + validator tests |

## Related

- Wiki source: `../wiki.ts`
- Model constants: `../models.ts`
- Plan: `/Users/ammar/.claude/plans/curious-roaming-sifakis.md` → Part 2
