import type { BetaContainerParams } from '@anthropic-ai/sdk/resources/beta/messages/messages';

export const ANTHROPIC_SKILLS_BETA = 'skills-2025-10-02';
export const ANTHROPIC_CODE_EXECUTION_BETA = 'code-execution-2025-08-25';

const DEFAULT_SKILL_TYPE = 'custom' as const;

const AI_GOS_GTM_PLATFORM_SKILL_IDS = [
  'skill_01Dt72aT2QNBWTu78RpL2yjB', // ai-gos-market-category-intelligence — uploaded 2026-05-06 20:36
  'skill_01D1mxRdAFXpRpaVA3ZaMtr7', // ai-gos-buyer-icp-validation — uploaded 2026-05-06 20:35
  'skill_012yUuFMRGtjKTeNXNxhPAvh', // ai-gos-competitive-positioning — uploaded 2026-05-06 20:36
  'skill_01MFN1v61rHoMgB1SSdVHtYv', // ai-gos-voc-objection-evidence — uploaded 2026-05-06 20:37
  'skill_01HDWUcp2WqmLnp5P4xFmMQi', // ai-gos-demand-intent-signals — uploaded 2026-05-06 20:36
  'skill_01L8KjoVof4LSeqUi9wxs849', // ai-gos-offer-performance-diagnostic — uploaded 2026-05-06 20:37
  'skill_014w2QX6HN1p5yktgHpAdC4x', // ai-gos-gtm-synthesis — uploaded 2026-05-06 20:36
  'skill_017YWtSBuYw8KGLuZNLUNULL', // ai-gos-activation-plan — uploaded 2026-05-06 20:35
] as const;

type SkillType = 'anthropic' | 'custom';

interface ParsedSkillToken {
  skill_id: string;
  type: SkillType;
  version?: string;
}

export interface AnthropicSkillsRuntimeStatus {
  enabled: boolean;
  source: 'environment' | 'defaults' | 'none';
  skillCount: number;
  skillRefs: string[];
  betaHeaders: string[];
  codeExecutionToolEnabled: boolean;
}

function isSkillType(value: string): value is SkillType {
  return value === 'anthropic' || value === 'custom';
}

function parseSkillToken(rawToken: string): ParsedSkillToken | null {
  const token = rawToken.trim();
  if (!token) return null;

  const [idAndType, rawVersion] = token.split('@', 2);
  const [maybeType, maybeId] = idAndType.split(':', 2);
  const type = maybeId && isSkillType(maybeType) ? maybeType : DEFAULT_SKILL_TYPE;
  const skillId = maybeId && isSkillType(maybeType) ? maybeId : idAndType;
  const version = rawVersion?.trim();

  if (!skillId.trim()) return null;
  return {
    skill_id: skillId.trim(),
    type,
    ...(version ? { version } : {}),
  };
}

function parseSkillList(value: string | undefined): ParsedSkillToken[] {
  if (!value) return [];

  const seen = new Set<string>();
  const skills: ParsedSkillToken[] = [];
  for (const rawToken of value.split(',')) {
    const skill = parseSkillToken(rawToken);
    if (!skill) continue;

    const key = `${skill.type}:${skill.skill_id}:${skill.version ?? 'latest'}`;
    if (seen.has(key)) continue;
    seen.add(key);
    skills.push(skill);
  }
  return skills;
}

function getConfiguredSkillParams(): ParsedSkillToken[] {
  return [
    ...parseSkillList(process.env.ANTHROPIC_PLATFORM_SKILL_IDS),
    ...parseSkillList(process.env.RESEARCH_DEEP_PROGRAM_SKILL_IDS),
  ];
}

function maskSkillId(skillId: string): string {
  if (skillId.length <= 10) return skillId;
  return `${skillId.slice(0, 8)}...${skillId.slice(-6)}`;
}

/**
 * Optional Anthropic Platform Skills for deep research.
 *
 * Configure without secrets:
 * - RESEARCH_DEEP_PROGRAM_SKILL_IDS="skill_abc,anthropic:built_in_id@latest"
 * - ANTHROPIC_PLATFORM_SKILL_IDS="skill_shared"
 *
 * Tokens are comma-separated. Prefix with `custom:` or `anthropic:` to set the
 * skill type; omit the prefix for custom skills. Suffix with `@version` to pin a
 * version; omit it to let Anthropic use latest.
 */
export function getDeepResearchSkillParams(): ParsedSkillToken[] {
  const configured = getConfiguredSkillParams();

  if (configured.length > 0) return configured;

  // Default to the new AI-GOS Anthropic Platform skill team in the user's
  // Default workspace. Override with RESEARCH_DEEP_PROGRAM_SKILL_IDS to pin
  // different versions or test an alternate skill set.
  return AI_GOS_GTM_PLATFORM_SKILL_IDS.map((skill_id) => ({
    skill_id,
    type: DEFAULT_SKILL_TYPE,
  }));
}

export function hasConfiguredAnthropicSkills(): boolean {
  return getDeepResearchSkillParams().length > 0;
}

export function getAnthropicSkillsRuntimeStatus(): AnthropicSkillsRuntimeStatus {
  const configured = getConfiguredSkillParams();
  const skills = getDeepResearchSkillParams();
  const enabled = skills.length > 0;

  return {
    enabled,
    source: enabled ? (configured.length > 0 ? 'environment' : 'defaults') : 'none',
    skillCount: skills.length,
    skillRefs: skills.map((skill) => {
      const version = skill.version ? `@${skill.version}` : '';
      return `${skill.type}:${maskSkillId(skill.skill_id)}${version}`;
    }),
    betaHeaders: enabled
      ? [ANTHROPIC_SKILLS_BETA, ANTHROPIC_CODE_EXECUTION_BETA]
      : [],
    codeExecutionToolEnabled: enabled,
  };
}

export function buildDeepResearchContainerParams(): BetaContainerParams | undefined {
  const skills = getDeepResearchSkillParams();
  if (skills.length === 0) return undefined;
  return { skills };
}
