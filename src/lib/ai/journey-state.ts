// Journey State Tracker
// Pure functions over UIMessage[] to derive which onboarding fields are collected
// and which intelligence stages should fire this request.
//
// Builds on extractAskUserResults() from session-state.ts — same message scanning
// pattern, same output shape. No side effects, no I/O.

import type { UIMessage } from 'ai';
import { extractAskUserResults } from '@/lib/journey/session-state';

// The 8 required onboarding fields in collection order
const REQUIRED_FIELDS = [
  'businessModel',
  'industry',
  'icpDescription',
  'productDescription',
  'competitors',
  'offerPricing',
  'marketingChannels',
  'goals',
] as const;

type RequiredField = (typeof REQUIRED_FIELDS)[number];

export interface JourneyStateSnapshot {
  /** All collected fields (required + optional), raw values from askUser outputs */
  collectedFields: Record<string, unknown>;
  /** True when businessModel has a non-empty value */
  hasBusinessModel: boolean;
  /** True when industry has a non-empty value */
  hasIndustry: boolean;
  /** True when both businessModel AND industry are collected — Stage 1 trigger */
  shouldFireStage1: boolean;
  /** True when synthesizeResearch has a completed output-available part in messages */
  synthComplete: boolean;
  /** Count of the 8 required fields that have non-empty values (0-8) */
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

  const hasBusinessModel = isCollected(collectedFields['businessModel']);
  const hasIndustry = isCollected(collectedFields['industry']);
  const shouldFireStage1 = hasBusinessModel && hasIndustry;

  const requiredFieldCount = REQUIRED_FIELDS.filter((f: RequiredField) =>
    isCollected(collectedFields[f])
  ).length;

  const synthComplete = detectSynthComplete(messages);
  const competitorFastHitsCalledFor = detectCompetitorFastHitsCalled(messages);

  return {
    collectedFields,
    hasBusinessModel,
    hasIndustry,
    shouldFireStage1,
    synthComplete,
    requiredFieldCount,
    competitorFastHitsCalledFor,
  };
}
