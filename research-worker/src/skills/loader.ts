import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import type { MediaPlanBlock } from '../contracts';

const REFS_DIR = join(__dirname, 'refs');
const TEMPLATES_DIR = join(__dirname, 'templates');
const BUSINESS_MODEL_TEMPLATES_DIR = join(__dirname, 'templates', 'business-models');
const METHODOLOGIES_DIR = join(__dirname, 'methodologies');
const MEDIA_PLAN_METHODOLOGIES_DIR = join(__dirname, 'methodologies', 'media-plan');
const RUNNER_PROMPTS_DIR = join(__dirname, '..', 'prompts', 'runners');

// Cache ref files at module load — worker is a long-running Express process
const refCache = new Map<string, string>();
const templateCache = new Map<string, string>();
const businessModelTemplateCache = new Map<string, string>();
const methodologyCache = new Map<string, string>();
const mediaPlanMethodologyCache = new Map<string, string>();

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
loadDir(BUSINESS_MODEL_TEMPLATES_DIR, businessModelTemplateCache);
loadDir(METHODOLOGIES_DIR, methodologyCache);
loadDir(MEDIA_PLAN_METHODOLOGIES_DIR, mediaPlanMethodologyCache);

const runnerPromptCache = new Map<string, string>();
loadDir(RUNNER_PROMPTS_DIR, runnerPromptCache);

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
 * Returns a media-plan-specific methodology file from
 * methodologies/media-plan/. These teach the media plan runner how to think
 * about business model routing, awareness-level routing, sales cycle bounding,
 * and channel grounding. Injected into the runner's system prompt per block.
 *
 * Returns empty string if not found (caller can handle gracefully).
 *
 * Example: loadMediaPlanMethodology('business-model-routing.md')
 */
export function loadMediaPlanMethodology(filename: string): string {
  const content = mediaPlanMethodologyCache.get(filename);
  if (!content) {
    console.warn(`[loader] Missing media plan methodology: ${filename}`);
    return '';
  }
  return content;
}

/**
 * Returns the business-model template for the given model type, falling back
 * to empty string if not found. Business-model templates layer ON TOP of
 * industry templates — they don't replace them.
 *
 * Valid types: 'plg' | 'slg' | 'ecommerce' | 'transactional' | 'marketplace'
 *
 * Example: loadBusinessModelTemplate('plg') → returns plg.md content
 */
export function loadBusinessModelTemplate(type: string): string {
  if (!type || type === 'unknown') return '';
  const file = `${type}.md`;
  const content = businessModelTemplateCache.get(file);
  if (!content) {
    console.warn(`[loader] Missing business model template: ${file}`);
    return '';
  }
  return content;
}

/**
 * Returns a runner system prompt by name (e.g., 'industry-system').
 * The name must match a file in prompts/runners/ without the .md extension.
 * Returns empty string if not found — callers should fall back to their
 * inline constant when this returns empty (e.g. in tests without the file).
 */
export function loadRunnerPrompt(name: string): string {
  const filename = `${name}.md`;
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
