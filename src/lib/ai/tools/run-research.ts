import { tool } from 'ai';
import type { UIMessage } from 'ai';
import { z } from 'zod';

import {
  researchIndustryMarket,
  researchCompetitors,
  researchICPAnalysis,
  researchOfferAnalysis,
  synthesizeCrossAnalysis,
} from '@/lib/ai/research';
import type {
  IndustryMarketResult,
  ICPAnalysisResult,
  OfferAnalysisResult,
  CompetitorAnalysisResult,
  CrossAnalysisResult,
} from '@/lib/ai/types';

// =============================================================================
// Types
// =============================================================================

/** Accumulated research results extracted from message history. */
export interface PreviousResearch {
  industryMarket?: IndustryMarketResult;
  competitors?: CompetitorAnalysisResult;
  icpValidation?: ICPAnalysisResult;
  offerAnalysis?: OfferAnalysisResult;
  crossAnalysis?: CrossAnalysisResult;
}

type SectionName =
  | 'industryMarket'
  | 'competitors'
  | 'icpValidation'
  | 'offerAnalysis'
  | 'crossAnalysis';

interface ToolSuccess {
  section: SectionName;
  status: 'complete';
  data: unknown;
  sources: { url: string; title?: string }[];
  durationMs: number;
  cost: number;
}

interface ToolError {
  section: SectionName;
  status: 'error';
  error: string;
  durationMs: number;
}

type ToolResult = ToolSuccess | ToolError;

// =============================================================================
// Constants
// =============================================================================

/** Human-readable labels for each research section. */
export const SECTION_LABELS: Record<SectionName, string> = {
  industryMarket: 'Industry & Market Overview',
  competitors: 'Competitor Analysis',
  icpValidation: 'ICP Validation',
  offerAnalysis: 'Offer Analysis',
  crossAnalysis: 'Cross-Analysis Synthesis',
};

// =============================================================================
// Context Builder
// =============================================================================

const CONTEXT_FIELD_LABELS: Record<string, string> = {
  businessModel: 'Business Model',
  industry: 'Industry',
  companyName: 'Company Name',
  websiteUrl: 'Website',
  productDescription: 'Product / Service Description',
  icpDescription: 'Ideal Customer Profile',
  competitors: 'Known Competitors',
  offerPricing: 'Offer & Pricing',
  marketingChannels: 'Current Marketing Channels',
  goals: 'Goals & Objectives',
  monthlyBudget: 'Monthly Budget',
  targetCpa: 'Target CPA',
  currentCac: 'Current CAC',
  avgDealSize: 'Average Deal Size',
  salesCycleLength: 'Sales Cycle Length',
  teamSize: 'Team Size',
  topPerformingChannel: 'Top Performing Channel',
  biggestMarketingChallenge: 'Biggest Marketing Challenge',
  buyerPersonaTitle: 'Buyer Persona Title',
};

/** Assemble a human-readable context string from the available fields. */
export function buildContextString(
  ctx: Record<string, string | undefined>,
): string {
  const lines: string[] = [];

  for (const [key, label] of Object.entries(CONTEXT_FIELD_LABELS)) {
    const value = ctx[key];
    if (value && value.trim()) {
      lines.push(`${label}: ${value.trim()}`);
    }
  }

  return lines.join('\n');
}

// =============================================================================
// Input Schema
// =============================================================================

const researchInputSchema = z.object({
  section: z
    .enum([
      'industryMarket',
      'competitors',
      'icpValidation',
      'offerAnalysis',
      'crossAnalysis',
    ])
    .describe('Which research section to run'),

  context: z
    .object({
      businessModel: z.string().optional().describe('B2B, B2C, DTC, etc.'),
      industry: z.string().optional().describe('Industry or vertical'),
      companyName: z.string().optional().describe('Company name'),
      websiteUrl: z.string().optional().describe('Company website URL'),
      productDescription: z
        .string()
        .optional()
        .describe('What the company sells'),
      icpDescription: z
        .string()
        .optional()
        .describe('Ideal customer profile description'),
      competitors: z
        .string()
        .optional()
        .describe('Comma or semicolon separated competitor names'),
      offerPricing: z
        .string()
        .optional()
        .describe('Offer description and pricing info'),
      marketingChannels: z
        .string()
        .optional()
        .describe('Current marketing channels'),
      goals: z.string().optional().describe('Marketing goals and objectives'),
      monthlyBudget: z.string().optional().describe('Monthly ad budget'),
      targetCpa: z.string().optional().describe('Target cost per acquisition'),
      currentCac: z
        .string()
        .optional()
        .describe('Current customer acquisition cost'),
      avgDealSize: z.string().optional().describe('Average deal size'),
      salesCycleLength: z.string().optional().describe('Sales cycle length'),
      teamSize: z.string().optional().describe('Marketing team size'),
      topPerformingChannel: z
        .string()
        .optional()
        .describe('Best performing channel'),
      biggestMarketingChallenge: z
        .string()
        .optional()
        .describe('Primary marketing challenge'),
      buyerPersonaTitle: z
        .string()
        .optional()
        .describe('Buyer persona job title'),
    })
    .describe('Onboarding context collected so far'),
});

// =============================================================================
// Validation Helpers
// =============================================================================

/** Required context fields per section. */
const REQUIRED_FIELDS: Record<SectionName, string[]> = {
  industryMarket: ['businessModel', 'industry'],
  competitors: ['industry', 'productDescription'],
  icpValidation: ['businessModel', 'industry', 'icpDescription'],
  offerAnalysis: ['productDescription', 'offerPricing'],
  crossAnalysis: [], // validated by checking previousResearch instead
};

function validateRequiredFields(
  section: SectionName,
  context: Record<string, string | undefined>,
): string | null {
  const required = REQUIRED_FIELDS[section];
  const missing = required.filter((f) => !context[f]?.trim());

  if (missing.length > 0) {
    const labels = missing.map(
      (f) => CONTEXT_FIELD_LABELS[f] ?? f,
    );
    return `Missing required fields for ${SECTION_LABELS[section]}: ${labels.join(', ')}`;
  }

  return null;
}

function validateCrossAnalysisDeps(
  prev: PreviousResearch,
): string | null {
  const needed: (keyof PreviousResearch)[] = [
    'industryMarket',
    'competitors',
    'icpValidation',
    'offerAnalysis',
  ];
  const missing = needed.filter((k) => !prev[k]);

  if (missing.length > 0) {
    const labels = missing.map(
      (k) => SECTION_LABELS[k as SectionName] ?? k,
    );
    return `Cross-analysis requires all 4 prior sections. Missing: ${labels.join(', ')}`;
  }

  return null;
}

// =============================================================================
// Research Dispatcher
// =============================================================================

async function dispatchResearch(
  section: SectionName,
  contextString: string,
  context: Record<string, string | undefined>,
  previousResearch: PreviousResearch,
): Promise<ToolResult> {
  const start = Date.now();

  try {
    let result:
      | IndustryMarketResult
      | CompetitorAnalysisResult
      | ICPAnalysisResult
      | OfferAnalysisResult
      | CrossAnalysisResult;

    switch (section) {
      case 'industryMarket': {
        result = await researchIndustryMarket(contextString);
        break;
      }

      case 'competitors': {
        // Parse competitor names from comma/semicolon separated string
        const rawNames = context.competitors?.trim();
        const fullTierNames = rawNames
          ? rawNames.split(/[,;]+/).map((n) => n.trim()).filter(Boolean)
          : undefined;
        result = await researchCompetitors(contextString, fullTierNames);
        break;
      }

      case 'icpValidation': {
        if (!previousResearch.industryMarket) {
          return {
            section,
            status: 'error',
            error:
              'ICP Validation requires Industry & Market research to be completed first. Run industryMarket before icpValidation.',
            durationMs: Date.now() - start,
          };
        }
        result = await researchICPAnalysis(
          contextString,
          previousResearch.industryMarket.data,
        );
        break;
      }

      case 'offerAnalysis': {
        if (!previousResearch.industryMarket) {
          return {
            section,
            status: 'error',
            error:
              'Offer Analysis requires Industry & Market research to be completed first. Run industryMarket before offerAnalysis.',
            durationMs: Date.now() - start,
          };
        }
        result = await researchOfferAnalysis(
          contextString,
          previousResearch.industryMarket.data,
        );
        break;
      }

      case 'crossAnalysis': {
        const depError = validateCrossAnalysisDeps(previousResearch);
        if (depError) {
          return {
            section,
            status: 'error',
            error: depError,
            durationMs: Date.now() - start,
          };
        }
        result = await synthesizeCrossAnalysis(
          contextString,
          {
            industryMarket: previousResearch.industryMarket!.data,
            icpAnalysis: previousResearch.icpValidation!.data,
            offerAnalysis: previousResearch.offerAnalysis!.data,
            competitorAnalysis: previousResearch.competitors!.data,
          },
          undefined, // keywordData — not available in progressive mode
          undefined, // seoAuditData — not available in progressive mode
        );
        break;
      }
    }

    return {
      section,
      status: 'complete',
      data: result.data,
      sources: result.sources,
      durationMs: Date.now() - start,
      cost: result.cost,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unknown research error';
    console.error(
      `[runResearch] ${SECTION_LABELS[section]} failed:`,
      err,
    );
    return {
      section,
      status: 'error',
      error: message,
      durationMs: Date.now() - start,
    };
  }
}

// =============================================================================
// Tool Factory
// =============================================================================

interface CreateRunResearchToolDeps {
  previousResearch: PreviousResearch;
}

/** Create a runResearch tool instance with prior results injected via closure. */
export function createRunResearchTool(deps: CreateRunResearchToolDeps) {
  const { previousResearch } = deps;

  return tool({
    description:
      'Run a specific research section using the onboarding context collected so far. ' +
      'Sections: industryMarket, competitors, icpValidation, offerAnalysis, crossAnalysis. ' +
      'Some sections depend on prior results: icpValidation and offerAnalysis need industryMarket; ' +
      'crossAnalysis needs all four. The tool returns structured data or an error.',
    inputSchema: researchInputSchema,

    execute: async ({ section, context }) => {
      // Validate required context fields (except crossAnalysis which checks deps)
      if (section !== 'crossAnalysis') {
        const fieldError = validateRequiredFields(
          section,
          context as Record<string, string | undefined>,
        );
        if (fieldError) {
          return {
            section,
            status: 'error' as const,
            error: fieldError,
            durationMs: 0,
          };
        }
      }

      const contextString = buildContextString(
        context as Record<string, string | undefined>,
      );

      return dispatchResearch(
        section,
        contextString,
        context as Record<string, string | undefined>,
        previousResearch,
      );
    },
  });
}

// =============================================================================
// Message History Extraction
// =============================================================================

/**
 * Walk the message array and extract completed runResearch tool outputs.
 * Used by the route handler to rebuild PreviousResearch from message history
 * before creating a new tool instance.
 */
export function extractResearchResults(
  messages: UIMessage[],
): PreviousResearch {
  const results: PreviousResearch = {};

  for (const msg of messages) {
    if (msg.role !== 'assistant') continue;

    for (const part of msg.parts) {
      if (
        typeof part === 'object' &&
        'type' in part &&
        (part as Record<string, unknown>).type === 'tool-runResearch' &&
        (part as Record<string, unknown>).state === 'output-available'
      ) {
        const output = (part as Record<string, unknown>).output as
          | ToolSuccess
          | undefined;

        if (!output || output.status !== 'complete') continue;

        const section = output.section as SectionName;

        switch (section) {
          case 'industryMarket':
            results.industryMarket = {
              data: output.data,
              sources: output.sources,
              cost: output.cost,
              usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
              model: 'extracted-from-history',
            } as IndustryMarketResult;
            break;

          case 'competitors':
            results.competitors = {
              data: output.data,
              sources: output.sources,
              cost: output.cost,
              usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
              model: 'extracted-from-history',
            } as CompetitorAnalysisResult;
            break;

          case 'icpValidation':
            results.icpValidation = {
              data: output.data,
              sources: output.sources,
              cost: output.cost,
              usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
              model: 'extracted-from-history',
            } as ICPAnalysisResult;
            break;

          case 'offerAnalysis':
            results.offerAnalysis = {
              data: output.data,
              sources: output.sources,
              cost: output.cost,
              usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
              model: 'extracted-from-history',
            } as OfferAnalysisResult;
            break;

          case 'crossAnalysis':
            results.crossAnalysis = {
              data: output.data,
              sources: output.sources,
              cost: output.cost,
              usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
              model: 'extracted-from-history',
            } as CrossAnalysisResult;
            break;
        }
      }
    }
  }

  return results;
}
