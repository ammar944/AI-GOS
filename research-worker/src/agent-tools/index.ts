/**
 * Agent-tools registry — AI SDK v6 tool() wrappers per Phase 3a.
 *
 * Each subagent in Phase 3b picks a subset of these per design Premise 7:
 *
 * | Subagent                       | Tools                                                     |
 * | positioningMarketCategory      | web_search, firecrawl, pagespeed                          |
 * | positioningBuyerICP            | web_search, reviews, firecrawl                            |
 * | positioningCompetitorLandscape | web_search, spyfu, adlibrary, meta-ads, google-ads, firecrawl |
 * | positioningVoiceOfCustomer     | web_search, reviews, firecrawl                            |
 * | positioningDemandIntent        | web_search, keyword-ad-probe, firecrawl                   |
 * | positioningOfferDiagnostic     | web_search, ga4, pagespeed, reviews, firecrawl, code_execution |
 */

export { adLibraryAgentTool } from './adlibrary';
export { codeExecutionAgentTool } from './code-execution';
export { firecrawlAgentTool } from './firecrawl';
export { ga4AgentTool } from './ga4';
export { googleAdsAgentTool } from './google-ads';
export { keywordAdProbeAgentTool } from './keyword-ad-probe';
export { metaAdsAgentTool } from './meta-ads';
export { pagespeedAgentTool } from './pagespeed';
export { reviewsAgentTool } from './reviews';
export { spyfuAgentTool } from './spyfu';
export {
  webSearchAgentTool,
  ANTHROPIC_WEB_SEARCH_PROVIDER_TOOL,
} from './web-search';

export * from './_shared';

// Convenience tool maps per positioning subagent. Phase 3b uses these
// directly in the subagent definitions.

import { anthropic } from '@ai-sdk/anthropic';
import type { ToolSet } from 'ai';

import { firecrawlAgentTool } from './firecrawl';
import { pagespeedAgentTool } from './pagespeed';
import { reviewsAgentTool } from './reviews';
import { spyfuAgentTool } from './spyfu';
import { adLibraryAgentTool } from './adlibrary';
import { metaAdsAgentTool } from './meta-ads';
import { googleAdsAgentTool } from './google-ads';
import { keywordAdProbeAgentTool } from './keyword-ad-probe';
import { ga4AgentTool } from './ga4';

/**
 * Anthropic provider-native tools. The SDK injects them at the model call
 * level so Claude executes web_search + code_execution server-side. Phase
 * 3a's webSearchAgentTool + codeExecutionAgentTool shims existed because
 * the spike couldn't verify these factories were exported from
 * @ai-sdk/anthropic; Phase 3b's Codex QA caught that those shims returned
 * not_implemented gaps and broke every subagent's web search.
 */
const anthropicWebSearch = anthropic.tools.webSearch_20250305({});
const anthropicCodeExecution = anthropic.tools.codeExecution_20250825({});

// Provider tools + user-defined tool() wrappers have incompatible
// Schema<never> vs Schema<input> generics in the AI SDK v6 type. The
// runtime composition works fine — cast each map to ToolSet so the
// ToolLoopAgent accepts the mixed registry.
export const POSITIONING_TOOL_MAPS: {
  positioningMarketCategory: ToolSet;
  positioningBuyerICP: ToolSet;
  positioningCompetitorLandscape: ToolSet;
  positioningVoiceOfCustomer: ToolSet;
  positioningDemandIntent: ToolSet;
  positioningOfferDiagnostic: ToolSet;
} = {
  positioningMarketCategory: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    web_search: anthropicWebSearch as any,
    firecrawl: firecrawlAgentTool,
    pagespeed: pagespeedAgentTool,
  },
  positioningBuyerICP: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    web_search: anthropicWebSearch as any,
    reviews: reviewsAgentTool,
    firecrawl: firecrawlAgentTool,
  },
  positioningCompetitorLandscape: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    web_search: anthropicWebSearch as any,
    spyfu: spyfuAgentTool,
    adlibrary: adLibraryAgentTool,
    meta_ads: metaAdsAgentTool,
    google_ads: googleAdsAgentTool,
    firecrawl: firecrawlAgentTool,
  },
  positioningVoiceOfCustomer: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    web_search: anthropicWebSearch as any,
    reviews: reviewsAgentTool,
    firecrawl: firecrawlAgentTool,
  },
  positioningDemandIntent: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    web_search: anthropicWebSearch as any,
    keyword_ad_probe: keywordAdProbeAgentTool,
    firecrawl: firecrawlAgentTool,
  },
  positioningOfferDiagnostic: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    web_search: anthropicWebSearch as any,
    ga4: ga4AgentTool,
    pagespeed: pagespeedAgentTool,
    reviews: reviewsAgentTool,
    firecrawl: firecrawlAgentTool,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    code_execution: anthropicCodeExecution as any,
  },
};
