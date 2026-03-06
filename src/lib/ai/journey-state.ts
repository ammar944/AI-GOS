// Journey State Tracker
// Pure functions over UIMessage[] to derive which onboarding fields are collected
// and which intelligence stages should fire this request.
//
// Builds on extractAskUserResults() from session-state.ts — same message scanning
// pattern, same output shape. No side effects, no I/O.

import type { UIMessage } from 'ai';
import { extractAskUserResults } from '@/lib/journey/session-state';

// The required onboarding fields — minimum needed to build a strategy
const REQUIRED_FIELDS = [
  'websiteUrl',
  'businessModel',
  'primaryIcpDescription',
  'productDescription',
  'topCompetitors',
  'monthlyAdBudget',
  'goals',
] as const;

type RequiredField = (typeof REQUIRED_FIELDS)[number];

export interface JourneyStateSnapshot {
  /** All collected fields (required + optional), raw values from askUser outputs */
  collectedFields: Record<string, unknown>;
  /** True when synthesizeResearch has a completed output-available part in messages */
  synthComplete: boolean;
  /** Count of the 7 required fields that have non-empty values (0-7) */
  requiredFieldCount: number;
  /** Domains for which competitorFastHits has already been called (or is in-flight). */
  competitorFastHitsCalledFor: Set<string>;
}

/** Returns true if a value counts as "collected" (non-null, non-empty). */
function isCollected(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/**
 * Scan messages for a completed synthesizeResearch tool output.
 * Mirrors the pattern in extractResearchOutputs() in session-state.ts:
 * look for assistant parts with type 'tool-synthesizeResearch' and
 * state 'output-available'.
 */
function detectSynthComplete(messages: UIMessage[]): boolean {
  for (const msg of messages) {
    if (msg.role !== 'assistant') continue;
    for (const part of msg.parts) {
      if (typeof part !== 'object' || !part) continue;
      const p = part as Record<string, unknown>;
      if (
        p.type === 'tool-synthesizeResearch' &&
        p.state === 'output-available'
      ) {
        return true;
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

/**
 * Derive a typed snapshot of onboarding progress from the full message history.
 *
 * Pure function — no side effects.
 * Call once per POST in route.ts, before streamText.
 */
export function parseCollectedFields(messages: UIMessage[]): JourneyStateSnapshot {
  const collectedFields = extractAskUserResults(messages);

  const requiredFieldCount = REQUIRED_FIELDS.filter((f: RequiredField) =>
    isCollected(collectedFields[f])
  ).length;

  const synthComplete = detectSynthComplete(messages);
  const competitorFastHitsCalledFor = detectCompetitorFastHitsCalled(messages);

  return {
    collectedFields,
    synthComplete,
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
  /** True when all 7 REQUIRED_FIELDS are collected */
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

  // readyForCompletion: all 7 REQUIRED_FIELDS collected
  const readyForCompletion = REQUIRED_FIELDS.every((f) =>
    isCollected(fields[f]),
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
