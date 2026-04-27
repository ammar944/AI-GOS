import type {
  AwarenessLevel,
  InMarketTier,
  ScriptAngle,
  ScriptDuration,
  ScriptFormat,
  ScriptPlatform,
} from "../schemas/output.ts";

export type ScriptFramework =
  | "talking-head-broll"
  | "case-study-snapshot"
  | "objection-first"
  | "qa-style"
  | "demo-screencast"
  | "interview"
  | "skit-scenario";

export interface ScriptPlan {
  index: number;
  awareness_level: AwarenessLevel;
  in_market_tier: InMarketTier;
  platform: ScriptPlatform;
  format: ScriptFormat;
  angle: ScriptAngle;
  framework: ScriptFramework;
  duration: ScriptDuration;
  objection: string | null;
  claim_index: number;
}

export interface MatrixInput {
  selected_awareness_levels: AwarenessLevel[];
  objections: string[];
  claim_count: number;
}

const LEVEL_TO_TIER: Record<AwarenessLevel, InMarketTier> = {
  unaware: "cold-mass",
  problem: "needs-convinced",
  solution: "needs-convinced",
  product: "in-market",
  mostAware: "in-market",
};

const LEVEL_TO_DURATION: Record<AwarenessLevel, ScriptDuration> = {
  unaware: "60s",
  problem: "60s",
  solution: "30s",
  product: "30s",
  mostAware: "10s",
};

const PLATFORMS: ScriptPlatform[] = ["meta", "google", "linkedin"];
const FORMATS: ScriptFormat[] = ["video", "static", "email"];
const ANGLES: ScriptAngle[] = [
  "painPoint",
  "outcome",
  "socialProof",
  "curiosity",
  "urgency",
  "identity",
  "contrarian",
];
const FRAMEWORKS: ScriptFramework[] = [
  "talking-head-broll",
  "case-study-snapshot",
  "objection-first",
  "qa-style",
  "demo-screencast",
  "interview",
  "skit-scenario",
];

function pick<T>(items: readonly T[], index: number): T {
  const item = items[index % items.length];
  if (item === undefined) {
    throw new Error("Cannot pick from an empty list.");
  }
  return item;
}

export function buildScriptMatrix(input: MatrixInput): ScriptPlan[] {
  if (input.selected_awareness_levels.length < 3 || input.selected_awareness_levels.length > 5) {
    throw new Error(
      `selected_awareness_levels must contain 3 to 5 tiers; received ${input.selected_awareness_levels.length}.`,
    );
  }
  if (input.claim_count < 1) {
    throw new Error("claim_count must be at least 1 for sourced script generation.");
  }

  return input.selected_awareness_levels.flatMap((level, levelIndex) =>
    [0, 1, 2].map((slotIndex) => {
      const globalIndex = levelIndex * 3 + slotIndex;
      return {
        index: globalIndex,
        awareness_level: level,
        in_market_tier: LEVEL_TO_TIER[level],
        platform: PLATFORMS[slotIndex],
        format: FORMATS[slotIndex],
        angle: pick(ANGLES, levelIndex * 3 + slotIndex),
        framework: pick(FRAMEWORKS, globalIndex),
        duration: LEVEL_TO_DURATION[level],
        objection: input.objections.length > 0 && globalIndex % 2 === 0
          ? pick(input.objections, globalIndex)
          : null,
        claim_index: globalIndex % input.claim_count,
      };
    }),
  );
}

export function validateMatrixDiversity(plans: ScriptPlan[]): string[] {
  const warnings: string[] = [];

  if (plans.length < 9 || plans.length > 15) {
    warnings.push(`Script matrix has ${plans.length} scripts; expected 9 to 15.`);
  }

  const levels = new Set(plans.map((plan) => plan.awareness_level));
  for (const level of levels) {
    const levelPlans = plans.filter((plan) => plan.awareness_level === level);
    if (levelPlans.length !== 3) {
      warnings.push(`Awareness tier ${level} has ${levelPlans.length} scripts; expected 3.`);
    }
    const angles = new Set(levelPlans.map((plan) => plan.angle));
    if (angles.size !== levelPlans.length) {
      warnings.push(`Awareness tier ${level} repeats angles.`);
    }
    const platforms = new Set(levelPlans.map((plan) => plan.platform));
    if (platforms.size !== 3) {
      warnings.push(`Awareness tier ${level} does not rotate all platforms.`);
    }
    const formats = new Set(levelPlans.map((plan) => plan.format));
    if (formats.size !== 3) {
      warnings.push(`Awareness tier ${level} does not rotate all formats.`);
    }
  }

  return warnings;
}
