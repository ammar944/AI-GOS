// Journey State Tracker
// Pure functions over UIMessage[] to derive which onboarding fields are collected
// and which intelligence stages should fire this request.
//
// Builds on extractAskUserResults() from session-state.ts — same message scanning
// pattern, same output shape. No side effects, no I/O.

import type { UIMessage } from 'ai';
import { extractAskUserResults } from '@/lib/journey/session-state';
import { getDownstreamResearchPlan } from '@/lib/ai/journey-downstream-research';

// The required Journey blockers — aligned to the field catalog and pricing context rule.
const REQUIRED_FIELD_REQUIREMENTS = [
  ['businessModel'],
  ['primaryIcpDescription'],
  ['productDescription'],
  ['topCompetitors'],
  ['pricingTiers', 'monthlyAdBudget'],
  ['goals'],
  ['uniqueEdge'],
] as const;

export interface JourneyStateSnapshot {
  /** All collected fields (required + optional), raw values from askUser outputs */
  collectedFields: Record<string, unknown>;
  /** True when synthesizeResearch has a completed output-available part in messages */
  synthComplete: boolean;
  /** True when researchKeywords has completed successfully */
  keywordResearchComplete: boolean;
  /** True when researchMediaPlan has completed successfully */
  mediaPlanComplete: boolean;
  /** True when synthesis + keyword intel are complete and Strategist Mode can begin */
  strategistModeReady: boolean;
  /** Count of the 7 required Journey blocker requirements that have non-empty values (0-7) */
  requiredFieldCount: number;
  /** Domains for which competitorFastHits has already been called (or is in-flight). */
  competitorFastHitsCalledFor: Set<string>;
}

const PREFILL_PREFIX = "Here's what I found about the company:";

const PREFILL_LABEL_TO_FIELD: Record<string, string> = {
  'Company Name': 'companyName',
  'Website': 'websiteUrl',
  'Business Model': 'businessModel',
  'Industry Vertical': 'industryVertical',
  'Ideal Customer Profile': 'primaryIcpDescription',
  'Target Job Titles': 'jobTitles',
  'Company Size': 'companySize',
  'Geographic Focus': 'geography',
  Headquarters: 'headquartersLocation',
  'Product Description': 'productDescription',
  'Core Deliverables': 'coreDeliverables',
  'Pricing Tiers': 'pricingTiers',
  'Monthly Ad Budget': 'monthlyAdBudget',
  'Value Proposition': 'valueProp',
  Guarantees: 'guarantees',
  'Top Competitors': 'topCompetitors',
  'Unique Edge': 'uniqueEdge',
  Goals: 'goals',
  'Market Problem': 'marketProblem',
  'Before State': 'situationBeforeBuying',
  'Desired Transformation': 'desiredTransformation',
  'Common Objections': 'commonObjections',
  'Brand Positioning': 'brandPositioning',
  'Testimonial Quote': 'testimonialQuote',
  'Pricing URL': 'pricingUrl',
  'Case Studies URL': 'caseStudiesUrl',
  'Testimonials URL': 'testimonialsUrl',
  'Demo URL': 'demoUrl',
};

/** Returns true if a value counts as "collected" (non-null, non-empty). */
function isCollected(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function parseToolOutput(output: unknown): Record<string, unknown> | null {
  if (typeof output === 'string') {
    try {
      const parsed = JSON.parse(output) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : null;
    } catch {
      return null;
    }
  }

  return output && typeof output === 'object' && !Array.isArray(output)
    ? output as Record<string, unknown>
    : null;
}

/**
 * Scan messages for a completed synthesizeResearch tool output.
 * Mirrors the pattern in extractResearchOutputs() in session-state.ts:
 * look for assistant parts with type 'tool-synthesizeResearch' and
 * state 'output-available'.
 */
function hasCompletedToolOutput(
  messages: UIMessage[],
  toolName: string,
): boolean {
  for (const msg of messages) {
    if (msg.role !== 'assistant') continue;
    for (const part of msg.parts) {
      if (typeof part !== 'object' || !part) continue;
      const p = part as Record<string, unknown>;
      if (
        p.type === `tool-${toolName}` &&
        p.state === 'output-available'
      ) {
        const output = parseToolOutput(p.output);
        if (!output || output.status === 'complete') {
          return true;
        }
      }
    }
  }
  return false;
}

/** Scan message history for competitorFastHits calls. Returns set of called domains. */
function detectCompetitorFastHitsCalled(messages: UIMessage[]): Set<string> {
  const called = new Set<string>();
  for (const msg of messages) {
    if (msg.role !== 'assistant') continue;
    for (const part of msg.parts) {
      if (typeof part !== 'object' || !part) continue;
      const p = part as Record<string, unknown>;
      if (p.type !== 'tool-competitorFastHits') continue;
      // Capture both in-flight and completed calls
      if (p.state !== 'output-available' && p.state !== 'input-available') continue;
      const input = p.input as Record<string, unknown> | undefined;
      if (typeof input?.competitorUrl === 'string') {
        called.add(input.competitorUrl.toLowerCase());
      }
    }
  }
  return called;
}

function extractAcceptedPrefillFields(messages: UIMessage[]): Record<string, unknown> {
  const fields: Record<string, unknown> = {};

  for (const msg of messages) {
    if (msg.role !== 'user') continue;

    const text = msg.parts
      .filter(
        (part): part is { type: 'text'; text: string } =>
          typeof part === 'object' && part !== null && (part as { type?: string }).type === 'text',
      )
      .map((part) => part.text)
      .join('\n')
      .trim();

    if (!text.startsWith(PREFILL_PREFIX)) {
      continue;
    }

    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === PREFILL_PREFIX || !trimmed.includes(':')) {
        continue;
      }

      const separatorIndex = trimmed.indexOf(':');
      const label = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();
      const fieldName = PREFILL_LABEL_TO_FIELD[label];
      if (!fieldName || value.length === 0) {
        continue;
      }

      fields[fieldName] = value;
    }
  }

  return fields;
}

/**
 * Derive a typed snapshot of onboarding progress from the full message history.
 *
 * Pure function — no side effects.
 * Call once per POST in route.ts, before streamText.
 */
export function parseCollectedFields(messages: UIMessage[]): JourneyStateSnapshot {
  const collectedFields = {
    ...extractAcceptedPrefillFields(messages),
    ...extractAskUserResults(messages),
  };

  const requiredFieldCount = REQUIRED_FIELD_REQUIREMENTS.filter((requirement) =>
    requirement.some((fieldKey) => isCollected(collectedFields[fieldKey])),
  ).length;

  const synthComplete = hasCompletedToolOutput(messages, 'synthesizeResearch');
  const keywordResearchComplete = hasCompletedToolOutput(
    messages,
    'researchKeywords',
  );
  const mediaPlanComplete = hasCompletedToolOutput(
    messages,
    'researchMediaPlan',
  );
  const competitorFastHitsCalledFor = detectCompetitorFastHitsCalled(messages);
  const strategistModeReady = getDownstreamResearchPlan({
    synthesisStarted: synthComplete,
    synthesisComplete: synthComplete,
    keywordResearchStarted: keywordResearchComplete,
    keywordResearchComplete,
    mediaPlanStarted: mediaPlanComplete,
    mediaPlanComplete,
  }).strategistModeReady;

  return {
    collectedFields,
    synthComplete,
    keywordResearchComplete,
    mediaPlanComplete,
    strategistModeReady,
    requiredFieldCount,
    competitorFastHitsCalledFor,
  };
}

// ── Phase Definitions ─────────────────────────────────────────────────────
// Maps the 6 conversational phases to the fields they require.

interface PhaseDefinition {
  phase: number;
  name: string;
  /** At least one of these must be collected to consider the phase "started" */
  primaryFields: string[];
  /** Additional fields in this phase (not all required) */
  secondaryFields: string[];
  /** Minimum secondary fields needed (in addition to at least one primary) */
  minSecondary: number;
}

const PHASE_DEFINITIONS: PhaseDefinition[] = [
  {
    phase: 1,
    name: 'Discovery',
    primaryFields: ['companyName', 'websiteUrl'],
    secondaryFields: ['businessModel'],
    minSecondary: 1,
  },
  {
    phase: 2,
    name: 'ICP Deep Dive',
    primaryFields: ['primaryIcpDescription'],
    secondaryFields: [
      'industryVertical',
      'jobTitles',
      'companySize',
      'geography',
      'easiestToClose',
      'buyingTriggers',
      'bestClientSources',
    ],
    minSecondary: 2,
  },
  {
    phase: 3,
    name: 'Product & Offer',
    primaryFields: ['productDescription'],
    secondaryFields: [
      'coreDeliverables',
      'pricingTiers',
      'valueProp',
      'currentFunnelType',
    ],
    minSecondary: 1,
  },
  {
    phase: 4,
    name: 'Competitive Landscape',
    primaryFields: ['topCompetitors'],
    secondaryFields: [
      'uniqueEdge',
      'competitorFrustrations',
      'marketBottlenecks',
    ],
    minSecondary: 1,
  },
  {
    phase: 5,
    name: 'Customer Journey',
    primaryFields: [
      'situationBeforeBuying',
      'desiredTransformation',
      'commonObjections',
      'salesCycleLength',
    ],
    secondaryFields: ['salesProcessOverview'],
    minSecondary: 0,
  },
  {
    phase: 6,
    name: 'Brand & Budget',
    primaryFields: ['monthlyAdBudget'],
    secondaryFields: [
      'goals',
      'brandPositioning',
      'campaignDuration',
      'targetCpl',
      'targetCac',
    ],
    minSecondary: 0,
  },
];

export interface OnboardingProgress {
  /** Current phase number (1-6) based on which fields are collected */
  phase: number;
  /** Human-readable name of the current phase */
  phaseName: string;
  /** All field names that have been collected so far */
  completedFields: string[];
  /** Fields the agent should ask about next (from current + next phases) */
  nextFields: string[];
  /** True when Phase 1 is complete (businessModel + industryVertical/primaryIcpDescription) */
  readyForResearch: boolean;
  /** True when all required Journey blocker requirements are collected */
  readyForCompletion: boolean;
}

function isPhaseComplete(
  def: PhaseDefinition,
  fields: Record<string, unknown>,
): boolean {
  const hasPrimary = def.primaryFields.some((f) => isCollected(fields[f]));
  if (!hasPrimary) return false;
  const secondaryCount = def.secondaryFields.filter((f) =>
    isCollected(fields[f]),
  ).length;
  return secondaryCount >= def.minSecondary;
}

/**
 * Derive high-level onboarding progress from collected fields.
 *
 * Maps the flat field bag to the 6-phase conversation flow defined in
 * the lead agent prompt, returning the current phase, completed fields,
 * and what to ask next.
 */
export function getOnboardingProgress(
  snapshot: JourneyStateSnapshot,
): OnboardingProgress {
  const fields = snapshot.collectedFields;

  // Collect all field names that have values
  const allPhaseFields = PHASE_DEFINITIONS.flatMap((d) => [
    ...d.primaryFields,
    ...d.secondaryFields,
  ]);
  const completedFields = allPhaseFields.filter((f) => isCollected(fields[f]));

  // Find current phase (first incomplete phase)
  let currentPhase = 6;
  let currentPhaseName = 'Brand & Budget';
  for (const def of PHASE_DEFINITIONS) {
    if (!isPhaseComplete(def, fields)) {
      currentPhase = def.phase;
      currentPhaseName = def.name;
      break;
    }
  }

  // Next fields: uncollected fields from current phase + next phase
  const nextFields: string[] = [];
  for (const def of PHASE_DEFINITIONS) {
    if (def.phase < currentPhase) continue;
    if (def.phase > currentPhase + 1) break;
    for (const f of [...def.primaryFields, ...def.secondaryFields]) {
      if (!isCollected(fields[f])) nextFields.push(f);
    }
  }

  // readyForResearch: businessModel collected + either industryVertical or primaryIcpDescription
  const readyForResearch =
    isCollected(fields['businessModel']) &&
    (isCollected(fields['industryVertical']) ||
      isCollected(fields['primaryIcpDescription']));

  // readyForCompletion: all required Journey blockers collected
  const readyForCompletion = REQUIRED_FIELD_REQUIREMENTS.every((requirement) =>
    requirement.some((fieldKey) => isCollected(fields[fieldKey])),
  );

  return {
    phase: currentPhase,
    phaseName: currentPhaseName,
    completedFields,
    nextFields,
    readyForResearch,
    readyForCompletion,
  };
}
