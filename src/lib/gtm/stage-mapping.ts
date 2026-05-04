import type { GtmStageKey } from "@/lib/gtm/schemas/gtm-run";

export const GTM_LIGHTHOUSE_STAGE_KEYS = [
  "discover-url",
  "discover-identity",
  "research-market-category",
  "research-competitors",
  "research-buyer-icp",
] as const satisfies readonly GtmStageKey[];

export type GtmLighthouseStage = (typeof GTM_LIGHTHOUSE_STAGE_KEYS)[number];

export type GtmInvocationSkill =
  | "discover-url"
  | "ingest-identity"
  | "research-market"
  | "research-competitor"
  | "research-icp";

const LEGACY_STAGE_ALIASES: Record<string, GtmLighthouseStage> = {
  "ingest-url": "discover-url",
  "ingest-identity": "discover-identity",
  "research-market": "research-market-category",
  "research-competitor": "research-competitors",
  "research-icp": "research-buyer-icp",
};

const STAGE_TO_INVOCATION_SKILL = {
  "discover-url": "discover-url",
  "discover-identity": "ingest-identity",
  "research-market-category": "research-market",
  "research-competitors": "research-competitor",
  "research-buyer-icp": "research-icp",
} as const satisfies Record<GtmLighthouseStage, GtmInvocationSkill>;

const STAGE_LABELS = {
  "discover-url": "discover-url",
  "discover-identity": "ingest-identity",
  "research-market-category": "research-market",
  "research-competitors": "research-competitor",
  "research-buyer-icp": "research-icp",
} as const satisfies Record<GtmLighthouseStage, string>;

export function normalizeGtmLighthouseStage(
  stage: string
): GtmLighthouseStage | null {
  if (isGtmLighthouseStage(stage)) {
    return stage;
  }

  return LEGACY_STAGE_ALIASES[stage] ?? null;
}

export function isGtmLighthouseStage(
  stage: string
): stage is GtmLighthouseStage {
  return GTM_LIGHTHOUSE_STAGE_KEYS.some((candidate) => candidate === stage);
}

export function getInvocationSkillForStage(
  stage: string
): GtmInvocationSkill | null {
  const normalizedStage = normalizeGtmLighthouseStage(stage);
  return normalizedStage ? STAGE_TO_INVOCATION_SKILL[normalizedStage] : null;
}

export function getGtmStageLabel(stage: string): string {
  const normalizedStage = normalizeGtmLighthouseStage(stage);
  return normalizedStage ? STAGE_LABELS[normalizedStage] : stage;
}
