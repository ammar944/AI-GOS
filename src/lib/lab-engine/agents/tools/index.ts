import { adLibraryAgentTool } from "./adlibrary";
import { braveSearchAgentTool } from "./brave-search";
import { firecrawlAgentTool } from "./firecrawl";
import { googleAdsAgentTool } from "./google-ads";
import { keywordAdProbeAgentTool } from "./keyword-ad-probe";
import { metaAdsAgentTool } from "./meta-ads";
import { pagespeedAgentTool } from "./pagespeed";
import { reviewsAgentTool } from "./reviews";

export const TOOL_CATALOG = {
  web_search: braveSearchAgentTool,
  firecrawl: firecrawlAgentTool,
  adlibrary: adLibraryAgentTool,
  google_ads: googleAdsAgentTool,
  meta_ads: metaAdsAgentTool,
  pagespeed: pagespeedAgentTool,
  keyword_ad_probe: keywordAdProbeAgentTool,
  reviews: reviewsAgentTool,
} as const;

export type ToolName = keyof typeof TOOL_CATALOG;
