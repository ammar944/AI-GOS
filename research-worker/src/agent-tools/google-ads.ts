/**
 * Google Ads transparency wrapper — pins platform to 'google'. Codex Phase
 * 3a QA caught that the previous verbatim re-export of adLibraryAgentTool
 * let a model omit `platform` and silently get Meta results back. Narrow
 * schema ensures Google semantics.
 */

import { tool } from 'ai';
import { z } from 'zod';

import { adLibraryAgentTool } from './adlibrary';
import { type ToolGap } from './_shared';

type AdLibraryResult = Awaited<
  ReturnType<NonNullable<typeof adLibraryAgentTool.execute>>
>;

export const googleAdsAgentTool = tool({
  description:
    'Look up active Google Ads creative for a brand via Google Ads Transparency. Returns a small set of ad URLs + snippets you can cite as evidence the competitor is running paid acquisition on Google.',
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
      { advertiser, platform: 'google', max_results },
      opts,
    );
  },
});
