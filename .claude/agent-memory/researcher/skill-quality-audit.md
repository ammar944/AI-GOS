# Skills Quality Audit Report (2026-03-09)

## Executive Summary
All 7 research skills are well-structured with **strong output format specifications** but **insufficient guidance on tool usage, quality standards, and examples**. Average instructional depth: **6.5/10**.

Most skills specify exact JSON schemas and section headers but lack:
- Good vs. bad example outputs
- Specific guidance on how to USE tools effectively
- Quality criteria (e.g., "each stat must be cited")
- Client context (marketing agency helping B2B SaaS, not SaaS founders)

Only Industry Research has a supporting example file.

---

## Individual Skill Evaluations

### 1. Industry Research (129 lines)
**File**: `src/lib/ai/skills/industry-research/SKILL.md`
**Supporting Materials**: Yes — `references/output-example.md` (27 lines)

**Strengths**:
- Clear 6-step research process (market size → pain points → trends → seasonality → macro risks)
- Tool calls explicitly specified with query parameters and "focus" filter
- Output sections map cleanly to schema fields
- Example output shows proper citations and market-specific insights
- CRITICAL RULES explicitly state "Every statistic MUST come from a tool result"

**Weaknesses**:
- No quality criteria for market data (e.g., "use only research firms with 100+ analyst team")
- No guidance on interpreting conflicting data sources
- "Insufficient data from available sources" is given as fallback but no guidance on minimum viable data
- Seasonality calendar is 12 months but no example of what "intensity 1-10" actually means
- No guidance on client context (SaaS? B2B? B2C? affects TAM estimation)

**Output Format Specificity**: HIGH (7 subsections with exact headers + example values)

**Examples Provided**: YES — output-example.md shows market size citation, pain point sourcing, seasonal patterns

**Tool Usage Guidance**: MEDIUM (4 tool calls specified with queries but no "if this fails, try this" fallback logic)

**Quality Criteria**: MEDIUM (citations required but no data source hierarchy)

**Client Context**: LOW (no mention that client context affects research approach)

**Rating: 7/10** — Strong structure + example, but lacks interpretation guidance

---

### 2. Competitor Intelligence (167 lines)
**File**: `src/lib/ai/skills/competitor-intel/SKILL.md`
**Supporting Materials**: None

**Strengths**:
- 7-step process per competitor (website scrape → ads → keywords → page speed → pricing → threat scoring → white space)
- ALL tools must be run for EACH competitor (critical requirement emphasized)
- Threat assessment with 5 explicit factors (1-10 scale) gives clear scoring framework
- White space analysis with exploitability/impact scoring
- Competitive matrix table template included
- CRITICAL RULES explicitly forbid fabrication

**Weaknesses**:
- No example of what a "good" threat assessment looks like (what makes a 7 vs. a 9?)
- Pricing tier extraction is "best-effort" but no guidance on freemium model handling
- Ad copy fabrication is forbidden but no guidance on "if tool returns no ads, what do we do?"
- No mention of how to prioritize which competitors to analyze (top 3? top 5?)
- Funnel breakdown is vague ("landing page patterns observed") — what depth of analysis?
- White space gap discovery lacks a structured methodology (how many gaps? what if competitors all align?)
- Tone/messaging analysis on website is asked for but no guidance on how to evaluate "tone"

**Output Format Specificity**: HIGH (per-competitor profiles + matrix + funnel breakdown + gap analysis)

**Examples Provided**: NO

**Tool Usage Guidance**: MEDIUM-HIGH (tool sequence clear but no error recovery)

**Quality Criteria**: MEDIUM (no minimum standards for "complete" ad analysis)

**Client Context**: LOW (no mention of how B2B positioning differs from B2C)

**Rating: 6.5/10** — Strong structure + enforcement, but lacks execution examples

---

### 3. ICP Validation (180 lines)
**File**: `src/lib/ai/skills/icp-validation/SKILL.md`
**Supporting Materials**: None

**Strengths**:
- 6-step research process with explicit tool calls and focus filters
- Very detailed output schema (12+ subsections including psychographics, buying committee, risk scores)
- "Day in the Life" narrative required — forces specific context thinking
- Buying committee with influence levels (decision-maker/influencer/gatekeeper) is sophisticated
- Risk scores include probability/impact/mitigation/contingency — professional risk management format
- Final verdict with three states (validated/workable/invalid) gives clear decision gate
- SAM estimate with funnel drop-off methodology

**Weaknesses**:
- Persona card "name" is vague — should be role-based, not whimsical (e.g., "VP of Product" not "Product Paul")
- "Day in the Life" narrative is required but no example of 2-3 sentence vs. paragraph-length
- Coherence check lists 5 booleans but no guidance on what "clearly defined" means (how many job titles before it's "too broad"?)
- Platform audience size estimation lacks guidance (Meta/LinkedIn audience overlap? Google Volume is search demand, not addressable audience)
- Sensitivity analysis has three scenarios but no guidance on assumption selection
- Economic feasibility checks "Has Budget" but no guidance on how to assess from tool results (infer from TAM? from competitor analysis?)
- No client context about whether we're selling to enterprises (high CAC tolerance) vs. SMBs

**Output Format Specificity**: HIGHEST of all skills (14 labeled subsections, schema fields listed)

**Examples Provided**: NO

**Tool Usage Guidance**: MEDIUM (6 tool calls specified but "search_market_data" focus filter is vague for some calls)

**Quality Criteria**: MEDIUM (validation framework exists but "workable" is never defined)

**Client Context**: VERY LOW (no mention that advice for $50M+ enterprise ICP differs from $5M SMB)

**Rating: 6/10** — Most sophisticated schema but execution unclear; "workable" is too vague

---

### 4. Offer Analysis (143 lines)
**File**: `src/lib/ai/skills/offer-analysis/SKILL.md`
**Supporting Materials**: None

**Strengths**:
- Two-part output format (narrative + JSON) is clear contract
- Conversion potential assessment (landing page score 1-10, urgency factors, friction points) adds execution depth
- Red flags list is enumerated (offer_too_vague, overcrowded_market, etc.) — no open-ended hand-waving
- Recommendation status is enumerated (proceed, adjust_messaging, etc.) — clear decision tree
- Schema field rules are explicit (required vs. optional, valid enum values)
- Pricing comparison matrix is simple but actionable

**Weaknesses**:
- Only 4-step process is vague compared to other skills (Step 4 is just "assess conversion potential" with no tool specified)
- Landing page "clarity, CTA strength, social proof, load speed" are listed but no guidance on scoring (what's a 7 vs. a 4?)
- Urgency factors and friction points have no structured methodology (where do these come from? competitor analysis?)
- "Fabricate pricing" is forbidden but no guidance on "if we can't find competitor pricing, what do we do?"
- offer.json schema has 15+ fields but many are optional, unclear which matter most
- Final verdict focuses on offer but doesn't connect to ICP (a premium offer might be perfect for enterprises but wrong for SMBs)
- No discussion of handle positioning relative to market maturity (early market = different positioning than mature market)

**Output Format Specificity**: VERY HIGH (enumerated field rules, valid values documented)

**Examples Provided**: NO

**Tool Usage Guidance**: LOW (step 4 has no tool specification)

**Quality Criteria**: LOW (scoring scales undefined)

**Client Context**: LOW (assumes single positioning; doesn't address segmented positioning)

**Rating: 6/10** — Clear schema but weak methodology; step 4 is underspecified

---

### 5. Strategic Synthesis (195 lines)
**File**: `src/lib/ai/skills/strategic-synthesis/SKILL.md`
**Supporting Materials**: None

**Strengths**:
- No external tools required — synthesis-only, clean contract
- 5-step synthesis process (extract themes → prioritize → identify tensions → messaging framework → budget allocation)
- Messaging framework is sophisticated: ad hooks with technique classification + target awareness levels
- Technique taxonomy is specified (controversial, revelation, myth-bust, etc.)
- Awareness level taxonomy is specified (unaware → product-aware → most-aware)
- Proof points paired with evidence and source — traceable recommendations
- Objection handlers with response + reframe is mature sales psychology
- Budget allocation with percentage breakdown + reasoning is actionable
- Extensive field documentation and enum rules

**Weaknesses**:
- "Extract Key Themes" is vague (how many themes? search for "recurring" patterns but no threshold)
- Ad hook "technique classification" provides taxonomy but NO examples (what does "revelation" actually sound like?)
- Target awareness classification has 5 levels but no guidance on which awareness level needs which technique
- "If hooks were extracted or inspired by competitor ads, note the source" — but how? what if 70% of hooks come from competitors?
- Messaging angle "target emotion" is vague (which emotions for B2B software? fear of downtime? hope for efficiency? aspiration?)
- Budget allocation assumes single budget constraint, no discussion of phasing or ramp (spend $100/day week 1 or $1000/day?)
- "Every recommendation must trace back to a specific finding" is good rule but no guidance on depth (can you reference "market growth" or must you cite specific percentage?)
- No discussion of how messaging framework changes for different buying committee members

**Output Format Specificity**: VERY HIGH (14+ labeled JSON fields with enum validation)

**Examples Provided**: NO (no example hooks, angles, proof points, objection handlers)

**Tool Usage Guidance**: N/A (synthesis-only, by design)

**Quality Criteria**: LOW (technique/awareness taxonomy provided but no execution examples)

**Client Context**: LOW (assumes one-size-fits-all messaging; no segmentation guidance)

**Rating: 6/10** — Strong taxonomy but zero examples; hook techniques undefined

---

### 6. Keyword Intelligence (130 lines)
**File**: `src/lib/ai/skills/keyword-intel/SKILL.md`
**Supporting Materials**: None

**Strengths**:
- 7-step process with explicit tool calls and extraction fields
- Negative keyword analysis included (7 lines dedicated to exclusion logic)
- Content topic clusters with theme names, keywords, volume, format recommendations — structural thinking
- Four strategic recommendation lists (organic, paid search, competitive positioning, quick wins) — comprehensive
- Prose generation requirement ensures analysis depth, not just data dump
- SEO audit with technical metrics (sitemap found, robots.txt found) and Core Web Vitals

**Weaknesses**:
- "Keyword Opportunity Table" requires "at least 20 keyword opportunities" but no guidance on which 20 (volume? commercial intent? mix?)
- Commercial intent is mentioned in rules ("Prioritize keywords by commercial intent, not just volume") but not defined (how do you measure intent from volume/CPC data?)
- Competitive positioning advice is mentioned but no guidance on how to identify non-branded opportunities that competitors DON'T own
- Long-tail opportunities step (Step 4) has vague query ("long tail keywords buyer intent search queries") — what if tool doesn't return long-tail specifically?
- Content topic clusters have no minimum/maximum size guidance (3 keywords per theme? 20?)
- "Expected CPC ranges and click volume estimates per budget level" in prose generation is asked for but no methodology (how to estimate?)
- Prose analysis should cover "Budget allocation recommendations across keyword themes" — but no budgeting framework provided
- Difference between organic strategy (SEO) and paid search strategy not clearly bounded

**Output Format Specificity**: HIGH (8+ labeled sections with field definitions)

**Examples Provided**: NO

**Tool Usage Guidance**: MEDIUM (tool calls clear but success criteria vague)

**Quality Criteria**: LOW (20 keywords minimum but no quality standards)

**Client Context**: VERY LOW (assumes SaaS; ignores industry-specific keyword patterns like B2B2C or affiliate marketing)

**Rating: 5.5/10** — Clear structure but methodology gaps; "intent" undefined

---

### 7. Media Plan (135 lines)
**File**: `src/lib/ai/skills/media-plan/SKILL.md`
**Supporting Materials**: None

**Strengths**:
- Explicitly requires ALL 10 sub-sections (executiveSummary through riskMonitoring) — ensures comprehensive output
- Platform-level QVC scoring (Quality-Value-Cost) with 5 specific factors is sophisticated
- Campaign phases with duration, objective, activities, success criteria, budget, go/no-go gates — project management rigor
- KPI targets with scenario thresholds (best/base/worst) enables sensitivity analysis
- Performance model includes LTV:CAC ratio — full CAC economics
- Risk register with category enum (budget/creative/audience/platform/compliance/market) and mitigation + contingency
- Campaign naming conventions mentioned (but see weakness)

**Weaknesses**:
- 6-step planning process is listed but massively underspecified compared to other skills (step 1 is 9 lines, other skills have 30+ lines per step)
- Channel selection is "Based on ICP channel preferences and competitor analysis" but what if those conflict? No tiebreaker logic
- QVC scoring (each factor 1-10) has no rubric (is "targetingPrecision 8" achievable on LinkedIn for any audience, or only some?)
- Budget allocation "must sum to 100%" but no guidance on minimum platform budgets (can you allocate 5% to a channel and run statistically valid tests?)
- Campaign structure lists "naming conventions" but no examples (LI-Brand-Awareness-CAC or something else?)
- Retargeting segments "source, lookback days, messaging approach" — no guidance on which lookback windows work (30, 60, 90 days? depends on sales cycle?)
- Negative keywords "with match type and exclusion rationale" — but keyword research is a SEPARATE skill; circular dependency?
- Creative testing plan has "phases: variants, methodology, budget, duration" but no methodology guidance (A/B? multivariate? Bayesian?)
- Monthly roadmap with "scaling triggers" mentioned but no examples (e.g., "if CPL drops below $50, scale by 20%?")
- Assumes "provided monthly budget" but doesn't discuss budget source/procurement
- Performance model "must be internally consistent" but no validation examples (e.g., can you have 1000 leads but 0 conversions?)

**Output Format Specificity**: MEDIUM-HIGH (10 required sub-sections but Step 3 example shows 4+ fields per sub-section; structure is there but fields are light)

**Examples Provided**: NO

**Tool Usage Guidance**: VERY LOW (Step 1 mentions search_market_data for benchmarks, Step 2 mentions check_page_speed but that's all)

**Quality Criteria**: MEDIUM (QVC framework exists but no rubric; consistency rule exists but no examples)

**Client Context**: VERY LOW (assumes single large budget; no discussion of bootstrapped startup vs. VC-funded)

**Rating: 5/10** — Most underspecified of all skills; QVC framework is good but execution details missing

---

## Cross-Skill Patterns

### What's Strong Across All Skills
1. **Output schemas** are detailed with exact field names, enums, and validation rules
2. **CRITICAL RULES** section explicitly forbids fabrication and emphasize tool-reliance
3. **Multi-step processes** provide structured thinking (most have 4-7 steps)
4. **Final verdict/recommendation** fields provide clear decision gates

### What's Weak Across All Skills
1. **Zero good/bad examples** except Industry Research (which has only 1 example output)
2. **Vague scoring systems** (1-10 scales without rubrics; "coherence," "clarity," "relevance" undefined)
3. **No client context** about who this agency serves (B2B SaaS? B2C? Marketplace?)
4. **Tool error recovery** is rarely addressed (what if tool returns no results? vague data?)
5. **Interdependencies** across skills are complex but only briefly mapped
6. **No "confidence" or "data quality" meta-guidance** (when to flag uncertainty?)

### Supporting Materials
Only **industry-research** has a supporting file (output-example.md). 
**Zero skills have:**
- Bad output examples (for comparison)
- Tool usage walkthroughs
- Rubrics for scoring
- Case study examples
- FAQ troubleshooting

---

## Recommendations for Improvement

### High Impact (for Ammar's team)
1. **Add 2-3 example outputs per skill** — show "excellent," "good," "needs revision" for same input
2. **Create rubrics for all 1-10 scales** — what's a 5 vs. a 7 vs. a 9?
3. **Document interdependencies** — explicit "you will receive X from skill Y" sections
4. **Add "client context" section** to each skill — "This skill assumes B2B SaaS to $100M+ enterprises"
5. **Tool error recovery** — "If tool returns no results, try X then Y then Z"

### Medium Impact
1. **FAQ sections** per skill with "What if competitor pricing is private?" answers
2. **Field mapping diagrams** showing how skill output schema maps to frontend render components
3. **Confidence/quality flags** — tell Claude when to mark data as "uncertain"

### Low Impact (Nice to Have)
1. Competitive technique taxonomy with examples (e.g., "revelation: 'X% of teams still use Y [old way]'")
2. Sample messaging frameworks from real case studies
3. Video walkthroughs of tool usage

---

## V1 Output Quality Reference
The `output-example.md` for Industry Research shows:
- Citation format: "(Source: search_market_data — 'query text')"
- Metric precision: "$273.6B in 2023 and is projected to reach $908.2B by 2030"
- Narrative structure: Pain point → Source attribution → Implication pattern
- Specificity: "3-5 stakeholders, 45-90 day sales cycle" not "team, moderate timeline"

This sets a good bar, but only exists for Industry Research.

---

## Scoring Summary

| Skill | Output Format | Examples | Tool Guidance | Quality Criteria | Client Context | **Overall** |
|-------|---|---|---|---|---|---|
| Industry Research | 7 | ✓ 1 | 6 | 6 | 3 | **7/10** |
| Competitor Intel | 8 | ✗ | 7 | 5 | 3 | **6.5/10** |
| ICP Validation | 9 | ✗ | 5 | 5 | 2 | **6/10** |
| Offer Analysis | 9 | ✗ | 4 | 4 | 3 | **6/10** |
| Strategic Synthesis | 9 | ✗ | N/A | 4 | 2 | **6/10** |
| Keyword Intel | 8 | ✗ | 5 | 4 | 1 | **5.5/10** |
| Media Plan | 7 | ✗ | 3 | 5 | 2 | **5/10** |

**Average: 6.1/10** (range: 5-7)

---

## Conclusion

The skills are **production-ready in structure** (all have detailed output schemas) but **not ideal for high-quality research execution**. A senior strategist could produce output that matches the schema, but might produce mediocre insights because:

1. No examples to emulate
2. No quality rubrics to calibrate against
3. No client context to focus the research
4. No guidance on which tools to prioritize if all return data

**Recommended next step**: Invest 1-2 days in creating:
- 2-3 reference outputs per skill (good/mediocre/needs-work)
- One-page rubric per 1-10 score scale
- "Client profile" section for each skill documenting assumptions
