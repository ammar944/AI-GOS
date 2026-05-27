import { adLibraryAgentTool } from "./adlibrary";
import { braveSearchAgentTool } from "./brave-search";
import { firecrawlAgentTool } from "./firecrawl";
import { ga4AgentTool } from "./ga4";
import { googleAdsAgentTool } from "./google-ads";
import { keywordAdProbeAgentTool } from "./keyword-ad-probe";
import { metaAdsAgentTool } from "./meta-ads";
import { pagespeedAgentTool } from "./pagespeed";
import { reviewsAgentTool } from "./reviews";
import { spyfuAgentTool } from "./spyfu";

export const TOOL_CATALOG = {
  web_search: braveSearchAgentTool,
  firecrawl: firecrawlAgentTool,
  adlibrary: adLibraryAgentTool,
  google_ads: googleAdsAgentTool,
  meta_ads: metaAdsAgentTool,
  spyfu: spyfuAgentTool,
  pagespeed: pagespeedAgentTool,
  keyword_ad_probe: keywordAdProbeAgentTool,
  reviews: reviewsAgentTool,
  ga4: ga4AgentTool,
} as const;

export type ToolName = keyof typeof TOOL_CATALOG;
