// Runner: Ad Scripts (2-pass sequential generator)
// Generates 3 scripts per awareness level (5 levels = 15 scripts total).
// Pass 1: Draft scripts grounded in research context.
// Pass 2: Humanize + apply 43-check audit.
// IDs are injected post-generation — AI never produces them.
// Progressive Supabase writes via onLevelComplete callback.

import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import crypto from 'node:crypto';
import { awarenessLevelOutputSchema } from '../schemas/ad-scripts';
import { buildPass1Prompt } from '../prompts/ad-scripts-pass1';
import { buildPass2Prompt } from '../prompts/ad-scripts-pass2';
import { stripNumericConstraints } from '../utils/strip-numeric-constraints';
import type { RunnerProgressReporter } from '../runner';
import { emitRunnerProgress } from '../runner';
import { loadRefFile } from '../skills/loader';
import { getStrategicPlan } from '../planning/opus-planner';
import { MODELS } from '../models';

const SCRIPT_MODEL = MODELS.STANDARD;
const PER_CALL_TIMEOUT_MS = 180_000;
const MAX_OUTPUT_TOKENS = 4000;
const SCRIPTS_PER_LEVEL = 3;

// --- Post-processing utilities ---

/**
 * Strip em dashes (—) and en dashes (–) from all string fields on a script object.
 * Context-aware: spaced em dashes become ". " with capitalized next word,
 * unspaced become ", ". Preserves hyphens in compound words.
 */
export function sanitizeScript(script: Record<string, unknown>): Record<string, unknown> {
  const result = { ...script };
  for (const [key, value] of Object.entries(result)) {
    if (typeof value === 'string') {
      result[key] = stripDashes(value);
    } else if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
      result[key] = value.map((v) => stripDashes(v as string));
    }
  }
  // Normalize confidenceScore: prompt specifies 0–10 but models sometimes output 0–100.
  // Clamp to [0, 10] after normalization to guarantee frontend "/10" display is correct.
  if (typeof result.confidenceScore === 'number') {
    let score = result.confidenceScore;
    if (!Number.isFinite(score)) {
      result.confidenceScore = 5; // fallback for NaN/Infinity
    } else {
      if (score > 20) score = score / 10;   // clearly 0-100 scale
      else if (score > 10) score = 10;       // slight overshoot, clamp
      result.confidenceScore = Math.min(10, Math.max(0, Math.round(score * 10) / 10));
    }
  }
  return result;
}

function stripDashes(text: string): string {
  // Spaced em dash " — " or " – " → ". " + capitalize next word
  let result = text.replace(/\s[—–]\s/g, (match, offset, str) => {
    const after = str.slice(offset + match.length);
    const nextAlpha = after.match(/[a-zA-Z]/);
    if (nextAlpha && nextAlpha.index !== undefined) {
      const before = str.slice(0, offset + match.length);
      // We'll handle capitalization in a second pass
    }
    return '. ';
  });

  // Capitalize the character after each ". " that we just inserted
  // (only where the original had an em dash, detected by looking for lowercase after ". ")
  result = result.replace(/\. ([a-z])/g, (_, ch) => `. ${ch.toUpperCase()}`);

  // Numeric range en dash "$500K–$5M" or "3–6 months" → "$500K to $5M" or "3 to 6 months"
  result = result.replace(/(\d[\d$%KkMmBb.,]*)[—–](\$?\d)/g, '$1 to $2');

  // Unspaced em/en dash "word—word" or "word–word" → "word, word"
  result = result.replace(/([a-zA-Z])([—–])([a-zA-Z])/g, '$1, $3');

  // Any remaining em/en dashes (e.g., at start/end of string)
  result = result.replace(/[—–]/g, ',');

  return result;
}

/**
 * Dedup scripts within a level by fingerprint (angle|type|platform|normalizedBody).
 * Returns unique scripts. Does NOT retry — caller handles retry if count < expected.
 */
export function dedupScripts(
  scripts: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const seen = new Set<string>();
  const unique: Array<Record<string, unknown>> = [];
  for (const s of scripts) {
    const body = typeof s.body === 'string' ? s.body : '';
    const normalized = body.toLowerCase().replace(/\s+/g, ' ').slice(0, 50);
    const fp = `${s.angle}|${s.type}|${s.platform}|${normalized}`;
    if (!seen.has(fp)) {
      seen.add(fp);
      unique.push(s);
    }
  }
  return unique;
}

/**
 * Select a subset of proof points for a given awareness level.
 * Sliding window of size ceil(proofs.length / 2), offset by levelIndex.
 * Wraps around. Returns all proofs if 0-1 available.
 */
export function getProofSubset<T>(allProofs: T[], levelIndex: number): T[] {
  if (allProofs.length <= 1) return allProofs;
  if (allProofs.length === 2) {
    // Alternate: even levels get [0], odd get [1]
    return [allProofs[levelIndex % 2]];
  }
  const windowSize = Math.ceil(allProofs.length / 2);
  const offset = levelIndex % allProofs.length;
  const subset: T[] = [];
  for (let i = 0; i < windowSize; i++) {
    subset.push(allProofs[(offset + i) % allProofs.length]);
  }
  return subset;
}

/**
 * Detect which proof point headlines appear in a script's body (normalized match).
 */
export function detectUsedProofPoints(
  scripts: Array<Record<string, unknown>>,
  proofHeadlines: string[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const script of scripts) {
    const body = (typeof script.body === 'string' ? script.body : '').toLowerCase();
    const headline = (typeof script.headline === 'string' ? script.headline : '').toLowerCase();
    const combined = `${body} ${headline}`;
    for (const ph of proofHeadlines) {
      if (combined.includes(ph.toLowerCase())) {
        counts.set(ph, (counts.get(ph) ?? 0) + 1);
      }
    }
  }
  return counts;
}

const AWARENESS_LEVELS = ['unaware', 'problem', 'solution', 'product', 'mostAware'] as const;

export interface ProofPoint {
  id: string;
  type: string;
  headline: string;
  detail: string;
  clientName?: string;
  verified: boolean;
}

export interface AdScriptsInput {
  companyName: string;
  researchContext: Record<string, unknown>;
  styleReferences: Array<{ name: string; content: string; source: string }>;
  targetAudience: string;
  proofPoints?: ProofPoint[];
  brandVoiceNotes?: {
    tone: string;
    constraints: string;
    goodExample: string;
    badExample: string;
  } | null;
}

export interface AdScriptsResult {
  scripts: Array<Record<string, unknown>>;
  generatedAt: string;
  styleReferencesUsed: string[];
  summary: {
    totalScripts: number;
    byType: Record<string, number>;
    byPlatform: Record<string, number>;
    byAwareness: Record<string, number>;
  };
  diversity?: { diversityScore: number; flags: string[] };
}

export async function runAdScripts(
  input: AdScriptsInput,
  onProgress?: RunnerProgressReporter,
  onLevelComplete?: (allScriptsSoFar: unknown[], completedLevels: number) => Promise<void>,
): Promise<AdScriptsResult> {
  const allScripts: Array<Record<string, unknown>> = [];

  const styleRefText =
    input.styleReferences.length > 0
      ? input.styleReferences
          .map((r) => `### ${r.name} (${r.source})\n${r.content}`)
          .join('\n\n')
      : null;

  const brandVoiceText = input.brandVoiceNotes && (input.brandVoiceNotes.tone || input.brandVoiceNotes.constraints)
    ? input.brandVoiceNotes
    : null;

  const contextText = JSON.stringify(input.researchContext);

  // Load ref files for prompt injection
  const platformSpecs = loadRefFile('platform-specs.md');
  const adCopyTemplates = loadRefFile('ad-copy-templates.md');
  if (!platformSpecs) {
    console.error('[ad-scripts] CRITICAL: platform-specs.md missing — scripts will lack platform constraints');
  }

  // Extract monologue triggers for Collier framework injection
  const rc = input.researchContext as Record<string, unknown>;
  const targetAudienceMonologue = Array.isArray(rc.targetAudienceMonologue)
    ? (rc.targetAudienceMonologue as string[])
    : undefined;

  // Extract competitor ad intelligence for prompt injection
  const competitorAdIntel = Array.isArray(rc.competitorAdIntel)
    ? (rc.competitorAdIntel as Array<{
        advertiser: string;
        topAdHooks: string[];
        adCreatives: Array<{ platform: string; headline?: string; body?: string; format: string }>;
      }>)
    : undefined;

  // Extract research-derived stats for rotation
  const researchStats = Array.isArray(rc.researchStats)
    ? (rc.researchStats as Array<{ stat: string; source: string }>)
    : [];

  // Opus planning pass — get creative strategy guidance before generating scripts
  const strategicPlan = await getStrategicPlan(contextText, 'ad-scripts', onProgress);
  const enrichedContextText = strategicPlan
    ? `${contextText}\n\n## Creative Strategy Advisor Guidance\n\nThe following creative strategy was produced by a senior direct-response copywriter. Use it to guide angle distribution, hook patterns, and proof point allocation across awareness levels — but still generate unique, specific scripts.\n\n${strategicPlan}`
    : contextText;

  // Track used angles/hooks across levels for dedup
  const usedAnglesAndHooks: { angle: string; hook: string }[] = [];

  // Track proof point usage across levels for rotation
  const usedProofPoints = new Map<string, number>();
  const proofHeadlines = (input.proofPoints ?? []).map((p) => p.headline);

  for (const [idx, level] of AWARENESS_LEVELS.entries()) {
    await emitRunnerProgress(
      onProgress,
      'runner',
      `generating scripts ${idx + 1}/5: ${level} awareness level`,
    );

    // Select proof subset for this level (rotation)
    const proofSubset = input.proofPoints
      ? getProofSubset(input.proofPoints, idx)
      : undefined;

    // Select research stats subset for this level (rotation)
    const statsSubset = researchStats.length > 0
      ? getProofSubset(researchStats, idx)
      : undefined;

    // --- Pass 1: Draft ---
    let pass1Scripts: unknown[];
    try {
      const { system, prompt } = buildPass1Prompt({
        companyName: input.companyName,
        awarenessLevel: level,
        count: SCRIPTS_PER_LEVEL,
        trimmedResearchContext: enrichedContextText,
        styleReferences: styleRefText,
        targetAudience: input.targetAudience,
        targetAudienceMonologue,
        usedAnglesAndHooks,
        platformSpecs,
        adCopyTemplates,
        brandVoiceNotes: brandVoiceText,
        proofPoints: proofSubset,
        usedProofPoints,
        competitorAdIntel,
        researchStatsSubset: statsSubset,
      });

      const result = await generateObject({
        model: anthropic(SCRIPT_MODEL),
        schema: stripNumericConstraints(awarenessLevelOutputSchema),
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        system,
        prompt,
        abortSignal: AbortSignal.timeout(PER_CALL_TIMEOUT_MS),
      });
      pass1Scripts = result.object.scripts;
    } catch (err) {
      await emitRunnerProgress(
        onProgress,
        'error',
        `Pass 1 failed for ${level}: ${err instanceof Error ? err.message : String(err)}`,
      );
      continue;
    }

    // --- Pass 2: Humanize ---
    await emitRunnerProgress(onProgress, 'analysis', `humanizing ${level} scripts (pass 2)`);

    let finalScripts: unknown[];
    try {
      const { system, prompt } = buildPass2Prompt({
        pass1Scripts: JSON.stringify(pass1Scripts),
        trimmedResearchContext: enrichedContextText,
        styleReferences: styleRefText,
        targetAudience: input.targetAudience,
        brandVoiceNotes: brandVoiceText,
      });

      const result = await generateObject({
        model: anthropic(SCRIPT_MODEL),
        schema: stripNumericConstraints(awarenessLevelOutputSchema),
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        system,
        prompt,
        abortSignal: AbortSignal.timeout(PER_CALL_TIMEOUT_MS),
      });
      finalScripts = result.object.scripts;
    } catch (err) {
      // Pass 2 failure recovery: preserve Pass 1 output with humanizedPass: false
      await emitRunnerProgress(
        onProgress,
        'error',
        `Pass 2 failed for ${level} — saving unhumanized scripts`,
      );
      finalScripts = (pass1Scripts as Array<Record<string, unknown>>).map((s) => ({
        ...s,
        humanizedPass: false,
      }));
    }

    // Post-processing: sanitize all string fields (em dash/en dash removal)
    let sanitized = (finalScripts as Array<Record<string, unknown>>).map(sanitizeScript);

    // Dedup within level — remove duplicates by fingerprint
    let uniqueScripts = dedupScripts(sanitized);

    // Retry once if dedup removed scripts
    if (uniqueScripts.length < SCRIPTS_PER_LEVEL && uniqueScripts.length < sanitized.length) {
      const removedAngles = sanitized
        .filter((s) => !uniqueScripts.includes(s))
        .map((s) => String(s.angle ?? ''))
        .filter(Boolean);
      await emitRunnerProgress(onProgress, 'analysis', `dedup removed ${sanitized.length - uniqueScripts.length} duplicate(s) from ${level}, retrying`);
      try {
        const retryCount = SCRIPTS_PER_LEVEL - uniqueScripts.length;
        const { system, prompt } = buildPass1Prompt({
          companyName: input.companyName,
          awarenessLevel: level,
          count: retryCount,
          trimmedResearchContext: enrichedContextText,
          styleReferences: styleRefText,
          targetAudience: input.targetAudience,
          targetAudienceMonologue,
          usedAnglesAndHooks: [...usedAnglesAndHooks, ...removedAngles.map((a) => ({ angle: a, hook: '' }))],
          platformSpecs,
          adCopyTemplates,
          brandVoiceNotes: brandVoiceText,
          proofPoints: proofSubset,
          usedProofPoints,
        });
        const retryResult = await generateObject({
          model: anthropic(SCRIPT_MODEL),
          schema: stripNumericConstraints(awarenessLevelOutputSchema),
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          system,
          prompt,
          abortSignal: AbortSignal.timeout(PER_CALL_TIMEOUT_MS),
        });
        const retryScripts = (retryResult.object.scripts as Array<Record<string, unknown>>).map(sanitizeScript);
        const retryDeduped = dedupScripts([...uniqueScripts, ...retryScripts]);
        uniqueScripts = retryDeduped.slice(0, SCRIPTS_PER_LEVEL);
      } catch (err) {
        await emitRunnerProgress(onProgress, 'error', `dedup retry failed for ${level}: ${err instanceof Error ? err.message : String(err)}`);
        // Ship with what we have
      }
    }

    // Count validation: cap at SCRIPTS_PER_LEVEL
    if (uniqueScripts.length > SCRIPTS_PER_LEVEL) {
      uniqueScripts = uniqueScripts.slice(0, SCRIPTS_PER_LEVEL);
    }

    // Inject UUIDs and force awarenessLevel — AI must not be trusted to produce IDs
    const levelScripts = uniqueScripts.map((s) => ({
      ...s,
      id: crypto.randomUUID(),
      awarenessLevel: level,
    }));

    allScripts.push(...levelScripts);

    // Track used angles/hooks for dedup in subsequent levels
    for (const script of levelScripts as Array<Record<string, unknown>>) {
      const angle = String(script.angle ?? '');
      const hook = String(script.headline ?? (script.body as string)?.split('.')[0] ?? '');
      if (angle) usedAnglesAndHooks.push({ angle, hook });
    }

    // Track proof point usage for rotation in subsequent levels
    if (proofHeadlines.length > 0) {
      const levelProofUsage = detectUsedProofPoints(levelScripts, proofHeadlines);
      for (const [headline, count] of levelProofUsage) {
        usedProofPoints.set(headline, (usedProofPoints.get(headline) ?? 0) + count);
      }
    }

    // Progressive write callback — caller persists to Supabase
    if (onLevelComplete) {
      await onLevelComplete(allScripts, idx + 1);
    }
  }

  // Pass 3: Batch diversity validation
  let diversity: { diversityScore: number; flags: string[] } | undefined;
  if (allScripts.length > 0) {
    await emitRunnerProgress(onProgress, 'analysis', 'validating batch diversity (pass 3)');
    try {
      diversity = await validateBatchDiversity(allScripts);
    } catch (err) {
      await emitRunnerProgress(
        onProgress,
        'error',
        `Pass 3 diversity check failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  const summary = {
    totalScripts: allScripts.length,
    byType: countBy(allScripts, 'type'),
    byPlatform: countBy(allScripts, 'platform'),
    byAwareness: countBy(allScripts, 'awarenessLevel'),
  };

  return {
    scripts: allScripts,
    generatedAt: new Date().toISOString(),
    styleReferencesUsed: input.styleReferences.map((r) => r.name),
    summary,
    diversity,
  };
}

function countBy(
  items: Array<Record<string, unknown>>,
  key: string,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const val = String(item[key] ?? 'unknown');
    counts[val] = (counts[val] ?? 0) + 1;
  }
  return counts;
}

const batchDiversitySchema = z.object({
  diversityScore: z.number(),
  flags: z.array(z.string()),
});

async function validateBatchDiversity(
  scripts: Array<Record<string, unknown>>,
): Promise<{ diversityScore: number; flags: string[] }> {
  const result = await generateObject({
    model: anthropic(SCRIPT_MODEL),
    schema: batchDiversitySchema,
    maxOutputTokens: 1000,
    system: `You are a creative director reviewing a batch of ${scripts.length} ad scripts for diversity and quality distribution.`,
    prompt: `Review these scripts for:
1. ANGLE DIVERSITY: Are there 2+ scripts using the exact same angle? Flag pairs.
2. HOOK DIVERSITY: Do any hooks sound similar? Flag pairs with the similar language.
3. FORMAT COVERAGE: Are video, static, and email all represented?
4. PLATFORM COVERAGE: Are meta, google, and linkedin all represented?
5. CTA VARIETY: Are CTAs varied or all "Book a call"?

Rate diversity 0-10 (10 = perfectly diverse batch, 0 = all identical).

Scripts:
${scripts.map((s, i) => `[${i + 1}] ${s.type}|${s.platform}|${s.awarenessLevel}|${s.angle}\nHook: ${s.headline || (s.body as string)?.split('.')[0] || ''}\nCTA: ${s.cta}`).join('\n\n')}`,
    abortSignal: AbortSignal.timeout(60_000),
  });
  return result.object;
}
