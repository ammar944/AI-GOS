/**
 * Stage 01 — Script Matrix Planner (deterministic, 0 AI tokens)
 *
 * Pre-computes the 15-script matrix: assigns angle, platform, format,
 * framework, in-market tier, sub-segment, objection, and proof point
 * for each script. Guarantees diversity by construction.
 *
 * ICM contract:
 *   Input:  Research context (ICP objections, proof points, competitor intel)
 *   Output: ScriptPlan[] — one plan per script
 */

// --- Types ---

export type AwarenessLevel = 'unaware' | 'problem' | 'solution' | 'product' | 'mostAware';
export type InMarketTier = 'in-market' | 'needs-convinced' | 'cold-mass';
export type SubSegment = 'current-practitioner' | 'adjacent-mover' | 'constraint-driven' | 'ambitious-newcomer' | null;
export type ScriptAngle = 'painPoint' | 'outcome' | 'socialProof' | 'curiosity' | 'urgency' | 'identity' | 'contrarian';
export type ScriptFormat = 'video' | 'static' | 'email';
export type ScriptPlatform = 'meta' | 'google' | 'linkedin';
export type ScriptFramework =
  | 'talking-head-broll'
  | 'case-study-snapshot'
  | 'objection-first'
  | 'qa-style'
  | 'demo-screencast'
  | 'interview'
  | 'skit-scenario';

export interface ScriptPlan {
  index: number;
  awarenessLevel: AwarenessLevel;
  inMarketTier: InMarketTier;
  subSegment: SubSegment;
  angle: ScriptAngle;
  platform: ScriptPlatform;
  format: ScriptFormat;
  framework: ScriptFramework;
  objectionToHandle: string | null;
  proofPointIndex: number | null;
  claimIndices: number[];
  duration: '30s' | '60s' | '90s';
}

export interface PlannerInput {
  objections: string[];
  proofPointCount: number;
  claimCount: number;
  hasCompetitorAds: boolean;
  hasCaseStudies: boolean;
}

// --- Constants ---

const LEVELS: AwarenessLevel[] = ['unaware', 'problem', 'solution', 'product', 'mostAware'];

const LEVEL_TO_TIER: Record<AwarenessLevel, InMarketTier> = {
  mostAware: 'in-market',
  product: 'in-market',
  solution: 'needs-convinced',
  problem: 'needs-convinced',
  unaware: 'cold-mass',
};

const LEVEL_DURATION: Record<AwarenessLevel, '30s' | '60s' | '90s'> = {
  mostAware: '30s',
  product: '30s',
  solution: '60s',
  problem: '60s',
  unaware: '90s',
};

const IN_MARKET_SUB_SEGMENTS: SubSegment[] = [
  'current-practitioner',
  'adjacent-mover',
  'constraint-driven',
  'ambitious-newcomer',
];

const ANGLES: ScriptAngle[] = [
  'painPoint', 'outcome', 'socialProof', 'curiosity',
  'urgency', 'identity', 'contrarian',
];

const PLATFORMS: ScriptPlatform[] = ['meta', 'google', 'linkedin'];
const FORMATS: ScriptFormat[] = ['video', 'static', 'email'];

const FRAMEWORKS: ScriptFramework[] = [
  'talking-head-broll',
  'case-study-snapshot',
  'objection-first',
  'qa-style',
  'demo-screencast',
  'interview',
  'skit-scenario',
];

// --- Deterministic distribution helpers ---

/** Round-robin pick from an array, offset by index */
function pick<T>(arr: T[], index: number): T {
  return arr[index % arr.length];
}

/** Shuffle array deterministically using a seed offset */
function shuffled<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = (seed + i * 7) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// --- Planner ---

/**
 * Generate the 15-script matrix.
 *
 * Distribution strategy:
 * - 3 scripts per awareness level (5 levels × 3 = 15)
 * - Angles: round-robin through 7 angles, no two scripts in same level share an angle
 * - Platforms: guaranteed rotation (meta, google, linkedin) within each level
 * - Formats: guaranteed rotation (video, static, email) within each level
 * - Frameworks: distributed across all 7, at least 2 different per batch
 * - Objections: top 3-4 objections mapped across 6-8 scripts
 * - Proof points: rotated via sliding window
 * - Claims: distributed evenly
 */
export function buildScriptMatrix(input: PlannerInput): ScriptPlan[] {
  const plans: ScriptPlan[] = [];

  // Shuffle frameworks so the batch doesn't always start with talking-head
  const frameworkOrder = shuffled(FRAMEWORKS, Date.now() % 100);

  // Pre-compute objection assignments: spread top objections across scripts
  const objections = input.objections.slice(0, 4);

  for (const [levelIdx, level] of LEVELS.entries()) {
    const tier = LEVEL_TO_TIER[level];
    const duration = LEVEL_DURATION[level];

    // 3 scripts per level
    for (let slotIdx = 0; slotIdx < 3; slotIdx++) {
      const globalIdx = levelIdx * 3 + slotIdx;

      // Platform: guaranteed rotation within level
      const platform = PLATFORMS[slotIdx % PLATFORMS.length];

      // Format: guaranteed rotation within level
      const format = FORMATS[slotIdx % FORMATS.length];

      // Angle: rotate through all 7, offset by level to prevent repetition
      const angle = pick(ANGLES, levelIdx * 3 + slotIdx);

      // Framework: distribute across batch
      const framework = pick(frameworkOrder, globalIdx);

      // Sub-segment: only for in-market tier
      const subSegment: SubSegment = tier === 'in-market'
        ? pick(IN_MARKET_SUB_SEGMENTS, globalIdx)
        : null;

      // Objection: assign to ~60% of scripts (9-10 of 15)
      // Objection-first framework always gets one; others get one if available
      let objectionToHandle: string | null = null;
      if (framework === 'objection-first' && objections.length > 0) {
        objectionToHandle = pick(objections, globalIdx);
      } else if (objections.length > 0 && globalIdx % 2 === 0) {
        objectionToHandle = pick(objections, globalIdx);
      }

      // Proof point: sliding window rotation
      const proofPointIndex = input.proofPointCount > 0
        ? globalIdx % input.proofPointCount
        : null;

      // Claims: assign 2-3 claims per script, spread evenly
      const claimsPerScript = Math.min(3, Math.max(1, Math.ceil(input.claimCount / 15)));
      const claimStart = (globalIdx * claimsPerScript) % Math.max(1, input.claimCount);
      const claimIndices: number[] = [];
      for (let c = 0; c < claimsPerScript && input.claimCount > 0; c++) {
        claimIndices.push((claimStart + c) % input.claimCount);
      }

      plans.push({
        index: globalIdx,
        awarenessLevel: level,
        inMarketTier: tier,
        subSegment,
        angle,
        platform,
        format,
        framework,
        objectionToHandle,
        proofPointIndex,
        claimIndices,
        duration,
      });
    }
  }

  return plans;
}

/**
 * Validate that a script matrix meets diversity requirements.
 * Returns violations (empty array = all good).
 */
export function validateMatrixDiversity(plans: ScriptPlan[]): string[] {
  const violations: string[] = [];

  // Check platform distribution
  const platformCounts = new Map<string, number>();
  for (const p of plans) {
    platformCounts.set(p.platform, (platformCounts.get(p.platform) ?? 0) + 1);
  }
  for (const [platform, count] of platformCounts) {
    if (count < 3) violations.push(`Platform ${platform} has only ${count} scripts (minimum 3)`);
  }

  // Check format distribution
  const formatCounts = new Map<string, number>();
  for (const p of plans) {
    formatCounts.set(p.format, (formatCounts.get(p.format) ?? 0) + 1);
  }
  for (const [format, count] of formatCounts) {
    if (count < 3) violations.push(`Format ${format} has only ${count} scripts (minimum 3)`);
  }

  // Check angle diversity: no angle used more than 4x
  const angleCounts = new Map<string, number>();
  for (const p of plans) {
    angleCounts.set(p.angle, (angleCounts.get(p.angle) ?? 0) + 1);
  }
  for (const [angle, count] of angleCounts) {
    if (count > 4) violations.push(`Angle ${angle} used ${count}x (maximum 4)`);
  }

  // Check framework diversity: at least 4 distinct frameworks used
  const frameworkSet = new Set(plans.map((p) => p.framework));
  if (frameworkSet.size < 4) {
    violations.push(`Only ${frameworkSet.size} distinct frameworks used (minimum 4)`);
  }

  // Check no two scripts in same level have same angle
  for (const level of LEVELS) {
    const levelPlans = plans.filter((p) => p.awarenessLevel === level);
    const levelAngles = levelPlans.map((p) => p.angle);
    const uniqueAngles = new Set(levelAngles);
    if (uniqueAngles.size < levelAngles.length) {
      violations.push(`Level ${level} has duplicate angles: ${levelAngles.join(', ')}`);
    }
  }

  // Check no two scripts in same level have same platform
  for (const level of LEVELS) {
    const levelPlans = plans.filter((p) => p.awarenessLevel === level);
    const levelPlatforms = levelPlans.map((p) => p.platform);
    const uniquePlatforms = new Set(levelPlatforms);
    if (uniquePlatforms.size < levelPlatforms.length) {
      violations.push(`Level ${level} has duplicate platforms: ${levelPlatforms.join(', ')}`);
    }
  }

  return violations;
}
