import { z } from "zod";

export const sectionKeySchema = z.enum([
  "reviewBrief",
  "industryMarket",
  "icpValidation",
  "competitors",
  "offerAnalysis",
  "keywordIntel",
  "crossAnalysis",
  "mediaPlan",
  "scripts",
]);

export const cardStatusSchema = z.enum(["draft", "edited", "approved"]);

export const workspaceCardInputSchema = z
  .object({
    id: z.string().min(1),
    section_key: sectionKeySchema,
    card_kind: z.string().min(1),
    label: z.string().min(1),
    content: z.record(z.string(), z.unknown()),
    status: cardStatusSchema,
  })
  .strict();

export const cardEditSchema = z
  .object({
    edited_by: z.enum(["user", "ai", "system"]),
    updated_content: z.record(z.string(), z.unknown()).refine(
      (content) => Object.keys(content).length > 0,
      "updated_content must not be empty",
    ),
    edited_at: z.string().datetime(),
  })
  .strict();

export const presentWorkspaceInputSchema = z
  .object({
    run_id: z.string().min(1),
    user_id: z.string().min(1),
    section_key: sectionKeySchema,
    skill_output: z.record(z.string(), z.unknown()).refine(
      (output) => Object.keys(output).length > 0,
      "skill_output must not be empty",
    ),
    brief_id: z.string().min(1).optional(),
    brief_snapshot_id: z.string().min(1).optional(),
    client_id: z.string().min(1).optional(),
    existing_cards: z.array(workspaceCardInputSchema).optional(),
    card_edits: z.record(z.string(), cardEditSchema).optional(),
    write_mode: z.enum(["dry-run", "mock-write"]).default("dry-run"),
  })
  .strict();

export type SectionKey = z.infer<typeof sectionKeySchema>;
export type CardStatus = z.infer<typeof cardStatusSchema>;
export type WorkspaceCardInput = z.infer<typeof workspaceCardInputSchema>;
export type CardEdit = z.infer<typeof cardEditSchema>;
export type PresentWorkspaceInput = z.infer<typeof presentWorkspaceInputSchema>;
