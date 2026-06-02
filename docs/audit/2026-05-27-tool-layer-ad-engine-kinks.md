# Lab Engine Tool Layer + Ad Engine Audit

Date: 2026-05-27
Branch: `feat/v2-lab-section-wire`
Current checkout ref: `21f7fd8e`
Compared ref: `main:research-worker/src/tools/adlibrary.ts` and `main:research-worker/src/tools/adlibrary-types.ts`
Mode: REPORT ONLY. No source fixes applied.

Scope audited:

- Current lab tool files at `21f7fd8e`: `src/lib/lab-engine/agents/tools/_shared.ts`, `adlibrary.ts`, `competitor-ad-adapter.ts`, `firecrawl.ts`, `ga4.ts`, `google-ads.ts`, `index.ts`, `keyword-ad-probe.ts`, `meta-ads.ts`, `pagespeed.ts`, `reviews.ts`, `spyfu.ts` (`git ls-files src/lib/lab-engine/agents/tools` at `21f7fd8e`).
- Current tool registry and section registry: `src/lib/lab-engine/agents/tool-registry.ts:12-30`, `src/lib/lab-engine/agents/tools/index.ts:11-23`, `src/lib/lab-engine/sections/section-registry.ts:103-253`.
- Current section skills: `src/lib/lab-engine/skills/*/SKILL.md` cited below.
- Current streaming module: `src/lib/lab-engine/streaming/run-section-ui-message.ts:1-45`.
- Main worker ad library and types: `main:research-worker/src/tools/adlibrary.ts:1-1429`, `main:research-worker/src/tools/adlibrary-types.ts:1-44`.

## Executive Verdict

The two prior hypotheses are confirmed in this checkout:

1. `web_search` is not an executable lab tool. `buildToolMap` special-cases `web_search` and injects `createWebSearchProviderTool` instead of wrapping a `TOOL_CATALOG` entry (`src/lib/lab-engine/agents/tool-registry.ts:18-24`). That provider tool is constructed from `anthropic.tools.webSearch_20250305` (`src/lib/lab-engine/ai/web-search-provider-tool.ts:1-18`). The section model can be DeepSeek via `LAB_ENGINE_PROVIDER=deepseek-direct`, which uses `createDeepSeek` and model id `deepseek-v4-flash` (`src/lib/lab-engine/ai/models.ts:12-15`, `src/lib/lab-engine/ai/models.ts:114-137`). Impact under DeepSeek is provider mismatch, not an executable search call. DeepSeek inability to execute this Anthropic provider tool is an inference from the Anthropic-specific constructor and DeepSeek model selection.
2. The deterministic competitor ad probe returns no steps unless both `google_ads` and `meta_ads` exist in the built tool map (`src/lib/lab-engine/agents/run-section.ts:1852-1868`). The Competitor section currently allows only `web_search`, `firecrawl`, `adlibrary`, and `reviews` (`src/lib/lab-engine/sections/section-registry.ts:125-141`). Since `google_ads` and `meta_ads` are registered in `TOOL_CATALOG` but not allowed for this section (`src/lib/lab-engine/agents/tools/index.ts:11-23`, `src/lib/lab-engine/sections/section-registry.ts:140`), the deterministic probe is always empty on the default Competitor path.
3. The easy path was coded twice: provider web search instead of an executable provider-agnostic search tool (`src/lib/lab-engine/agents/tool-registry.ts:18-24`), and ad-evidence schemas that can hold rich groups while the deterministic probe can return `[]` before any tool call (`src/lib/lab-engine/artifacts/schemas/competitor-landscape.ts:207-223`, `src/lib/lab-engine/agents/run-section.ts:1863-1868`).

## 1. Tool Roster Truth Table

Shared gap convention: tool gaps are typed as `{ type: "gap", reason, envVar?, message }` with reasons including `missing_credential`, `api_error`, `rate_limited`, `not_implemented`, and `aborted` (`src/lib/lab-engine/agents/tools/_shared.ts:3-18`). Helpers return credential, API, abort, and caught-error gaps (`src/lib/lab-engine/agents/tools/_shared.ts:35-49`, `src/lib/lab-engine/agents/tools/_shared.ts:112-118`).

| Tool file | Real executable external API? | Env/key | Missing key/error behavior | Registered in `TOOL_CATALOG` / `ToolName`? | Allowed sections today | Shim / data quality note |
|---|---:|---|---|---|---|---|
| `adlibrary.ts` | Yes. It calls SearchAPI engines for Google Ads Transparency and Meta Ad Library (`src/lib/lab-engine/agents/tools/adlibrary.ts:81-82`, `src/lib/lab-engine/agents/tools/adlibrary.ts:465-509`, `src/lib/lab-engine/agents/tools/adlibrary.ts:511-553`). | `SEARCHAPI_KEY` (`src/lib/lab-engine/agents/tools/adlibrary.ts:598-602`). | Missing key returns `credentialGap`; HTTP/caught errors return `ToolGap` through `toApiErrorGap` (`src/lib/lab-engine/agents/tools/adlibrary.ts:575-580`, `src/lib/lab-engine/agents/tools/adlibrary.ts:598-620`). No candidate returns a successful result with `ads: []`, not a gap (`src/lib/lab-engine/agents/tools/adlibrary.ts:488-492`, `src/lib/lab-engine/agents/tools/adlibrary.ts:530-535`, `src/lib/lab-engine/agents/tools/adlibrary.ts:613-618`). | Yes: `adlibrary` is in `TOOL_CATALOG`; `ToolName` is `keyof typeof TOOL_CATALOG | "web_search"` (`src/lib/lab-engine/agents/tools/index.ts:11-23`). | Competitor only (`src/lib/lab-engine/sections/section-registry.ts:140`). | SearchAPI proxy over ad-library engines. It is real external data, but it is thinner than `main` and has no domain-aware relevance filter in this lab copy; see ad regression section. |
| `competitor-ad-adapter.ts` | No. This is not an AI SDK tool; it normalizes completed `AgentStep` tool outputs from `adlibrary`, `google_ads`, and `meta_ads` (`src/lib/lab-engine/agents/tools/competitor-ad-adapter.ts:1-14`, `src/lib/lab-engine/agents/tools/competitor-ad-adapter.ts:470-524`). | None. | It silently skips non-ad tools and unparsable outputs (`src/lib/lab-engine/agents/tools/competitor-ad-adapter.ts:477-492`); typed gaps from ad tools become `sourceErrors` (`src/lib/lab-engine/agents/tools/competitor-ad-adapter.ts:494-505`). | No. It is not imported by `tools/index.ts` (`src/lib/lab-engine/agents/tools/index.ts:1-23`). | None as a callable tool. It is used by `run-section.ts` to build `adEvidence` (`src/lib/lab-engine/agents/run-section.ts:58-61`, `src/lib/lab-engine/agents/run-section.ts:2172-2175`, `src/lib/lab-engine/agents/run-section.ts:2965-2971`). | Its schema can preserve `rawCounts`, `displayableCounts`, creatives, library links, raw samples, data gaps, and source errors (`src/lib/lab-engine/agents/tools/competitor-ad-adapter.ts:402-467`), but today it often receives no steps because the deterministic probe returns `[]`. |
| `firecrawl.ts` | Yes. It calls `https://api.firecrawl.dev/v2/scrape` (`src/lib/lab-engine/agents/tools/firecrawl.ts:13`, `src/lib/lab-engine/agents/tools/firecrawl.ts:45-59`). | `FIRECRAWL_API_KEY` (`src/lib/lab-engine/agents/tools/firecrawl.ts:39-43`). | Missing key returns `credentialGap`; non-OK response returns `apiErrorGap`; caught errors return `errorToGap` (`src/lib/lab-engine/agents/tools/firecrawl.ts:39-84`). | Yes (`src/lib/lab-engine/agents/tools/index.ts:11-23`). | Market, Competitor, Buyer, Voice, Demand, Offer (`src/lib/lab-engine/sections/section-registry.ts:118`, `src/lib/lab-engine/sections/section-registry.ts:140`, `src/lib/lab-engine/sections/section-registry.ts:161`, `src/lib/lab-engine/sections/section-registry.ts:182`, `src/lib/lab-engine/sections/section-registry.ts:203`, `src/lib/lab-engine/sections/section-registry.ts:224`). | Real scrape tool. |
| `ga4.ts` | No real API today. The description says V1 surfaces a data availability gap, and `execute` always returns `credentialGap("GA4_REFRESH_TOKEN")` (`src/lib/lab-engine/agents/tools/ga4.ts:18-29`). | `GA4_REFRESH_TOKEN` is named, but no API call uses it (`src/lib/lab-engine/agents/tools/ga4.ts:18-29`). | Always honest typed gap. | Yes (`src/lib/lab-engine/agents/tools/index.ts:11-23`). | No section allows it today (`src/lib/lab-engine/sections/section-registry.ts:118-247`). | Registered dead capability: skill docs mention it for Offer, registry omits it (`src/lib/lab-engine/skills/positioning-offer-diagnostic/SKILL.md:24-28`, `src/lib/lab-engine/sections/section-registry.ts:224`). |
| `google-ads.ts` | Yes, but only as a thin wrapper around `adLibraryAgentTool.execute` with `platform: "google"` (`src/lib/lab-engine/agents/tools/google-ads.ts:11-38`). | Inherits `SEARCHAPI_KEY` from `adlibrary.ts` (`src/lib/lab-engine/agents/tools/google-ads.ts:33-37`, `src/lib/lab-engine/agents/tools/adlibrary.ts:598-602`). | If `adLibraryAgentTool.execute` is missing, returns `not_implemented`; otherwise parses the adlibrary output/gap (`src/lib/lab-engine/agents/tools/google-ads.ts:21-38`). | Yes (`src/lib/lab-engine/agents/tools/index.ts:11-23`). | No section allows it today (`src/lib/lab-engine/sections/section-registry.ts:118-247`). | The Competitor skill explicitly instructs use of `google_ads`, but the registry does not allow it (`src/lib/lab-engine/skills/positioning-competitor-landscape/SKILL.md:80-85`, `src/lib/lab-engine/sections/section-registry.ts:140`). |
| `keyword-ad-probe.ts` | Yes. It calls SearchAPI Google SERP with `engine=google` (`src/lib/lab-engine/agents/tools/keyword-ad-probe.ts:34-55`). | `SEARCHAPI_KEY` (`src/lib/lab-engine/agents/tools/keyword-ad-probe.ts:45-49`). | Missing key returns `credentialGap`; non-OK returns `apiErrorGap`; caught errors return `errorToGap` (`src/lib/lab-engine/agents/tools/keyword-ad-probe.ts:45-87`). | Yes (`src/lib/lab-engine/agents/tools/index.ts:11-23`). | Demand and Paid Media Plan (`src/lib/lab-engine/sections/section-registry.ts:203`, `src/lib/lab-engine/sections/section-registry.ts:247`). | SERP/parametric shim. It reports organic/ad result counts from a Google SearchAPI response, not first-party search volume or ad spend (`src/lib/lab-engine/agents/tools/keyword-ad-probe.ts:61-84`). |
| `meta-ads.ts` | Yes, but only as a thin wrapper around `adLibraryAgentTool.execute` with `platform: "meta"` (`src/lib/lab-engine/agents/tools/meta-ads.ts:11-38`). | Inherits `SEARCHAPI_KEY` from `adlibrary.ts` (`src/lib/lab-engine/agents/tools/meta-ads.ts:33-37`, `src/lib/lab-engine/agents/tools/adlibrary.ts:598-602`). | If `adLibraryAgentTool.execute` is missing, returns `not_implemented`; otherwise parses the adlibrary output/gap (`src/lib/lab-engine/agents/tools/meta-ads.ts:21-38`). | Yes (`src/lib/lab-engine/agents/tools/index.ts:11-23`). | No section allows it today (`src/lib/lab-engine/sections/section-registry.ts:118-247`). | The Competitor skill explicitly instructs use of `meta_ads`, but the registry does not allow it (`src/lib/lab-engine/skills/positioning-competitor-landscape/SKILL.md:80-85`, `src/lib/lab-engine/sections/section-registry.ts:140`). |
| `pagespeed.ts` | Yes. It calls Google PageSpeed Insights (`src/lib/lab-engine/agents/tools/pagespeed.ts:11-12`, `src/lib/lab-engine/agents/tools/pagespeed.ts:35-43`). | No key required by this implementation (`src/lib/lab-engine/agents/tools/pagespeed.ts:26-34`). | Non-OK returns `apiErrorGap`; caught errors return `errorToGap` (`src/lib/lab-engine/agents/tools/pagespeed.ts:45-65`). | Yes (`src/lib/lab-engine/agents/tools/index.ts:11-23`). | Offer only (`src/lib/lab-engine/sections/section-registry.ts:224`). | Real external API. Market skill mentions `pagespeed`, but Market registry omits it (`src/lib/lab-engine/skills/positioning-market-category/SKILL.md:82-84`, `src/lib/lab-engine/sections/section-registry.ts:118`). |
| `reviews.ts` | Yes. It calls SearchAPI Google with a site-constrained review query (`src/lib/lab-engine/agents/tools/reviews.ts:48-70`). | `SEARCHAPI_KEY` (`src/lib/lab-engine/agents/tools/reviews.ts:59-63`). | Missing key returns `credentialGap`; non-OK returns `apiErrorGap`; caught errors return `errorToGap` (`src/lib/lab-engine/agents/tools/reviews.ts:59-99`). | Yes (`src/lib/lab-engine/agents/tools/index.ts:11-23`). | Competitor and Voice (`src/lib/lab-engine/sections/section-registry.ts:140`, `src/lib/lab-engine/sections/section-registry.ts:182`). | SERP shim posing as review evidence. It searches Google snippets for G2/Capterra/Trustpilot and does not call those review platforms directly (`src/lib/lab-engine/agents/tools/reviews.ts:66-96`). |
| `spyfu.ts` | Yes. It calls SpyFu domain stats and paid SERP APIs (`src/lib/lab-engine/agents/tools/spyfu.ts:11-12`, `src/lib/lab-engine/agents/tools/spyfu.ts:68-81`). | `SPYFU_API_KEY` (`src/lib/lab-engine/agents/tools/spyfu.ts:19-23`). | Missing key throws a sentinel error and is converted to `credentialGap`; other errors return `errorToGap` (`src/lib/lab-engine/agents/tools/spyfu.ts:19-23`, `src/lib/lab-engine/agents/tools/spyfu.ts:89-97`). | Yes (`src/lib/lab-engine/agents/tools/index.ts:11-23`). | No section allows it today (`src/lib/lab-engine/sections/section-registry.ts:118-247`). | Real SpyFu API, but registered dead capability. Competitor skill instructs `spyfu`; registry omits it (`src/lib/lab-engine/skills/positioning-competitor-landscape/SKILL.md:80-85`, `src/lib/lab-engine/sections/section-registry.ts:140`). The `intent` input is defined but ignored in `execute` (`src/lib/lab-engine/agents/tools/spyfu.ts:59-67`). |

## 2. Skill <-> Registry Drift

| Section | Skill instructs model to use | Registry allows | Drift |
|---|---|---|---|
| Market Category | `web_search`, `firecrawl`, `pagespeed` (`src/lib/lab-engine/skills/positioning-market-category/SKILL.md:78-86`). | `web_search`, `firecrawl` (`src/lib/lab-engine/sections/section-registry.ts:103-119`). | `pagespeed` is instructed but unavailable. |
| Competitor Landscape | `web_search`, `spyfu`, `adlibrary`, `meta_ads`, `google_ads`, `firecrawl` (`src/lib/lab-engine/skills/positioning-competitor-landscape/SKILL.md:76-87`). | `web_search`, `firecrawl`, `adlibrary`, `reviews` (`src/lib/lab-engine/sections/section-registry.ts:125-141`). | `spyfu`, `meta_ads`, and `google_ads` are instructed but unavailable. `reviews` is allowed but not listed in the skill tool table. This is the direct cause of the deterministic ad probe returning `[]` before tool execution (`src/lib/lab-engine/agents/run-section.ts:1863-1868`). |
| Buyer ICP | `web_search`, `firecrawl`, `reviews` (`src/lib/lab-engine/skills/positioning-buyer-icp/SKILL.md:20-27`). | `web_search`, `firecrawl` (`src/lib/lab-engine/sections/section-registry.ts:147-162`). | `reviews` is instructed but unavailable. |
| Voice of Customer | `web_search`, `firecrawl`, `reviews` (`src/lib/lab-engine/skills/positioning-voice-of-customer/SKILL.md:20-27`). | `web_search`, `reviews`, `firecrawl` (`src/lib/lab-engine/sections/section-registry.ts:168-183`). | No functional drift. Order differs only. |
| Demand Intent | `web_search`, `firecrawl`, `keyword_ad_probe` (`src/lib/lab-engine/skills/positioning-demand-intent/SKILL.md:20-27`). | `web_search`, `keyword_ad_probe`, `firecrawl` (`src/lib/lab-engine/sections/section-registry.ts:189-204`). | No functional drift. Order differs only. |
| Offer Diagnostic | `web_search`, `firecrawl`, `pagespeed`, `reviews`, `ga4` (`src/lib/lab-engine/skills/positioning-offer-diagnostic/SKILL.md:20-29`). | `web_search`, `firecrawl`, `pagespeed` (`src/lib/lab-engine/sections/section-registry.ts:210-225`). | `reviews` and `ga4` are instructed but unavailable. |
| Paid Media Plan | Skill says synthesize committed artifacts and do not re-run the six positioning sections (`src/lib/lab-engine/skills/positioning-paid-media-plan/SKILL.md:18-35`). | `keyword_ad_probe` (`src/lib/lab-engine/sections/section-registry.ts:231-248`). | Registry allows a live SERP probe that the skill does not instruct and arguably forbids by saying to synthesize, not re-run. |

## 3. Brave Executable Search Design

### Current State

There is no executable `web_search` file in `src/lib/lab-engine/agents/tools` at current ref `21f7fd8e`; the tracked tool files are `_shared.ts`, `adlibrary.ts`, `competitor-ad-adapter.ts`, `firecrawl.ts`, `ga4.ts`, `google-ads.ts`, `index.ts`, `keyword-ad-probe.ts`, `meta-ads.ts`, `pagespeed.ts`, `reviews.ts`, and `spyfu.ts` (`git ls-files src/lib/lab-engine/agents/tools` at `21f7fd8e`). The only `web_search` path is the `buildToolMap` special case (`src/lib/lab-engine/agents/tool-registry.ts:18-24`) backed by `anthropic.tools.webSearch_20250305` (`src/lib/lab-engine/ai/web-search-provider-tool.ts:1-18`).

### New File

Create `src/lib/lab-engine/agents/tools/brave-search.ts`.

Input schema design:

```ts
z.object({
  q: z.string().min(1),
  count: z.number().int().min(1).max(20).default(10),
  freshness: z.enum(["pd", "pw", "pm", "py"]).optional(),
  country: z.string().min(2).max(2).default("US"),
}).strict()
```

Output schema design, using the existing `ToolGapSchema` union convention (`src/lib/lab-engine/agents/tools/_shared.ts:3-18`):

```ts
z.union([
  z.object({
    type: z.literal("result"),
    query: z.string().min(1),
    results: z.array(z.object({
      title: z.string().min(1),
      url: z.string().url(),
      description: z.string().min(1).optional(),
      extra_snippets: z.array(z.string().min(1)),
    }).strict()),
  }).strict(),
  ToolGapSchema,
])
```

Execution contract:

- `GET https://api.search.brave.com/res/v1/web/search`.
- Header `X-Subscription-Token: process.env.BRAVE_SEARCH_API_KEY`.
- Query params: `q`, `count` clamped by schema to `<=20`, optional `freshness` in `pd|pw|pm|py`, and `country`.
- Parse `web.results[]` into `{ title, url, description, extra_snippets }` exactly from the Brave response contract stated in the task.
- Missing key returns `credentialGap("BRAVE_SEARCH_API_KEY")`, matching existing tool convention (`src/lib/lab-engine/agents/tools/_shared.ts:35-42`).
- Non-OK response returns `apiErrorGap("Brave Search <status>: <body-prefix>")`, matching the Firecrawl and Reviews pattern (`src/lib/lab-engine/agents/tools/firecrawl.ts:61-65`, `src/lib/lab-engine/agents/tools/reviews.ts:72-74`).
- Caught errors return `errorToGap(error, "Brave Search request failed")`, matching existing executable tools (`src/lib/lab-engine/agents/tools/_shared.ts:112-118`).

### Registration and Tool Map Change

Do not add a new model-facing name like `brave_search` unless the skill docs are also rewritten. The lowest-drift provider-agnostic integration is to register the Brave executable as model-facing `web_search`.

Files that change:

1. `src/lib/lab-engine/agents/tools/index.ts`: import `braveSearchAgentTool` and add `web_search: braveSearchAgentTool` inside `TOOL_CATALOG`; change `ToolName` to `keyof typeof TOOL_CATALOG` instead of `keyof typeof TOOL_CATALOG | "web_search"` (`src/lib/lab-engine/agents/tools/index.ts:11-23`).
2. `src/lib/lab-engine/agents/tool-registry.ts`: remove the `name === "web_search"` special case and remove the import of `createWebSearchProviderTool`; every allowed tool should go through `wrapWithBudget` (`src/lib/lab-engine/agents/tool-registry.ts:3-30`). This makes `web_search` an executable AI SDK `tool({ execute })`, like Firecrawl and Reviews (`src/lib/lab-engine/agents/tools/firecrawl.ts:28-85`, `src/lib/lab-engine/agents/tools/reviews.ts:48-101`).
3. `src/lib/lab-engine/ai/web-search-provider-tool.ts`: stop importing it from `tool-registry.ts`. Keep or delete the file only after checking `createCodeExecutionProviderTool` references; `rg` in current scope shows the web-search provider import is in `tool-registry.ts` (`src/lib/lab-engine/agents/tool-registry.ts:3`).
4. `src/lib/lab-engine/sections/section-registry.ts`: keep the tool name `web_search`, but its implementation switches to Brave for these six sections: Market (`:118`), Competitor (`:140`), Buyer (`:161`), Voice (`:182`), Demand (`:203`), Offer (`:224`). Paid Media Plan currently does not list `web_search` (`:247`).
5. `src/lib/lab-engine/sections/__tests__/section-registry.test.ts`: no semantic expected-name change if the name stays `web_search`; update only if tests assert catalog membership.

Provider-agnostic behavior:

- The tool is an AI SDK executable tool, not an Anthropic provider tool. Existing executable tools are wrapped and passed as generic `Tool` objects in `buildToolMap` (`src/lib/lab-engine/agents/tool-registry.ts:26-63`), and DeepSeek is already selected through a separate model factory (`src/lib/lab-engine/ai/models.ts:114-137`). Therefore the Brave design works with `deepseek-direct`, `deepseek-ollama`, and `anthropic` as long as the model can call ordinary tools. This is an inference from the AI SDK executable tool shape already used by Firecrawl/Reviews and the provider-specific DeepSeek model selection.

## 4. Competitor Ad Regression vs `main`

### What Main Has

Main's ad library is a broad multi-platform engine:

- Types cover `linkedin`, `meta`, and `google` platforms (`main:research-worker/src/tools/adlibrary-types.ts:1-4`).
- Creative output includes headline, body, image, video, format, active status, first/last seen, platform list, and details URL (`main:research-worker/src/tools/adlibrary-types.ts:3-17`).
- Summary output includes `activeAdCount`, platforms, themes, evidence, source confidence, sample messages, library links, source counts by platform, and optional rate-limit platforms (`main:research-worker/src/tools/adlibrary-types.ts:19-44`).
- Runtime fetches Google, LinkedIn, and Meta in parallel (`main:research-worker/src/tools/adlibrary.ts:1376-1391`).
- Runtime falls back to Foreplay historical creative records when a domain exists and SearchAPI returns fewer than three current ads (`main:research-worker/src/tools/adlibrary.ts:1393-1397`).
- Google has a domain-direct path and a name-search fallback (`main:research-worker/src/tools/adlibrary.ts:601-690`).
- Meta has a domain-first page search and a name-search fallback (`main:research-worker/src/tools/adlibrary.ts:861-958`).
- LinkedIn has a platform-specific advertiser search plus verified-domain post-filtering (`main:research-worker/src/tools/adlibrary.ts:729-859`).
- Foreplay lookup calls brand-by-domain and ads-by-brand APIs when enabled (`main:research-worker/src/tools/adlibrary.ts:969-1036`).
- Normalization extracts headline, body, image URL, video URL, advertiser, format, active flag, first/last seen, and details URL fallbacks for Meta and Google (`main:research-worker/src/tools/adlibrary.ts:1069-1218`).
- Deduplication uses ID plus content fingerprint (`main:research-worker/src/tools/adlibrary.ts:1292-1306`).
- Library links include Meta, LinkedIn, and Google advertiser URLs (`main:research-worker/src/tools/adlibrary.ts:1231-1269`).
- `activeAdCount` is based on normalized displayable creatives, not raw rows (`main:research-worker/src/tools/adlibrary.ts:1354-1359`).
- Source counts are preserved as `sourcesUsed.linkedin/meta/google/foreplay` (`main:research-worker/src/tools/adlibrary.ts:1367-1372`).

Most important: main has relevance filtering that the lab copy does not have.

- `isAdvertiserMatch` rejects wrong-company ads using exact match, containment with short-name suffix guards, first-word Jaro-Winkler, and domain fallback (`main:research-worker/src/tools/adlibrary.ts:195-224`, `main:research-worker/src/tools/adlibrary.ts:235-352`).
- `resolveBestCandidate` scores candidates, handles short names, uses domain corroboration, rejects low-score candidates, and marks ambiguous cases (`main:research-worker/src/tools/adlibrary.ts:390-599`).
- Google and Meta pass candidates through that resolver (`main:research-worker/src/tools/adlibrary.ts:675-690`, `main:research-worker/src/tools/adlibrary.ts:924-935`).
- `normalizeSearchApiToCreatives` applies `isAdvertiserMatch` as a final safety filter before producing creatives (`main:research-worker/src/tools/adlibrary.ts:1069-1091`).
- LinkedIn has an additional verified-domain URL filter that drops wrong-company ads and specifically documents the Fathom-style short-name collision it prevents (`main:research-worker/src/tools/adlibrary.ts:729-846`).

### What Lab Kept

The lab copy kept some normalization fields:

- Lab `AdLibraryOutputSchema` can return `url`, `id`, `advertiserName`, `title`, `snippet`, `landingUrl`, `imageUrl`, `videoUrl`, `detailsUrl`, `firstSeen`, `lastSeen`, `format`, and `isActive` (`src/lib/lab-engine/agents/tools/adlibrary.ts:13-43`).
- Lab normalization extracts many nested SearchAPI fields for headline/body/image/video/details URL (`src/lib/lab-engine/agents/tools/adlibrary.ts:322-443`).
- Lab filters unresolved template text (`src/lib/lab-engine/agents/tools/adlibrary.ts:116-126`, `src/lib/lab-engine/agents/tools/adlibrary.ts:457-462`).
- Lab adapter preserves raw counts, displayable counts, returned creative count, library links, raw samples, data gaps, and source errors in `CompetitorAdEvidenceGroup` (`src/lib/lab-engine/agents/tools/competitor-ad-adapter.ts:402-467`), and the artifact schema can hold those fields (`src/lib/lab-engine/artifacts/schemas/competitor-landscape.ts:207-223`).

### What Lab Lost

1. Platform breadth: lab `adLibraryPlatformSchema` only supports `meta` and `google` (`src/lib/lab-engine/agents/tools/adlibrary.ts:13`). Main supports LinkedIn in the type system and runtime (`main:research-worker/src/tools/adlibrary-types.ts:1-4`, `main:research-worker/src/tools/adlibrary.ts:737-859`). Lab adapter has `linkedin` count/link slots, but no lab ad tool populates them today (`src/lib/lab-engine/agents/tools/competitor-ad-adapter.ts:49-54`, `src/lib/lab-engine/agents/tools/adlibrary.ts:13`).
2. Foreplay fallback: lab has no Foreplay API path in `adlibrary.ts`; main has `searchForeplayAds` and invokes it when current ad coverage is thin (`main:research-worker/src/tools/adlibrary.ts:969-1036`, `main:research-worker/src/tools/adlibrary.ts:1393-1397`). Absence in lab is confirmed by current `adlibrary.ts` only defining SearchAPI Google/Meta fetchers and ending at the adlibrary tool export (`src/lib/lab-engine/agents/tools/adlibrary.ts:465-623`).
3. Domain-first identity: lab Google search is name-based advertiser search followed by advertiser ID fetch (`src/lib/lab-engine/agents/tools/adlibrary.ts:465-509`), and lab Meta search is name-based page search followed by page ID fetch (`src/lib/lab-engine/agents/tools/adlibrary.ts:511-553`). Main has domain-first paths for Google and Meta (`main:research-worker/src/tools/adlibrary.ts:601-690`, `main:research-worker/src/tools/adlibrary.ts:861-958`).
4. Relevance filtering: lab uses `scoreCandidateName` and accepts the best candidate above `0.5` (`src/lib/lab-engine/agents/tools/adlibrary.ts:155-203`). Main uses `calculateSimilarity`, `isAdvertiserMatch`, resolver verdicts, short-name guards, domain corroboration, and final creative filtering (`main:research-worker/src/tools/adlibrary.ts:195-224`, `main:research-worker/src/tools/adlibrary.ts:390-599`, `main:research-worker/src/tools/adlibrary.ts:1069-1091`). Lab ad tool inputs have no domain field (`src/lib/lab-engine/agents/tools/adlibrary.ts:586-592`, `src/lib/lab-engine/agents/tools/google-ads.ts:14-19`, `src/lib/lab-engine/agents/tools/meta-ads.ts:14-19`), so the main filter cannot be expressed in the current lab tool contract.
5. LinkedIn wrong-company filtering: main has explicit URL/domain post-filtering for LinkedIn (`main:research-worker/src/tools/adlibrary.ts:729-846`). Lab has no LinkedIn fetcher (`src/lib/lab-engine/agents/tools/adlibrary.ts:13`, `src/lib/lab-engine/agents/tools/adlibrary.ts:465-573`).
6. Active-ad summary: main produces `summary.activeAdCount` from normalized displayable creatives (`main:research-worker/src/tools/adlibrary.ts:1354-1359`). Lab returns raw `ads[]` per platform and relies on the adapter to derive raw/displayable counts later (`src/lib/lab-engine/agents/tools/adlibrary.ts:613-618`, `src/lib/lab-engine/agents/tools/competitor-ad-adapter.ts:300-345`).
7. Library-link depth: main builds Meta, LinkedIn, and Google library URLs with Google derived from actual creative details when present (`main:research-worker/src/tools/adlibrary.ts:1231-1269`). Lab builds only platform links in the adapter and only for observed/requested platforms (`src/lib/lab-engine/agents/tools/competitor-ad-adapter.ts:124-143`, `src/lib/lab-engine/agents/tools/competitor-ad-adapter.ts:195-202`).
8. Platform error visibility is mixed. Main has a whole-tool error summary path (`main:research-worker/src/tools/adlibrary.ts:1404-1426`) and source counts (`main:research-worker/src/tools/adlibrary.ts:1367-1372`); the `rateLimitedPlatforms` type exists (`main:research-worker/src/tools/adlibrary-types.ts:42-43`), but this file does not populate it at the searched ref (inference from `rg rateLimitedPlatforms` over `main:research-worker/src/tools/adlibrary.ts`). Lab adapter has stronger typed `sourceErrors` for returned gaps (`src/lib/lab-engine/agents/tools/competitor-ad-adapter.ts:348-362`, `src/lib/lab-engine/agents/tools/competitor-ad-adapter.ts:494-505`), but the current deterministic probe often returns no steps before a tool can return any gap (`src/lib/lab-engine/agents/run-section.ts:1863-1868`).

### Smallest Correct Fix

The smallest correct fix is **not** just "register existing `google_ads` and `meta_ads` into Competitor." That would stop the deterministic probe from returning `[]`, but it would route live ad evidence through the lab's thin name-based matching, which lacks the main relevance filter that prevents unrelated ads (`src/lib/lab-engine/agents/tools/adlibrary.ts:155-203`, `main:research-worker/src/tools/adlibrary.ts:195-224`, `main:research-worker/src/tools/adlibrary.ts:390-599`). Because the product owner specifically valued relevance filtering, the correct fix is option **(b): port main's depth and relevance filter**, with the registry fix included as a necessary wiring step.

Precise wiring:

1. `src/lib/lab-engine/sections/section-registry.ts`: add `google_ads` and `meta_ads` to `positioningCompetitorLandscape.allowedTools`; consider adding `spyfu` too if the skill remains authoritative (`src/lib/lab-engine/sections/section-registry.ts:140`, `src/lib/lab-engine/skills/positioning-competitor-landscape/SKILL.md:80-85`).
2. `src/lib/lab-engine/sections/__tests__/section-registry.test.ts`: update the expected Competitor allow-list, which currently mirrors the stale list (`src/lib/lab-engine/sections/__tests__/section-registry.test.ts:16` from `rg` output in current checkout).
3. `src/lib/lab-engine/agents/run-section.ts`: replace `getCompetitorAdProbeAdvertisers` with a target builder that can pass `{ advertiser, domain? }` rather than just names; current code only extracts names from `researchInput.competitorAds` (`src/lib/lab-engine/agents/run-section.ts:1638-1645`) and current tool calls pass only `advertiser` and `max_results` (`src/lib/lab-engine/agents/run-section.ts:1880-1898`).
4. `src/lib/lab-engine/artifacts/artifact-envelope.ts`: add or derive a competitor domain field if live competitor domains are available; current `competitorAdSchema` has competitor name, platform, landing URL, source URL, and creative fields but no explicit competitor domain (`src/lib/lab-engine/artifacts/artifact-envelope.ts:20-34`).
5. `src/lib/lab-engine/agents/tools/adlibrary.ts`: port main's `isAdvertiserMatch`, `resolveBestCandidate`, Google domain-direct path, Meta domain-first path, LinkedIn fetcher/filter if LinkedIn coverage is required, Foreplay fallback if historical creative coverage is required, normalization quality gate, dedupe, and library-link derivation (`main:research-worker/src/tools/adlibrary.ts:195-224`, `main:research-worker/src/tools/adlibrary.ts:390-599`, `main:research-worker/src/tools/adlibrary.ts:601-690`, `main:research-worker/src/tools/adlibrary.ts:729-859`, `main:research-worker/src/tools/adlibrary.ts:861-1036`, `main:research-worker/src/tools/adlibrary.ts:1069-1374`).
6. `src/lib/lab-engine/agents/tools/google-ads.ts` and `src/lib/lab-engine/agents/tools/meta-ads.ts`: extend input schemas with optional `domain` and pass it through to `adLibraryAgentTool.execute`; current wrappers drop anything except `advertiser` and `max_results` (`src/lib/lab-engine/agents/tools/google-ads.ts:14-38`, `src/lib/lab-engine/agents/tools/meta-ads.ts:14-38`).
7. `src/lib/lab-engine/agents/tools/competitor-ad-adapter.ts`: set `group.domain` from the tool input or parsed output; current groups initialize `domain: null` and never update it (`src/lib/lab-engine/agents/tools/competitor-ad-adapter.ts:161-171`, `src/lib/lab-engine/agents/tools/competitor-ad-adapter.ts:450-467`).

## 5. Streaming Module

The `src/lib/lab-engine/streaming/` directory contains one tracked file at current ref `21f7fd8e`: `run-section-ui-message.ts` (`git ls-files src/lib/lab-engine/streaming` at `21f7fd8e`). That file defines UI stream data events for section status, tool events, artifact partial, artifact final, and validation events (`src/lib/lab-engine/streaming/run-section-ui-message.ts:5-45`).

`run-section.ts` imports the stream writer type from this module (`src/lib/lab-engine/agents/run-section.ts:63`). It has writer helpers for `data-section-status`, `data-tool-event`, `data-validation-event`, `data-artifact-partial`, and `data-artifact-final` (`src/lib/lab-engine/agents/run-section.ts:361-479`).

Partial typed artifact streaming exists only on the legacy structured stream path:

- `defaultStructuredStreamer` exposes `partialOutputStream` from AI SDK `streamText` with `Output.object` (`src/lib/lab-engine/agents/section-agent.ts:1186-1223`, `src/lib/lab-engine/agents/section-agent.ts:1349-1363`).
- `callStructuredStreamAttempt` consumes `structuredStream.partialOutputStream` and writes each partial to the UI writer (`src/lib/lab-engine/agents/run-section.ts:2038-2078`).
- `streamRunSection` calls that path for sections not in `answerToolSectionIds` (`src/lib/lab-engine/agents/run-section.ts:2808-2820`, `src/lib/lab-engine/agents/run-section.ts:3000-3008`).

The six shipped positioning sections are routed through the answer-tool path instead:

- `answerToolSectionIds` includes Market, Demand, Offer, Buyer, Voice, and Competitor (`src/lib/lab-engine/agents/run-section.ts:604-613`).
- `streamRunSection` immediately routes those IDs to `streamSectionViaAnswerTool` (`src/lib/lab-engine/agents/run-section.ts:2816-2818`).
- `streamSectionViaAnswerTool` streams tool/status events, validates the answer tool output after the answer result returns, saves the artifact, and writes `artifact-final` (`src/lib/lab-engine/agents/run-section.ts:2532-2590`, `src/lib/lab-engine/agents/run-section.ts:2600-2702`, `src/lib/lab-engine/agents/run-section.ts:2754-2777`).
- There is no call to `writeArtifactPartial` in the answer-tool path; the only `writeArtifactPartial` call is inside `callStructuredStreamAttempt` (`src/lib/lab-engine/agents/run-section.ts:446-460`, `src/lib/lab-engine/agents/run-section.ts:2038-2078`). This is an inference from the call sites above and `rg writeArtifactPartial` in current checkout.

Conclusion: the streaming module supports partial artifact events in type and in the legacy structured path, but the current six answer-tool sections effectively emit terminal artifact data only. Paid Media Plan is not in `answerToolSectionIds` and can use the partial structured path if executed through `streamRunSection` (`src/lib/lab-engine/agents/run-section.ts:604-613`, `src/lib/lab-engine/sections/section-registry.ts:231-248`).

## Kinks: Evidence -> Impact -> Effort -> One-line Fix

### H1. Anthropic provider `web_search` under DeepSeek

- Evidence: `web_search` bypasses `TOOL_CATALOG` and uses `createWebSearchProviderTool` (`src/lib/lab-engine/agents/tool-registry.ts:18-24`); that function returns `anthropic.tools.webSearch_20250305` (`src/lib/lab-engine/ai/web-search-provider-tool.ts:1-18`); DeepSeek direct model selection uses `createDeepSeek` with `deepseek-v4-flash` (`src/lib/lab-engine/ai/models.ts:114-137`).
- Impact: H. Under `LAB_ENGINE_PROVIDER=deepseek-direct`, a core research tool is provider-shaped for Anthropic, not executable/provider-agnostic. Provider incompatibility is an inference from the cited constructors.
- Effort: M.
- One-line fix: Replace the provider special case with executable Brave-backed `web_search` registered in `TOOL_CATALOG`.

### H2. Competitor deterministic ad probe is always empty on the default section registry

- Evidence: `runCompetitorAdProbeSteps` returns `[]` unless both `google_ads` and `meta_ads` are executable in `researchTools` (`src/lib/lab-engine/agents/run-section.ts:1852-1868`); Competitor allowed tools omit both (`src/lib/lab-engine/sections/section-registry.ts:140`); both tools exist in `TOOL_CATALOG` (`src/lib/lab-engine/agents/tools/index.ts:14-15`).
- Impact: H. `body.adEvidence` can hold normalized ad evidence, but deterministic live ad evidence is not generated by default (`src/lib/lab-engine/artifacts/schemas/competitor-landscape.ts:207-223`, `src/lib/lab-engine/agents/run-section.ts:2172-2175`).
- Effort: S for the unblock, M/L for the correct ad-quality fix.
- One-line fix: Add `google_ads` and `meta_ads` to Competitor allowed tools, then port main relevance filtering before trusting results.

### H3. Main ad relevance filtering was not ported

- Evidence: lab candidate selection is a normalized-name score with a `0.5` cutoff (`src/lib/lab-engine/agents/tools/adlibrary.ts:155-203`); lab tool inputs have no domain (`src/lib/lab-engine/agents/tools/adlibrary.ts:586-592`). Main has domain-aware `isAdvertiserMatch`, resolver verdicts, domain-first Google/Meta, and LinkedIn domain post-filtering (`main:research-worker/src/tools/adlibrary.ts:195-224`, `main:research-worker/src/tools/adlibrary.ts:390-599`, `main:research-worker/src/tools/adlibrary.ts:601-690`, `main:research-worker/src/tools/adlibrary.ts:729-958`).
- Impact: H. Naively enabling `google_ads`/`meta_ads` can turn empty evidence into wrong-company ad evidence, especially for short or ambiguous names. This impact is an inference from the absence of the main relevance filters and the comments in main documenting wrong-company collisions (`main:research-worker/src/tools/adlibrary.ts:209-214`, `main:research-worker/src/tools/adlibrary.ts:789-795`).
- Effort: L if full multi-platform parity is required; M if only Google/Meta relevance is ported.
- One-line fix: Port main's candidate resolver and advertiser-match filters into lab `adlibrary.ts`, add optional domain plumbing, then enable the tools.

### H4. Skill instructions and registry allow-lists disagree

- Evidence: Market skill mentions `pagespeed` but registry omits it (`src/lib/lab-engine/skills/positioning-market-category/SKILL.md:82-84`, `src/lib/lab-engine/sections/section-registry.ts:118`); Buyer mentions `reviews` but registry omits it (`src/lib/lab-engine/skills/positioning-buyer-icp/SKILL.md:24-26`, `src/lib/lab-engine/sections/section-registry.ts:161`); Competitor mentions `spyfu`, `google_ads`, and `meta_ads` but registry omits them (`src/lib/lab-engine/skills/positioning-competitor-landscape/SKILL.md:80-85`, `src/lib/lab-engine/sections/section-registry.ts:140`); Offer mentions `reviews` and `ga4` but registry omits them (`src/lib/lab-engine/skills/positioning-offer-diagnostic/SKILL.md:24-28`, `src/lib/lab-engine/sections/section-registry.ts:224`).
- Impact: H. The prompt tells the model to use tools it cannot call, while the runtime silently builds a smaller tool map (`src/lib/lab-engine/agents/tool-registry.ts:18-30`).
- Effort: S.
- One-line fix: Make each `SKILL.md` tool table and `section-registry.ts` allow-list identical, then add tests that diff them.

### M1. Registered dead capabilities

- Evidence: `ga4`, `spyfu`, `google_ads`, and `meta_ads` are in `TOOL_CATALOG` (`src/lib/lab-engine/agents/tools/index.ts:14-20`), but no section allows `ga4`, `spyfu`, `google_ads`, or `meta_ads` today (`src/lib/lab-engine/sections/section-registry.ts:118-247`).
- Impact: M. Code presence gives a false sense of live capability; model-facing sections cannot access these tools unless `deps.allowedTools` overrides the registry (`src/lib/lab-engine/agents/run-section.ts:498-503`).
- Effort: S.
- One-line fix: Either expose these tools in the sections whose skills name them or remove their skill mentions until the registry exposes them.

### M2. Fail-soft-to-empty is still present where an honest gap would be better

- Evidence: `adlibrary.ts` returns `ads: []` when candidate matching fails (`src/lib/lab-engine/agents/tools/adlibrary.ts:488-492`, `src/lib/lab-engine/agents/tools/adlibrary.ts:530-535`, `src/lib/lab-engine/agents/tools/adlibrary.ts:613-618`); `runCompetitorAdProbeSteps` returns `[]` when required tools are absent instead of emitting a typed gap step (`src/lib/lab-engine/agents/run-section.ts:1863-1868`).
- Impact: M. Missing tool wiring and no candidate match become indistinguishable from "no ad evidence found" unless the caller inspects registry wiring. This violates the local gap convention in `_shared.ts` (`src/lib/lab-engine/agents/tools/_shared.ts:3-18`).
- Effort: S.
- One-line fix: Return typed gaps for unavailable required ad tools and for no matched advertiser/page when the lookup was attempted.

### M3. SERP shims are named like direct evidence tools

- Evidence: `reviews` searches Google for review-site snippets, not direct review APIs (`src/lib/lab-engine/agents/tools/reviews.ts:66-96`); `keyword_ad_probe` reports Google SERP organic/ad counts from SearchAPI (`src/lib/lab-engine/agents/tools/keyword-ad-probe.ts:51-84`).
- Impact: M. Outputs can be useful directional evidence, but names imply first-party review or ad-platform facts. "Search result snippet" vs "review" and "SERP ad count" vs "ad demand" should be explicit in prompts and prose. This is an inference from the tool names and cited implementations.
- Effort: S.
- One-line fix: Rename descriptions and output prose requirements to state "SearchAPI SERP snippets/counts"; do not present them as direct platform metrics.

### M4. Streaming supports partials, but not for the six answer-tool sections

- Evidence: stream event types include `artifact-partial` (`src/lib/lab-engine/streaming/run-section-ui-message.ts:19-23`), and legacy structured streaming writes partials (`src/lib/lab-engine/agents/run-section.ts:2038-2078`). The six positioning sections route through answer-tool streaming (`src/lib/lab-engine/agents/run-section.ts:604-613`, `src/lib/lab-engine/agents/run-section.ts:2816-2818`) and emit final artifact only after validation/save (`src/lib/lab-engine/agents/run-section.ts:2696-2777`).
- Impact: M. The shipped DeepSeek sections do not stream typed artifacts field-by-field to consumers; they stream status/tool events plus final artifact. This conclusion is an inference from the routed code paths above.
- Effort: M/L.
- One-line fix: Add partial-object streaming to the answer-tool path or move these sections back onto a structured stream path that preserves tool control.

### L1. `spyfu` input has an unused `intent`

- Evidence: `spyfu.ts` input schema defines `intent: "keywords" | "competitors"` but `execute` only destructures `{ domain }` and always calls the same two endpoints (`src/lib/lab-engine/agents/tools/spyfu.ts:59-81`).
- Impact: L. The schema advertises a mode switch that does not exist.
- Effort: S.
- One-line fix: Remove `intent` or implement separate behavior.

## Hypotheses Checked

- Hypothesis: `web_search` is an Anthropic provider tool and DeepSeek cannot literally invoke it. Result: confirmed as provider-specific wiring; DeepSeek incompatibility is an inference from `anthropic.tools.webSearch_20250305` plus `deepseek-direct` model selection (`src/lib/lab-engine/ai/web-search-provider-tool.ts:1-18`, `src/lib/lab-engine/ai/models.ts:114-137`).
- Hypothesis: Competitor deterministic ad evidence is always empty. Result: confirmed for default registry wiring because required `google_ads`/`meta_ads` are not in Competitor `allowedTools` (`src/lib/lab-engine/agents/run-section.ts:1852-1868`, `src/lib/lab-engine/sections/section-registry.ts:140`).
- Hypothesis: `google-ads.ts` and `meta-ads.ts` exist. Result: confirmed, and both are registered in `TOOL_CATALOG` (`src/lib/lab-engine/agents/tools/google-ads.ts:11-38`, `src/lib/lab-engine/agents/tools/meta-ads.ts:11-38`, `src/lib/lab-engine/agents/tools/index.ts:14-15`).
- Hypothesis: main's relevance filtering was lost. Result: confirmed. Main has domain/name/url relevance guards; lab has only simple name scoring and no domain input (`main:research-worker/src/tools/adlibrary.ts:195-224`, `main:research-worker/src/tools/adlibrary.ts:390-599`, `src/lib/lab-engine/agents/tools/adlibrary.ts:155-203`, `src/lib/lab-engine/agents/tools/adlibrary.ts:586-592`).
- Hypothesis: streaming module only emits terminal artifact. Result: partially wrong. The module and legacy structured path support partials, but the six current answer-tool sections only emit final artifact data (`src/lib/lab-engine/streaming/run-section-ui-message.ts:19-28`, `src/lib/lab-engine/agents/run-section.ts:2038-2078`, `src/lib/lab-engine/agents/run-section.ts:604-613`, `src/lib/lab-engine/agents/run-section.ts:2696-2777`).
