# AIGOS Layer B Public-Repo Skills Research

Generated: 2026-04-28  
Scope: recommendation-only research for Tier-2 and Tier-3 AIGOS Layer B skill files.  
Edits made to skill files: none.

## Public-Repo Shortlist

Metadata was verified from GitHub repository metadata or live public-index pages during this pass. "No license detected" means the GitHub repo metadata did not expose a license; recommendations below adapt methodology only and do not copy text or code.

| Repo | Stars | Last commit / push | License note | Relevant files or patterns |
|---|---:|---|---|---|
| [superamped/ai-marketing-skills](https://github.com/superamped/ai-marketing-skills) | 35 | 2026-03-14 | MIT | Existing AIGOS citation; marketing skill pack with competitor and SEO patterns. |
| [OpenClaudia/openclaudia-skills](https://github.com/OpenClaudia/openclaudia-skills) | 403 | 2026-04-24 | MIT | Broad marketing skill catalog: keyword research, competitor analysis, ads, CRO, pricing. |
| [BrianRWagner/ai-marketing-claude-code-skills](https://github.com/BrianRWagner/ai-marketing-claude-code-skills) | 259 | 2026-03-19 | No license detected | Practical marketing skills with context-loading gates, Reddit/community research, positioning, voice extraction. |
| [docaohieu2808/claude-skills](https://github.com/docaohieu2808/claude-skills) | 0 | 2026-03-09 | No license detected in GitHub metadata | Skill-indexed marketing-research package surfaced by SkillsMP. |
| [brightdata/skills](https://github.com/brightdata/skills) | 67 | 2026-04-28 | MIT | Competitive-intel skill with data-source guide, output templates, and analysis frameworks. |
| [natea/ar-claude-skills](https://github.com/natea/ar-claude-skills) | 6 | 2025-10-22 | No license detected | Product marketing, competitive intelligence, UX persona generation, documentation control. |
| [glebis/claude-skills](https://github.com/glebis/claude-skills) | 135 | 2026-04-27 | No license detected | Fathom/transcript ingestion, meeting processing, JTBD/review mining, dashboard block libraries. |
| [jesseotremblay/claude-skills](https://github.com/jesseotremblay/claude-skills) | 2 | 2025-10-23 | No license detected | Customer analysis / VoC skill patterns. |
| [paperclipai/companies](https://github.com/paperclipai/companies) | 485 | 2026-03-23 | No license detected | Company/product-compass skill patterns including competitor-analysis. |
| [majiayu000/claude-skill-registry](https://github.com/majiayu000/claude-skill-registry) | 222 | 2026-04-28 | MIT | Skill registry containing competitor-analysis and product/marketing skills. |
| [kenneth-liao/ai-launchpad-marketplace](https://github.com/kenneth-liao/ai-launchpad-marketplace) | 124 | 2026-03-23 | No license detected | Business competitor-analysis skill in public marketplace. |
| [iclaudioo/marketing-science-skills](https://github.com/iclaudioo/marketing-science-skills) | 0 | 2026-03-22 | MIT | Marketing-science competitor-analysis patterns with battlecard and market-analysis framing. |
| [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) | 5,664 | 2026-04-28 | MIT | SEO and keyword research suite with DataForSEO / SERP / AI visibility boundaries. |
| [johssinma/audit-my-site](https://github.com/johssinma/Audit-my-site) | 0 | 2026-03-20 | No license detected | Marketing audit toolkit with competitor, CRO, funnel, and content audit commands. |
| [alirezarezvani/claude-skills](https://github.com/alirezarezvani/claude-skills) | 13,023 | 2026-04-28 | MIT | Large Claude skill library with marketing, product, compliance, C-level advisory patterns. |
| [daymade/claude-code-skills](https://github.com/daymade/claude-code-skills) | 943 | 2026-04-28 | MIT | Skill-creator and marketplace conventions; useful for Anthropic-style skill structure. |
| [anthropics/skills](https://github.com/anthropics/skills) | 125,307 | 2026-04-23 | No license detected | Canonical public Agent Skills structure and progressive-disclosure convention. |
| [openclaw/skills](https://github.com/openclaw/skills) | 4,416 | 2026-04-28 | MIT | Public skill library; strongest relevant pattern is competitive-intelligence-market-research. |
| [ericosiu/ai-marketing-skills](https://github.com/ericosiu/ai-marketing-skills) | 2,204 | 2026-04-17 | MIT | Marketing / SEO operations skill patterns. |
| [realjaymes/marketingagentskills](https://github.com/realjaymes/marketingagentskills) | 25 | 2026-04-27 | MIT | ICP persona, performance marketing, and operating checklist patterns. |

Additional methodology repos used for targeted gaps: [m-bain/whisperX](https://github.com/m-bain/whisperX) (21,551 stars, 2026-04-04, BSD-2-Clause), [pyannote/pyannote-audio](https://github.com/pyannote/pyannote-audio) (9,842, 2026-02-07, MIT), [apify/crawlee](https://github.com/apify/crawlee) (23,004, 2026-04-28, Apache-2.0), [firecrawl/firecrawl](https://github.com/firecrawl/firecrawl) (112,809, 2026-04-28, AGPL-3.0), [scrapy/scrapy](https://github.com/scrapy/scrapy) (61,482, 2026-04-28, BSD-3-Clause), [Unstructured-IO/unstructured](https://github.com/Unstructured-IO/unstructured) (14,581, 2026-04-26, Apache-2.0), [docling-project/docling](https://github.com/docling-project/docling) (58,716, 2026-04-28, MIT), [dedupeio/dedupe](https://github.com/dedupeio/dedupe) (4,456, 2025-07-29, MIT), [moj-analytical-services/splink](https://github.com/moj-analytical-services/splink) (2,106, 2026-04-15, MIT), and [zentity-io/zentity](https://github.com/zentity-io/zentity) (167, 2025-01-14, Apache-2.0).

## Recommendation Blocks

## skills/research-competitor/ — prompts/collector.md

- Tier: 2
- Existing gap (from audit): phase 4 ad-fetch protocol underspecified
- Public sources reviewed: [brightdata/skills](https://github.com/brightdata/skills) (67, 2026-04-28, MIT), [openclaw/skills](https://github.com/openclaw/skills) (4,416, 2026-04-28, MIT), [superamped/ai-marketing-skills](https://github.com/superamped/ai-marketing-skills) (35, 2026-03-14, MIT)
- Strongest external pattern: Bright Data's competitive-intel skill separates live data collection needs from output templates and source guides; adapt that as an ad-fetch source ledger. Attribution: [brightdata/skills](https://github.com/brightdata/skills). License check: MIT.
- Recommended edit to `skills/research-competitor/prompts/collector.md`:
  - WHY this fills the gap: Phase 4 already names SearchAPI, but a ledger makes ad page matching, no-match states, and provider failures auditable.
  - WHAT to add:
```md
### Phase 4.5 — Ad Fetch Source Ledger

For each competitor ad fetch, record:
- `competitor_name`
- `domain`
- `matched_advertiser_name`
- `matched_ad_library_url`
- `provider`: `searchapi_meta_ads`
- `provider_status`: `matched`, `no_match`, `provider_error`, or `missing_key`
- `retrieved_at`
- `reason` for `no_match` or `provider_error`

Only merge ad hooks, active counts, or activity signals when `provider_status` is `matched`.
If status is not `matched`, preserve the attempted library URL and add a source gap.
```
  - VERBATIM vs ADAPTED: ADAPTED from Bright Data's source-guide separation pattern; no external text copied.
- Rejections: Do not import Bright Data CLI, Apify, Meta scraping, or broad battlecard templates. Keep the current SearchAPI path and AIGOS schema.

## skills/ingest-fathom/ — references/collector.md

- Tier: 2
- Existing gap (from audit): missing transcript-edge-case do/don't list
- Public sources reviewed: [m-bain/whisperX](https://github.com/m-bain/whisperX) (21,551, 2026-04-04, BSD-2-Clause), [pyannote/pyannote-audio](https://github.com/pyannote/pyannote-audio) (9,842, 2026-02-07, MIT), [glebis/claude-skills](https://github.com/glebis/claude-skills) (135, 2026-04-27, no license detected)
- Strongest external pattern: WhisperX separates ASR text, word alignment, and diarization; adapt that into quote anchoring and speaker-provenance rules. Attribution: [m-bain/whisperX](https://github.com/m-bain/whisperX). License check: BSD-2-Clause.
- Recommended edit to `skills/ingest-fathom/references/collector.md`:
  - WHY this fills the gap: It tells the collector how to handle Fathom transcript edge cases without pretending diarized labels are verified identities.
  - WHAT to add:
```md
## Transcript Edge Cases

Do:
- Preserve Fathom speaker labels exactly.
- Treat `Speaker 1` style labels as labels, not verified names.
- Anchor every quote to an exact transcript substring.
- Preserve timestamps when provided by the source packet.
- Add `source_gaps` when timestamps, named speakers, or transcript segments are missing.

Do not:
- Infer speaker roles from conversational behavior.
- Rewrite quotes for grammar or clarity.
- Merge adjacent speakers into one quote.
- Emit key moments when the supporting quote cannot be found exactly.
```
  - VERBATIM vs ADAPTED: ADAPTED from transcript alignment / diarization methodology; no external wording copied.
- Rejections: Do not add WhisperX, pyannote, audio diarization, or new parsing dependencies to this skill.

## skills/research-voc/ — references/collector.md

- Tier: 2
- Existing gap (from audit): pattern-only, missing claim-chain guidance
- Public sources reviewed: [BrianRWagner/ai-marketing-claude-code-skills](https://github.com/BrianRWagner/ai-marketing-claude-code-skills) (259, 2026-03-19, no license detected), [realjaymes/marketingagentskills](https://github.com/realjaymes/marketingagentskills) (25, 2026-04-27, MIT), [jesseotremblay/claude-skills](https://github.com/jesseotremblay/claude-skills) (2, 2025-10-23, no license detected)
- Strongest external pattern: Brian Wagner's Reddit/community research skills emphasize finding lived language before synthesis; adapt that into a strict quote-to-claim chain. Attribution: [BrianRWagner/ai-marketing-claude-code-skills](https://github.com/BrianRWagner/ai-marketing-claude-code-skills). License check: no license detected, so methodology only.
- Recommended edit to `skills/research-voc/references/collector.md`:
  - WHY this fills the gap: VoC output becomes defensible when every category claim traces to retained first-person evidence.
  - WHAT to add:
```md
## Claim Chain

For each retained VoC item, preserve this chain:
1. exact user language
2. source URL and retrieved_at
3. source type: forum, review_site, community, blog_comment, or search_result
4. category-safe reason
5. excluded terms checked
6. mapped output bucket

Do not write a broad pattern unless at least two retained quotes support it.
If only one strong quote exists, keep the quote but avoid naming it a pattern.
```
  - VERBATIM vs ADAPTED: ADAPTED from community-research source discipline; no external text copied.
- Rejections: Reject sentiment scores, generic social-listening trend summaries, named-product review mining, and strategy recommendations.

## skills/research-icp/ — references/rules.md

- Tier: 2
- Existing gap (from audit): only 3 rules
- Public sources reviewed: [realjaymes/marketingagentskills](https://github.com/realjaymes/marketingagentskills) (25, 2026-04-27, MIT), [natea/ar-claude-skills](https://github.com/natea/ar-claude-skills) (6, 2025-10-22, no license detected), [robertbstillwell/marketing-skills](https://github.com/robertbstillwell/marketing-skills) (4, 2026-03-02, no license detected)
- Strongest external pattern: ICP/persona skills separate role signals, pain signals, and buying involvement; adapt that without fictional persona bios. Attribution: [realjaymes/marketingagentskills](https://github.com/realjaymes/marketingagentskills). License check: MIT.
- Recommended edit to `skills/research-icp/references/rules.md`:
  - WHY this fills the gap: The rules file needs decision criteria for role grouping and exclusions, not just generic source requirements.
  - WHAT to add:
```md
## Role-Family Evidence

Before grouping an ICP role family, require sourced evidence for:
- role or title
- company context
- pain, trigger, or workflow
- current alternative or process
- buying involvement, when available

If evidence proves usage only, label the role as a user.
Do not upgrade a role to champion, buyer, or decision maker without source support.
```
  - VERBATIM vs ADAPTED: ADAPTED from ICP/persona evidence-packet patterns; no external wording copied.
- Rejections: Reject fictional buyer names, demographics, psychographics, persona scores, outreach channels, and campaign advice.

## skills/research-market/ — references/collector.md

- Tier: 2
- Existing gap (from audit): thin on evidence weighting
- Public sources reviewed: [openclaw/skills](https://github.com/openclaw/skills) (4,416, 2026-04-28, MIT), [langchain-ai/open_deep_research](https://github.com/langchain-ai/open_deep_research) (11,259, 2026-04-28, MIT), [brightdata/skills](https://github.com/brightdata/skills) (67, 2026-04-28, MIT)
- Strongest external pattern: Open Deep Research uses clarify / brief / supervisor phases before synthesis; adapt that as evidence weighting before market signals are promoted. Attribution: [langchain-ai/open_deep_research](https://github.com/langchain-ai/open_deep_research). License check: MIT.
- Recommended edit to `skills/research-market/references/collector.md`:
  - WHY this fills the gap: Market sizing and timing signals need a rule for direct, proxy, weak, and rejected evidence.
  - WHAT to add:
```md
## Evidence Weighting

Use this precedence when promoting market evidence:
1. first-party or official source for category boundary
2. named analyst, government, or platform data for market sizing
3. recent independent source for timing or adoption signals
4. proxy evidence only when labeled as proxy

Keep a signal only when scope, date, and category fit are clear.
If evidence is adjacent, parent-market, stale, or weak, label it as context or move it to `source_gaps`.
```
  - VERBATIM vs ADAPTED: ADAPTED from staged research quality gates; no external text copied.
- Rejections: Reject broad trend reports without scope, prescriptive strategy playbooks, and unsourced TAM/SAM/SOM numbers.

## skills/research-offer/ — references/collector.md

- Tier: 2
- Existing gap (from audit): lacks decision criteria for funnel mapping
- Public sources reviewed: [realjaymes/marketingagentskills](https://github.com/realjaymes/marketingagentskills) (25, 2026-04-27, MIT), [robertbstillwell/marketing-skills](https://github.com/robertbstillwell/marketing-skills) (4, 2026-03-02, no license detected), [johssinma/Audit-my-site](https://github.com/johssinma/Audit-my-site) (0, 2026-03-20, no license detected)
- Strongest external pattern: Performance-marketing checklists separate entry point, setup, first value, and proof; adapt that as funnel mapping. Attribution: [realjaymes/marketingagentskills](https://github.com/realjaymes/marketingagentskills). License check: MIT.
- Recommended edit to `skills/research-offer/references/collector.md`:
  - WHY this fills the gap: The collector can map public offer evidence into funnel stages without recommending funnel changes.
  - WHAT to add:
```md
### Funnel Mapping Criteria

Map public evidence by observable user step:
- `entry`: CTA, signup, demo, download, contact, or checkout path
- `activation`: import, integration, setup, permissions, onboarding, or template use
- `first_value`: first report, workflow, asset, automation, insight, or completed task
- `proof`: customer story, testimonial, logo, public metric, or named outcome
- `friction`: migration, security review, admin setup, billing, seat, or implementation requirement

If a stage is not publicly visible, leave the array empty and add a source gap.
```
  - VERBATIM vs ADAPTED: ADAPTED from funnel and performance-checklist structure; no external wording copied.
- Rejections: Reject CRO recommendations, ad funnel advice, conversion scoring, and copy generation.

## skills/synthesize-media-plan/ — references/block-prompts.md

- Tier: 2
- Existing gap (from audit): no valid/invalid block examples
- Public sources reviewed: [aws-solutions-library-samples/guidance-for-advertising-agents-on-aws](https://github.com/aws-solutions-library-samples/guidance-for-advertising-agents-on-aws) (16, 2026-04-14, MIT-0), [langchain-ai/social-media-agent](https://github.com/langchain-ai/social-media-agent) (2,525, 2026-04-28, MIT), [realjaymes/marketingagentskills](https://github.com/realjaymes/marketingagentskills) (25, 2026-04-27, MIT)
- Strongest external pattern: LangChain Social Agent separates content-generation structure from follow-up/update rules; adapt that as valid/invalid block examples. Attribution: [langchain-ai/social-media-agent](https://github.com/langchain-ai/social-media-agent). License check: MIT.
- Recommended edit to `skills/synthesize-media-plan/references/block-prompts.md`:
  - WHY this fills the gap: Valid/invalid examples make schema-preserving generation easier and reduce benchmark/budget hallucination.
  - WHAT to add:
```md
## Valid / Invalid Block Examples

Valid `channelMix` item:
- names one channel
- cites cross-analysis evidence
- explains role without inventing CAC, CPL, or conversion rate

Invalid `channelMix` item:
- adds a platform absent from evidence
- predicts performance from category norms
- uses "best practice" as proof

Valid `industryBenchmarks` item:
- includes source URL, retrieved_at, metric label, and stated range.

Invalid benchmark:
- "Typical SaaS CPL is $X" without supplied evidence.
```
  - VERBATIM vs ADAPTED: ADAPTED from structure-vs-content rule separation; no external text copied.
- Rejections: Reject copied campaign templates, platform defaults, AWS AgentCore architecture, and invented KPI ranges.

## skills/synthesize-media-plan/ — references/guardrails.md

- Tier: 2
- Existing gap (from audit): no phase-transition do/don't list
- Public sources reviewed: [langchain-ai/open_deep_research](https://github.com/langchain-ai/open_deep_research) (11,259, 2026-04-28, MIT), [aws-solutions-library-samples/guidance-for-advertising-agents-on-aws](https://github.com/aws-solutions-library-samples/guidance-for-advertising-agents-on-aws) (16, 2026-04-14, MIT-0), [langchain-ai/social-media-agent](https://github.com/langchain-ai/social-media-agent) (2,525, 2026-04-28, MIT)
- Strongest external pattern: Open Deep Research keeps clear phase handoffs before final synthesis; adapt that into media-plan phase transition rules. Attribution: [langchain-ai/open_deep_research](https://github.com/langchain-ai/open_deep_research). License check: MIT.
- Recommended edit to `skills/synthesize-media-plan/references/guardrails.md`:
  - WHY this fills the gap: It prevents readiness blockers from being blurred into normal evidence gaps.
  - WHAT to add:
```md
## Phase Transition Do / Don't

Do:
- Treat `research-cross` as the only allowed upstream evidence.
- Stop when readiness blockers are present.
- Use `source_gaps` for remaining limits after blockers are clear.
- Keep budget shares as allocation logic, not performance forecasts.

Do not:
- Reopen blocked strategic decisions.
- Downgrade blockers into source gaps.
- Add channels, benchmarks, or audiences absent from cross-analysis evidence.
- Forecast CAC, CPL, ROAS, or conversion rates without supplied evidence.
```
  - VERBATIM vs ADAPTED: ADAPTED from phase-gated deep-research workflow; no external wording copied.
- Rejections: Reject multi-agent ad platform architecture, generic media-plan best practices, and benchmark filler.

## skills/research-keywords/ — references/collector.md

- Tier: 2
- Existing gap (from audit): no de-dupe / fallback rules
- Public sources reviewed: [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) (5,664, 2026-04-28, MIT), [ericosiu/ai-marketing-skills](https://github.com/ericosiu/ai-marketing-skills) (2,204, 2026-04-17, MIT), [robertbstillwell/marketing-skills](https://github.com/robertbstillwell/marketing-skills) (4, 2026-03-02, no license detected)
- Strongest external pattern: SEO skill suites keep provider status separate from keyword metrics; adapt that with deterministic dedupe and fallback behavior. Attribution: [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo). License check: MIT.
- Recommended edit to `skills/research-keywords/references/collector.md`:
  - WHY this fills the gap: It prevents duplicate query clusters and fake zero metrics when providers are unavailable.
  - WHAT to add:
```md
## De-Dupe And Fallback

Normalize candidate keywords by:
- lowercasing
- trimming
- collapsing whitespace
- removing duplicate punctuation
- preserving the first sourced spelling

If a paid provider is unavailable:
- set metric fields as absent, not zero
- emit provider_status with attempted source
- add a matching source gap
- still collect public SERP/content patterns when available

Do not merge distinct intents just because normalized text matches.
```
  - VERBATIM vs ADAPTED: ADAPTED from SEO provider-status patterns; no external code copied.
- Rejections: Reject KOB scoring, traffic forecasts, budget recommendations, and fake keyword difficulty.

## skills/chat-refine/ — references/collector.md

- Tier: 2
- Existing gap (from audit): no field-edit decision matrix
- Public sources reviewed: [langchain-ai/open-canvas](https://github.com/langchain-ai/open-canvas) (5,440, 2026-02-25, MIT, archived), [langchain-ai/social-media-agent](https://github.com/langchain-ai/social-media-agent) (2,525, 2026-04-28, MIT), [glebis/claude-skills](https://github.com/glebis/claude-skills) (135, 2026-04-27, no license detected)
- Strongest external pattern: Open Canvas routes chat requests by artifact/update intent before changing an artifact; adapt that as an edit decision matrix. Attribution: [langchain-ai/open-canvas](https://github.com/langchain-ai/open-canvas). License check: MIT.
- Recommended edit to `skills/chat-refine/references/collector.md`:
  - WHY this fills the gap: It forces a precise target and prevents broad chat from becoming silent card mutation.
  - WHAT to add:
```md
## Field-Edit Decision Matrix

Use `answer` when the user asks what the cards mean.
Use `edit_card` when the user names one card and one editable field.
Use `regenerate_fragment` when the user asks to rewrite one section from existing evidence.
Use `update_profile` only when the user explicitly changes a brief/profile field.
Use `blocked` when fresh research, missing card IDs, or ambiguous fields are required.

Never edit by label when multiple cards share the label.
Never apply a proposal inside this skill.
```
  - VERBATIM vs ADAPTED: ADAPTED from artifact-intent routing; no external text copied.
- Rejections: Reject auto-apply behavior, research dispatch, broad strategy generation, and Supabase persistence.

## skills/research-keywords/ — references/rules.md

- Tier: 2
- Existing gap (from audit): no volume thresholds, intent tiering
- Public sources reviewed: [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo) (5,664, 2026-04-28, MIT), [anyin-ai/aperture](https://github.com/anyin-ai/aperture) (9, 2026-03-11, MIT), [OpenClaudia/openclaudia-skills](https://github.com/OpenClaudia/openclaudia-skills) (403, 2026-04-24, MIT)
- Strongest external pattern: Keyword and AI-visibility tools separate metric availability from intent classification; adapt that as threshold discipline. Attribution: [AgriciDaniel/claude-seo](https://github.com/AgriciDaniel/claude-seo). License check: MIT.
- Recommended edit to `skills/research-keywords/references/rules.md`:
  - WHY this fills the gap: It gives the collector clear tiers without turning unavailable metrics into fake volume bands.
  - WHAT to add:
```md
## Volume And Intent Tiering

Use volume tiers only when a provider returns sourced volume:
- `no_volume_data`: provider unavailable or omitted volume
- `low`: 1-100 monthly searches
- `medium`: 101-1,000 monthly searches
- `high`: 1,001+ monthly searches

Intent precedence:
1. pricing, comparison, competitor, implementation
2. solution
3. category
4. problem
5. content_gap

When volume is missing, classify intent but do not infer demand size.
```
  - VERBATIM vs ADAPTED: ADAPTED from SEO metric/intent separation; no external text copied.
- Rejections: Reject opportunity scores, AI-visibility scores as keyword volume, and budget advice.

## skills/ingest-url/ — references/collector.md

- Tier: 2
- Existing gap (from audit): no fallback for crawl limits
- Public sources reviewed: [apify/crawlee](https://github.com/apify/crawlee) (23,004, 2026-04-28, Apache-2.0), [firecrawl/firecrawl](https://github.com/firecrawl/firecrawl) (112,809, 2026-04-28, AGPL-3.0), [scrapy/scrapy](https://github.com/scrapy/scrapy) (61,482, 2026-04-28, BSD-3-Clause), [scrapy/w3lib](https://github.com/scrapy/w3lib) (419, 2026-04-27, BSD-3-Clause)
- Strongest external pattern: Crawlee-style bounded queues plus URL normalization; adapt as collection limits and fallback reporting. Attribution: [apify/crawlee](https://github.com/apify/crawlee). License check: Apache-2.0.
- Recommended edit to `skills/ingest-url/references/collector.md`:
  - WHY this fills the gap: The collector gets explicit behavior for runaway sites, JS-heavy pages, and unreachable URLs.
  - WHAT to add:
```md
## Crawl Limits And Fallbacks

Stay bounded:
- max candidate pages: 25
- max selected pages: 12
- max depth: 2 from submitted root URL
- same-origin HTTP(S) only
- strip hash fragments and tracking query params before dedupe

If a page is blocked, too large, JS-empty, or repeatedly 4xx/5xx:
- do not guess field values
- keep already fetched evidence
- add unresolved fields or source gaps naming the blocked page and needed evidence
```
  - VERBATIM vs ADAPTED: ADAPTED from crawler budget patterns; no external code copied.
- Rejections: Reject Firecrawl SDK adoption, AGPL code reuse, broad web crawl architecture, and guessed canonical pages.

## skills/present-workspace/ — references/card-taxonomy.md

- Tier: 2
- Existing gap (from audit): minimal status decision tree
- Public sources reviewed: [jontsai/openclaw-command-center](https://github.com/jontsai/openclaw-command-center) (227, 2026-03-30, MIT), [glebis/claude-skills](https://github.com/glebis/claude-skills) (135, 2026-04-27, no license detected), [nexu-io/open-design](https://github.com/nexu-io/open-design) (599, 2026-04-28, Apache-2.0)
- Strongest external pattern: OpenClaw Command Center keeps visible per-panel status rather than collapsing the whole dashboard on one failure. Attribution: [jontsai/openclaw-command-center](https://github.com/jontsai/openclaw-command-center). License check: MIT.
- Recommended edit to `skills/present-workspace/references/card-taxonomy.md`:
  - WHY this fills the gap: It makes status computation concrete while keeping the skill data-only and portable.
  - WHAT to add:
```md
## Status Decision Tree

For each card:
1. Upstream path absent -> `missing`
2. Upstream JSON parse or transform failed -> `error`
3. Renderable sections exist but evidence or gaps are weak -> `partial`
4. Renderable sections, preserved evidence, and source_gaps exist -> `ready`

Workspace status is derived from card counts.
One failed upstream output must not change unrelated cards to `error`.
```
  - VERBATIM vs ADAPTED: ADAPTED from dashboard per-panel status isolation; no external text copied.
- Rejections: Reject React dashboard implementation, app type imports, Supabase writes, and new card types.

## skills/present-workspace/ — references/rules.md

- Tier: 3
- Existing gap (from audit): 12 lines, pure negation
- Public sources reviewed: [jontsai/openclaw-command-center](https://github.com/jontsai/openclaw-command-center) (227, 2026-03-30, MIT), [langchain-ai/open_deep_research](https://github.com/langchain-ai/open_deep_research) (11,259, 2026-04-28, MIT), [glebis/claude-skills](https://github.com/glebis/claude-skills) (135, 2026-04-27, no license detected)
- Strongest external pattern: OpenClaw Command Center status panels make status visible per unit; adapt that to workspace cards. Attribution: [jontsai/openclaw-command-center](https://github.com/jontsai/openclaw-command-center). License check: MIT.
- Recommended edit to `skills/present-workspace/references/rules.md`:
  - WHY this fills the gap: The rules file should say what to emit, not only what to avoid.
  - WHAT to add:
```md
## Positive Rules

- Emit exactly the supported 10 card types every run.
- Preserve upstream evidence URLs and retrieval timestamps.
- Preserve upstream `source_gaps`; add a generated gap only for missing or invalid stages.
- Isolate failures to the affected card.
- Derive workspace status from card statuses:
  - all ready -> ready
  - any partial -> partial
  - any missing/error and at least one ready -> partial
  - all missing/error -> error
- Never emit `ready` by title or section count alone.
```
  - VERBATIM vs ADAPTED: ADAPTED from per-panel status visibility; no external wording copied.
- Rejections: Reject UI rendering, mutation of upstream outputs, database writes, and silent fallback to ready.

## skills/ingest-identity/ — references/rules.md

- Tier: 3
- Existing gap (from audit): placeholder, 3 rule headers
- Public sources reviewed: [dedupeio/dedupe](https://github.com/dedupeio/dedupe) (4,456, 2025-07-29, MIT), [moj-analytical-services/splink](https://github.com/moj-analytical-services/splink) (2,106, 2026-04-15, MIT), [zentity-io/zentity](https://github.com/zentity-io/zentity) (167, 2025-01-14, Apache-2.0)
- Strongest external pattern: Entity-resolution libraries define comparison fields before applying match/link gates; adapt that as schema alignment. Attribution: [dedupeio/dedupe](https://github.com/dedupeio/dedupe). License check: MIT.
- Recommended edit to `skills/ingest-identity/references/rules.md`:
  - WHY this fills the gap: The current rules must align with the actual output schema before identity can safely feed downstream skills.
  - WHAT to add:
```md
## Schema Alignment Gate

Rules must match `schemas/output.ts`.

Current schema-required fields:
- `company_name`
- `domain`
- `category`
- `core_keywords`
- `negative_keywords`
- `sources`

Do not hard-fail missing future fields such as `businessModel` or `segments`
until those fields exist in schema. Track future fields as TODOs, not runtime requirements.
```
  - VERBATIM vs ADAPTED: ADAPTED from entity-model discipline; no external text copied.
- Rejections: Reject hidden camelCase aliases, unsupported future fields, fuzzy scores in output, and parent/subsidiary merging without sourced proof.

## skills/ingest-identity/ — prompts/collector.md

- Tier: 3
- Existing gap (from audit): mostly schema boilerplate
- Public sources reviewed: [dedupeio/dedupe](https://github.com/dedupeio/dedupe) (4,456, 2025-07-29, MIT), [moj-analytical-services/splink](https://github.com/moj-analytical-services/splink) (2,106, 2026-04-15, MIT), [adbar/courlan](https://github.com/adbar/courlan) (168, 2025-12-19, Apache-2.0)
- Strongest external pattern: Entity resolution uses field-by-field comparison plus normalized domain matching; adapt that into same-name company ambiguity handling. Attribution: [dedupeio/dedupe](https://github.com/dedupeio/dedupe). License check: MIT.
- Recommended edit to `skills/ingest-identity/prompts/collector.md`:
  - WHY this fills the gap: The collector gets a concrete disambiguation protocol instead of just output-shape instructions.
  - WHAT to add:
```md
## Identity Disambiguation

Resolve the submitted company, not the most famous same-name company.

Priority order:
1. submitted domain and owned pages
2. linked pages from the submitted domain
3. third-party sources only when they confirm the same domain

If name, domain, category, ownership, or product boundary conflicts:
- stop broad collection
- emit only sourced fields that remain safe
- include sources describing the conflict

Do not merge parent, subsidiary, product, or competitor identities.
```
  - VERBATIM vs ADAPTED: ADAPTED from entity-resolution methodology; no external prompt copied.
- Rejections: Reject third-party-only canonical names, fuzzy match scores, invented keywords, and famous-company bias.

## skills/chat-refine/ — prompts/refinement-system.md

- Tier: 3
- Existing gap (from audit): 9 lines
- Public sources reviewed: [langchain-ai/open-canvas](https://github.com/langchain-ai/open-canvas) (5,440, 2026-02-25, MIT, archived), [langchain-ai/social-media-agent](https://github.com/langchain-ai/social-media-agent) (2,525, 2026-04-28, MIT), [anthropics/skills](https://github.com/anthropics/skills) (125,307, 2026-04-23, no license detected)
- Strongest external pattern: Open Canvas validates artifact selection before edit/update actions; adapt that to card/field validation. Attribution: [langchain-ai/open-canvas](https://github.com/langchain-ai/open-canvas). License check: MIT.
- Recommended edit to `skills/chat-refine/prompts/refinement-system.md`:
  - WHY this fills the gap: The system prompt should prevent tool calls until the target card and field are exact.
  - WHAT to add:
```md
Before any tool call:
- Confirm `cardId` exists in supplied context.
- Confirm `fieldPath` or `sectionName` is exact.
- Confirm the requested change can be made from existing supplied evidence.
- If target is ambiguous, ask one concise clarification.
- If fresh evidence is needed, block the request.
- If answering only, do not call a tool.

A tool call returns a proposal only. It does not persist, approve, or version the edit.
```
  - VERBATIM vs ADAPTED: ADAPTED from artifact edit gating; no external text copied.
- Rejections: Reject speculative card mapping, label-only edits when IDs conflict, broad research, and auto-apply.

## skills/chat-refine/ — references/rules.md

- Tier: 3
- Existing gap (from audit): 4 rules, no edit-scope
- Public sources reviewed: [langchain-ai/open-canvas](https://github.com/langchain-ai/open-canvas) (5,440, 2026-02-25, MIT, archived), [langchain-ai/open_deep_research](https://github.com/langchain-ai/open_deep_research) (11,259, 2026-04-28, MIT), [anthropics/skills](https://github.com/anthropics/skills) (125,307, 2026-04-23, no license detected)
- Strongest external pattern: Open Canvas separates general response, update, and follow-up flows; adapt that into allowed edit scope. Attribution: [langchain-ai/open-canvas](https://github.com/langchain-ai/open-canvas). License check: MIT.
- Recommended edit to `skills/chat-refine/references/rules.md`:
  - WHY this fills the gap: It removes drift toward research tools and makes the sidecar boundary explicit.
  - WHAT to add:
```md
## Edit Scope

Allowed:
- answer questions about supplied cards
- propose one field edit to one visible card
- propose one narrow section regeneration from existing evidence
- propose an explicit profile-field update when the user asks for it

Blocked:
- fresh market, competitor, keyword, ad, pricing, or VoC research
- direct Supabase writes
- auto-apply, approval, or version history
- broad new strategy deliverables owned by another skill
```
  - VERBATIM vs ADAPTED: ADAPTED from artifact-route boundaries; no external wording copied.
- Rejections: Reject deep-research tools, search tools, visualization/metrics tools, and any persistence from chat-refine.

## skills/ingest-docs/ — references/collector.md

- Tier: 3
- Existing gap (from audit): 15-line runbook, no examples
- Public sources reviewed: [Unstructured-IO/unstructured](https://github.com/Unstructured-IO/unstructured) (14,581, 2026-04-26, Apache-2.0), [docling-project/docling](https://github.com/docling-project/docling) (58,716, 2026-04-28, MIT), [vectara/vectara-ingest](https://github.com/vectara/vectara-ingest) (197, 2026-04-14, Apache-2.0)
- Strongest external pattern: Document-ingestion projects preserve parsed elements and metadata before downstream extraction; adapt that as evidence-span discipline without adding parsers. Attribution: [docling-project/docling](https://github.com/docling-project/docling). License check: MIT.
- Recommended edit to `skills/ingest-docs/references/collector.md`:
  - WHY this fills the gap: Examples clarify how to handle conflicts and exact evidence without changing the deterministic parser.
  - WHAT to add:
```md
## Evidence Span Examples

Valid extracted field:
- source line: `Primary ICP: Series B RevOps teams`
- field key: `primaryIcpDescription`
- evidence value: exact source line or shortest exact span

Invalid extracted field:
- source line: `We mostly sell to RevOps`
- field value: `Enterprise revenue operations buyers`
- reason: paraphrased beyond source text

Conflict rule:
- If two documents disagree on the same field, emit both in `conflicts`.
- Do not choose a winner unless a source explicitly resolves the conflict.
```
  - VERBATIM vs ADAPTED: ADAPTED from document element metadata practice; no external text copied.
- Rejections: Reject Docling/Unstructured dependency additions, page/line schema fields without schema change, and paraphrased evidence values.

## skills/research-offer/ — references/rules.md

- Tier: 3
- Existing gap (from audit): 5 rules, no funnel-stage mapping
- Public sources reviewed: [robertbstillwell/marketing-skills](https://github.com/robertbstillwell/marketing-skills) (4, 2026-03-02, no license detected), [realjaymes/marketingagentskills](https://github.com/realjaymes/marketingagentskills) (25, 2026-04-27, MIT), [johssinma/Audit-my-site](https://github.com/johssinma/Audit-my-site) (0, 2026-03-20, no license detected)
- Strongest external pattern: Pricing and funnel audit skills separate public pricing evidence from research-only pricing methods; adapt that into offer-stage rules. Attribution: [robertbstillwell/marketing-skills](https://github.com/robertbstillwell/marketing-skills). License check: no license detected, so methodology only.
- Recommended edit to `skills/research-offer/references/rules.md`:
  - WHY this fills the gap: It codifies stage mapping and prevents research methods from being treated as verified subject-company pricing.
  - WHAT to add:
```md
## Funnel-Stage Rules

- `promise`: homepage, product, category, or use-case page.
- `cta`: visible signup, demo, sales, contact, download, checkout, or install action.
- `first_value_path`: docs, onboarding, template, integration, or workflow evidence.
- `activation_friction`: migration, import, permissions, security, admin, billing, or setup evidence.
- `proof_assets`: customer story, testimonial, logo proof, named outcome, or public metric.
- `pricing_signals`: first-party pricing preferred; third-party only after first-party attempt.

Brief hints do not satisfy any stage without public evidence.
```
  - VERBATIM vs ADAPTED: ADAPTED from offer/pricing audit methodology; no external wording copied.
- Rejections: Reject survey methods, category pricing norms, competitor pricing as subject-company pricing, and recommendations.

## skills/ingest-identity/ — references/TODO.md

- Tier: 3
- Existing gap (from audit): literal stub — recommend deletion
- Public sources reviewed: [anthropics/skills](https://github.com/anthropics/skills) (125,307, 2026-04-23, no license detected), [daymade/claude-code-skills](https://github.com/daymade/claude-code-skills) (943, 2026-04-28, MIT), [dedupeio/dedupe](https://github.com/dedupeio/dedupe) (4,456, 2025-07-29, MIT)
- Strongest external pattern: Agent Skills convention keeps loaded references purposeful and one level deep; placeholder TODO references should be removed once real references exist. Attribution: [anthropics/skills](https://github.com/anthropics/skills). License check: no license detected; convention only.
- Recommended edit to `skills/ingest-identity/references/TODO.md`:
  - WHY this fills the gap: A literal placeholder can be accidentally loaded as guidance and conflicts with the real rules and collector prompt.
  - WHAT to add:
```md
Recommended action: delete this file.

If deletion is delayed, replace the placeholder with:

# ingest-identity TODO

- Align `references/rules.md` with `schemas/output.ts`.
- Decide whether `businessModel` and `segments` belong in v1 schema.
- Add same-name collision fixture.
- Add parent/subsidiary/product-name ambiguity fixture.
- Add sanity-check gate for minimum sourced `core_keywords`.
```
  - VERBATIM vs ADAPTED: ORIGINAL AIGOS cleanup recommendation, informed by Agent Skills reference hygiene.
- Rejections: Do not keep generic scaffold text in a live skill folder.

## Verification Notes

- Blocks written: 21 / 21 Tier-2 and Tier-3 audit targets.
- Tier-1 files intentionally skipped.
- Every recommended edit targets an existing file path from `skills/<name>/`.
- No external folder import is recommended.
- No Layer A, `.claude/skills/`, `src/`, or `research-worker/` edits are recommended.
- No public match found cases: none for these 21 targets. Where public skill content was weak, recommendations adapt methodology from adjacent public GitHub repos instead of copying skill files.
