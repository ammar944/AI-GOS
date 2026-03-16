import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import type { MediaPlanBlock } from '../contracts';

const REFS_DIR = join(__dirname, 'refs');
const TEMPLATES_DIR = join(__dirname, 'templates');

// Cache ref files at module load — worker is a long-running Express process
const refCache = new Map<string, string>();
const templateCache = new Map<string, string>();

function loadDir(dir: string, cache: Map<string, string>): void {
  try {
    const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
    for (const file of files) {
      try {
        cache.set(file, readFileSync(join(dir, file), 'utf-8'));
      } catch {
        console.warn(`[media-plan] Failed to read: ${dir}/${file}`);
      }
    }
  } catch {
    console.warn(`[media-plan] Failed to read directory: ${dir}`);
  }
}

loadDir(REFS_DIR, refCache);
loadDir(TEMPLATES_DIR, templateCache);

const BLOCK_REFS: Record<MediaPlanBlock, string[]> = {
  channelMixBudget: ['benchmarks.md', 'budget-allocation.md', 'bidding-strategies.md'],
  audienceCampaign: ['audience-targeting.md', 'benchmarks.md'],
  creativeSystem: ['platform-specs.md', 'ad-copy-templates.md'],
  measurementGuardrails: ['conversion-tracking.md', 'compliance.md', 'benchmarks.md'],
  rolloutRoadmap: ['budget-allocation.md'],
  strategySnapshot: [],
};

/**
 * Returns the concatenated reference data for the given media plan block.
 * Missing ref files are skipped with a console warning — blocks can still run
 * with partial reference data (benchmarks.md is the most critical).
 */
export function loadBlockRefs(block: MediaPlanBlock): string {
  const files = BLOCK_REFS[block];
  return files
    .map((f) => {
      const content = refCache.get(f);
      if (!content) {
        console.warn(`[media-plan] Missing ref: ${f}`);
        return '';
      }
      return content;
    })
    .filter(Boolean)
    .join('\n\n---\n\n');
}

/**
 * Returns the industry-specific template for the given industry slug, falling
 * back to generic.md if no industry-specific template exists.
 * Returns empty string if neither is found.
 */
export function loadIndustryTemplate(industry: string): string {
  const file = `${industry}.md`;
  return templateCache.get(file) ?? templateCache.get('generic.md') ?? '';
}
