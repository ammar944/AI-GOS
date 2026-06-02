# Lab Engine Research Quality Report - 2026-05-27

Branch audited: `feat/v2-lab-section-wire` at `21f7fd8e18ab9f8f91735833f0990e3b47696426`.

Scope: shipped reader path only: `executionMode: 'lab'` -> `POST /api/research-v2/run-lab-section` -> `runLabSectionJob` -> `src/lib/lab-engine`. I ignored the Anthropic worker positioning path except for the explicit regression comparison against `main`.

Method: read-only static audit, five parallel subagent passes, Supabase persisted-run grading, one no-spend Airtable control draft, and official Anthropic reference check. No product code was changed. No `.env*` contents or secrets were printed. No fresh paid run was started; I reused the latest completed persisted lab run.

Anthropic standard references used: [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents), [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents), and [How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system). The relevant bar is: tools actually used in a loop, tight tool interfaces, dynamically retrieved context, explicit planning/decomposition, eval gates, resumable telemetry, and a citation/verification pass after research.

## 1. Verdict

Overall grade against a Perplexity / Claude research-grade bar: **C+**.

This is not just a glorified single LLM call: the corpus is citation-native Perplexity sonar with deterministic minimums, sections load skills, schemas are meaningful, and several sections did fire real tools in the latest persisted run. But it is also not production-grade deep research yet. The separator is verification: the section loop has no claim-level critic/citation agent, `web_search` fails under the DeepSeek path in the persisted run, and the most important competitive-ad evidence path regressed to empty normalized ad evidence.

Single biggest lever: **make external verification first-class in the section loop**. Replace provider-shaped `web_search` with executable DeepSeek-compatible search/fetch tools, restore deterministic competitor ad-library probing, then add a bounded claim/citation critic that rejects unsupported section claims before persistence. Model choice is secondary; the current weak point is tool execution and verification.

## 2. Ground Truth Run

Latest completed lab run graded from Supabase:

| Field | Evidence |
|---|---|
| `research_artifacts.id` | DB row `5ddba968-0219-4307-89b7-fdcb8727826b` |
| user-facing `run_id` | DB row `fc883ad4-53d7-4dab-86db-dd8328665f88` |
| parent status | `complete`, `children_complete=6`, `children_total=6` in `research_artifacts` row `5ddba968-0219-4307-89b7-fdcb8727826b` |
| event transcript | 224 `research_section_events` rows, from `2026-05-27T04:18:42.057845+00:00` to `2026-05-27T04:36:47.455252+00:00` |
| section model/provider | all current lab section rows report `provider=deepseek-direct`, `model=deepseek-v4-flash`, `transport=deepseek-direct` in `research_section_runs.telemetry` |
| corpus source count | `research_artifact_sections` row `bf1e0849-1aca-414f-903d-7675b10c8a00`, zone `deepResearchProgram`, `sourceCount=9`, title `Airtable GTM Research` |

The route is Clerk-gated at `src/app/api/research-v2/run-lab-section/route.ts:187-204`, checks corpus readiness at `route.ts:237-246`, builds `baseResearchInput = corpusToResearchInput(...)` at `route.ts:267-272`, and schedules `scheduleLabSectionJob(...)` at `route.ts:299-308`. The scheduler persists that input with `store.createRun(input.researchInput)` at `src/lib/research-v2/lab-section-dispatch.ts:28-43`. The job invokes `runSection` with `loadLabSkill` and registry/default tools at `src/lib/research-v2/lab-section-job.ts:37-59`.

## 3. Tool Calls Actually Fired

Interpretation: `tool-started` is the model attempt count. "Real external success" excludes `answer`, `readResearchInput`, capability gaps, invalid inputs, rate-limit gaps, and `web_search` unavailable errors.

| Section | DB section row | Tool attempts from event transcript | Real external successes | Verdict |
|---|---|---:|---:|---|
| Market Category | `67309178-e234-401a-8b89-bb28a80919f6` / run `b885019a-05d3-45cd-a245-dee5b6655916` | `firecrawl:3`, `web_search:6`, `answer:2` | 3 | Real Firecrawl only. `web_search` failed. |
| Buyer ICP | `2747dcdf-0633-4e47-83b7-7912fafc74c5` / run `aa900fe6-05d2-483b-9f3f-9519d14c5e0a` | `firecrawl:3`, `web_search:4`, `answer:1` | 3 | Real Firecrawl only. `web_search` failed. |
| Competitor Landscape | `da7e5603-a8c8-4573-9e58-6bb52fedc57a` / run `cfd79801-d8ea-4bd9-bd5a-fd6bba2444d6` | `web_search:6`, `answer:2` | 0 | Effectively LLM synthesis over corpus. No `adlibrary`, `google_ads`, `meta_ads`, `firecrawl`, or `reviews`. |
| Voice of Customer | `5f246cda-4f34-49fe-ba22-56fd898df16b` / run `9bb34650-4241-478f-a6e3-96277156f6e3` | `reviews:1`, `web_search:2`, `firecrawl:6`, `answer:2` | 3 | 1 review fetch + 2 Firecrawl successes; 4 Firecrawl gaps; web search invalid input. |
| Demand Intent | `1429a328-897d-402e-96d4-ec39b0ef12d7` / run `1e4c0ea7-3215-4d19-b32f-4d9cc256ce5e` | `keyword_ad_probe:6`, `web_search:8`, `answer:1` | 5 | Keyword probe worked; one rate-limit gap; web search failed. |
| Offer Diagnostic | `a1e71c12-2c31-4033-917f-fd5102402630` / run `e734083d-d443-4ba7-b056-fcef6a507c81` | `firecrawl:7`, `pagespeed:1`, `answer:2` | 3 | 3 Firecrawl successes; 4 Firecrawl rate-limit gaps; PageSpeed 429. |
| Paid Media Plan | `355cc19f-ec62-4fee-9028-509563884bb7` / run `e7703058-e586-45b4-b081-4d779db1e278` | `readResearchInput:1`, `keyword_ad_probe:3` | 2 | Current persisted paid-media artifact has 2 successful keyword probes. Across both paid-media attempts: 6 keyword probes, 4 successes, 2 rate-limit gaps; first attempt failed. |

Representative DB transcript evidence:

- `research_section_events` row `464ea1c2-6ea9-4fc7-ade7-4b4c560963eb`: Market Firecrawl finished with output beginning `{"type":"result","url":"https://www.airtable.com/"...}`.
- `research_section_events` row `67bfee46-8051-451d-8cb4-2797e3e3f00c`: Market Firecrawl finished with Airtable pricing page output.
- `research_section_events` row `9b6448cb-0468-4db5-9735-17f6b3455397`: Buyer `web_search` output was `Model tried to call unavailable tool 'web_search'. Available tools: answer.`
- `research_section_events` row `f0e0f555-1552-4201-89c9-af20b7407ffc`: VoC `web_search` had invalid input for `{"q":"Airtable reviews G2 pain points frustrations"}`.
- `research_section_events` row `118babf0-ad2a-4f4a-86ef-e19a61295cd4`: Offer `pagespeed` gap reason `api_error`, message `PageSpeed API 429`.
- `research_section_events` rows for Competitor Landscape under section run `cfd79801-d8ea-4bd9-bd5a-fd6bba2444d6`: only `web_search` and `answer` tools are present; no finished real external tool result.

Static explanation for the failure: `web_search` is implemented as an Anthropic provider tool at `src/lib/lab-engine/ai/web-search-provider-tool.ts:1-18`, while the run used DeepSeek (`src/lib/lab-engine/ai/models.ts:114-137`; DB telemetry above). The tool registry treats `web_search` specially rather than wrapping it as an executable local catalog tool at `src/lib/lab-engine/agents/tool-registry.ts:18-24`.

## 4. Machinery Truth Table

| Unit | Model/provider | Tools allowed | Skill loaded | Schema/workflow quality | Context input |
|---|---|---|---|---|---|
| Corpus | `sonar-pro`, fallback `sonar` in `research-worker/src/runners/deep-research-program.ts:15-22`; ADR confirms Perplexity at `docs/adr/0007-corpus-perplexity-migration.md:14-25` | Perplexity managed search only | N/A | B+: structured `deepResearchCorpusSchema` at `deep-research-program.ts:73-118`; deterministic citation minimums at `deep-research-program.ts:556-599` and `1192-1248` | Worker builds corpus then `corpusToResearchInput` maps it at `src/lib/research-v2/corpus-to-research-input.ts:441-562` |
| Market | DB telemetry `deepseek-direct` / `deepseek-v4-flash`; code constants at `models.ts:7-8`, selection at `models.ts:114-137` | `web_search`, `firecrawl` at `section-registry.ts:103-124` | Yes: DB skill event row, and runner emits at `run-section.ts:2250-2262` | B: strong skill playbook at `skills/positioning-market-category/SKILL.md:100-118`; schema/minimums at `market-category.ts:129-155`, `339-390` | Same `ResearchInput`; no per-section excerpt selection |
| Buyer ICP | Same DeepSeek DB telemetry | `web_search`, `firecrawl` at `section-registry.ts:147-167` | Yes | C+: thin skill at `skills/positioning-buyer-icp/SKILL.md:12-45`; stronger schema/minimums at `buyer-icp.ts:95-147`, `173-250` | Same `ResearchInput`; skill advertises `reviews` at `SKILL.md:20-27` but registry does not allow it |
| Competitor | Same DeepSeek DB telemetry | `web_search`, `firecrawl`, `adlibrary`, `reviews` at `section-registry.ts:125-146` | Yes | Runtime D, design B: skill is strong at `skills/positioning-competitor-landscape/SKILL.md:104-135`, schema strong at `competitor-landscape.ts:232-262`, but persisted run had 0 real external successes and 0 ad groups | Competitor prompt replaces fixture `competitorAds` with a warning at `build-prompts.ts:169-185`; live input has `competitorAds: []` from `corpus-to-research-input.ts:560-562` |
| Voice of Customer | Same DeepSeek DB telemetry | `web_search`, `reviews`, `firecrawl` at `section-registry.ts:168-188` | Yes | B-: thin but quote-first skill at `skills/positioning-voice-of-customer/SKILL.md:12-45`; strong quote schema/minimums at `voice-of-customer.ts:31-121`, `144-213` | Same `ResearchInput`; some actual review/firecrawl evidence |
| Demand Intent | Same DeepSeek DB telemetry | `web_search`, `keyword_ad_probe`, `firecrawl` at `section-registry.ts:189-209` | Yes | B-: thin skill at `skills/positioning-demand-intent/SKILL.md:12-45`; useful schema/minimums at `demand-intent.ts:81-118`, `132-192` | Same `ResearchInput`; keyword probes worked, but low precision example hit `lowes.com` for `low code database for business teams` in DB event sample |
| Offer Diagnostic | Same DeepSeek DB telemetry | `web_search`, `firecrawl`, `pagespeed` at `section-registry.ts:210-230` | Yes | C+: thin skill and tool drift at `skills/positioning-offer-diagnostic/SKILL.md:20-29`; schema useful but `redFlags` lacks `sourceUrl` at `offer-diagnostic.ts:57-64` | Same `ResearchInput`; external performance metrics mostly unavailable |
| Paid Media Plan | Same DeepSeek DB telemetry | `keyword_ad_probe` at `section-registry.ts:231-253` | Yes | C+: synthesis contract is good at `skills/positioning-paid-media-plan/SKILL.md:18-35`; schema has 12 body groups at `paid-media-plan.ts:169-208`; first run failed on grounding | Requires all six committed artifacts before dispatch at `route.ts:74-123`; uses `committedPositioningArtifacts` |

## 5. Skills and Schema Quality

The right skills are being loaded from `src/lib/lab-engine/skills/{slug}/SKILL.md`: `loadLabSkill` reads that path at `src/lib/research-v2/lab-section-job.ts:92-107`, and `runSection` emits `skill-loaded` at `src/lib/lab-engine/agents/run-section.ts:2250-2262`. The latest DB run has one `skill-loaded` event for each current persisted section row; paid media also had an earlier failed attempt before the successful row.

Skill quality is uneven:

| Section | Skill grade | Schema grade | Evidence |
|---|---:|---:|---|
| Market | A- | B+ | Decomposed workflow and anti-slop rules at `skills/positioning-market-category/SKILL.md:100-118`, `199-207`, `258-265`; schema requires triangulated signals at `market-category.ts:339-385`. |
| Buyer ICP | C | B | Skill is only role/tool/gap/output text at `skills/positioning-buyer-icp/SKILL.md:12-45`; schema enforces personas, firmographics, awareness, triggers, venues at `buyer-icp.ts:95-147`, `173-250`. |
| Competitor | A | A- design, D runtime | Skill is genuinely strong at `skills/positioning-competitor-landscape/SKILL.md:104-135`, `397-488`; schema has ad evidence groups at `competitor-landscape.ts:149-242`; latest DB artifact has `adEvidence.advertiserGroups.length=0`. |
| VoC | C+ | B+ | Skill is thin but quote-first at `skills/positioning-voice-of-customer/SKILL.md:12-45`; schema demands 10 pain quotes, 5 objections, switching stories, criteria, success quotes at `voice-of-customer.ts:144-213`. |
| Demand | C+ | B | Skill is thin at `skills/positioning-demand-intent/SKILL.md:12-45`; schema has keyword/question/content/intent/venue groups at `demand-intent.ts:81-118`; `contentGaps` lacks source URL at `demand-intent.ts:54-60`. |
| Offer | C | C+ | Skill lists `reviews` and `ga4` at `skills/positioning-offer-diagnostic/SKILL.md:20-29`, but registry allows neither at `section-registry.ts:223-225`; `redFlags` lacks `sourceUrl` at `offer-diagnostic.ts:57-64`. |
| Paid Media | B | B- | Strong source-section rule at `skills/positioning-paid-media-plan/SKILL.md:29-35`; schema omits `sourceUrl` on funnel/channel/KPI fields at `paid-media-plan.ts:134-167`. |

## 6. Corpus and Context Engineering

Corpus grade: **B**.

The corpus builder is the strongest part of the system. It uses Perplexity `sonar-pro` by default with fallback `sonar` at `research-worker/src/runners/deep-research-program.ts:15-22`, structured output at `deep-research-program.ts:844-885`, and deterministic citation/evidence minimums at `deep-research-program.ts:556-599` and `1192-1248`. ADR-0007 explicitly chose Perplexity because DeepSeek lacks native web search and the corpus needed citation-native grounding at `docs/adr/0007-corpus-perplexity-migration.md:18-25`.

The bottleneck is how the corpus becomes section input. `corpusToResearchInput` maps every corpus evidence record into `corpus.excerpts` at `src/lib/research-v2/corpus-to-research-input.ts:399-435`, then passes all excerpts to every section at `corpus-to-research-input.ts:552-562`. There is no section-scoped retrieval, compaction, or just-in-time loading. Also, `findSourceForEvidence` falls back to `sources[0]` when URL/title matching fails at `corpus-to-research-input.ts:343-363`, which can silently misattribute an excerpt instead of failing.

Latest Airtable `ResearchInput` pulled from the persisted run:

- `fixtureId=brand_airtable`, company `Airtable`, website `https://www.airtable.com/`.
- `sourceCount=9`, `excerptCount=10`, `competitorAds=[]`.
- First sources include Airtable homepage, Airtable pricing, Zapier, Gap Consulting, Baserow, Airtable guides.
- `journey_sessions` for `run_id=fc883ad4-53d7-4dab-86db-dd8328665f88` reports corpus telemetry `model=sonar-pro`, usage `inputTokens=6140`, `outputTokens=6321`, `totalTokens=12461`.

This is engineered enough to seed a section, but not enough to meet Anthropic-style context engineering. Anthropic's context guidance emphasizes tight, just-in-time context and progressive retrieval; this system sends the same compact corpus to every section, then depends on tools that may fail.

## 7. Technical Depth

The lab section loop is bounded, but mostly synthesis-plus-repair:

- Answer-tool path loads skill, builds a `ToolBudget`, constructs external tools, injects ad evidence, then calls `sectionRunnerModel` with max step/output limits at `src/lib/lab-engine/agents/run-section.ts:2227-2339`.
- If the output fails schema/minimum validation, repair runs at `run-section.ts:2386-2452`.
- This is schema repair, not a generator -> critic -> claim verifier loop. There is no post-section citation agent equivalent to Anthropic's research architecture, where final claims pass through a citation step.
- Confidence is a single top-level decimal in `artifactEnvelopeSchema` at `src/lib/lab-engine/artifacts/artifact-envelope.ts:101-115`; most schemas do not require per-claim confidence or verified/inferred/gap fields.
- Tool gaps are represented (`ToolGapSchema` at `src/lib/lab-engine/agents/tools/_shared.ts:3-18`) and emitted in metadata, but the section can still complete with major missing evidence, as Competitor did.

Bottom line: this is a bounded workflow with tools, not yet a research-grade agent that verifies its own claims against ground truth.

## 8. Competitor Ad Regression vs Main

Hypothesis verified: competitor-ad evidence got worse on the shipped lab path.

Current lab path:

- Competitor registry allows `web_search`, `firecrawl`, `adlibrary`, `reviews` at `src/lib/lab-engine/sections/section-registry.ts:138-141`.
- The deterministic ad evidence probe requires executable `google_ads` and `meta_ads`; if either is absent, it returns `[]` at `src/lib/lab-engine/agents/run-section.ts:1852-1868`.
- The current registry does not allow `google_ads` or `meta_ads`, so normalized ad evidence is empty by default.
- Latest DB Competitor artifact row `da7e5603-a8c8-4573-9e58-6bb52fedc57a` has `adEvidence.advertiserGroups.length=0` and `adPresence.signals.length=4`.
- Latest DB Competitor event transcript for run `cfd79801-d8ea-4bd9-bd5a-fd6bba2444d6` has `web_search:6`, `answer:2`, and **0 real external successes**. There are no `adlibrary`, `google_ads`, or `meta_ads` events.

What current lab retained:

- `src/lib/lab-engine/agents/tools/adlibrary.ts` can call SearchAPI for Google and Meta only; its tool output includes `ads` at `adlibrary.ts:583-620`.
- `src/lib/lab-engine/artifacts/schemas/competitor-landscape.ts:149-242` can hold rich ad creatives, counts, links, gaps, and raw samples.

What main had:

- `git show main:research-worker/src/tools/adlibrary.ts | nl -ba` is 1429 lines.
- Main Google Ads Transparency Center path is at `main:research-worker/src/tools/adlibrary.ts:616-725`.
- Main LinkedIn ad library SearchAPI path is at `main:research-worker/src/tools/adlibrary.ts:737-859`.
- Main Meta ad library path is at `main:research-worker/src/tools/adlibrary.ts:874-967`.
- Main optional Foreplay fallback is at `main:research-worker/src/tools/adlibrary.ts:969-1036`.
- Main creative normalization extracts headline/body/image/video/details URLs at `main:research-worker/src/tools/adlibrary.ts:1069-1219`.
- Main insight assembly returns `activeAdCount`, `platforms`, `themes`, `evidence`, `sourceConfidence`, `adCreatives`, `libraryLinks`, `sourcesUsed`, and `rateLimitedPlatforms` at `main:research-worker/src/tools/adlibrary.ts:1274-1373`.
- Main type contract includes active counts and creative URLs at `main:research-worker/src/tools/adlibrary-types.ts:1-43`.

Quantified loss:

| Capability | `main` | lab path now |
|---|---|---|
| Google ads | Real SearchAPI / Transparency Center fetch | Tool exists via lab `adlibrary`, but deterministic normalized probe does not run |
| Meta ads | Real SearchAPI fetch | Tool exists via lab `adlibrary`, but not called in latest Competitor run |
| LinkedIn ads | Real SearchAPI fetch | No lab LinkedIn fetcher; schema has `linkedin` enum/counts only |
| Foreplay fallback | Optional support | Missing |
| Active ad count | Deterministically tied to real creatives | No visible active count; `adEvidence.advertiserGroups=[]` in latest run |
| Creative media | Image/video/details URLs normalized and rendered | Schema can hold them, but current renderer does not display `adEvidence` fields |
| Latest persisted Competitor run | Not applicable | 0 real external successes, 0 normalized ad groups |

Current renderer regression: `src/components/research-v2/section-renderers/competitor-landscape.tsx:264-267` renders `adPresence` summary fields, and `competitor-landscape.tsx:443-549` renders competitor/platform/spend/evidence/source. There are no renderer references to `adEvidence`, `advertiserGroups`, `rawCounts`, `displayableCounts`, `creatives`, or `returnedCreativeCount`.

Other five sections did not regress in the same "real fetch -> schema-only" way. They still have executable Firecrawl/SearchAPI/PageSpeed tools in registry and tool files, but `web_search` being Anthropic-shaped affects every section that relies on it.

## 9. Control Experiment

Control input: I pulled the exact Airtable `ResearchInput` shape from latest run `fc883ad4-53d7-4dab-86db-dd8328665f88`: `sourceCount=9`, `excerptCount=10`, `competitorAds=[]`. This is the input Competitor Landscape received after `corpusToResearchInput`, except paid media later adds committed artifacts.

I wrote a no-spend Airtable Competitor Landscape control draft to the same schema using live public sources from search/opened pages: Airtable pricing, monday pricing/homepage, Smartsheet pricing/homepage, Notion pricing/projects, SmartSuite pricing, Airtable vs monday, and public Reddit alternatives/weakness snippets. I intentionally left `adPresence.signals=[]` and `adEvidence.advertiserGroups=[]` because I did not run Google/Meta/LinkedIn ad libraries.

Validation: `npx tsx` parsed the control with `competitorLandscapeSectionOutputSchema` and `validateCompetitorLandscapeMinimums`; result:

```json
{
  "ok": true,
  "errors": []
}
```

Control vs latest lab Competitor:

| Dimension | Latest lab Competitor | My control |
|---|---|---|
| Real external tools | 0 real external successes in DB run `cfd79801-d8ea-4bd9-bd5a-fd6bba2444d6` | Used external web research manually; not a persisted app run |
| Competitor set | DB artifact has 9 competitors but was generated without successful external tools | 6 evidence-bounded buckets: monday, Smartsheet, SmartSuite, Notion, Google Sheets/status quo, DIY stack |
| Pricing | Lab output source count 10, confidence 0.65, but no tool transcript beyond failed web search | Official pricing pages for Airtable, monday, Smartsheet, Notion, SmartSuite |
| Weaknesses | Unknown quality without manually reviewing every card; no live review/ad fetch succeeded | Public snippets only; acceptable for a control, not enough for production |
| Ad evidence | `adEvidence.advertiserGroups=[]` despite competitor ad schema | Also empty, but explicitly marked as not fetched |
| Honest grade | D on real tool use; C/C+ on schema completion | B- as a research draft; C on ad evidence |

This isolates workflow quality from corpus quality: with the same thin `competitorAds=[]` input, a small amount of real external lookup materially improves competitor/pricing coverage. But without a live ad-library tool, neither the pipeline nor the control reaches paid-media research grade.

## 10. Scorecards

Scale: A=4, B=3, C=2, D=1. The score below weights real tool use, evidence grounding, and verification higher than schema elegance.

| Unit | Grade | Number | Why |
|---|---:|---:|---|
| Corpus | B | 3 | Perplexity sonar, structured output, deterministic cited-source minimums; weak section scoping and source fallback. |
| Market Category | B- | 2.7 | Good skill/schema and 3 real Firecrawl successes; web search failed and no claim critic. |
| Buyer ICP | C+ | 2.3 | Schema strong, skill thin, 3 Firecrawl successes; no review tool despite skill mention; web search failed. |
| Competitor Landscape | D | 1 | Strong skill/schema on paper, but latest run had 0 real external successes and 0 ad groups. |
| Voice of Customer | B- | 2.7 | Real review + Firecrawl evidence; enough quote schema; tool gaps and web-search invalid input. |
| Demand Intent | B- | 2.7 | Keyword probe worked; one rate limit and low precision example; web search failed. |
| Offer Diagnostic | C+ | 2.3 | Some real page reads; PageSpeed 429, Firecrawl budget gaps, no real performance metrics. |
| Paid Media Plan | C+ | 2.3 | Good synthesis schema, current row has 2 keyword successes; first paid-media attempt failed on section-grounding; competitor ad evidence missing upstream. |

Heatmap:

| Dimension | Corpus | Market | Buyer | Competitor | VoC | Demand | Offer | Paid |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1. Real tool use | B | B | B- | D | B | B | C+ | C |
| 2. Multi-step bounded loop | B | B- | B- | C | B- | B- | B- | B- |
| 3. Decomposition/planning | B | A- | C | A | C+ | C+ | C | B |
| 4. Context engineering | C+ | C | C | C | C | C | C | C+ |
| 5. Evidence/citations | B+ | B- | C+ | D+ | B- | B- | C+ | C+ |
| 6. Iterative refinement | B | C+ | C+ | C+ | C+ | C+ | C+ | C+ |
| 7. Skill quality | N/A | A- | C | A | C+ | C+ | C | B |
| 8. Structured output | B+ | B+ | B | B+ schema / D runtime | B+ | B | C+ | B |
| 9. Confidence/gaps | B | C+ | C | C | B- | C+ | C | C |
| 10. Evals/observability | B | C+ | C+ | C | C+ | C+ | C+ | C+ |

## 11. Prioritized Kinks

| Kink | Category | Evidence | Impact | Effort | Fix |
|---|---|---|---:|---:|---|
| DeepSeek cannot use current `web_search` | tools/config | Anthropic provider tool at `web-search-provider-tool.ts:1-18`; DB rows show `Model tried to call unavailable tool 'web_search'. Available tools: answer.` | H | M | Replace with executable search API tool for DeepSeek or disable it per provider; add integration test that asserts real search results under `LAB_ENGINE_PROVIDER=deepseek-direct`. |
| Competitor normalized ad probe is dead | tools/config | Registry omits `google_ads`/`meta_ads` at `section-registry.ts:138-141`; probe returns `[]` if missing at `run-section.ts:1852-1868`; DB `adGroups=0` | H | S/M | Either allow `google_ads`/`meta_ads` or make deterministic probe consume `adlibrary`; fail closed when ad evidence is required. |
| Ad-library depth regressed vs `main` | tool depth | `main:adlibrary.ts:616-1036` has Google/LinkedIn/Meta/Foreplay; lab adlibrary has Google/Meta only and latest run did not call it | H | M | Port main ad-library engines and normalizer into lab path; keep raw counts, displayable counts, creative URLs, platform errors. |
| Competitor renderer hides `adEvidence` | tool depth / UI | Renderer shows `adPresence` at `competitor-landscape.tsx:264-267`, table at `443-549`; no `adEvidence` references | M/H | S | Render advertiser groups, counts, creatives, library links, and gaps. |
| Corpus mapping is dump-style | context engineering | All excerpts passed to all sections at `corpus-to-research-input.ts:399-435`, `552-562` | M | M | Add section-specific excerpt selection and source packs; keep compact corpus references for just-in-time loading. |
| Source fallback can misattribute evidence | context engineering | `findSourceForEvidence` falls back to `sources[0]` at `corpus-to-research-input.ts:343-363` | H | S | Return an explicit validation error or `unmatchedSource` gap instead of silently assigning source 0. |
| No claim-level critic/citation agent | schema/workflow | Repairs at `run-section.ts:2386-2452` are schema/minimum repairs, not claim verification | H | M/L | Add bounded post-section verifier: every numeric, pricing, quote, ad, and competitor claim must cite a source/tool result or be marked inferred/gap. |
| Skill/tool drift | schema/skill | Buyer skill lists `reviews` at `buyer-icp/SKILL.md:20-27`, registry does not; Offer skill lists `reviews`/`ga4` at `offer-diagnostic/SKILL.md:20-29`, registry does not | M | S | Generate skills from registry or validate skill tool list against registry in tests. |
| Missing per-card citations | schema quality | `demand-intent.ts:54-60` content gaps lack `sourceUrl`; `offer-diagnostic.ts:57-64` red flags lack `sourceUrl`; paid-media KPI fields lack source | M | S/M | Add `sourceUrl`, `sourceSection`, and `confidence` to judgment-heavy cards. |
| Telemetry incomplete | observability | Subagent WS2 found `latestTool` and `latestSource` null on lab `research_section_runs.telemetry`; event rows exist but summary fields absent | M | S | Update run telemetry builder to persist latest tool/source/gap counts and real-success counts. |
| Paid media retry required | schema/workflow | Failed paid-media run `a9422b0c-523b-4665-abc9-33987e15e0c2` error: `synthesized items: need section-grounded sourceSection values.`; later row `e770...` completed | M | S | Tighten first-attempt prompt/schema examples; add fixture test for sourceSection/sourceUrl grounding. |

## 12. Model and Provider Truth

Sections:

- Code defines `DEEPSEEK_SECTION_MODEL_ID = "deepseek-v4-flash"` at `src/lib/lab-engine/ai/models.ts:7-8`.
- `LAB_ENGINE_PROVIDER=deepseek-direct` requires `DEEPSEEK_API_KEY`, creates `createDeepSeek({ apiKey })`, and uses `deepseek-v4-flash` at `models.ts:114-137`.
- Latest DB `research_section_runs.telemetry` for current lab sections confirms `provider=deepseek-direct`, `model=deepseek-v4-flash`, `transport=deepseek-direct`.
- If `LAB_ENGINE_PROVIDER` is unset, code defaults to Anthropic at `models.ts:54-61`. Do not infer DeepSeek from code alone; the DB row is the proof for this run.

Corpus:

- ADR-0007 says the corpus engine moved to Perplexity sonar, kept on the Railway worker, at `docs/adr/0007-corpus-perplexity-migration.md:14-25`.
- Code default is `sonar-pro`, fallback `sonar` at `research-worker/src/runners/deep-research-program.ts:15-22`.
- The Airtable persisted journey session telemetry for `run_id=fc883ad4-53d7-4dab-86db-dd8328665f88` reports `model=sonar-pro`, usage `6140 input / 6321 output / 12461 total tokens`.

## 13. What I Could Not Verify

- I did not start a fresh paid live run. I reused the latest completed Supabase run to avoid spend and because it already exercises the lab path.
- I did not verify production Railway environment or deployed env values; only the local branch and persisted Supabase run were audited.
- I did not inspect a full raw provider transcript beyond `research_section_events`; the durable transcript does not store every raw model token.
- I did not run Google/Meta/LinkedIn ad libraries live in the control experiment; ad evidence remains intentionally empty there.
- I did not run authenticated browser proof of `/api/research-v2/audit-state?run_id=...`; DB events were more direct and sufficient for tool-call counts.
- I did not manually fact-check every claim inside every persisted artifact body. The report grades machinery and samples enough rows to identify systemic risk; a full claim audit would be a separate pass.

## 14. Shipping Call

Do not ship this as "Perplexity/Claude research-grade" yet. It is acceptable to call it a bounded, schema-driven lab research workflow with a Perplexity-grounded corpus and partial live tools. The production-blocking issues are:

1. Competitor Landscape has zero real external tool successes in the latest persisted run.
2. Competitor ad evidence regressed from real, normalized, rendered ad-library evidence to empty normalized groups.
3. DeepSeek sections are trying to use an Anthropic-shaped `web_search` tool.
4. There is no claim-level verifier/citation critic before persistence.

Fix those before trusting the data for production positioning or paid-media decisions.
