// skills/landing-page-studio/schemas/directions.ts
// Zod v3 schema for DirectionSpec and DirectionPlan (array of 3).
// Consumed by: plan-directions.ts (T4), generate-html.ts (T5), generate.ts (T10).
// No imports from outside skills/landing-page-studio/ — this file is skill-local.
import { z } from "zod";

export const DirectionSpecSchema = z.object({
  id: z.enum(["A", "B", "C"]).describe("Direction identifier"),
  label: z.string().describe("Short human name for the direction, e.g. Editorial Minimal"),
  layout_paradigm: z
    .enum(["hero", "editorial", "grid", "split", "card-stack"])
    .describe("Primary layout paradigm"),
  color_temperature: z
    .enum(["warm", "cool", "neutral"])
    .describe("Overall color temperature of the palette"),
  typographic_register: z
    .enum(["serif-led", "sans-led", "mono-accent"])
    .describe("Primary typographic character"),
  primary_color_oklch: z
    .string()
    .regex(/^oklch\(/, "Must be an OKLCH color string starting with oklch(")
    .describe("Primary brand color expressed as oklch(L C H), e.g. oklch(0.65 0.18 240)"),
  accent_color_oklch: z
    .string()
    .regex(/^oklch\(/, "Must be an OKLCH color string starting with oklch(")
    .describe("Accent color expressed as oklch(L C H)"),
  rationale: z
    .string()
    .describe("One sentence explaining why this direction is distinct from the others"),
});

export type DirectionSpec = z.infer<typeof DirectionSpecSchema>;

// Note: disjointness validation (no two directions sharing layout_paradigm+color_temperature)
// is enforced at runtime in plan-directions.ts rather than via Zod .refine() to avoid
// TypeScript TS2589 "type instantiation is excessively deep" with generateObject().
export const DirectionPlanSchema = z.object({
  directions: z
    .array(DirectionSpecSchema)
    .length(3)
    .describe("Exactly 3 disjoint visual directions for the landing page"),
});

export type DirectionPlan = z.infer<typeof DirectionPlanSchema>;
