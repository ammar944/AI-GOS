import { NextResponse } from 'next/server';

import {
  POSITIONING_SECTION_IDS,
  type PositioningSectionId,
} from '@/lib/ai/prompts/positioning-skills';
import {
  researchInputSchema,
  type ResearchInput,
} from '@/lib/lab-engine/artifacts/artifact-envelope';
import {
  evaluateResearchEvidenceReadiness,
  type ResearchEvidenceReadinessRow,
} from '@/lib/research-v2/research-evidence-readiness';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * Server-only. Loads the committed positioning-section artifacts for a parent
 * audit run and projects them into a ResearchInput for capstone / paid-media
 * dispatch. Extracted from the run-lab-section and rerun-section routes, which
 * carried logic-identical copies. Returns a discriminated union — call sites
 * branch on `response.status === 409` (positioning sections not yet ready), so
 * preserve the shape exactly. Do NOT import from client code.
 */
export function isCommittedPositioningArtifactRow(
  row: ResearchEvidenceReadinessRow,
): row is ResearchEvidenceReadinessRow & {
  zone: PositioningSectionId;
  data: unknown;
} {
  return (POSITIONING_SECTION_IDS as readonly string[]).includes(row.zone ?? '');
}

export async function buildCommittedArtifactsResearchInput({
  baseResearchInput,
  parentAuditRunId,
  supabase,
}: {
  baseResearchInput: ResearchInput;
  parentAuditRunId: string;
  supabase: ReturnType<typeof createAdminClient>;
}): Promise<
  | { ok: true; researchInput: ResearchInput }
  | { ok: false; response: NextResponse }
> {
  const { data, error } = await supabase
    .from('research_artifact_sections')
    .select('zone, data, markdown, verification_tier, verification_flag')
    .eq('artifact_id', parentAuditRunId)
    .eq('status', 'complete')
    .in('zone', POSITIONING_SECTION_IDS);

  if (error) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'committed_artifacts_lookup_failed',
          message: error.message,
        },
        { status: 500 },
      ),
    };
  }

  const artifactRows = (data ?? []) as ResearchEvidenceReadinessRow[];
  const rows = artifactRows.filter(isCommittedPositioningArtifactRow);
  const committedPositioningArtifacts = Object.fromEntries(
    rows.map((row) => [row.zone, row.data]),
  ) as Partial<Record<PositioningSectionId, unknown>>;
  const committedPositioningSectionMarkdown = Object.fromEntries(
    rows
      .filter((row) => typeof row.markdown === 'string')
      .map((row) => [row.zone, row.markdown]),
  ) as Partial<Record<PositioningSectionId, string>>;
  const missingSections = POSITIONING_SECTION_IDS.filter(
    (sectionId) => committedPositioningArtifacts[sectionId] === undefined,
  );

  if (missingSections.length > 0) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'positioning_sections_not_ready',
          missing_sections: missingSections,
        },
        { status: 409 },
      ),
    };
  }

  // ARI: readiness is a COVERAGE annotation, never a gate. Paid-media dispatch on
  // 6/6 and capstone reruns both proceed regardless of section quality; thin
  // sections are badged needs_review at commit.
  const readiness = evaluateResearchEvidenceReadiness(artifactRows);

  return {
    ok: true,
    researchInput: researchInputSchema.parse({
      ...baseResearchInput,
      committedPositioningArtifacts,
      committedPositioningSectionMarkdown,
      evidenceCoverage: {
        ready: readiness.ready,
        blockedSections: readiness.blockedSections,
        reasons: readiness.reasons,
      },
    }),
  };
}
