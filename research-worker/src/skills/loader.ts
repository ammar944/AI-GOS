import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import type { MediaPlanBlock } from '../contracts';

const REFS_DIR = join(__dirname, 'refs');
const TEMPLATES_DIR = join(__dirname, 'templates');
const METHODOLOGIES_DIR = join(__dirname, 'methodologies');
const PROMPTS_DIR = join(__dirname, '..', 'prompts', 'runners');

// Cache ref files at module load — worker is a long-running Express process
const refCache = new Map<string, string>();
const templateCache = new Map<string, string>();
const methodologyCache = new Map<string, string>();
const runnerPromptCache = new Map<string, string>();

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
loadDir(PROMPTS_DIR, runnerPromptCache);

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
 * Returns a runner system prompt from prompts/runners/*.md.
 * These are large multi-stage prompt templates extracted from inline
 * constants in research-worker/src/runners/*.ts — extracting them makes
 * prompt edits reviewable in PRs without TS recompile.
 */
export function loadRunnerPrompt(filename: string): string {
  const content = runnerPromptCache.get(filename);
  if (!content) {
    console.warn(`[loader] Missing runner prompt: ${filename}`);
    return '';
  }
  return content;
}

// Lazy cache for Haynes frameworks (outside standard cache dirs)
let haynesFrameworksCache: string | null = null;

/**
 * Returns the Jeremy Haynes direct response frameworks. These live in
 * scripts/refs/ for the ad scripts pipeline. Cached at first call since
 * the worker is a long-running process.
 */
export function loadHaynesFrameworks(): string {
  if (haynesFrameworksCache !== null) return haynesFrameworksCache;
  try {
    haynesFrameworksCache = readFileSync(
      join(__dirname, '..', 'scripts', 'refs', 'haynes-frameworks.md'),
      'utf-8',
    );
  } catch {
    console.warn('[loader] Failed to load haynes-frameworks.md');
    haynesFrameworksCache = '';
  }
  return haynesFrameworksCache;
}
