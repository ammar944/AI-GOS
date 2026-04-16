---
name: positioning-move
version: 1.0.0
category: intelligence
domain: competitor-intelligence
description: Methodology for generating 1-3 paid-media positioning moves against specific competitor weaknesses. Grounded in Blue Ocean ERRC, April Dunford positioning, Porter's 5 Forces, Alex Hormozi offer theory.
triggers:
  - positioningMoves
  - competitive positioning intelligence
  - competitor counter-positioning
---

# Positioning Moves

## Purpose

You are generating 1-3 positioning moves for paid media based on SPECIFIC competitive weaknesses found in the research above. Every move must name a real competitor and reference a real weakness.

## Frameworks Applied

- **Blue Ocean ERRC Grid** — Eliminate, Reduce, Raise, Create factors vs. competition
- **April Dunford 10-Step Positioning** — differentiated value vs. competitive alternatives
- **Porter's 5 Forces** — where is competitor strongest/weakest?
- **Alex Hormozi Value Equation** — which Value-Equation variable is the competitor weakest on?
- **Strategy Canvas** — visualizing competitive space

## The Value Equation (Hormozi)

```
Value = (Dream Outcome × Perceived Likelihood) ÷ (Time Delay × Effort & Sacrifice)
```

For every positioning move: identify which of the 4 variables competitors are WEAKEST on, then attack that axis.

## Qualifying Criteria — A Real Positioning Move Has

1. **Named competitor** from the analysis above (not a generic "incumbents")
2. **Specific weakness** backed by research evidence (review mining, ad analysis, pricing, reviews, messaging)
3. **Counter-angle** that paid media creative can execute (hook or value prop, not roadmap work)
4. **Value Equation axis** attacked (make our Dream Outcome bigger, our Likelihood more believable, or our Time/Effort lower)
5. **Risk honestly scoped** — a bold move carries real risk, named

If fewer than 4 of 5 → it's marketing poetry, not a move. Do NOT include.

## Move Archetypes

**A. ERRC-Eliminate** — competitor raises a factor the market doesn't actually value; eliminate it in your messaging and reduce perceived cost/complexity.
**B. ERRC-Create** — a factor no competitor offers. You introduce and own it.
**C. Time-Delay Attack** — competitor takes 90-day onboarding; you promise results in 14. Lead with speed.
**D. Effort/Sacrifice Attack** — competitor requires setup, training, rip-and-replace. Lead with "zero migration" or "done-for-you."
**E. Likelihood Attack** — competitor has weak proof (no case studies, bad reviews). Lead with specific customer-result proof.
**F. Dream-Outcome Upgrade** — competitor sells features; you sell the emotional end-state.
**G. Mechanism Reveal** — competitor makes vague claims; you name the specific mechanism (how it actually works).
**H. Category Redefinition** — reframe what category you're in so direct comparison breaks (Dunford's "different game" move).

## Decision Rules

- IF fewer than 2 competitors analyzed with real evidence → return empty array
- IF competitor pricing is unknown → skip Archetype A (can't attack cost-reduce)
- IF competitor reviews are strong → avoid Archetype E (attacking proof is suicide)
- IF you don't have differentiated mechanism → avoid Archetype G
- IF market is at Schwartz Sophistication Level 4-5 → Archetypes B, G, H are highest-leverage

## Risk/Reward Rubric

**Risk: Low** — creative-level change, reversible in <48 hours, no brand reposition
**Risk: Medium** — requires landing page change or offer tweak, reversible in 2 weeks
**Risk: High** — category reposition or direct attack; competitor may respond

**Reward: Low** — small segment lift, <15% improvement
**Reward: Medium** — broad-segment or high-LTV cohort lift, 15-40% improvement
**Reward: High** — category-shifting; potential to 2x+ on a specific conversion metric

Only claim High Reward if evidence shows a CORE Value Equation weakness (not peripheral).

## Playbook Specification (MANDATORY)

Every move must include a concrete "playbook" sentence that:
1. References a specific competitor weakness (name it)
2. States the counter-angle (a hook, headline, or creative pattern)
3. Is specific enough for a creative team to execute TODAY

"Target [competitor]'s [weakness] with [counter-angle] using [format]."

## Output Format

```json
{
  "positioningMoves": [
    {
      "move": "One sentence: what the positioning action is",
      "archetype": "A|B|C|D|E|F|G|H",
      "targetCompetitor": "Specific competitor name from research",
      "competitorWeakness": "One sentence: the specific weakness + source",
      "valueEquationAxis": "dream_outcome|likelihood|time_delay|effort_sacrifice",
      "risk": "low|medium|high",
      "reward": "low|medium|high",
      "playbook": "Concrete execution sentence: 'Target X with Y using Z'",
      "evidence": "One sentence citing the specific competitive finding"
    }
  ]
}
```

## Anti-Patterns

- Generic competitor names ("competitors", "legacy players", "incumbents")
- Vague playbooks ("differentiate on value")
- "Low risk, high reward" claimed without evidence
- Attacking a strength you can't actually exceed (e.g., claiming to beat a funded unicorn on feature breadth)
- Moves that require product changes, not marketing execution
- Archetype E (Likelihood Attack) when your own proof is thin — hypocritical

## Good vs. Bad Examples

**BAD** (generic, no teeth):
```json
{
  "move": "Differentiate by emphasizing customer success",
  "targetCompetitor": "Incumbent solutions",
  "playbook": "Use testimonials and case studies"
}
```

**GOOD** (specific, archetype-tagged, executable):
```json
{
  "move": "Attack HubSpot's 6-month implementation with a 'live in 14 days' promise",
  "archetype": "C",
  "targetCompetitor": "HubSpot",
  "competitorWeakness": "G2 reviews show 47% of mentions cite long/painful implementation; their onboarding doc promises 'typical deployment 4-6 months'",
  "valueEquationAxis": "time_delay",
  "risk": "medium",
  "reward": "high",
  "playbook": "Meta/LinkedIn static + short-form video: 'Still waiting on your HubSpot migration? We go live in 14 days or your money back.' Proof: 3 migration case studies.",
  "evidence": "Review mining: 47% of HubSpot negative reviews cite implementation pain; validated by 6+ G2/Trustpilot excerpts"
}
```

## Quality Gate

Each move must pass:
- [ ] Archetype assigned (A-H)
- [ ] Specific competitor named
- [ ] Specific weakness cited with source
- [ ] Value Equation axis identified
- [ ] Playbook is executable TODAY by a creative team
- [ ] Risk honestly scoped
- [ ] Reward proportionate to evidence strength

If fewer than 2 moves pass → return empty array. Positioning moves without teeth are noise.
