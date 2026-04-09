import { readFileSync } from 'fs';
import { join } from 'path';

const REFS_DIR = __dirname;

// Cache at module load — worker is a long-running Express process
const cache = new Map<string, string>();
let killListCache: KillList | null = null;
let platformLimitsCache: PlatformLimits | null = null;

function readFile(filename: string): string {
  if (cache.has(filename)) return cache.get(filename)!;
  try {
    const content = readFileSync(join(REFS_DIR, filename), 'utf-8');
    cache.set(filename, content);
    return content;
  } catch {
    console.warn(`[scripts/refs] Missing: ${filename}`);
    return '';
  }
}

// --- Kill List (machine-readable) ---

export interface KillList {
  tier1_always_replace: Record<string, string>;
  tier2_replace_if_repeated: string[];
  tier3_replace_if_3_plus: string[];
  banned_phrases: string[];
  template_openers: string[];
  filler_constructions: string[];
  chatbot_closers: string[];
  sycophantic_affirmations: string[];
  hyphenated_corporate: string[];
  structures_to_avoid: {
    rule_of_three_pattern: string;
    passive_voice_indicators: string[];
    em_dash: string;
    en_dash: string;
  };
}

export function loadKillList(): KillList {
  if (killListCache) return killListCache;
  const raw = readFile('kill-list.json');
  if (!raw) throw new Error('kill-list.json is required for script generation');
  killListCache = JSON.parse(raw) as KillList;
  return killListCache;
}

// --- Platform Limits (machine-readable) ---

export interface PlatformCharLimit {
  optimal?: number;
  max: number;
  label?: string;
  note?: string;
}

export interface PlatformLimits {
  meta: Record<string, PlatformCharLimit | Record<string, unknown>>;
  google: Record<string, PlatformCharLimit | Record<string, unknown>>;
  linkedin: Record<string, PlatformCharLimit | Record<string, unknown>>;
  tiktok: Record<string, PlatformCharLimit | Record<string, unknown>>;
  email: Record<string, PlatformCharLimit | Record<string, unknown>>;
}

export function loadPlatformLimits(): PlatformLimits {
  if (platformLimitsCache) return platformLimitsCache;
  const raw = readFile('platform-limits.json');
  if (!raw) throw new Error('platform-limits.json is required for script generation');
  platformLimitsCache = JSON.parse(raw) as PlatformLimits;
  return platformLimitsCache;
}

/**
 * Get the character limit for a specific platform + field combo.
 * Returns null if not found.
 */
export function getCharLimit(
  platform: string,
  field: string,
): { max: number; optimal?: number } | null {
  const limits = loadPlatformLimits();
  const platformData = limits[platform as keyof PlatformLimits];
  if (!platformData) return null;
  const fieldData = platformData[field] as PlatformCharLimit | undefined;
  if (!fieldData || typeof fieldData.max !== 'number') return null;
  return { max: fieldData.max, optimal: fieldData.optimal };
}

// --- Markdown refs (loaded on demand for prompt injection) ---

export function loadHaynesFrameworks(): string {
  return readFile('haynes-frameworks.md');
}

export function loadInMarketSegments(): string {
  return readFile('in-market-segments.md');
}
