import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const PLATFORM_SKILLS_ROOT = path.resolve(__dirname, '../../..', 'platform-skills');

function stripFrontmatter(markdown: string): string {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trim();
}

function loadSkillBody(slug: string): string {
  const skillPath = path.join(PLATFORM_SKILLS_ROOT, slug, 'SKILL.md');

  if (!existsSync(skillPath)) {
    throw new Error(`Positioning subagent skill file is missing: ${skillPath}`);
  }

  try {
    return stripFrontmatter(readFileSync(skillPath, 'utf8'));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Unable to read positioning subagent skill file ${skillPath}: ${message}`);
  }
}

export const MARKET_CATEGORY_INSTRUCTIONS = loadSkillBody(
  'ai-gos-market-category-intelligence',
);
export const BUYER_ICP_INSTRUCTIONS = loadSkillBody(
  'ai-gos-buyer-icp-validation',
);
export const COMPETITOR_LANDSCAPE_INSTRUCTIONS = loadSkillBody(
  'ai-gos-competitive-positioning',
);
export const VOICE_OF_CUSTOMER_INSTRUCTIONS = loadSkillBody(
  'ai-gos-voc-objection-evidence',
);
export const DEMAND_INTENT_INSTRUCTIONS = loadSkillBody(
  'ai-gos-demand-intent-signals',
);
export const OFFER_DIAGNOSTIC_INSTRUCTIONS = loadSkillBody(
  'ai-gos-offer-performance-diagnostic',
);
