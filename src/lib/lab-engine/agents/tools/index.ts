import { adLibraryAgentTool } from "./adlibrary";
import { firecrawlAgentTool } from "./firecrawl";
import { firecrawlSearchAgentTool } from "./firecrawl-search";
import { googleAdsAgentTool } from "./google-ads";
import { keywordAdProbeAgentTool } from "./keyword-ad-probe";
import { keywordDiscoveryAgentTool } from "./keyword-discovery";
import { keywordTrendsAgentTool } from "./keyword-trends";
import { keywordVolumeAgentTool } from "./keyword-volume";
import { linkedInAdsAgentTool } from "./linkedin-ads";
import { metaAdsAgentTool } from "./meta-ads";
import { pagespeedAgentTool } from "./pagespeed";
import { perplexityResearchAgentTool } from "./perplexity-research";
import { reviewsAgentTool } from "./reviews";

export const TOOL_CATALOG = {
  web_search: firecrawlSearchAgentTool,
  firecrawl: firecrawlAgentTool,
  adlibrary: adLibraryAgentTool,
  google_ads: googleAdsAgentTool,
  meta_ads: metaAdsAgentTool,
  linkedin_ads: linkedInAdsAgentTool,
  pagespeed: pagespeedAgentTool,
  keyword_ad_probe: keywordAdProbeAgentTool,
  keyword_trends: keywordTrendsAgentTool,
  keyword_volume: keywordVolumeAgentTool,
  keyword_discovery: keywordDiscoveryAgentTool,
  perplexity_research: perplexityResearchAgentTool,
  reviews: reviewsAgentTool,
} as const;

export type ToolName = keyof typeof TOOL_CATALOG;
