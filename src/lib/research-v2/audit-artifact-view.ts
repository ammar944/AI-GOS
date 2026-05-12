import {
  POSITIONING_SECTION_IDS,
  POSITIONING_SECTION_LABELS,
  type PositioningSectionId,
} from '@/lib/ai/prompts/positioning-skills';

import {
  type ResearchJobUpdate,
  collapseResearchJobUpdates,
} from '@/lib/journey/research-job-activity';

import {
  sectionEnvelopeToMarkdown,
  type PositioningSectionEnvelope,
} from '@/lib/research-v2/json-to-markdown';

import {
  type ArtifactActivityEvent,
  type ArtifactClaim,
  type ArtifactSource,
  type ArtifactThesis,
  type ArtifactZone,
  type AuditArtifact,
  type ZoneStatus,
} from '@/lib/research-v2/audit-artifact-schema';

type ResearchJobActivityState = {
  status?: 'running' | 'complete' | 'error' | 'idle' | string;
  updates?: ResearchJobUpdate[];
};

type ResearchJobActivityMap = Partial<
  Record<PositioningSectionId, ResearchJobActivityState>
>;

type RawSectionRow = {
  status?: string | null;
  data?: unknown;
  artifact?: { markdown?: string | null } | null;
  error?: string | null;
};

export type AuditArtifactInput = {
  runId: string;
  researchResults: Record<string, unknown> | null | undefined;
  jobActivity: ResearchJobActivityMap | null | undefined;
  artifactId?: string | null;
};

const PHASE_TO_EVENT_TYPE: Record<string, ArtifactActivityEvent['type']> = {
  tool: 'tool-start',
  'tool-start': 'tool-start',
  'tool-finish': 'tool-finish',
  analysis: 'step-finish',
  thinking: 'thinking',
  artifact: 'snapshot',
  output: 'output',
  heartbeat: 'heartbeat',
  error: 'error',
};

function mapJobStatusToZoneStatus(
  jobStatus: string | undefined,
  resultStatus: string | undefined,
): ZoneStatus {
  if (resultStatus === 'complete') return 'complete';
  if (resultStatus === 'error' || jobStatus === 'error') return 'error';
  if (jobStatus === 'running' || jobStatus === 'pending') return 'running';
  if (resultStatus === 'pending') return 'running';
  return 'idle';
}

function projectActivity(
  updates: ResearchJobUpdate[] | undefined,
): ArtifactActivityEvent[] {
  if (!Array.isArray(updates) || updates.length === 0) return [];
  const collapsed = collapseResearchJobUpdates(updates);
  return collapsed.map((u) => {
    const phase = String(u.phase ?? 'thinking');
    const type = PHASE_TO_EVENT_TYPE[phase] ?? 'thinking';
    return {
      ts: u.at ?? new Date().toISOString(),
      type,
      label: u.message ?? phase,
      detail: null,
    };
  });
}

function projectNarrative(row: RawSectionRow | null | undefined): string {
  if (!row) return '';
  if (row.artifact?.markdown && typeof row.artifact.markdown === 'string') {
    return row.artifact.markdown;
  }
  if (row.data) {
    try {
      return sectionEnvelopeToMarkdown(row.data as PositioningSectionEnvelope);
    } catch {
      return '';
    }
  }
  return '';
}

function projectClaims(row: RawSectionRow | null | undefined): ArtifactClaim[] {
  if (!row?.data || typeof row.data !== 'object') return [];
  const envelope = row.data as Record<string, unknown>;
  const claimsCandidate =
    envelope.claims ??
    envelope.key_claims ??
    envelope.findings ??
    null;
  if (!Array.isArray(claimsCandidate)) return [];
  return claimsCandidate
    .map((c, idx) => {
      if (typeof c === 'string') {
        return {
          id: `claim-${idx}`,
          text: c,
          confidence: 0.5,
          sourceIds: [] as string[],
        };
      }
      if (c && typeof c === 'object') {
        const obj = c as Record<string, unknown>;
        const text = typeof obj.text === 'string' ? obj.text : null;
        if (!text) return null;
        const sourceIds = Array.isArray(obj.sourceIds)
          ? obj.sourceIds.filter((s): s is string => typeof s === 'string')
          : [];
        const rawConfidence =
          typeof obj.confidence === 'number' ? obj.confidence : 0.5;
        return {
          id: typeof obj.id === 'string' ? obj.id : `claim-${idx}`,
          text,
          confidence: Math.max(0, Math.min(1, rawConfidence)),
          sourceIds,
        };
      }
      return null;
    })
    .filter((claim): claim is ArtifactClaim => claim !== null);
}

function projectSources(
  zoneId: string,
  row: RawSectionRow | null | undefined,
): ArtifactSource[] {
  if (!row?.data || typeof row.data !== 'object') return [];
  const envelope = row.data as Record<string, unknown>;
  const sourcesCandidate =
    envelope.sources ?? envelope.references ?? envelope.citations ?? null;
  if (!Array.isArray(sourcesCandidate)) return [];
  return sourcesCandidate
    .map((s, idx): ArtifactSource | null => {
      if (typeof s === 'string') {
        return {
          id: `${zoneId}-src-${idx}`,
          url: s,
          title: null,
          fetchedAt: null,
          snippet: null,
          zoneId,
        };
      }
      if (s && typeof s === 'object') {
        const obj = s as Record<string, unknown>;
        const url = typeof obj.url === 'string' ? obj.url : null;
        if (!url) return null;
        return {
          id:
            typeof obj.id === 'string'
              ? obj.id
              : `${zoneId}-src-${idx}`,
          url,
          title: typeof obj.title === 'string' ? obj.title : null,
          fetchedAt:
            typeof obj.fetchedAt === 'string' ? obj.fetchedAt : null,
          snippet: typeof obj.snippet === 'string' ? obj.snippet : null,
          zoneId,
        };
      }
      return null;
    })
    .filter((src): src is ArtifactSource => src !== null);
}

function projectThesis(
  researchResults: Record<string, unknown> | null | undefined,
): ArtifactThesis {
  if (!researchResults) return null;
  const corpus = researchResults.deepResearchProgram as
    | Record<string, unknown>
    | undefined;
  if (!corpus || typeof corpus !== 'object') return null;
  const data = corpus.data as Record<string, unknown> | undefined;
  if (!data || typeof data !== 'object') return null;

  const positioning_statement =
    typeof data.positioning_statement === 'string'
      ? data.positioning_statement
      : null;
  const target_user =
    typeof data.target_user === 'string' ? data.target_user : null;
  const jtbd = typeof data.jtbd === 'string' ? data.jtbd : null;
  const competitors = Array.isArray(data.competitors)
    ? data.competitors.filter((c): c is string => typeof c === 'string')
    : null;
  const win_axes = Array.isArray(data.win_axes)
    ? data.win_axes.filter((c): c is string => typeof c === 'string')
    : null;

  if (
    !positioning_statement &&
    !target_user &&
    !jtbd &&
    !competitors &&
    !win_axes
  ) {
    return null;
  }

  return {
    positioning_statement,
    target_user,
    jtbd,
    competitors,
    win_axes,
  };
}

function computeArtifactStatus(zones: Record<string, ArtifactZone>): AuditArtifact['status'] {
  const states = Object.values(zones).map((z) => z.status);
  if (states.length === 0) return 'idle';
  const hasRunning = states.some((s) => s === 'running');
  const hasComplete = states.some((s) => s === 'complete');
  const hasError = states.some((s) => s === 'error');
  const allComplete = states.every((s) => s === 'complete');
  if (allComplete) return 'complete';
  if (hasRunning) return 'running';
  if (hasComplete && hasError) return 'partial';
  if (hasComplete) return 'partial';
  if (hasError) return 'error';
  return 'idle';
}

export function projectAuditArtifact(input: AuditArtifactInput): AuditArtifact {
  const zones: Record<string, ArtifactZone> = {};

  for (const zoneId of POSITIONING_SECTION_IDS) {
    const row = (input.researchResults?.[zoneId] ?? null) as
      | RawSectionRow
      | null;
    const job = input.jobActivity?.[zoneId];

    const status = mapJobStatusToZoneStatus(
      job?.status,
      row?.status ?? undefined,
    );
    const activity = projectActivity(job?.updates);
    const narrative = projectNarrative(row);
    const claims = projectClaims(row);
    const sources = projectSources(zoneId, row);

    zones[zoneId] = {
      zone: zoneId,
      sectionRunId: null,
      revision: 0,
      status,
      title: POSITIONING_SECTION_LABELS[zoneId] ?? zoneId,
      narrative,
      claims,
      sources,
      activity,
      errorMessage: row?.error ?? null,
      partialAt: null,
    };
  }

  return {
    artifactId: input.artifactId ?? null,
    runId: input.runId,
    status: computeArtifactStatus(zones),
    thesis: projectThesis(input.researchResults),
    zones,
  };
}

export function collectAllSources(artifact: AuditArtifact): ArtifactSource[] {
  const seen = new Map<string, ArtifactSource>();
  for (const zone of Object.values(artifact.zones)) {
    for (const src of zone.sources) {
      if (!seen.has(src.url)) seen.set(src.url, src);
    }
  }
  return Array.from(seen.values());
}
