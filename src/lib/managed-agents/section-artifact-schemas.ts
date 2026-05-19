// Section artifact schema registry for the Managed Agents path.
//
// This module is the Next.js-side mirror of the worker section artifact
// schemas. The Next.js process MUST NOT import from research-worker/ — the
// schemas under ./schemas/ duplicate research-worker/src/agents/subagents/
// schemas/. Schema evolution must update BOTH locations.
//
// Used by:
//   - src/app/api/webhooks/managed-agents/route.ts (validates artifacts
//     committed via save_section_artifact custom-tool calls).
//   - scripts/managed-agents-section-canary.mjs (Phase 1 canary).

import type { z } from 'zod';

import type { PositioningSectionId } from '@/lib/ai/prompts/positioning-skills';

import type { ValidationResult } from './schemas/_shared';

import {
  MarketCategoryArtifactSchema,
  validateMarketCategoryMinimums,
  type MarketCategoryArtifact,
} from './schemas/market-category';
import {
  BuyerICPArtifactSchema,
  validateBuyerICPMinimums,
  type BuyerICPArtifact,
} from './schemas/buyer-icp';
import {
  CompetitorLandscapeArtifactSchema,
  validateCompetitorLandscapeMinimums,
  type CompetitorLandscapeArtifact,
} from './schemas/competitor-landscape';
import {
  VoiceOfCustomerArtifactSchema,
  validateVoiceOfCustomerMinimums,
  type VoiceOfCustomerArtifact,
} from './schemas/voc-objection-evidence';
import {
  DemandIntentArtifactSchema,
  validateDemandIntentMinimums,
  type DemandIntentArtifact,
} from './schemas/demand-intent-signals';
import {
  OfferPerformanceArtifactSchema,
  validateOfferPerformanceMinimums,
  type OfferPerformanceArtifact,
} from './schemas/offer-performance-diagnostic';

export type SectionArtifact =
  | MarketCategoryArtifact
  | BuyerICPArtifact
  | CompetitorLandscapeArtifact
  | VoiceOfCustomerArtifact
  | DemandIntentArtifact
  | OfferPerformanceArtifact;

export interface SectionArtifactSchemaEntry {
  /** Display label for diagnostics; matches the SKILL.md heading. */
  readonly label: string;
  /** Tool name the specialist agent must call to submit this section. */
  readonly toolName: string;
  /** Zod schema mirrored from the worker side. */
  readonly schema: z.ZodTypeAny;
  /**
   * Business minimum validator (cardinality, source coverage, confidence
   * range, etc.). Provider structured-output schemas reject Zod cardinality
   * constraints, so these checks live outside the Zod schema.
   */
  readonly validateMinimums: (artifact: unknown) => ValidationResult;
}

const SECTION_ARTIFACT_SCHEMAS: Record<PositioningSectionId, SectionArtifactSchemaEntry> = {
  positioningMarketCategory: {
    label: 'Market & Category Intelligence',
    toolName: 'save_market_category_artifact',
    schema: MarketCategoryArtifactSchema,
    validateMinimums: (artifact) =>
      validateMarketCategoryMinimums(artifact as MarketCategoryArtifact),
  },
  positioningBuyerICP: {
    label: 'Buyer & ICP Validation',
    toolName: 'save_buyer_icp_artifact',
    schema: BuyerICPArtifactSchema,
    validateMinimums: (artifact) =>
      validateBuyerICPMinimums(artifact as BuyerICPArtifact),
  },
  positioningCompetitorLandscape: {
    label: 'Competitor Landscape & Positioning',
    toolName: 'save_competitor_landscape_artifact',
    schema: CompetitorLandscapeArtifactSchema,
    validateMinimums: (artifact) =>
      validateCompetitorLandscapeMinimums(artifact as CompetitorLandscapeArtifact),
  },
  positioningVoiceOfCustomer: {
    label: 'Voice of Customer & Objection Evidence',
    toolName: 'save_voice_of_customer_artifact',
    schema: VoiceOfCustomerArtifactSchema,
    validateMinimums: (artifact) =>
      validateVoiceOfCustomerMinimums(artifact as VoiceOfCustomerArtifact),
  },
  positioningDemandIntent: {
    label: 'Demand & Intent Signals',
    toolName: 'save_demand_intent_artifact',
    schema: DemandIntentArtifactSchema,
    validateMinimums: (artifact) =>
      validateDemandIntentMinimums(artifact as DemandIntentArtifact),
  },
  positioningOfferDiagnostic: {
    label: 'Offer & Performance Diagnostic',
    toolName: 'save_offer_diagnostic_artifact',
    schema: OfferPerformanceArtifactSchema,
    validateMinimums: (artifact) =>
      validateOfferPerformanceMinimums(artifact as OfferPerformanceArtifact),
  },
};

export const sectionArtifactSchemas: Readonly<
  Record<PositioningSectionId, SectionArtifactSchemaEntry>
> = SECTION_ARTIFACT_SCHEMAS;

/**
 * Reverse lookup: given a custom-tool name (the one the agent invokes) return
 * the corresponding section ID. Used by the webhook handler to route
 * agent.custom_tool_use events.
 */
const TOOL_NAME_TO_SECTION_ID: Record<string, PositioningSectionId> = Object.fromEntries(
  (Object.entries(SECTION_ARTIFACT_SCHEMAS) as ReadonlyArray<
    [PositioningSectionId, SectionArtifactSchemaEntry]
  >).map(([sectionId, entry]) => [entry.toolName, sectionId]),
);

export function sectionIdForToolName(
  toolName: string,
): PositioningSectionId | null {
  return TOOL_NAME_TO_SECTION_ID[toolName] ?? null;
}

export interface ArtifactValidationOk<T = unknown> {
  ok: true;
  artifact: T;
}

export interface ArtifactValidationError {
  ok: false;
  schemaErrors: readonly string[];
  minimumsErrors: readonly string[];
  repairFeedback: string;
}

export type ArtifactValidation<T = unknown> =
  | ArtifactValidationOk<T>
  | ArtifactValidationError;

/**
 * Validates an artifact against the mirrored Zod schema and minimum
 * validator. Returns repair_feedback the agent can use to fix its output
 * (R5 hard-rule semantics).
 */
export function validateArtifactForSection(
  sectionId: PositioningSectionId,
  artifact: unknown,
): ArtifactValidation {
  const entry = sectionArtifactSchemas[sectionId];
  if (!entry) {
    return {
      ok: false,
      schemaErrors: [`Unknown section id: ${sectionId}`],
      minimumsErrors: [],
      repairFeedback: `Unknown section id: ${sectionId}.`,
    };
  }

  const parsed = entry.schema.safeParse(artifact);
  if (!parsed.success) {
    const schemaErrors = parsed.error.issues
      .slice(0, 24)
      .map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join('.') : '<root>';
        return `${path}: ${issue.message}`;
      });
    return {
      ok: false,
      schemaErrors,
      minimumsErrors: [],
      repairFeedback: [
        `Schema validation failed for ${entry.label}. Keep the exact artifact shape and patch these paths:`,
        ...schemaErrors,
      ].join('\n'),
    };
  }

  const minimums = entry.validateMinimums(parsed.data);
  if (!minimums.ok) {
    return {
      ok: false,
      schemaErrors: [],
      minimumsErrors: minimums.errors,
      repairFeedback: [
        `Business minimum validation failed for ${entry.label}. Keep the schema-valid shape and add evidence to satisfy these minimums:`,
        ...minimums.errors,
      ].join('\n'),
    };
  }

  return { ok: true, artifact: parsed.data };
}

export type { ValidationResult } from './schemas/_shared';
export type {
  MarketCategoryArtifact,
  BuyerICPArtifact,
  CompetitorLandscapeArtifact,
  VoiceOfCustomerArtifact,
  DemandIntentArtifact,
  OfferPerformanceArtifact,
};
