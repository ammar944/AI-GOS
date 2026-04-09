/**
 * ICM Script Pipeline Orchestrator (replaces runAdScripts)
 *
 * Orchestrates 6 stages sequentially:
 *   01-plan     → Deterministic script matrix
 *   02-claims   → Deterministic claim extraction
 *   03-hooks    → Focused AI hook generation
 *   04-body     → Focused AI body writing
 *   05-quality  → Deterministic quality gate
 *   06-polish   → Focused AI voice polish
 *
 * Produces a DynamicCreativePackage for platform upload
 * + assembled scripts for human review.
 */

import crypto from 'node:crypto';
import { buildScriptMatrix, validateMatrixDiversity, type ScriptPlan } from './stages/01-plan/planner';
import { extractClaims, type ExtractedClaim } from './stages/02-claims/claim-extractor';
import { generateHooks, type HookResult } from './stages/03-hooks/hook-generator';
import { writeBody, type ScriptBody } from './stages/04-body/body-writer';
import { runQualityGate } from './stages/05-quality-gate/quality-gate';
import { polishVoice, mergePolishResult } from './stages/06-voice-polish/voice-polisher';
import type { RunnerProgressReporter } from '../runner';
import { emitRunnerProgress } from '../runner';

// --- Types ---

export interface PipelineInput {
  companyName: string;
  researchContext: Record<string, unknown>;
  styleReferences: Array<{ name: string; content: string; source: string }>;
  targetAudience: string;
  proofPoints?: Array<{
    id: string;
    type: string;
    headline: string;
    detail: string;
    clientName?: string;
    verified: boolean;
  }>;
}

export interface AssembledScript {
  id: string;
  awarenessLevel: string;
  inMarketTier: string;
  subSegment: string | null;
  angle: string;
  platform: string;
  format: string;
  framework: string;
  duration: string;
  headline: string;
  subheadline?: string;
  subjectLine?: string;
  previewText?: string;
  body: string;
  cta: string;
  hookVariants?: string[];
  designDirection?: string;
  groundedIn: Array<{ section: string; claim: string }>;
  confidenceScore: number;
  humanizedPass: boolean;
  patternsFixed: number;
  flaggedClaims: Array<{ claim: string; reason: string }>;
  objectionHandled: string | null;
  qualityGateViolations: number;
  qualityGateAutoFixes: number;
}

export interface DynamicCreativePackage {
  hookVariants: Array<{ id: string; text: string; scriptIndex: number; platform: string; angle: string }>;
  headlineVariants: Array<{ id: string; text: string; platform: string }>;
  bodyVariants: Array<{ id: string; text: string; platform: string; format: string }>;
  ctaVariants: Array<{ id: string; text: string }>;
  assembledScripts: AssembledScript[];
  dynamicCreativeSets: Array<{
    platform: string;
    hookIds: string[];
    headlineIds: string[];
    bodyIds: string[];
    ctaIds: string[];
  }>;
  metadata: {
    generatedAt: string;
    totalScripts: number;
    totalClaims: number;
    matrixViolations: string[];
    styleReferencesUsed: string[];
    pipelineVersion: string;
  };
}

// --- Pipeline ---

export async function runScriptPipeline(
  input: PipelineInput,
  onProgress?: RunnerProgressReporter,
  onLevelComplete?: (allScriptsSoFar: unknown[], completedLevels: number) => Promise<void>,
): Promise<DynamicCreativePackage> {
  const startTime = Date.now();

  // --- Stage 01: Plan ---
  await emitRunnerProgress(onProgress, 'runner', 'Stage 1/6: Building script matrix');

  const objections = extractObjections(input.researchContext);
  const proofPoints = input.proofPoints ?? [];

  // We need claim count for the planner, but claims aren't extracted yet.
  // Pre-count by running the extractor (it's deterministic and fast).
  const claims = extractClaims(input.researchContext);

  const plans = buildScriptMatrix({
    objections,
    proofPointCount: proofPoints.length,
    claimCount: claims.length,
    hasCompetitorAds: !!input.researchContext.competitorAdIntel,
    hasCaseStudies: proofPoints.some((p) => p.type === 'case-study' || p.type === 'testimonial'),
  });

  const matrixViolations = validateMatrixDiversity(plans);
  if (matrixViolations.length > 0) {
    await emitRunnerProgress(onProgress, 'error', `Matrix violations: ${matrixViolations.join('; ')}`);
  }

  await emitRunnerProgress(onProgress, 'runner', `Stage 1 complete: ${plans.length} scripts planned, ${claims.length} claims extracted`);

  // --- Stage 02: Claims (already done above) ---
  await emitRunnerProgress(onProgress, 'runner', `Stage 2/6: ${claims.length} citable claims extracted`);

  // Prepare shared context
  const styleRefText = input.styleReferences.length > 0
    ? input.styleReferences.map((r) => `### ${r.name} (${r.source})\n${r.content}`).join('\n\n')
    : null;

  const audienceTriggers = extractAudienceTriggers(input.researchContext);
  const competitorHooks = extractCompetitorHooks(input.researchContext);

  // --- Stages 03-06: Per-script processing ---
  const assembledScripts: AssembledScript[] = [];
  const allHookVariants: DynamicCreativePackage['hookVariants'] = [];
  const allHeadlines: DynamicCreativePackage['headlineVariants'] = [];
  const allBodies: DynamicCreativePackage['bodyVariants'] = [];
  const allCtas: DynamicCreativePackage['ctaVariants'] = [];
  const seenCtas = new Set<string>();

  // Track completed awareness levels for progressive writes
  let lastCompletedLevel = '';
  let completedLevelCount = 0;

  for (const [idx, plan] of plans.entries()) {
    const scriptNum = idx + 1;
    await emitRunnerProgress(
      onProgress,
      'runner',
      `Stage 3/6: Generating hooks for script ${scriptNum}/15 (${plan.awarenessLevel}/${plan.framework})`,
    );

    // Get assigned claims for this script
    const assignedClaims = plan.claimIndices.map((i) => claims[i]).filter(Boolean);

    // Get assigned proof point
    const proofPoint = plan.proofPointIndex !== null ? proofPoints[plan.proofPointIndex] ?? null : null;

    // --- Stage 03: Generate hooks ---
    let hookResult: HookResult;
    try {
      hookResult = await generateHooks({
        plan,
        companyName: input.companyName,
        targetAudience: input.targetAudience,
        audienceTriggers,
        assignedClaims,
        competitorHooks,
        objectionText: plan.objectionToHandle,
      });
    } catch (err) {
      await emitRunnerProgress(onProgress, 'error', `Hook generation failed for script ${scriptNum}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    const selectedHook = hookResult.hooks[hookResult.recommendedIndex]?.text ?? hookResult.hooks[0]?.text ?? '';
    const hookTexts = hookResult.hooks.map((h) => h.text);

    // Collect hook variants for Dynamic Creative package
    for (const hook of hookResult.hooks) {
      allHookVariants.push({
        id: crypto.randomUUID(),
        text: hook.text,
        scriptIndex: idx,
        platform: plan.platform,
        angle: plan.angle,
      });
    }

    // --- Stage 04: Write body ---
    await emitRunnerProgress(onProgress, 'analysis', `Stage 4/6: Writing body for script ${scriptNum}/15`);

    let bodyResult: ScriptBody;
    try {
      bodyResult = await writeBody({
        plan,
        companyName: input.companyName,
        targetAudience: input.targetAudience,
        selectedHook,
        allHookVariants: hookTexts,
        assignedClaims,
        proofPoint,
        objectionText: plan.objectionToHandle,
        styleReferences: styleRefText,
      });
    } catch (err) {
      await emitRunnerProgress(onProgress, 'error', `Body writing failed for script ${scriptNum}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    // Merge hook + body into a single script object
    let scriptObj: Record<string, unknown> = {
      ...bodyResult,
      awarenessLevel: plan.awarenessLevel,
      angle: plan.angle,
      type: plan.format,
      platform: plan.platform,
      hookType: hookResult.hooks[hookResult.recommendedIndex]?.hookType ?? 'direct',
      duration: plan.duration,
    };

    // --- Stage 05: Quality gate ---
    await emitRunnerProgress(onProgress, 'analysis', `Stage 5/6: Quality gate for script ${scriptNum}/15`);

    const { script: gatedScript, report: qualityReport } = runQualityGate({
      script: scriptObj,
      platform: plan.platform,
      format: plan.format,
    });
    scriptObj = gatedScript;

    if (qualityReport.autoFixed > 0) {
      await emitRunnerProgress(
        onProgress,
        'analysis',
        `Quality gate auto-fixed ${qualityReport.autoFixed} issues in script ${scriptNum}`,
      );
    }

    // --- Stage 06: Voice polish ---
    await emitRunnerProgress(onProgress, 'analysis', `Stage 6/6: Voice polishing script ${scriptNum}/15`);

    try {
      const polishResult = await polishVoice({
        script: scriptObj,
        platform: plan.platform,
        format: plan.format,
        targetAudience: input.targetAudience,
        styleReferences: styleRefText,
        qualityReport,
      });
      scriptObj = mergePolishResult(scriptObj, polishResult);
    } catch (err) {
      // Voice polish failure is non-fatal — keep the quality-gated version
      await emitRunnerProgress(
        onProgress,
        'error',
        `Voice polish failed for script ${scriptNum} — keeping quality-gated version`,
      );
      scriptObj = {
        ...scriptObj,
        humanizedPass: false,
        patternsFixed: 0,
        flaggedClaims: [],
      };
    }

    // Inject ID
    scriptObj.id = crypto.randomUUID();

    // Build assembled script
    const assembled: AssembledScript = {
      id: scriptObj.id as string,
      awarenessLevel: plan.awarenessLevel,
      inMarketTier: plan.inMarketTier,
      subSegment: plan.subSegment,
      angle: plan.angle,
      platform: plan.platform,
      format: plan.format,
      framework: plan.framework,
      duration: plan.duration,
      headline: (scriptObj.headline as string) ?? '',
      ...(scriptObj.subheadline && { subheadline: scriptObj.subheadline as string }),
      ...(scriptObj.subjectLine && { subjectLine: scriptObj.subjectLine as string }),
      ...(scriptObj.previewText && { previewText: scriptObj.previewText as string }),
      body: (scriptObj.body as string) ?? '',
      cta: (scriptObj.cta as string) ?? '',
      ...(scriptObj.hookVariants && { hookVariants: scriptObj.hookVariants as string[] }),
      ...(scriptObj.designDirection && { designDirection: scriptObj.designDirection as string }),
      groundedIn: (scriptObj.groundedIn as Array<{ section: string; claim: string }>) ?? [],
      confidenceScore: (scriptObj.confidenceScore as number) ?? 5,
      humanizedPass: (scriptObj.humanizedPass as boolean) ?? false,
      patternsFixed: (scriptObj.patternsFixed as number) ?? 0,
      flaggedClaims: (scriptObj.flaggedClaims as Array<{ claim: string; reason: string }>) ?? [],
      objectionHandled: plan.objectionToHandle,
      qualityGateViolations: qualityReport.totalViolations,
      qualityGateAutoFixes: qualityReport.autoFixed,
    };

    assembledScripts.push(assembled);

    // Collect Dynamic Creative variants
    allHeadlines.push({ id: crypto.randomUUID(), text: assembled.headline, platform: plan.platform });
    allBodies.push({ id: crypto.randomUUID(), text: assembled.body, platform: plan.platform, format: plan.format });
    if (!seenCtas.has(assembled.cta.toLowerCase())) {
      seenCtas.add(assembled.cta.toLowerCase());
      allCtas.push({ id: crypto.randomUUID(), text: assembled.cta });
    }

    // Progressive write callback — fire after each awareness level completes
    if (plan.awarenessLevel !== lastCompletedLevel && lastCompletedLevel !== '') {
      completedLevelCount++;
      if (onLevelComplete) {
        await onLevelComplete(assembledScripts, completedLevelCount);
      }
    }
    lastCompletedLevel = plan.awarenessLevel;
  }

  // Final level complete callback
  if (onLevelComplete && assembledScripts.length > 0) {
    completedLevelCount++;
    await onLevelComplete(assembledScripts, completedLevelCount);
  }

  // --- Build Dynamic Creative Sets ---
  const platforms = [...new Set(plans.map((p) => p.platform))];
  const dynamicCreativeSets = platforms.map((platform) => ({
    platform,
    hookIds: allHookVariants.filter((h) => h.platform === platform).map((h) => h.id),
    headlineIds: allHeadlines.filter((h) => h.platform === platform).map((h) => h.id),
    bodyIds: allBodies.filter((b) => b.platform === platform).map((b) => b.id),
    ctaIds: allCtas.map((c) => c.id),
  }));

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  await emitRunnerProgress(onProgress, 'runner', `Pipeline complete: ${assembledScripts.length} scripts in ${elapsed}s`);

  return {
    hookVariants: allHookVariants,
    headlineVariants: allHeadlines,
    bodyVariants: allBodies,
    ctaVariants: allCtas,
    assembledScripts,
    dynamicCreativeSets,
    metadata: {
      generatedAt: new Date().toISOString(),
      totalScripts: assembledScripts.length,
      totalClaims: claims.length,
      matrixViolations,
      styleReferencesUsed: input.styleReferences.map((r) => r.name),
      pipelineVersion: '2.0.0-icm',
    },
  };
}

// --- Helper extractors ---

function extractObjections(ctx: Record<string, unknown>): string[] {
  const icp = ctx.icpValidation as Record<string, unknown> | undefined;
  if (!icp) return [];
  const objections = Array.isArray(icp.objections) ? icp.objections : [];
  return objections
    .map((o) => {
      if (typeof o === 'string') return o;
      const rec = o as Record<string, unknown>;
      return String(rec.objection ?? rec.text ?? rec.description ?? '');
    })
    .filter((s) => s.length > 5)
    .slice(0, 4);
}

function extractAudienceTriggers(ctx: Record<string, unknown>): string[] {
  if (Array.isArray(ctx.targetAudienceMonologue)) {
    return (ctx.targetAudienceMonologue as string[]).slice(0, 5);
  }
  const icp = ctx.icpValidation as Record<string, unknown> | undefined;
  if (!icp) return [];
  const triggers = Array.isArray(icp.triggers) ? icp.triggers : [];
  return triggers
    .map((t) => {
      if (typeof t === 'string') return t;
      const rec = t as Record<string, unknown>;
      return String(rec.trigger ?? rec.text ?? '');
    })
    .filter((s) => s.length > 5)
    .slice(0, 5);
}

function extractCompetitorHooks(ctx: Record<string, unknown>): string[] {
  const hooks: string[] = [];
  const intel = Array.isArray(ctx.competitorAdIntel) ? ctx.competitorAdIntel : [];
  for (const ci of intel as Array<Record<string, unknown>>) {
    const adHooks = Array.isArray(ci.topAdHooks) ? ci.topAdHooks : [];
    for (const h of adHooks.slice(0, 3)) {
      if (typeof h === 'string' && h.length > 5) hooks.push(h);
    }
  }
  return hooks.slice(0, 8);
}
