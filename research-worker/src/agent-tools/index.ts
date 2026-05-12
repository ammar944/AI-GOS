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

import { firecrawlAgentTool } from './firecrawl';
import { pagespeedAgentTool } from './pagespeed';
import { reviewsAgentTool } from './reviews';
import { spyfuAgentTool } from './spyfu';
import { adLibraryAgentTool } from './adlibrary';
import { metaAdsAgentTool } from './meta-ads';
import { googleAdsAgentTool } from './google-ads';
import { keywordAdProbeAgentTool } from './keyword-ad-probe';
import { ga4AgentTool } from './ga4';
import { codeExecutionAgentTool } from './code-execution';
import { webSearchAgentTool } from './web-search';

export const POSITIONING_TOOL_MAPS = {
  positioningMarketCategory: {
    web_search: webSearchAgentTool,
    firecrawl: firecrawlAgentTool,
    pagespeed: pagespeedAgentTool,
  },
  positioningBuyerICP: {
    web_search: webSearchAgentTool,
    reviews: reviewsAgentTool,
    firecrawl: firecrawlAgentTool,
  },
  positioningCompetitorLandscape: {
    web_search: webSearchAgentTool,
    spyfu: spyfuAgentTool,
    adlibrary: adLibraryAgentTool,
    meta_ads: metaAdsAgentTool,
    google_ads: googleAdsAgentTool,
    firecrawl: firecrawlAgentTool,
  },
  positioningVoiceOfCustomer: {
    web_search: webSearchAgentTool,
    reviews: reviewsAgentTool,
    firecrawl: firecrawlAgentTool,
  },
  positioningDemandIntent: {
    web_search: webSearchAgentTool,
    keyword_ad_probe: keywordAdProbeAgentTool,
    firecrawl: firecrawlAgentTool,
  },
  positioningOfferDiagnostic: {
    web_search: webSearchAgentTool,
    ga4: ga4AgentTool,
    pagespeed: pagespeedAgentTool,
    reviews: reviewsAgentTool,
    firecrawl: firecrawlAgentTool,
    code_execution: codeExecutionAgentTool,
  },
} as const;
