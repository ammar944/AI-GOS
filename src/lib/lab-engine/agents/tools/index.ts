import { adLibraryAgentTool } from "./adlibrary";
import { braveSearchAgentTool } from "./brave-search";
import { firecrawlAgentTool } from "./firecrawl";
import { googleAdsAgentTool } from "./google-ads";
import { keywordAdProbeAgentTool } from "./keyword-ad-probe";
import { keywordVolumeAgentTool } from "./keyword-volume";
import { linkedInAdsAgentTool } from "./linkedin-ads";
import { metaAdsAgentTool } from "./meta-ads";
import { pagespeedAgentTool } from "./pagespeed";
import { reviewsAgentTool } from "./reviews";

export const TOOL_CATALOG = {
  web_search: braveSearchAgentTool,
  firecrawl: firecrawlAgentTool,
  adlibrary: adLibraryAgentTool,
  google_ads: googleAdsAgentTool,
  meta_ads: metaAdsAgentTool,
  linkedin_ads: linkedInAdsAgentTool,
  pagespeed: pagespeedAgentTool,
  keyword_ad_probe: keywordAdProbeAgentTool,
  keyword_volume: keywordVolumeAgentTool,
  reviews: reviewsAgentTool,
} as const;

export type ToolName = keyof typeof TOOL_CATALOG;
