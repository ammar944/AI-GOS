import { tool } from "ai";
import { z } from "zod";

import { ToolGapSchema, credentialGap, type ToolGap } from "./_shared";

export const Ga4OutputSchema = z.union([
  z
    .object({
      type: z.literal("result"),
      metric: z.string().min(1),
      property: z.string().min(1),
      value: z.number().nullable(),
    })
    .strict(),
  ToolGapSchema,
]);

export const ga4AgentTool = tool({
  description:
    "Pull funnel and acquisition metrics from a connected GA4 property. V1 surfaces a data availability gap.",
  inputSchema: z
    .object({
      property: z.string().min(1),
      metric: z.string().min(1),
    })
    .strict(),
  outputSchema: Ga4OutputSchema,
  execute: async (): Promise<ToolGap> => credentialGap("GA4_REFRESH_TOKEN"),
});
