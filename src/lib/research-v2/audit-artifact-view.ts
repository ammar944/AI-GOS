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
  type SectionKeyFinding,
  type SectionEvidenceQuote,
  type SectionSource,
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
  jobId?: string;
};

export type ResearchJobActivityMap = Partial<
  Record<PositioningSectionId, ResearchJobActivityState>
>;

type RawSectionRow = {
  status?: string | null;
  data?: unknown;
  artifact?: { markdown?: string | null } | null;
  error?: string | null;
  citations?: unknown;
};

export type ArtifactSectionRow = {
  zone: string;
  status: string;
  revision: number;
  section_run_id: string | null;
  title: string | null;
  markdown: string | null;
  claims: unknown;
  sources: unknown;
  error: unknown;
  updated_at: string | null;
};

export type AuditArtifactInput = {
  runId: string;
  researchResults: Record<string, unknown> | null | undefined;
  jobActivity: ResearchJobActivityMap | null | undefined;
  artifactId?: string | null;
  /**
   * Phase 2 dual-read: normalized research_artifact_sections rows keyed by
   * zone. When present, these take precedence over researchResults JSONB.
   * Phase 4 cleanup removes the JSONB fallback once dual-write is stable.
   */
  artifactSections?: Record<string, ArtifactSectionRow> | null | undefined;
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
  if (resultStatus === 'partial') return 'partial';
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

function isKeyFinding(value: unknown): value is SectionKeyFinding {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as { title?: unknown }).title === 'string' &&
    typeof (value as { detail?: unknown }).detail === 'string'
  );
}

function isEvidenceQuote(value: unknown): value is SectionEvidenceQuote {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as { quote?: unknown }).quote === 'string' &&
    typeof (value as { source?: unknown }).source === 'string'
  );
}

function isSectionSource(value: unknown): value is SectionSource {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as { url?: unknown }).url === 'string'
  );
}

function projectClaims(row: RawSectionRow | null | undefined): ArtifactClaim[] {
  if (!row?.data || typeof row.data !== 'object') return [];
  const envelope = row.data as Record<string, unknown>;

  const claims: ArtifactClaim[] = [];

  if (Array.isArray(envelope.keyFindings)) {
    envelope.keyFindings.forEach((finding, idx) => {
      if (!isKeyFinding(finding)) return;
      const text = finding.detail
        ? `${finding.title}: ${finding.detail}`
        : finding.title;
      claims.push({
        id: `kf-${idx}`,
        text,
        confidence: 0.6,
        sourceIds: finding.sourceUrl
          ? [normalizeSourceId(finding.sourceUrl)]
          : [],
      });
    });
  }

  if (Array.isArray(envelope.claims)) {
    envelope.claims.forEach((c, idx) => {
      if (typeof c === 'string') {
        claims.push({
          id: `claim-${idx}`,
          text: c,
          confidence: 0.5,
          sourceIds: [],
        });
        return;
      }
      if (c && typeof c === 'object') {
        const obj = c as Record<string, unknown>;
        if (typeof obj.text === 'string') {
          claims.push({
            id: typeof obj.id === 'string' ? obj.id : `claim-${idx}`,
            text: obj.text,
            confidence:
              typeof obj.confidence === 'number'
                ? Math.max(0, Math.min(1, obj.confidence))
                : 0.5,
            sourceIds: Array.isArray(obj.sourceIds)
              ? obj.sourceIds.filter((s): s is string => typeof s === 'string')
              : [],
          });
        }
      }
    });
  }

  return claims;
}

function normalizeSourceId(url: string): string {
  return `src::${url}`;
}

function projectSources(
  zoneId: string,
  row: RawSectionRow | null | undefined,
): ArtifactSource[] {
  if (!row) return [];
  const dedup = new Map<string, ArtifactSource>();

  const push = (
    url: string,
    title?: string | null,
    snippet?: string | null,
  ) => {
    if (!url || dedup.has(url)) return;
    dedup.set(url, {
      id: normalizeSourceId(url),
      url,
      title: title ?? null,
      fetchedAt: null,
      snippet: snippet ?? null,
      zoneId,
    });
  };

  const data = row.data && typeof row.data === 'object' ? (row.data as Record<string, unknown>) : null;

  if (data) {
    if (Array.isArray(data.sources)) {
      data.sources.forEach((s) => {
        if (isSectionSource(s)) push(s.url, s.title ?? null, s.whyItMatters ?? null);
      });
    }
    if (Array.isArray(data.keyFindings)) {
      data.keyFindings.forEach((f) => {
        if (isKeyFinding(f) && f.sourceUrl) {
          push(f.sourceUrl, f.title, f.evidence ?? null);
        }
      });
    }
    if (Array.isArray(data.evidenceQuotes)) {
      data.evidenceQuotes.forEach((q) => {
        if (isEvidenceQuote(q)) {
          const url = (q as { url?: unknown }).url;
          if (typeof url === 'string') push(url, q.source, q.quote);
        }
      });
    }
    if (Array.isArray(data.references)) {
      data.references.forEach((r) => {
        if (typeof r === 'string') push(r);
        else if (isSectionSource(r)) push(r.url, r.title ?? null);
      });
    }
    if (Array.isArray(data.citations)) {
      data.citations.forEach((r) => {
        if (typeof r === 'string') push(r);
        else if (isSectionSource(r)) push(r.url, r.title ?? null);
      });
    }
  }

  if (Array.isArray(row.citations)) {
    row.citations.forEach((r) => {
      if (typeof r === 'string') push(r);
      else if (isSectionSource(r)) push(r.url, r.title ?? null);
    });
  }

  return Array.from(dedup.values());
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

  // deepResearchProgram corpus output. Field names vary across runner
  // revisions; project from the most-likely keys and fall back gracefully.
  // Phase 2 swaps this to read from the normalized research_artifacts.thesis
  // JSONB column, at which point the fragility below disappears.
  const onboardingFields =
    (data.onboardingFields as Record<string, unknown> | undefined) ?? null;
  const synthesis =
    (data.synthesis as Record<string, unknown> | undefined) ?? null;

  const positioning_statement =
    pickString(data, 'positioning_statement') ??
    pickString(synthesis, 'positioning_statement') ??
    pickString(synthesis, 'positioning') ??
    null;

  const target_user =
    pickString(data, 'target_user') ??
    pickString(onboardingFields, 'icp') ??
    pickString(synthesis, 'target_user') ??
    null;

  const jtbd =
    pickString(data, 'jtbd') ??
    pickString(onboardingFields, 'jtbd') ??
    pickString(synthesis, 'jtbd') ??
    null;

  const competitors =
    pickStringArray(data, 'competitors') ??
    pickStringArray(synthesis, 'competitors') ??
    pickStringArray(onboardingFields, 'competitors') ??
    null;

  const win_axes =
    pickStringArray(data, 'win_axes') ??
    pickStringArray(synthesis, 'win_axes') ??
    pickStringArray(synthesis, 'differentiators') ??
    null;

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

function pickString(
  source: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  if (!source) return null;
  const value = source[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

function pickStringArray(
  source: Record<string, unknown> | null | undefined,
  key: string,
): string[] | null {
  if (!source) return null;
  const value = source[key];
  if (!Array.isArray(value)) return null;
  const out = value.filter((v): v is string => typeof v === 'string' && !!v);
  return out.length > 0 ? out : null;
}

function computeArtifactStatus(zones: Record<string, ArtifactZone>): AuditArtifact['status'] {
  const states = Object.values(zones).map((z) => z.status);
  if (states.length === 0) return 'idle';
  const hasRunning = states.some((s) => s === 'running');
  const hasComplete = states.some((s) => s === 'complete');
  const hasError = states.some((s) => s === 'error');
  const hasPartial = states.some((s) => s === 'partial');
  const allComplete = states.every((s) => s === 'complete');
  if (allComplete) return 'complete';
  if (hasRunning) return 'running';
  if (hasPartial || (hasComplete && hasError)) return 'partial';
  if (hasComplete) return 'partial';
  if (hasError) return 'error';
  return 'idle';
}

function projectZoneFromNormalized(
  zoneId: string,
  normalized: ArtifactSectionRow,
  job: ResearchJobActivityState | undefined,
  legacyError: string | null,
): ArtifactZone {
  const claims = Array.isArray(normalized.claims)
    ? (normalized.claims as ArtifactClaim[])
    : [];
  const sources = Array.isArray(normalized.sources)
    ? (normalized.sources as ArtifactSource[])
    : [];
  const activity = projectActivity(job?.updates);

  const errorPayload =
    normalized.error && typeof normalized.error === 'object'
      ? (normalized.error as Record<string, unknown>)
      : null;
  const errorMessage =
    typeof errorPayload?.message === 'string'
      ? (errorPayload.message as string)
      : legacyError;
  const errorPartial =
    errorPayload?.partial === true || typeof errorPayload?.partialAt === 'number';
  const partialAt =
    typeof errorPayload?.partialAt === 'number'
      ? Math.max(0, Math.min(100, errorPayload.partialAt))
      : null;
  // When status==='error' AND we captured a partial snapshot, the section's
  // `markdown` column already holds that partial. Surface it on a distinct
  // field so the error card can show it without confusing it with a
  // completed narrative.
  const status = mapJobStatusToZoneStatus(job?.status, normalized.status);
  const partialNarrative =
    status === 'error' && errorPartial && typeof normalized.markdown === 'string'
      ? normalized.markdown
      : null;

  return {
    zone: zoneId,
    sectionRunId: normalized.section_run_id ?? job?.jobId ?? null,
    revision: typeof normalized.revision === 'number' ? normalized.revision : 0,
    status,
    title:
      normalized.title ??
      (POSITIONING_SECTION_LABELS as Record<string, string>)[zoneId] ??
      zoneId,
    narrative: status === 'error' && errorPartial ? '' : normalized.markdown ?? '',
    claims,
    sources,
    activity,
    errorMessage,
    partialAt,
    errorPartial,
    partialNarrative,
  };
}

export function projectAuditArtifact(input: AuditArtifactInput): AuditArtifact {
  const zones: Record<string, ArtifactZone> = {};

  for (const zoneId of POSITIONING_SECTION_IDS) {
    const job = input.jobActivity?.[zoneId];
    const normalized = input.artifactSections?.[zoneId];

    if (normalized) {
      const legacyRow = (input.researchResults?.[zoneId] ?? null) as
        | RawSectionRow
        | null;
      zones[zoneId] = projectZoneFromNormalized(
        zoneId,
        normalized,
        job,
        legacyRow?.error ?? null,
      );
      continue;
    }

    // Legacy fallback: research_results JSONB. Removed in Phase 4 cleanup
    // once the dual-write has been live long enough for backfill to seed
    // every existing artifact row.
    const row = (input.researchResults?.[zoneId] ?? null) as
      | RawSectionRow
      | null;

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
      sectionRunId: job?.jobId ?? null,
      revision: 0,
      status,
      title: POSITIONING_SECTION_LABELS[zoneId] ?? zoneId,
      narrative,
      claims,
      sources,
      activity,
      errorMessage: row?.error ?? null,
      partialAt: null,
      errorPartial: false,
      partialNarrative: null,
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
