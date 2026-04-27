# v3 Research Findings — 2026-04-24

Consolidation of three research lanes dispatched to support the skill-first pivot. Companion to `.claude/architecture/v3-skill-first.md`.

Per-skill actionable items have been (or will be) routed to `skills/<name>/references/rules.md` and `skills/<name>/references/frameworks.md`. This doc is the canonical index.

---

## Lane 3 — Framework map per skill

For each research/synthesis skill, the 2-3 canonical frameworks to draw from. URLs verified by WebFetch. Synthesize-scripts skipped (already covered by `/grade-scripts` skill with Schwartz/Halbert/Hopkins/Sugarman/Collier/Caples).

### research-market
| Framework | 1-line | Source |
|---|---|---|
| TAM/SAM/SOM (bottom-up) | Three-tier market sizing | https://blog.hubspot.com/marketing/tam-sam-som |
| Porter's Five Forces | Rivalry / new entrants / substitutes / buyer + supplier power | https://hbr.org/2008/01/the-five-competitive-forces-that-shape-strategy |
| Crossing the Chasm | Innovator → early adopter → early majority → late majority → laggard | https://en.wikipedia.org/wiki/Crossing_the_Chasm |

Free scraping sources: Google Trends (category maturity signal), Crunchbase News funding feed (competitive intensity), SEC EDGAR 10-K "Competition" sections (incumbents name competitors + moats in plain English).

**Don't reinvent**: use Porter's 5-forces verbatim as the output shape — it's the lingua franca for investor/strategy decks.

### research-icp
| Framework | 1-line | Source |
|---|---|---|
| Revella's 5 Rings of Buying Insight | Priority Initiative / Success Factors / Perceived Barriers / Buyer's Journey / Decision Criteria | https://buyerpersona.com/leadership |
| JTBD (Christensen) | Functional + social + emotional jobs | https://www.christenseninstitute.org/theory/jobs-to-be-done/ |
| Schwartz's 5 Stages of Awareness | Unaware → Problem → Solution → Product → Most Aware | https://www.optimizesmart.com/schwartz-five-stages-of-awareness-in-marketing/ |

Sources: LinkedIn job descriptions, BuiltWith/Wappalyzer firmographics, podcast show-note bios (how buyers describe own roles).

**Don't reinvent**: use Revella's 5 Rings as the persona schema — industry-standard shape.

### research-offer
| Framework | 1-line | Source |
|---|---|---|
| Hormozi Value Equation | `Value = (Dream Outcome × Perceived Likelihood) / (Time Delay × Effort)` | https://creatoreconomy.so/p/the-value-equation-for-irresistible-products |
| JTBD Forces of Progress | Push / Pull / Habit / Anxiety — why buyers switch vs. stay | https://hbr.org/2016/09/know-your-customers-jobs-to-be-done |
| AARRR / Pirate Metrics | Acquisition → Activation → Retention → Referral → Revenue | TBD — unverified (original 2007 slide deck) |

Sources: G2/Capterra "what do you dislike?" + "what problems is the product solving?" structured fields; archive.org pricing-page history (repackaging = retention pressure proxy); Trustpilot.

**Don't reinvent**: use Hormozi's 4-variable equation as the offer-health scoring shape.

### research-keywords
| Framework | 1-line | Source |
|---|---|---|
| Broder/Jansen intent taxonomy | Informational / Navigational / Commercial / Transactional | https://ahrefs.com/blog/search-intent/ |
| Ahrefs content-gap analysis | Competitor keywords minus yours | https://ahrefs.com/content-gap |
| Parent-topic / SERP clustering | Shared SERP = one page not many | https://ahrefs.com/blog/search-intent/ |

Sources: Google autocomplete + PAA (SERP scrape, free), Reddit/Quora question-form queries (long-tail informational in buyer's own language), AnswerThePublic free tier.

**Don't reinvent**: use the 4-bucket Broder taxonomy verbatim. Don't invent a 5th bucket — SEOs don't recognize it and it degrades interop with Ahrefs/Semrush exports.

### research-voc
| Framework | 1-line | Source |
|---|---|---|
| Jennifer Havice VoC-to-copy | Interview + tag verbatim by theme | https://www.amazon.com/Finding-Right-Message-Customer-Irresistible/dp/0578648725 |
| Copyhackers review-mining (Wiebe) | Mine 1★ and 5★ reviews for pains + desired outcomes | https://copyhackers.com (specific post: TBD) |
| Schwartz 5 Stages | Classify each verbatim by awareness stage | https://www.optimizesmart.com/schwartz-five-stages-of-awareness-in-marketing/ |

Sources: Reddit `.json` endpoints (free reads), HN Algolia API (`https://hn.algolia.com/api/v1` — no rate limit, full-text), G2/Capterra structured review fields.

**Don't reinvent**: borrow Havice's review-mining spreadsheet template (pain / fear / desire / verbatim / awareness stage) — already portable into copywriting workflows.

### synthesize-positioning
| Framework | 1-line | Source |
|---|---|---|
| April Dunford positioning canvas | 10 steps: competitive alternatives → unique attributes → value → best-fit → category | https://www.aprildunford.com/books |
| Donald Miller StoryBrand SB7 | Hero/Villain/Guide/Plan/CTA/Stakes — supplies villain/hero/transformation arc | https://www.gravityglobal.com/blog/complete-guide-storybrand-framework |
| Schwartz 5 Stages | Positioning must match target's awareness stage; drives headline variants | https://www.optimizesmart.com/schwartz-five-stages-of-awareness-in-marketing/ |

Sources: competitor home-page H1 (re-use from `research-competitor`, don't re-fetch), G2 category pages ("Top 10" lists = how the category frames itself = Dunford step 1), earnings-call transcripts on Seeking Alpha (incumbents narrate positioning arc to investors).

**Don't reinvent**: scaffold with Dunford's 10 steps internally, output in StoryBrand's 7 slots.

---

## Lane 4 — Adversarial architecture review (weakest assumptions)

**Source**: independent review against `v3-skill-first.md` + `skills/research-competitor/` + `skills/ingest-url/`. The full report is integrated as §14 of the architecture doc.

### Five weakest load-bearing assumptions

1. **"No skill may import from outside its own folder"** (`v3-skill-first.md` Decision #5) — `skills/research-competitor/scripts/name-matcher.ts` already duplicates `src/lib/ad-library/name-matcher.ts` which has a Vitest suite. When `research-voc` needs name matching (skill #6 in migration), 3 divergent copies will exist, only 1 tested. → **De-risk**: allow `skills/<name>/vendored/` with provenance headers + CI drift-check.

2. **"16 peers, no Layer 1/2/3"** (Decision #4) **contradicts** agent-loop ordering enforcement elsewhere in the same doc. If `/synthesize-media-plan` is invoked standalone without upstream research, does the agent loop refuse or dispatch anyway? The doc has opposite answers in two places. → **De-risk**: pick one. Either layers exist (call them that) or composition is the user's problem (delete `research-cross` entry + layer-enforcement language).

3. **"Every skill implements receive → collect → validate → render → present"** (runtime §2). `ingest-identity` produces a 12-field card that populates a form — it has no natural editorial-HTML output. Either (a) scaffold empty `generate-report.ts` no one runs, or (b) build 15 bespoke renderers to satisfy ceremony. → **De-risk**: split runtime into `data-skill` (receive/collect/validate/emit JSON) vs `report-skill` (adds render + present). Frontmatter flag. Data-skills drop `assets/` entirely.

4. **Rename `schemas/ + prompts/ → references/` flattens useful semantic split.** Research-competitor uses `schemas/` + `prompts/`; stubs use flat `references/`. The rename breaks SKILL.md line references AND loses the input/prompts distinction. → **De-risk**: don't flatten. Keep `references/schemas/` + `references/prompts/` + `references/rules.md`. Anthropic's `references/` convention is load-on-demand, not naming.

5. **"Skills are a publishable GitHub repo"** (Decision #7) vs. `.claude/` bridges living in AIGOS. At repo split, bridges reference AIGOS-repo paths (broken on clone) OR every consumer rewrites 16 bridges. Plus research-competitor hardcodes `SEARCHAPI_KEY` from "AI-GOS repo root `.env.local`" — direct AIGOS coupling. → **De-risk**: decide now — skills as *library* (import) or *subprocess contract* (`npx tsx`, JSON in/out). Document one seam only.

### Forced-choice answers

- **Delete first**: Decision #5 ("no shared libs"). It breaks the reference impl's actual behavior and fights Decision #7 (publishable). Replace with `skills/_lib/` — published alongside skills, zero imports outside the `skills/` tree.
- **Unacknowledged assumption masquerading as decision**: **#3 (all skills user-invoked, no auto-run).** This is a UX guess, not a decision. Nothing validates users want `/ingest-url https://...` after pasting a URL. Current auto-prefill is load-bearing per `MEMORY.md` and `feedback_journey_is_form_driven.md`. Flipping without a user test is itself the decision — and it's written as settled.
- **Bifurcation (schemas/prompts vs references/scripts/assets)**: ceremony. Keep research-competitor's shipped layout. Canonical `references/` is advice about load-on-demand, not a directory-name mandate.
- **GitHub-repo leak into design** (3 places):
  - `.claude/` bridges inside AIGOS (only exist because skill folder must stay clean of Claude-Code-specific files)
  - Per-skill `package.json` + `node_modules/` vendoring `zod` (only defensible if each skill is `npm publish`ed standalone)
  - Decision #5's "no shared libs" (only reason to forbid `../../lib/` is that skills travel to a different repo)

---

## Lane 5 — Team feedback distilled per skill

Mined from project-memory + `.claude/rules/*.md`. Full raw findings routed to `skills/<name>/references/rules.md`. Summary below — these are **load-bearing rules** extracted from real team feedback.

### ICM = "Interpreted Context Methodology" (Jake Van Clief)
Five-stage pipeline: Discover → Plan → Develop → Test/Verify → Ship. Applied at two levels:
- **Workspace level**: `.claude/workspaces/aigos-feature-dev/` (feature-dev stages 01–05)
- **Skill level**: each research skill's pipeline has per-stage CONTEXT.md with Inputs/Process/Checkpoints/Outputs

Each stage has Layer 0 (module contract), Layer 1 (current state), Layer 2+ (per-stage context). ICM replaces JSDoc — context files ARE the contract.

### High-signal skills (rules routed to rules.md)

| Skill | # constraints extracted | Most critical |
|---|---|---|
| synthesize-media-plan | 5 | No SLG-style funnels for PLG; never channels outside ICP/competitor evidence; £5k minimum before multi-channel; CAC < LTV gate |
| research-competitor | 4 | Never empty-creative ads; never cite weakness without source URL; search by keyword not company name; always dedup |
| research-icp | 2 | **MULTI-ICP support mandatory** — never lock onto single persona if research shows 2+ segments |
| research-keywords | 2 | ≥4 keywords; confidence threshold gate bottom 2–3 |
| research-offer | 2 | Always scan client's own ad library; flag contradictions with current spend |
| ingest-identity | 1 | Max-tokens retry on JSON truncation |
| ingest-url | 1 | No HTML outputs in repo — Desktop only |
| chat-refine | 1 | Stop after 3 failures, ask user |
| present-workspace | 1 | Never route to old `/generate` flow |

Cross-cutting: no CVR/pricing/review hallucination (3-layer defense — benchmark + cite + flag-missing); reviews must include Capterra + G2 + Trustpilot verbatim text (not just links); mechanism needed to input existing strategy so recommendations aren't 90% duplicates of current spend.

---

## Next steps (routing)

- [ ] Write `references/rules.md` in the 9 skills above ← in progress this session
- [ ] Write `references/frameworks.md` in 6 research/synthesize skills ← can defer, content is in this doc
- [ ] Append Lane 4 adversarial review as `§14` of architecture doc ← in progress
- [ ] **User decision needed** on the 5 adversarial findings — especially #1 (shared libs) and #2 (layer contradiction). These are real contradictions in the architecture doc that need resolving before Phase A.

---

## Sources

All Lane 3 framework URLs verified via WebFetch in the research agent's session. Lane 4 cites v3-skill-first.md line numbers. Lane 5 sources project-memory files named in each extracted rule.
