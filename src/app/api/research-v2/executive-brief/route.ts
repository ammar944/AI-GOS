import { after, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

import {
  ALL_POSITIONING_SECTION_IDS,
  ALL_POSITIONING_SECTION_LABELS,
  isAllPositioningSectionId,
} from '@/lib/ai/prompts/positioning-skills';
import { extractCrossSectionFactConflicts } from '@/lib/lab-engine/agents/cross-section-facts';
import {
  runExecutiveBrief,
  type ExecutiveBriefSectionInput,
} from '@/lib/lab-engine/agents/executive-brief';
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

    const sections = ((data ?? []) as SectionRow[])
      .map(toBriefSectionInput)
      .filter((section): section is ExecutiveBriefSectionInput => section !== null);

    if (sections.length < ALL_POSITIONING_SECTION_IDS.length) {
      throw new Error(
        `expected ${ALL_POSITIONING_SECTION_IDS.length} committed sections, found ${sections.length}`,
      );
    }

    const conflicts = extractCrossSectionFactConflicts({
      sections,
      subjectName: payload.companyName,
    });

    const startedAt = Date.now();
    const brief = await runExecutiveBrief({
      companyName: payload.companyName,
      companyWebsiteUrl: payload.companyWebsiteUrl,
      conflicts,
      sections,
    });

    await writeThesis({
      conflictsDetected: conflicts.length,
      durationMs: Date.now() - startedAt,
      executiveThesis: brief.executiveThesis,
      factConflicts: brief.factConflicts,
      generatedAt: new Date().toISOString(),
      rankedMoves: brief.rankedMoves,
      status: 'complete',
    });

    console.info('[executive-brief] generated', {
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
