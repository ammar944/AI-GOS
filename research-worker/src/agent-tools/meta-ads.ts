/**
 * Meta Ads transparency wrapper — wraps adlibrary with platform pinned to
 * 'meta'. Codex Phase 3a QA caught that re-exporting adLibraryAgentTool
 * verbatim let a model omit `platform` and silently default to meta on
 * google_ads. We narrow the schema so each alias has correct semantics.
 */

import { tool } from 'ai';
import { z } from 'zod';

import { adLibraryAgentTool } from './adlibrary';
import { type ToolGap } from './_shared';

type AdLibraryResult = Awaited<
  ReturnType<NonNullable<typeof adLibraryAgentTool.execute>>
>;

export const metaAdsAgentTool = tool({
  description:
    'Look up active Meta (Facebook + Instagram) advertising creative for a brand. Returns a small set of ad URLs + snippets you can cite as evidence the competitor is running paid acquisition on Meta.',
  inputSchema: z.object({
    advertiser: z.string(),
    max_results: z.number().int().default(8),
  }),
  execute: async (
    { advertiser, max_results },
    opts,
  ): Promise<AdLibraryResult | ToolGap> => {
    if (!adLibraryAgentTool.execute) {
      return { type: 'gap', reason: 'not_implemented', message: 'adLibrary tool has no execute' };
    }
    return adLibraryAgentTool.execute(
      { advertiser, platform: 'meta', max_results },
      opts,
    );
  },
});
