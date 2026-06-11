import { after, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

import {
  ALL_POSITIONING_SECTION_IDS,
  ALL_POSITIONING_SECTION_LABELS,
  isAllPositioningSectionId,
  PAID_MEDIA_PLAN_SECTION_ID,
} from '@/lib/ai/prompts/positioning-skills';
import { extractCrossSectionFactConflictsFromLedger } from '@/lib/lab-engine/agents/cross-section-facts';
import {
  runExecutiveBrief,
  type ExecutiveBriefSectionInput,
} from '@/lib/lab-engine/agents/executive-brief';
import { findContradictions } from '@/lib/lab-engine/agents/synthesis/contradictions';
import {
  buildFactLedger,
  type SynthesisSectionInput,
} from '@/lib/lab-engine/agents/synthesis/fact-ledger';
import {
  auditPaidMediaFeasibility,
  type PaidMediaFeasibilityAudit,
} from '@/lib/lab-engine/agents/synthesis/feasibility';
import { createAdminClient } from '@/lib/supabase/server';

// W3 executive brief (detached, mirrors review-section ADR-0012 shape): the
// paid-media commit path POSTs a small kickoff payload here and awaits only
// the 202 ACK; the brief itself — load the seven committed bodies, run the
// deterministic cross-section fact pre-pass, write the pro-penned brief into
// research_artifacts.thesis — runs in after() on THIS invocation's clock, so
// it can never blow the section job's watchdog. Failure writes an error
// status into thesis and never blocks anything.
export const runtime = 'nodejs';
export const maxDuration = 180;

const internalKeyHeader = 'x-internal-key';

const RequestSchema = z.object({
  userId: z.string().min(1),
  runId: z.string().min(1),
  parentAuditRunId: z.string().min(1),
  companyName: z.string().min(1),
  companyWebsiteUrl: z.string().min(1),
});

interface SectionRow {
  zone: string | null;
  status: string | null;
  data: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toBriefSectionInput(row: SectionRow): ExecutiveBriefSectionInput | null {
  if (!isAllPositioningSectionId(row.zone) || !isRecord(row.data)) {
    return null;
  }

  const envelope = row.data;
  const body = isRecord(envelope.body) ? envelope.body : {};

  return {
    body,
    sectionId: row.zone,
    sectionTitle:
      typeof envelope.sectionTitle === 'string'
        ? envelope.sectionTitle
        : ALL_POSITIONING_SECTION_LABELS[row.zone],
    statusSummary:
      typeof envelope.statusSummary === 'string' ? envelope.statusSummary : '',
    verdict: typeof envelope.verdict === 'string' ? envelope.verdict : '',
  };
}

function toSynthesisSectionInput(row: SectionRow): SynthesisSectionInput | null {
  if (!isAllPositioningSectionId(row.zone) || !isRecord(row.data)) {
    return null;
  }

  const envelope = row.data;
  const body = isRecord(envelope.body) ? envelope.body : {};

  return {
    body,
    review: isRecord(envelope.review) ? envelope.review : undefined,
    sectionId: row.zone,
    sectionTitle:
      typeof envelope.sectionTitle === 'string'
        ? envelope.sectionTitle
        : ALL_POSITIONING_SECTION_LABELS[row.zone],
    statusSummary:
      typeof envelope.statusSummary === 'string' ? envelope.statusSummary : '',
    verdict: typeof envelope.verdict === 'string' ? envelope.verdict : '',
    verifierSummary: isRecord(envelope.verifierSummary)
      ? envelope.verifierSummary
      : undefined,
  };
}

async function persistPaidMediaFeasibility({
  feasibilityAudit,
  parentAuditRunId,
  rows,
  supabase,
}: {
  feasibilityAudit: PaidMediaFeasibilityAudit;
  parentAuditRunId: string;
  rows: readonly SectionRow[];
  supabase: ReturnType<typeof createAdminClient>;
}): Promise<void> {
  const paidMediaRow = rows.find(
    (row) => row.zone === PAID_MEDIA_PLAN_SECTION_ID,
  );
  const paidMediaData = paidMediaRow?.data;

  if (!isRecord(paidMediaData) || !isRecord(paidMediaData.body)) {
    return;
  }

  const nextData = {
    ...paidMediaData,
    body: {
      ...paidMediaData.body,
      feasibilityAudit,
    },
  };
  const { error } = await supabase
    .from('research_artifact_sections')
    .update({ data: nextData })
    .eq('artifact_id', parentAuditRunId)
    .eq('zone', PAID_MEDIA_PLAN_SECTION_ID);

  if (error) {
    console.error('[executive-brief] paid-media feasibility write failed', {
      message: error.message,
      parentAuditRunId,
    });
  }
}

async function generateExecutiveBrief(
  payload: z.infer<typeof RequestSchema>,
): Promise<void> {
  const supabase = createAdminClient();
  const writeThesis = async (thesis: Record<string, unknown>): Promise<void> => {
    const { error } = await supabase
      .from('research_artifacts')
      .update({ thesis })
      .eq('id', payload.parentAuditRunId)
      .eq('user_id', payload.userId);

    if (error) {
      console.error('[executive-brief] thesis write failed', {
        message: error.message,
        parentAuditRunId: payload.parentAuditRunId,
      });
    }
  };

  await writeThesis({
    claimedAt: new Date().toISOString(),
    status: 'generating',
  });

  try {
    const { data, error } = await supabase
      .from('research_artifact_sections')
      .select('zone, status, data')
      .eq('artifact_id', payload.parentAuditRunId)
      .eq('status', 'complete')
      .in('zone', [...ALL_POSITIONING_SECTION_IDS]);

    if (error) {
      throw new Error(`section load failed: ${error.message}`);
    }

    const rows = (data ?? []) as SectionRow[];
    const sections = rows
      .map(toBriefSectionInput)
      .filter((section): section is ExecutiveBriefSectionInput => section !== null);
    const synthesisSections = rows
      .map(toSynthesisSectionInput)
      .filter((section): section is SynthesisSectionInput => section !== null);

    if (sections.length === 0) {
      throw new Error(
        'expected at least one committed section for executive brief, found 0',
      );
    }

    const factLedger = buildFactLedger({
      requiredSectionIds: [...ALL_POSITIONING_SECTION_IDS],
      sections: synthesisSections,
      subjectName: payload.companyName,
      subjectWebsiteUrl: payload.companyWebsiteUrl,
    });
    const conflicts = extractCrossSectionFactConflictsFromLedger(factLedger);
    const contradictions = findContradictions({
      ledger: factLedger,
      sections: synthesisSections,
    });
    const paidMediaSection = synthesisSections.find(
      (section) => section.sectionId === PAID_MEDIA_PLAN_SECTION_ID,
    );
    const feasibilityAudit = auditPaidMediaFeasibility({
      factLedger,
      paidMediaBody: paidMediaSection?.body,
    });

    await persistPaidMediaFeasibility({
      feasibilityAudit,
      parentAuditRunId: payload.parentAuditRunId,
      rows,
      supabase,
    });

    const startedAt = Date.now();
    const brief = await runExecutiveBrief({
      companyName: payload.companyName,
      companyWebsiteUrl: payload.companyWebsiteUrl,
      contradictions,
      conflicts,
      factLedger,
      feasibilityAudit,
      sections,
    });

    await writeThesis({
      appendix: brief.appendix,
      assumptionsToConfirm: brief.assumptionsToConfirm,
      conflictsDetected: conflicts.length,
      contradictions,
      decisions: brief.decisions,
      durationMs: Date.now() - startedAt,
      executiveThesis: brief.executiveThesis,
      factConflicts: brief.factConflicts,
      factLedger,
      feasibilityAudit,
      fidelityStrikes: brief.fidelityStrikes,
      generatedAt: new Date().toISOString(),
      rankedMoves: brief.rankedMoves,
      status: 'complete',
      thesis: brief.thesis,
    });

    console.info('[executive-brief] generated', {
      criticalContradictions: contradictions.filter(
        (contradiction) =>
          contradiction.severity === 'critical' && !contradiction.resolved,
      ).length,
      conflictsDetected: conflicts.length,
      durationMs: Date.now() - startedAt,
      parentAuditRunId: payload.parentAuditRunId,
      runId: payload.runId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    console.error('[executive-brief] generation failed', {
      message,
      parentAuditRunId: payload.parentAuditRunId,
      runId: payload.runId,
    });

    await writeThesis({
      failedAt: new Date().toISOString(),
      message,
      status: 'error',
    });
  }
}

export async function POST(request: Request): Promise<Response> {
  const internalKey = process.env.RAILWAY_API_KEY?.trim();

  if (internalKey === undefined || internalKey === '') {
    return NextResponse.json(
      { error: 'executive_brief_dispatch_unconfigured' },
      { status: 503 },
    );
  }

  if (request.headers.get(internalKeyHeader)?.trim() !== internalKey) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: 'invalid_request',
        message:
          error instanceof ZodError
            ? error.issues
                .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
                .join('; ')
            : String(error),
      },
      { status: 400 },
    );
  }

  after(async (): Promise<void> => {
    await generateExecutiveBrief(body);
  });

  return NextResponse.json({ accepted: true }, { status: 202 });
}
