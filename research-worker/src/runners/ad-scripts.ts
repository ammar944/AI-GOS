// Runner: Ad Scripts (2-pass sequential generator)
// Generates 3 scripts per awareness level (5 levels = 15 scripts total).
// Pass 1: Draft scripts grounded in research context.
// Pass 2: Humanize + apply 41-check audit.
// IDs are injected post-generation — AI never produces them.
// Progressive Supabase writes via onLevelComplete callback.

import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import crypto from 'node:crypto';
import { awarenessLevelOutputSchema } from '../schemas/ad-scripts';
import { buildPass1Prompt } from '../prompts/ad-scripts-pass1';
import { buildPass2Prompt } from '../prompts/ad-scripts-pass2';
import { stripNumericConstraints } from '../utils/strip-numeric-constraints';
import type { RunnerProgressReporter } from '../runner';
import { emitRunnerProgress } from '../runner';

const SCRIPT_MODEL = 'claude-sonnet-4-6';
const PER_CALL_TIMEOUT_MS = 90_000;
const MAX_OUTPUT_TOKENS = 4000;
const SCRIPTS_PER_LEVEL = 3;

const AWARENESS_LEVELS = ['unaware', 'problem', 'solution', 'product', 'mostAware'] as const;

export interface AdScriptsInput {
  companyName: string;
  researchContext: Record<string, unknown>;
  styleReferences: Array<{ name: string; content: string; source: string }>;
  targetAudience: string;
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

  const contextText = JSON.stringify(input.researchContext);

  for (const [idx, level] of AWARENESS_LEVELS.entries()) {
    await emitRunnerProgress(
      onProgress,
      'runner',
      `generating scripts ${idx + 1}/5: ${level} awareness level`,
    );

    // --- Pass 1: Draft ---
    let pass1Scripts: unknown[];
    try {
      const { system, prompt } = buildPass1Prompt({
        companyName: input.companyName,
        awarenessLevel: level,
        count: SCRIPTS_PER_LEVEL,
        trimmedResearchContext: contextText,
        styleReferences: styleRefText,
        targetAudience: input.targetAudience,
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
        trimmedResearchContext: contextText,
        styleReferences: styleRefText,
        targetAudience: input.targetAudience,
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

    // Inject UUIDs and force awarenessLevel — AI must not be trusted to produce IDs
    const levelScripts = (finalScripts as Array<Record<string, unknown>>).map((s) => ({
      ...s,
      id: crypto.randomUUID(),
      awarenessLevel: level,
    }));

    allScripts.push(...levelScripts);

    // Progressive write callback — caller persists to Supabase
    if (onLevelComplete) {
      await onLevelComplete(allScripts, idx + 1);
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
