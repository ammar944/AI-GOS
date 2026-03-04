// src/lib/journey/research-readiness.ts
// Polls Supabase for research section completion before synthesis is dispatched.
// Server-only — imports createAdminClient from @/lib/supabase/server.

import { createAdminClient } from '@/lib/supabase/server';

export const SYNTHESIS_PREREQUISITES = [
  'industryMarket',
  'competitors',
  'icpValidation',
  'offerAnalysis',
] as const;

export type PrerequisiteSection = (typeof SYNTHESIS_PREREQUISITES)[number];

export interface ReadinessResult {
  ready: boolean;
  timedOut: boolean;
  completedSections: PrerequisiteSection[];
  missingSections: PrerequisiteSection[];
}

export interface ReadinessOptions {
  pollIntervalMs?: number; // default: 30_000 (30s)
  timeoutMs?: number;      // default: 300_000 (5 min)
}

/**
 * Polls journey_sessions.research_results until all 4 synthesis prerequisites
 * have status: 'complete', or until the timeout elapses.
 *
 * If the timeout elapses, resolves with timedOut: true so the caller can
 * proceed with whatever data is available rather than blocking indefinitely.
 */
export async function waitForResearchReadiness(
  userId: string,
  options: ReadinessOptions = {},
): Promise<ReadinessResult> {
  const {
    pollIntervalMs = 30_000,
    timeoutMs = 300_000,
  } = options;

  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const result = await checkReadiness(userId);

    if (result.ready) return result;

    const remaining = deadline - Date.now();
    if (remaining <= 0) break;

    await new Promise((resolve) => setTimeout(resolve, Math.min(pollIntervalMs, remaining)));
  }

  // Final check after timeout — return whatever state we have
  const finalResult = await checkReadiness(userId);
  return { ...finalResult, timedOut: !finalResult.ready };
}

async function checkReadiness(userId: string): Promise<ReadinessResult> {
  const supabase = createAdminClient();

  const { data: session, error } = await supabase
    .from('journey_sessions')
    .select('research_results')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !session) {
    return {
      ready: false,
      timedOut: false,
      completedSections: [],
      missingSections: [...SYNTHESIS_PREREQUISITES],
    };
  }

  const results = (session.research_results as Record<string, { status: string }>) ?? {};

  const completedSections = SYNTHESIS_PREREQUISITES.filter(
    (section) => results[section]?.status === 'complete',
  );
  const missingSections = SYNTHESIS_PREREQUISITES.filter(
    (section) => results[section]?.status !== 'complete',
  );

  return {
    ready: missingSections.length === 0,
    timedOut: false,
    completedSections,
    missingSections,
  };
}
