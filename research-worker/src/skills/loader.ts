import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import type { MediaPlanBlock } from '../contracts';

const REFS_DIR = join(__dirname, 'refs');
const TEMPLATES_DIR = join(__dirname, 'templates');
const METHODOLOGIES_DIR = join(__dirname, 'methodologies');

// Cache ref files at module load — worker is a long-running Express process
const refCache = new Map<string, string>();
const templateCache = new Map<string, string>();
const methodologyCache = new Map<string, string>();

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
loadDir(METHODOLOGIES_DIR, methodologyCache);

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
 * Returns a single ref file by name (e.g., 'platform-specs.md').
 * Returns empty string if not found.
 */
export function loadRefFile(filename: string): string {
  const content = refCache.get(filename);
  if (!content) {
    console.warn(`[loader] Missing ref file: ${filename}`);
    return '';
  }
  return content;
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

/**
 * Returns a methodology file (decision tree / scoring rubric / framework)
 * from the methodologies/ directory. These teach HOW to think about a problem,
 * not just what to output. Injected into skill prompts alongside refs.
 *
 * Example: loadMethodology('opportunity-identification.md')
 */
export function loadMethodology(filename: string): string {
  const content = methodologyCache.get(filename);
  if (!content) {
    console.warn(`[loader] Missing methodology: ${filename}`);
    return '';
  }
  return content;
}

/**
 * Returns the Jeremy Haynes direct response frameworks. These are already
 * in scripts/refs/ for the ad scripts pipeline. This re-exports them for
 * use in media plan creative system skills.
 */
export function loadHaynesFrameworks(): string {
  // Haynes frameworks live in scripts/refs/, not skills/refs/
  // Read at call time since they're outside our cache directories
  try {
    return readFileSync(
      join(__dirname, '..', 'scripts', 'refs', 'haynes-frameworks.md'),
      'utf-8',
    );
  } catch {
    console.warn('[loader] Failed to load haynes-frameworks.md');
    return '';
  }
}
