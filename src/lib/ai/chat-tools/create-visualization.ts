// Create Visualization Tool
// Auto-execute tool (no needsApproval) — extracts structured data from the
// blueprint and returns Recharts-compatible chart payloads.

import { tool } from 'ai';
import { z } from 'zod';
import type { VisualizationResult } from './types';

const CHART_COLORS = [
  '#4d6fff',
  '#3ee8d6',
  '#34d27b',
  '#f0a030',
  '#9b7dff',
  '#f05050',
];

// ---------------------------------------------------------------------------
// Data extractors
// ---------------------------------------------------------------------------

function extractOfferScores(
  blueprint: Record<string, unknown>,
  title: string
): VisualizationResult {
  const offer = blueprint.offerAnalysisViability as Record<string, unknown> | undefined;
  const strength = offer?.offerStrength as Record<string, unknown> | undefined;

  if (!strength) {
    return {
      type: 'bar',
      title,
      data: [],
      config: { colors: CHART_COLORS, dataKey: 'value', categoryKey: 'name' },
      error: 'Offer strength data not found in blueprint',
    };
  }

  const DIMENSION_LABELS: Record<string, string> = {
    painRelevance: 'Pain Relevance',
    urgency: 'Urgency',
    differentiation: 'Differentiation',
    tangibility: 'Tangibility',
    proof: 'Proof',
    pricingLogic: 'Pricing',
  };

  const data = Object.entries(DIMENSION_LABELS)
    .filter(([key]) => key in strength)
    .map(([key, label]) => ({
      name: label,
      value: Number(strength[key]) || 0,
    }));

  return {
    type: 'bar',
    title,
    data,
    config: {
      colors: CHART_COLORS,
      dataKey: 'value',
      categoryKey: 'name',
      labels: data.map((d) => String(d.name)),
    },
  };
}

function extractOfferScoresRadar(
  blueprint: Record<string, unknown>,
  title: string
): VisualizationResult {
  const offer = blueprint.offerAnalysisViability as Record<string, unknown> | undefined;
  const strength = offer?.offerStrength as Record<string, unknown> | undefined;

  if (!strength) {
    return {
      type: 'radar',
      title,
      data: [],
      config: { colors: CHART_COLORS, dataKey: 'score', categoryKey: 'subject' },
      error: 'Offer strength data not found in blueprint',
    };
  }

  const DIMENSION_LABELS: Record<string, string> = {
    painRelevance: 'Pain',
    urgency: 'Urgency',
    differentiation: 'Diff',
    tangibility: 'Tangible',
    proof: 'Proof',
    pricingLogic: 'Pricing',
  };

  const data = Object.entries(DIMENSION_LABELS)
    .filter(([key]) => key in strength)
    .map(([key, subject]) => ({
      subject,
      score: Number(strength[key]) || 0,
      fullMark: 10,
    }));

  return {
    type: 'radar',
    title,
    data,
    config: {
      colors: [CHART_COLORS[0]],
      dataKey: 'score',
      categoryKey: 'subject',
    },
  };
}

function extractICPScores(
  blueprint: Record<string, unknown>,
  title: string,
  chartType: 'bar' | 'radar'
): VisualizationResult {
  const icp = blueprint.icpAnalysisValidation as Record<string, unknown> | undefined;

  if (!icp) {
    return {
      type: chartType,
      title,
      data: [],
      config: { colors: CHART_COLORS, dataKey: 'value', categoryKey: 'name' },
      error: 'ICP data not found in blueprint',
    };
  }

  const segments = icp.targetSegments as Array<Record<string, unknown>> | undefined;
  const sizing = segments?.[0]?.sizing as Record<string, unknown> | undefined;
  const factors = sizing?.priorityFactors as Record<string, unknown> | undefined;

  if (factors) {
    const FACTOR_LABELS: Record<string, string> = {
      painSeverity: 'Pain Severity',
      budgetAuthority: 'Budget Auth',
      reachability: 'Reachability',
      triggerFrequency: 'Trigger Freq',
    };

    if (chartType === 'radar') {
      const data = Object.entries(FACTOR_LABELS)
        .filter(([key]) => key in factors)
        .map(([key, subject]) => ({
          subject,
          score: Number(factors[key]) || 0,
          fullMark: 10,
        }));

      return {
        type: 'radar',
        title,
        data,
        config: {
          colors: [CHART_COLORS[2]],
          dataKey: 'score',
          categoryKey: 'subject',
        },
      };
    }

    const data = Object.entries(FACTOR_LABELS)
      .filter(([key]) => key in factors)
      .map(([key, name]) => ({
        name,
        value: Number(factors[key]) || 0,
      }));

    return {
      type: 'bar',
      title,
      data,
      config: {
        colors: CHART_COLORS,
        dataKey: 'value',
        categoryKey: 'name',
      },
    };
  }

  // Fallback: derive from riskScores
  const riskScores = icp.riskScores as Array<Record<string, unknown>> | undefined;
  if (riskScores && riskScores.length > 0) {
    const data = riskScores.slice(0, 5).map((risk) => ({
      name: String(risk.category || 'Risk').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      value: Math.max(0, 10 - Number(risk.probability || 5) * Number(risk.impact || 5) / 10),
    }));

    return {
      type: chartType,
      title,
      data,
      config: {
        colors: CHART_COLORS,
        dataKey: chartType === 'radar' ? 'score' : 'value',
        categoryKey: chartType === 'radar' ? 'subject' : 'name',
      },
    };
  }

  return {
    type: chartType,
    title,
    data: [],
    config: { colors: CHART_COLORS, dataKey: 'value', categoryKey: 'name' },
    error: 'Insufficient ICP data to build chart',
  };
}

function extractCompetitorComparison(
  blueprint: Record<string, unknown>,
  title: string
): VisualizationResult {
  const comp = blueprint.competitorAnalysis as Record<string, unknown> | undefined;
  const competitors = comp?.competitors as Array<Record<string, unknown>> | undefined;

  if (!competitors || competitors.length === 0) {
    return {
      type: 'bar',
      title,
      data: [],
      config: { colors: CHART_COLORS, dataKey: 'threat', categoryKey: 'name' },
      error: 'Competitor data not found in blueprint',
    };
  }

  const data = competitors.slice(0, 6).map((c) => {
    const threat = c.threatAssessment as Record<string, unknown> | undefined;
    const weightedScore = threat?.weightedThreatScore as number | undefined;
    const factors = threat?.threatFactors as Record<string, number> | undefined;

    let score: number;
    if (weightedScore !== undefined) {
      score = Number(weightedScore);
    } else if (factors) {
      const vals = Object.values(factors).map(Number).filter((n) => !isNaN(n));
      score = vals.length > 0 ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : 5;
    } else {
      score = 5;
    }

    return {
      name: String(c.name || 'Competitor').slice(0, 14),
      threat: score,
    };
  });

  return {
    type: 'bar',
    title,
    data,
    config: {
      colors: CHART_COLORS,
      dataKey: 'threat',
      categoryKey: 'name',
    },
  };
}

function extractSectionScores(
  blueprint: Record<string, unknown>,
  title: string,
  chartType: 'bar' | 'radar'
): VisualizationResult {
  // Pull overall scores / strength indicators from each available section
  type ScorePoint = { name: string; value: number };
  const points: ScorePoint[] = [];

  const offer = blueprint.offerAnalysisViability as Record<string, unknown> | undefined;
  const strength = offer?.offerStrength as Record<string, unknown> | undefined;
  if (strength?.overallScore !== undefined) {
    points.push({ name: 'Offer', value: Number(strength.overallScore) });
  }

  const icp = blueprint.icpAnalysisValidation as Record<string, unknown> | undefined;
  const segments = icp?.targetSegments as Array<Record<string, unknown>> | undefined;
  const topSegment = segments?.[0];
  const sizing = topSegment?.sizing as Record<string, unknown> | undefined;
  const compositeRank = sizing?.compositeRank as number | undefined;
  if (compositeRank !== undefined) {
    // compositeRank is 1-based priority; invert to a 1-10 score proxy
    points.push({ name: 'ICP Fit', value: Math.max(1, 11 - compositeRank) });
  }

  const comp = blueprint.competitorAnalysis as Record<string, unknown> | undefined;
  const competitors = comp?.competitors as Array<Record<string, unknown>> | undefined;
  if (competitors && competitors.length > 0) {
    const threats = competitors
      .map((c) => {
        const ta = c.threatAssessment as Record<string, unknown> | undefined;
        return ta?.weightedThreatScore as number | undefined;
      })
      .filter((n): n is number => n !== undefined);

    if (threats.length > 0) {
      const avgThreat = threats.reduce((a, b) => a + b, 0) / threats.length;
      // Invert: low threat = high opportunity score
      points.push({ name: 'Opp Score', value: Math.round((10 - avgThreat) * 10) / 10 });
    }
  }

  if (points.length === 0) {
    return {
      type: chartType,
      title,
      data: [],
      config: { colors: CHART_COLORS, dataKey: 'value', categoryKey: 'name' },
      error: 'Not enough scored data found across blueprint sections',
    };
  }

  if (chartType === 'radar') {
    const data = points.map(({ name, value }) => ({ subject: name, score: value, fullMark: 10 }));
    return {
      type: 'radar',
      title,
      data,
      config: { colors: [CHART_COLORS[4]], dataKey: 'score', categoryKey: 'subject' },
    };
  }

  return {
    type: 'bar',
    title,
    data: points,
    config: { colors: CHART_COLORS, dataKey: 'value', categoryKey: 'name' },
  };
}

function extractCampaignTimeline(
  blueprint: Record<string, unknown>,
  title: string
): VisualizationResult {
  const synthesis = blueprint.crossAnalysisSynthesis as Record<string, unknown> | undefined;
  const nextSteps = synthesis?.nextSteps as string[] | undefined;

  if (!nextSteps || nextSteps.length === 0) {
    return {
      type: 'timeline',
      title,
      data: [],
      config: { colors: CHART_COLORS, dataKey: 'value', categoryKey: 'phase' },
      error: 'Next steps / campaign phases not found in blueprint',
    };
  }

  // Map next steps into phase blocks with estimated durations
  const phaseLabels = ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4', 'Phase 5'];
  const data = nextSteps.slice(0, 5).map((step, i) => ({
    phase: phaseLabels[i] || `Phase ${i + 1}`,
    label: step.length > 30 ? step.slice(0, 28) + '…' : step,
    value: 4 - i, // descending priority weight (just for visual bar width)
    week: (i + 1) * 2,
  }));

  return {
    type: 'timeline',
    title,
    data,
    config: {
      colors: CHART_COLORS,
      dataKey: 'value',
      categoryKey: 'phase',
      labels: data.map((d) => String(d.label)),
    },
  };
}

// ---------------------------------------------------------------------------
// Dispatch: pattern-match dataSource → extractor
// ---------------------------------------------------------------------------

function extractChartData(
  blueprint: Record<string, unknown>,
  type: 'bar' | 'radar' | 'timeline',
  dataSource: string,
  title: string
): VisualizationResult {
  const lower = dataSource.toLowerCase();

  // Offer strength / dimensions
  if (lower.includes('offer') || lower.includes('strength') || lower.includes('dimension')) {
    return type === 'radar'
      ? extractOfferScoresRadar(blueprint, title)
      : extractOfferScores(blueprint, title);
  }

  // ICP scores / reachability / priority
  if (
    lower.includes('icp') ||
    lower.includes('reachability') ||
    lower.includes('segment') ||
    lower.includes('priority')
  ) {
    return extractICPScores(blueprint, title, type === 'radar' ? 'radar' : 'bar');
  }

  // Competitor comparison / threat
  if (lower.includes('competitor') || lower.includes('threat') || lower.includes('comparison')) {
    return extractCompetitorComparison(blueprint, title);
  }

  // Section-level scores / overview
  if (lower.includes('score') || lower.includes('section') || lower.includes('overview')) {
    return extractSectionScores(blueprint, title, type === 'radar' ? 'radar' : 'bar');
  }

  // Campaign phases / timeline / next steps
  if (
    lower.includes('campaign') ||
    lower.includes('timeline') ||
    lower.includes('phase') ||
    lower.includes('next step') ||
    type === 'timeline'
  ) {
    return extractCampaignTimeline(blueprint, title);
  }

  // Default: try offer scores as a sensible fallback
  return type === 'radar'
    ? extractOfferScoresRadar(blueprint, title)
    : extractOfferScores(blueprint, title);
}

// ---------------------------------------------------------------------------
// Tool factory
// ---------------------------------------------------------------------------

export function createVisualizationTool(blueprint: Record<string, unknown>) {
  return tool({
    description:
      'Generate chart data for visual display inside the chat panel. ' +
      'Supports bar charts (competitor threat comparison, offer score dimensions), ' +
      'radar charts (multi-dimensional analysis of offer or ICP), and timeline charts ' +
      '(campaign phasing / next steps). Use when the user asks to visualize, chart, or ' +
      'graph blueprint data — e.g. "show me a chart of the offer scores" or "/visualize icp".',
    inputSchema: z.object({
      type: z
        .enum(['bar', 'radar', 'timeline'])
        .describe('Chart type: bar for comparisons, radar for multi-dimensional analysis, timeline for campaign phases'),
      title: z.string().describe('Short chart title shown in the card header (≤40 chars)'),
      dataSource: z
        .string()
        .describe(
          'What blueprint data to visualize. ' +
          'Examples: "offer scores", "offer dimensions", "icp reachability", ' +
          '"icp priority factors", "competitor comparison", "competitor threat", ' +
          '"section scores", "campaign phases", "next steps"'
        ),
    }),
    execute: async ({ type, title, dataSource }): Promise<VisualizationResult> => {
      try {
        return extractChartData(blueprint, type, dataSource, title);
      } catch (err) {
        return {
          type,
          title,
          data: [],
          config: { colors: CHART_COLORS, dataKey: 'value', categoryKey: 'name' },
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  });
}
