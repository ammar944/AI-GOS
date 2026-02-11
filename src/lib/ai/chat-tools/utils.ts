// Shared utilities for chat tools
// Extracted from edit-agent.ts, qa-agent.ts, chat-sidebar.tsx, and stream/route.ts

import type { BlueprintChunk, ConfidenceFactors, ConfidenceResult, SourceQuality, PendingEdit } from './types';

// Similarity thresholds for quality classification
const HIGH_QUALITY_THRESHOLD = 0.85;
const MEDIUM_QUALITY_THRESHOLD = 0.65;

/**
 * Get the current value at a dot-notation field path within an object.
 * Supports array notation like "painPoints.primary[0]".
 */
export function getValueAtPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.').flatMap(part => {
    const match = part.match(/^(.+)\[(\d+)\]$/);
    if (match) {
      return [match[1], parseInt(match[2], 10)];
    }
    return [part];
  });

  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof part === 'number') {
      if (!Array.isArray(current)) return undefined;
      current = current[part];
    } else {
      if (typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[part];
    }
  }
  return current;
}

/**
 * Generate a human-readable diff preview between old and new values.
 */
export function generateDiffPreview(oldValue: unknown, newValue: unknown): string {
  const formatValue = (val: unknown): string => {
    if (typeof val === 'string') {
      return val.length > 100 ? `"${val.substring(0, 97)}..."` : `"${val}"`;
    }
    if (Array.isArray(val)) {
      if (val.length === 0) return '[]';
      if (typeof val[0] === 'string') {
        return `[${val.map(v => `"${v}"`).join(', ')}]`;
      }
      return `[${val.length} items]`;
    }
    if (typeof val === 'object' && val !== null) {
      return JSON.stringify(val, null, 2);
    }
    return String(val);
  };

  const oldFormatted = formatValue(oldValue);
  const newFormatted = formatValue(newValue);

  return `- Old: ${oldFormatted}\n+ New: ${newFormatted}`;
}

/**
 * Calculate enhanced confidence based on multiple factors from retrieved chunks.
 */
export function calculateConfidence(chunks: BlueprintChunk[]): ConfidenceResult {
  if (chunks.length === 0) {
    return {
      level: 'low',
      factors: {
        avgSimilarity: 0,
        chunkCount: 0,
        coverageScore: 0,
        highQualityChunks: 0,
      },
      explanation: 'No relevant sources found in the blueprint.',
    };
  }

  const avgSimilarity = chunks.reduce((sum, c) => sum + (c.similarity || 0), 0) / chunks.length;
  const chunkCount = chunks.length;
  const highQualityChunks = chunks.filter(c => (c.similarity || 0) > HIGH_QUALITY_THRESHOLD).length;

  const uniqueSections = new Set(chunks.map(c => c.section)).size;
  const coverageScore = Math.min(1, (uniqueSections / 5) * (chunkCount / 3));

  const factors: ConfidenceFactors = {
    avgSimilarity: Math.round(avgSimilarity * 100) / 100,
    chunkCount,
    coverageScore: Math.round(coverageScore * 100) / 100,
    highQualityChunks,
  };

  const isHighConfidence =
    avgSimilarity > 0.8 &&
    chunkCount >= 3 &&
    highQualityChunks >= 2;

  const isMediumConfidence =
    avgSimilarity > MEDIUM_QUALITY_THRESHOLD ||
    chunkCount >= 2;

  let level: 'high' | 'medium' | 'low';
  let explanation: string;

  if (isHighConfidence) {
    level = 'high';
    explanation = `High confidence: ${highQualityChunks} high-quality sources with ${Math.round(avgSimilarity * 100)}% average relevance across ${chunkCount} total sources.`;
  } else if (isMediumConfidence) {
    level = 'medium';
    if (avgSimilarity > MEDIUM_QUALITY_THRESHOLD) {
      explanation = `Medium confidence: ${Math.round(avgSimilarity * 100)}% average relevance, but ${chunkCount < 3 ? 'limited source count' : highQualityChunks < 2 ? 'few high-quality matches' : 'moderate match quality'}.`;
    } else {
      explanation = `Medium confidence: Found ${chunkCount} relevant sources, but average relevance is ${Math.round(avgSimilarity * 100)}%.`;
    }
  } else {
    level = 'low';
    explanation = `Low confidence: ${chunkCount === 1 ? 'Only 1 source found' : chunkCount === 0 ? 'No sources found' : `${chunkCount} sources with ${Math.round(avgSimilarity * 100)}% average relevance`}. Answer may be incomplete.`;
  }

  return { level, factors, explanation };
}

/**
 * Build source quality assessment from retrieved chunks.
 */
export function buildSourceQuality(chunks: BlueprintChunk[]): SourceQuality {
  if (chunks.length === 0) {
    return {
      avgRelevance: 0,
      sourceCount: 0,
      highQualitySources: 0,
      explanation: 'No sources available.',
    };
  }

  const avgRelevance = chunks.reduce((sum, c) => sum + (c.similarity || 0), 0) / chunks.length;
  const sourceCount = chunks.length;
  const highQualitySources = chunks.filter(c => (c.similarity || 0) > HIGH_QUALITY_THRESHOLD).length;

  let explanation: string;

  if (highQualitySources >= 3) {
    explanation = `Excellent: ${highQualitySources} highly relevant sources with ${Math.round(avgRelevance * 100)}% average match.`;
  } else if (highQualitySources >= 1) {
    explanation = `Good: ${highQualitySources} highly relevant ${highQualitySources === 1 ? 'source' : 'sources'} among ${sourceCount} total with ${Math.round(avgRelevance * 100)}% average relevance.`;
  } else if (sourceCount >= 2 && avgRelevance > MEDIUM_QUALITY_THRESHOLD) {
    explanation = `Adequate: ${sourceCount} sources with ${Math.round(avgRelevance * 100)}% average relevance. No exceptionally strong matches.`;
  } else {
    explanation = `Limited: ${sourceCount} ${sourceCount === 1 ? 'source' : 'sources'} found with ${Math.round(avgRelevance * 100)}% average relevance. Results may be incomplete.`;
  }

  return {
    avgRelevance: Math.round(avgRelevance * 100) / 100,
    sourceCount,
    highQualitySources,
    explanation,
  };
}

/**
 * Summarize a blueprint into a concise text summary for system prompts.
 */
export function summarizeBlueprint(blueprint: Record<string, unknown>): string {
  const sections: string[] = [];

  const s1 = blueprint.industryMarketOverview as Record<string, unknown> | undefined;
  if (s1) {
    const painPoints = s1.painPoints as { primary?: string[]; secondary?: string[] } | undefined;
    sections.push(`## Industry & Market Overview
- Category: ${(s1.categorySnapshot as Record<string, unknown>)?.category || 'N/A'}
- Primary Pain Points: ${painPoints?.primary?.slice(0, 3).join('; ') || 'N/A'}
- Messaging Opportunities: ${((s1.messagingOpportunities as Record<string, unknown>)?.opportunities as string[])?.slice(0, 3).join('; ') || 'N/A'}`);
  }

  const s2 = blueprint.icpAnalysisValidation as Record<string, unknown> | undefined;
  if (s2) {
    const verdict = s2.finalVerdict as Record<string, unknown> | undefined;
    sections.push(`## ICP Analysis
- Status: ${verdict?.status || 'N/A'}
- Reasoning: ${verdict?.reasoning || 'N/A'}`);
  }

  const s3 = blueprint.offerAnalysisViability as Record<string, unknown> | undefined;
  if (s3) {
    const strength = s3.offerStrength as Record<string, unknown> | undefined;
    const rec = s3.recommendation as Record<string, unknown> | undefined;
    sections.push(`## Offer Analysis
- Overall Score: ${strength?.overallScore || 'N/A'}/10
- Recommendation: ${rec?.status || 'N/A'}`);
  }

  const s4 = blueprint.competitorAnalysis as Record<string, unknown> | undefined;
  if (s4) {
    const competitors = s4.competitors as { name?: string }[] | undefined;
    sections.push(`## Competitor Analysis
- Competitors: ${competitors?.map(c => c.name).join(', ') || 'N/A'}
- Gaps: ${(s4.gapsAndOpportunities as Record<string, unknown>)?.messagingOpportunities?.toString().slice(0, 200) || 'N/A'}`);
  }

  const s5 = blueprint.crossAnalysisSynthesis as Record<string, unknown> | undefined;
  if (s5) {
    sections.push(`## Cross-Analysis Synthesis
- Recommended Positioning: ${s5.recommendedPositioning || 'N/A'}
- Primary Messaging Angles: ${(s5.primaryMessagingAngles as string[])?.slice(0, 3).join('; ') || 'N/A'}
- Next Steps: ${(s5.nextSteps as string[])?.slice(0, 3).join('; ') || 'N/A'}`);
  }

  return sections.join('\n\n');
}

/**
 * Try to parse a JSON string value back into its proper type.
 * Handles the case where a previous edit stringified an array/object.
 */
function tryParseJsonString(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if ((trimmed.startsWith('[') && trimmed.endsWith(']')) ||
      (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
    try { return JSON.parse(trimmed); } catch { /* not valid JSON */ }
  }
  return value;
}

/**
 * Apply a single edit to a blueprint object (mutates the passed object).
 * Handles JSON-stringified values from prior edits by auto-parsing during traversal.
 */
export function applySingleEdit(
  result: Record<string, unknown>,
  edit: PendingEdit
): void {
  const section = result[edit.section];
  if (!section || typeof section !== 'object') {
    throw new Error(`Section ${edit.section} not found`);
  }

  const pathParts = edit.fieldPath.split('.').flatMap(part => {
    const match = part.match(/^(.+)\[(\d+)\]$/);
    if (match) {
      return [match[1], parseInt(match[2], 10)];
    }
    return [part];
  });

  // For single-part paths (e.g. "marketDynamics"), set directly on the section
  if (pathParts.length === 1) {
    const key = pathParts[0];
    if (typeof key === 'number') {
      if (!Array.isArray(section)) throw new Error('Expected array for single-part path');
      (section as unknown[])[key] = edit.newValue;
    } else {
      (section as Record<string, unknown>)[key] = edit.newValue;
    }
    return;
  }

  // Traverse to the parent of the target, auto-repairing stringified values
  let current: unknown = section;
  let parent: unknown = result;
  let parentKey: string | number = edit.section;

  for (let i = 0; i < pathParts.length - 1; i++) {
    const part = pathParts[i];

    // Auto-repair: if current is a JSON string, parse it and fix the parent reference
    if (typeof current === 'string') {
      const parsed = tryParseJsonString(current);
      if (parsed !== current) {
        if (typeof parentKey === 'number' && Array.isArray(parent)) {
          parent[parentKey] = parsed;
        } else if (typeof parentKey === 'string' && typeof parent === 'object' && parent !== null) {
          (parent as Record<string, unknown>)[parentKey] = parsed;
        }
        current = parsed;
      }
    }

    if (typeof part === 'number') {
      if (!Array.isArray(current)) {
        throw new Error(`Expected array at path "${pathParts.slice(0, i + 1).join('.')}"`);
      }
      parent = current;
      parentKey = part;
      current = current[part];
    } else {
      if (typeof current !== 'object' || current === null) {
        throw new Error(`Expected object at path "${pathParts.slice(0, i + 1).join('.')}"`);
      }
      const obj = current as Record<string, unknown>;
      // Auto-repair the value we're about to descend into
      if (typeof obj[part] === 'string') {
        const parsed = tryParseJsonString(obj[part]);
        if (parsed !== obj[part]) {
          obj[part] = parsed;
        }
      }
      parent = current;
      parentKey = part;
      current = obj[part];
    }
  }

  // Auto-repair current if it's a stringified value
  if (typeof current === 'string') {
    const parsed = tryParseJsonString(current);
    if (parsed !== current) {
      if (typeof parentKey === 'number' && Array.isArray(parent)) {
        parent[parentKey] = parsed;
      } else if (typeof parentKey === 'string' && typeof parent === 'object' && parent !== null) {
        (parent as Record<string, unknown>)[parentKey] = parsed;
      }
      current = parsed;
    }
  }

  // Set the final value
  const lastPart = pathParts[pathParts.length - 1];
  if (typeof lastPart === 'number') {
    if (!Array.isArray(current)) {
      throw new Error(`Expected array at final path "${edit.fieldPath}", got ${typeof current}`);
    }
    current[lastPart] = edit.newValue;
  } else {
    if (typeof current !== 'object' || current === null) {
      throw new Error(`Expected object at final path "${edit.fieldPath}", got ${typeof current}`);
    }
    (current as Record<string, unknown>)[lastPart] = edit.newValue;
  }
}

/**
 * Apply multiple edits to a blueprint object (immutable - returns new object).
 */
export function applyEdits(
  blueprint: Record<string, unknown>,
  edits: PendingEdit[]
): Record<string, unknown> {
  const result = JSON.parse(JSON.stringify(blueprint));
  for (const edit of edits) {
    applySingleEdit(result, edit);
  }
  return result;
}

/** Section labels for display */
export const SECTION_LABELS: Record<string, string> = {
  industryMarketOverview: 'Industry & Market',
  icpAnalysisValidation: 'ICP Analysis',
  offerAnalysisViability: 'Offer Analysis',
  competitorAnalysis: 'Competitors',
  crossAnalysisSynthesis: 'Synthesis',
};
