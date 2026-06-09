import { NextResponse } from 'next/server';

import type { AllPositioningSectionId } from '@/lib/ai/prompts/positioning-skills';
import { checkSectionModelDispatchPreflight } from '@/lib/lab-engine/ai/models';

/**
 * Shared lab-section provider preflight wrapper. Triplicated verbatim across the
 * run-lab-section / rerun-section / orchestrate dispatch routes (modulo the log
 * tag and orchestrate having no sectionId). Returns a 500 NextResponse when the
 * section-model provider is misconfigured, or null when dispatch may proceed.
 */
export function buildLabSectionProviderPreflightResponse({
  runId,
  sectionId,
  logTag,
}: {
  runId: string;
  sectionId?: AllPositioningSectionId;
  logTag: string;
}): NextResponse | null {
  const preflight = checkSectionModelDispatchPreflight();

  if (preflight.ok) {
    return null;
  }

  console.error(`${logTag} lab section provider preflight failed`, {
    runId,
    ...(sectionId !== undefined ? { sectionId } : {}),
    error: preflight.error,
    missingEnv: preflight.missingEnv,
    provider: preflight.provider,
  });

  return NextResponse.json(
    {
      error: 'lab_engine_provider_preflight_failed',
      message: preflight.message,
      missingEnv: preflight.missingEnv,
      provider: preflight.provider ?? null,
    },
    { status: 500 },
  );
}
