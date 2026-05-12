/**
 * Meta Ads transparency wrapper — Phase 3a shape uses the same SearchAPI
 * fallback as adlibrary.ts. The Competitor Landscape subagent calls this
 * when it specifically wants the Meta-side ad inventory; adlibrary is the
 * more general entry point.
 */

import { adLibraryAgentTool } from './adlibrary';

// Phase 3a alias — the Meta-specific entry just narrows adLibrary's
// platform parameter. Phase 3b can split if richer Meta-only features
// (page transparency, advertiser spend) are wired.
export const metaAdsAgentTool = adLibraryAgentTool;
