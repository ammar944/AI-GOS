---
name: offer-statement-crafting
version: 1.0.0
category: intelligence
domain: offer-craft
description: Generate 1-5 high-signal offer statements a paid media buyer can drop into a hero banner or ad headline, grounded in wiki evidence about the client's offer, ICP triggers, and competitor positioning.
triggers:
  - offerStatements
  - offer statement generation
  - ad copy generation
  - offer intelligence
  - hero statement
---

# Offer Statement Crafting

## Purpose

You are generating 1-5 offer statements that a paid media buyer can drop directly into a hero banner, ad headline, or landing page fold. NOT generic copy. NOT brand taglines. Evidence-backed, axis-targeted, awareness-matched only.

Each statement must pass the skeptical media buyer test: would this drive click AND conversion from a cold audience on Meta, Google, or LinkedIn? If not, cut it.

## Frameworks Applied

### Hormozi Value Equation

```
Perceived Value = (Dream Outcome × Likelihood of Success) / (Time Delay × Effort & Sacrifice)
```

Every statement must pull on one of the four axes:

- **dream_outcome** — amplify what life looks like after the solution (the result, not the feature)
- **likelihood** — increase belief the outcome is achievable (proof, mechanism, guarantee)
- **time_delay** — shrink perceived time to result ("in 14 days", "by Friday", "same week")
- **effort_sacrifice** — reduce perceived difficulty or risk ("no migration", "done for you", "zero setup")

### Schwartz Awareness Levels

Match the statement's hook to the buyer's current awareness state:

- **unaware** — buyer doesn't know they have the problem; lead with symptom or identity disruption
- **problem_aware** — buyer knows the pain but not solutions; lead with problem validation + relief
- **solution_aware** — buyer knows solutions exist but hasn't chosen one; lead with mechanism or differentiator
- **product_aware** — buyer knows your product; lead with proof, risk reversal, or urgency
- **most_aware** — buyer is ready to buy; lead with offer specifics, price, guarantee, or next step

## Statement Types

**hero** — the primary value claim. One sentence that captures the biggest transformation. Use for above-the-fold headlines and primary ad creative. Lead with this type when dream_outcome or time_delay is strongest.

**stack** — a compound value statement that layers multiple benefits or proof points. Use when the offer has 2-3 distinct advantages worth naming together. Effective at solution_aware and product_aware levels.

**guarantee** — removes risk by naming a specific promise with a consequence ("or your money back", "or we work for free"). Use only when pricing evidence supports a real guarantee and when buyer is at product_aware or most_aware level. Do NOT use if offer pricing is missing from the evidence pack.

**urgency** — creates a reason to act now. Cite a specific scarcity signal from the evidence (cohort size, pricing window, launch timing). Do NOT manufacture urgency — only use if the evidence pack contains a real signal. Do NOT use if icp_objection evidence is absent.

**social_proof** — borrows belief from a named result or recognizable cohort. Requires a specific number, company name, or outcome metric from the wiki. Do NOT use if competitor positioning evidence is absent and no proof data exists in the pack.

## Qualifying Criteria

A statement is production-ready if it passes ALL five:

1. **Cites a specific wiki finding** — references a real entry from the evidence pack by topic (e.g., offer_value_prop, icp_pain_point, offer_pricing). No general knowledge allowed.
2. **Matches an awareness level** to the buyer the client is targeting — the hook verb and complexity must fit. A most_aware buyer does not need a problem-framing hook.
3. **Pulls on at least one value-equation axis** — explicitly identifies which variable it inflates or deflates.
4. **Specific, not generic** — names a number, timeframe, mechanism, or named result. "Save time" fails. "Cut reporting from 4 hours to 20 minutes" passes.
5. **Rotatable** — across the 2-5 statements, at least 2 different axes must be covered. All five statements cannot attack the same axis.

## Decision Rules

- IF `offer_pricing` evidence is absent → skip `guarantee` and `urgency` types; they require pricing context to be credible
- IF `icp_objection` evidence is absent → skip `social_proof` type; without known objections, social proof is untargeted
- IF competitor positioning shows all competitors claim the same benefit (Schwartz Sophistication Level 3+) → lead with a **mechanism** hero statement that names HOW your client's offer works differently, not just that it does. This is a Sophistication Level 4+ play.
- IF fewer than 2 statements survive the quality gate → return `{"statements": []}`. Empty is better than fabricated.

## Output Format

Return strict JSON matching this schema exactly. No preamble. No fences.

```json
{
  "statements": [
    {
      "value": {
        "type": "hero|stack|guarantee|urgency|social_proof",
        "statement": "The actual headline or hook copy (min 10 chars)",
        "valueEquationAxis": "dream_outcome|likelihood|time_delay|effort_sacrifice",
        "awarenessLevel": "unaware|problem_aware|solution_aware|product_aware|most_aware",
        "rationale": "Why this passes the quality gate — which axis, which awareness level, what makes it non-generic (min 10 chars)",
        "evidence": "The specific wiki entry that grounds this statement, e.g. 'offer_value_prop#1: 30-day onboarding guarantee' (min 10 chars)",
        "targetEmotion": "Optional: the emotional register this is designed to trigger (e.g. relief, confidence, urgency, aspiration)"
      },
      "evidenceIds": ["topic#N"],
      "confidence": 0
    }
  ]
}
```

Every statement MUST:
- Include `evidenceIds` citing at least 1 entry ID from the EVIDENCE PACK
- Include `confidence` (0-100) representing how strongly the wiki evidence supports this statement
- Populate `valueEquationAxis`, `awarenessLevel`, `rationale`, and `evidence` — these are required

## Anti-Patterns (Automatic Rejection)

- "Save time and money" — generic, cites no evidence, no axis
- Any superlative ("best", "fastest", "most powerful") without a specific benchmark from the evidence
- Any statement not tied to a specific entry in the evidence pack
- Five statements that all attack the same value-equation axis (e.g., five time_delay claims)
- Guarantee statements without pricing evidence
- Urgency statements that manufacture scarcity not grounded in a wiki entry
- Social proof statements with invented numbers or company names

## Quality Gate

Before outputting, run each statement through:
- [ ] Does it cite a specific wiki entry (not general knowledge)?
- [ ] Does the awareness level match the hook style?
- [ ] Does it name a specific number, timeframe, mechanism, or named outcome?
- [ ] Is it different from the other statements (different axis or different buyer state)?
- [ ] Would a skeptical media buyer spend budget testing this? If no → cut.

If fewer than 2 statements pass → return `{"statements": []}`.

## Good vs. Bad Examples

**BAD** (generic, no evidence, no axis):
```json
{
  "type": "hero",
  "statement": "Grow your business faster with our platform",
  "valueEquationAxis": "dream_outcome",
  "awarenessLevel": "problem_aware",
  "rationale": "Addresses desire for growth",
  "evidence": "General market knowledge"
}
```

**GOOD** (specific, axis-targeted, evidence-backed):
```json
{
  "type": "hero",
  "statement": "Cut ops reporting from 4 hours to 20 minutes — guaranteed or we work free",
  "valueEquationAxis": "time_delay",
  "awarenessLevel": "problem_aware",
  "rationale": "Attacks time_delay axis with a specific before/after metric from the ICP pain point entry. Problem-aware hook leads with the pain (4 hours lost) before the relief. The guarantee elevates likelihood simultaneously.",
  "evidence": "icp_pain_point#1: ops teams lose 4hr/wk to manual status reporting",
  "targetEmotion": "relief"
}
```
