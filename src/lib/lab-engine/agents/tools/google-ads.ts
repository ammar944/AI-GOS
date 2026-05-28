import { tool } from "ai";
import { z } from "zod";

import {
  AdLibraryOutputSchema,
  adLibraryAgentTool,
  type AdLibraryOutput,
} from "./adlibrary";
import { type ToolGap } from "./_shared";

export const googleAdsAgentTool = tool({
  description:
    "Look up active Google Ads creative for a brand through Google Ads Transparency.",
  inputSchema: z
    .object({
      advertiser: z.string().min(1),
      domain: z.string().min(1).optional(),
      max_results: z.number().int().positive().default(8),
    })
    .strict(),
  outputSchema: AdLibraryOutputSchema,
  execute: async (
    { advertiser, domain, max_results },
    options,
  ): Promise<AdLibraryOutput | ToolGap> => {
    if (adLibraryAgentTool.execute === undefined) {
      return {
        type: "gap",
        reason: "not_implemented",
        message: "adLibrary tool has no execute function.",
      };
    }

    const output = await adLibraryAgentTool.execute(
      { advertiser, domain, platform: "google", max_results },
      options,
    );
    return AdLibraryOutputSchema.parse(output);
  },
});
