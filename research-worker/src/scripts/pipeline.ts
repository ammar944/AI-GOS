/**
 * ICM Script Pipeline v2.1 — Plan-Write-Gate (3 stages)
 *
 * Fixes the copy quality regression from v2.0's 6-stage architecture by
 * collapsing the 3 creative AI stages (hooks, body, polish) back into a
 * single integrated creative call per awareness level while keeping the
 * deterministic wins (planning matrix, claim extraction, quality gate).
 *
 *   Stage A (Plan)  → Deterministic matrix + claim extraction
 *   Stage B (Write) → Single integrated AI call per level (3 scripts)
 *   Stage C (Gate)  → Deterministic quality gate (code-based checks)
 */

import crypto from 'node:crypto';
import { buildScriptMatrix, validateMatrixDiversity, type ScriptPlan, type AwarenessLevel } from './stages/01-plan/planner';
import { extractClaims, type ExtractedClaim } from './stages/02-claims/claim-extractor';
import { writeCreativeLevel } from './stages/03-write/creative-writer';
import { runQualityGate } from './stages/05-quality-gate/quality-gate';
import { getProofSubset, detectUsedProofPoints, sanitizeScript, dedupScripts } from './utils/post-process';
import { loadRefFile } from '../skills/loader';
import type { RunnerProgressReporter } from '../runner';
import { emitRunnerProgress } from '../runner';
import type { PipelineInput } from './types';

export type { PipelineInput } from './types';

// --- Types (frontend-compatible output shape, unchanged from v2.0) ---

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

// --- Constants ---

const AWARENESS_LEVELS: AwarenessLevel[] = ['unaware', 'problem', 'solution', 'product', 'mostAware'];

// --- Pipeline ---

export async function runScriptPipeline(
  input: PipelineInput,
  onProgress?: RunnerProgressReporter,
  onLevelComplete?: (allScriptsSoFar: unknown[], completedLevels: number) => Promise<void>,
): Promise<DynamicCreativePackage> {
  const startTime = Date.now();

  // ═══════════════════════════════════════════════════════════════════════════
  // STAGE A: PLAN (deterministic)
  // ═══════════════════════════════════════════════════════════════════════════

  await emitRunnerProgress(onProgress, 'runner', 'Stage A: Planning script matrix + extracting claims');

  const objections = extractObjections(input.researchContext);
  const proofPoints = input.proofPoints ?? [];
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

  await emitRunnerProgress(onProgress, 'runner', `Stage A complete: ${plans.length} scripts planned, ${claims.length} claims extracted`);

  // Prepare shared context
  const contextText = JSON.stringify(input.researchContext);
  const styleRefText = input.styleReferences.length > 0
    ? input.styleReferences.map((r) => `### ${r.name} (${r.source})\n${r.content}`).join('\n\n')
    : null;

  const brandVoiceText = input.brandVoiceNotes && (input.brandVoiceNotes.tone || input.brandVoiceNotes.constraints)
    ? input.brandVoiceNotes
    : null;

  const platformSpecs = loadRefFile('platform-specs.md');
  const adCopyTemplates = loadRefFile('ad-copy-templates.md');

  // Extract audience triggers and competitor hooks from research
  const audienceTriggers = extractAudienceTriggers(input.researchContext);
  const competitorAdIntel = extractCompetitorAdIntel(input.researchContext);

  // Extract research stats for rotation
  const researchStats = Array.isArray(input.researchContext.researchStats)
    ? (input.researchContext.researchStats as Array<{ stat: string; source: string }>)
    : [];

  // Cross-level tracking (same as v1)
  const usedAnglesAndHooks: { angle: string; hook: string }[] = [];
  const usedProofPoints = new Map<string, number>();
  const proofHeadlines = proofPoints.map((p) => p.headline);

  // Accumulators
  const assembledScripts: AssembledScript[] = [];
  const allHookVariants: DynamicCreativePackage['hookVariants'] = [];
  const allHeadlines: DynamicCreativePackage['headlineVariants'] = [];
  const allBodies: DynamicCreativePackage['bodyVariants'] = [];
  const allCtas: DynamicCreativePackage['ctaVariants'] = [];
  const seenCtas = new Set<string>();

  // ═══════════════════════════════════════════════════════════════════════════
  // STAGE B: WRITE (integrated AI, one call per awareness level)
  // ═══════════════════════════════════════════════════════════════════════════

  for (const [levelIdx, level] of AWARENESS_LEVELS.entries()) {
    await emitRunnerProgress(
      onProgress,
      'runner',
      `Stage B: Writing ${level} scripts (${levelIdx + 1}/5)`,
    );

    // Get the 3 plans for this level
    const levelPlans = plans.filter((p) => p.awarenessLevel === level);

    // Rotate proof points for this level (same as v1)
    const proofSubset = proofPoints.length > 0
      ? getProofSubset(proofPoints, levelIdx)
      : undefined;

    // Rotate research stats for this level
    const statsSubset = researchStats.length > 0
      ? getProofSubset(researchStats, levelIdx)
      : undefined;

    // --- Single integrated creative call ---
    let rawScripts: Array<Record<string, unknown>>;
    try {
      const result = await writeCreativeLevel({
        level,
        levelPlans,
        companyName: input.companyName,
        trimmedResearchContext: contextText,
        targetAudience: input.targetAudience,
        targetAudienceMonologue: audienceTriggers,
        styleReferences: styleRefText,
        brandVoiceNotes: brandVoiceText,
        proofPoints: proofSubset,
        usedProofPoints,
        competitorAdIntel,
        researchStatsSubset: statsSubset,
        usedAnglesAndHooks,
        allClaims: claims,
        platformSpecs: platformSpecs || undefined,
        adCopyTemplates: adCopyTemplates || undefined,
      });
      rawScripts = result.scripts as unknown as Array<Record<string, unknown>>;
    } catch (err) {
      await emitRunnerProgress(
        onProgress,
        'error',
        `Creative write failed for ${level}: ${err instanceof Error ? err.message : String(err)}`,
      );
      continue;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // STAGE C: GATE (deterministic quality enforcement)
    // ═════════════════════════════════════════════════════════════════════════

    await emitRunnerProgress(onProgress, 'analysis', `Stage C: Quality gate for ${level} (${rawScripts.length} scripts)`);

    // Post-processing: sanitize dashes, dedup, quality gate
    let processed = rawScripts.map(sanitizeScript);
    processed = dedupScripts(processed);

    // Cap at 3 per level
    if (processed.length > 3) processed = processed.slice(0, 3);

    let totalAutoFixed = 0;
    const gatedScripts: Array<Record<string, unknown>> = [];

    for (const script of processed) {
      const platform = String(script.platform ?? levelPlans[0]?.platform ?? 'meta');
      const format = String(script.type ?? script.format ?? levelPlans[0]?.format ?? 'video');

      const { script: gatedScript, report } = runQualityGate({
        script,
        platform,
        format,
      });

      totalAutoFixed += report.autoFixed;

      // Inject ID and level metadata
      const finalScript: Record<string, unknown> = {
        ...gatedScript,
        id: crypto.randomUUID(),
        awarenessLevel: level,
      };

      // Find matching plan for metadata (best-effort match by angle+platform)
      const matchedPlan = levelPlans.find(
        (p) => p.angle === finalScript.angle && p.platform === finalScript.platform,
      ) ?? levelPlans.find(
        (p) => p.platform === finalScript.platform,
      ) ?? levelPlans[gatedScripts.length] ?? levelPlans[0];

      // Build assembled script
      const assembled: AssembledScript = {
        id: finalScript.id as string,
        awarenessLevel: level,
        inMarketTier: matchedPlan?.inMarketTier ?? 'needs-convinced',
        subSegment: matchedPlan?.subSegment ?? null,
        angle: String(finalScript.angle ?? matchedPlan?.angle ?? 'painPoint'),
        platform,
        format,
        framework: String(finalScript.framework ?? matchedPlan?.framework ?? 'talking-head-broll'),
        duration: String(finalScript.duration ?? matchedPlan?.duration ?? '60s'),
        headline: String(finalScript.headline ?? ''),
        ...(finalScript.subheadline ? { subheadline: String(finalScript.subheadline) } : {}),
        ...(finalScript.subjectLine ? { subjectLine: String(finalScript.subjectLine) } : {}),
        ...(finalScript.previewText ? { previewText: String(finalScript.previewText) } : {}),
        body: String(finalScript.body ?? ''),
        cta: String(finalScript.cta ?? ''),
        ...(Array.isArray(finalScript.hookVariants) ? { hookVariants: finalScript.hookVariants as string[] } : {}),
        ...(finalScript.designDirection ? { designDirection: String(finalScript.designDirection) } : {}),
        groundedIn: (finalScript.groundedIn as Array<{ section: string; claim: string }>) ?? [],
        confidenceScore: (finalScript.confidenceScore as number) ?? 5,
        humanizedPass: (finalScript.humanizedPass as boolean) ?? true,
        patternsFixed: (finalScript.patternsFixed as number) ?? 0,
        flaggedClaims: (finalScript.flaggedClaims as Array<{ claim: string; reason: string }>) ?? [],
        objectionHandled: matchedPlan?.objectionToHandle ?? null,
        qualityGateViolations: report.totalViolations,
        qualityGateAutoFixes: report.autoFixed,
      };

      assembledScripts.push(assembled);
      gatedScripts.push(finalScript);

      // Collect Dynamic Creative variants
      allHeadlines.push({ id: crypto.randomUUID(), text: assembled.headline, platform });
      allBodies.push({ id: crypto.randomUUID(), text: assembled.body, platform, format });
      if (!seenCtas.has(assembled.cta.toLowerCase())) {
        seenCtas.add(assembled.cta.toLowerCase());
        allCtas.push({ id: crypto.randomUUID(), text: assembled.cta });
      }

      // Collect hook variants for Dynamic Creative package
      if (assembled.hookVariants) {
        for (const hookText of assembled.hookVariants) {
          allHookVariants.push({
            id: crypto.randomUUID(),
            text: hookText,
            scriptIndex: assembledScripts.length - 1,
            platform,
            angle: assembled.angle,
          });
        }
      }
    }

    if (totalAutoFixed > 0) {
      await emitRunnerProgress(
        onProgress,
        'analysis',
        `Quality gate auto-fixed ${totalAutoFixed} issues in ${level} scripts`,
      );
    }

    // Track used angles/hooks for cross-level dedup (same as v1)
    for (const script of gatedScripts) {
      const angle = String(script.angle ?? '');
      const hook = String(script.headline ?? (script.body as string)?.split('.')[0] ?? '');
      if (angle) usedAnglesAndHooks.push({ angle, hook });
    }

    // Track proof point usage for rotation
    if (proofHeadlines.length > 0) {
      const levelProofUsage = detectUsedProofPoints(gatedScripts, proofHeadlines);
      for (const [headline, count] of levelProofUsage) {
        usedProofPoints.set(headline, (usedProofPoints.get(headline) ?? 0) + count);
      }
    }

    // Progressive write callback
    if (onLevelComplete) {
      await onLevelComplete(assembledScripts, levelIdx + 1);
    }
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
      pipelineVersion: '2.1.0-plan-write-gate',
    },
  };
}

// --- Helper extractors (unchanged) ---

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

function extractCompetitorAdIntel(ctx: Record<string, unknown>): Array<{
  advertiser: string;
  topAdHooks: string[];
  adCreatives: Array<{ platform: string; headline?: string; body?: string; format: string }>;
}> {
  const intel = Array.isArray(ctx.competitorAdIntel) ? ctx.competitorAdIntel : [];
  return (intel as Array<Record<string, unknown>>).map((ci) => ({
    advertiser: String(ci.advertiser ?? 'Competitor'),
    topAdHooks: Array.isArray(ci.topAdHooks)
      ? (ci.topAdHooks as string[]).filter((h) => typeof h === 'string' && h.length > 5).slice(0, 5)
      : [],
    adCreatives: Array.isArray(ci.adCreatives)
      ? (ci.adCreatives as Array<Record<string, unknown>>).slice(0, 5).map((ad) => ({
          platform: String(ad.platform ?? 'unknown'),
          headline: ad.headline as string | undefined,
          body: ad.body as string | undefined,
          format: String(ad.format ?? 'unknown'),
        }))
      : [],
  }));
}
