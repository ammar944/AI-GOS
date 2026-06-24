import { auth } from '@clerk/nextjs/server';
import { after, NextResponse } from 'next/server';
import { z } from 'zod';

import { POSITIONING_SECTION_IDS } from '@/lib/ai/prompts/positioning-skills';
import { buildOnboardingStrategicFrame } from '@/lib/lab-engine/agents/build-prompts';
import type { ResearchInput } from '@/lib/lab-engine/artifacts/artifact-envelope';
import {
  createResearchArtifactsEvidencePoolStore,
  readEvidencePoolFromArtifactData,
  STRUCTURER_EVIDENCE_POOL_CHAR_LIMIT,
  type EvidencePool,
  type EvidencePoolEntry,
  type SupabaseEvidencePoolClient,
} from '@/lib/lab-engine/evidence/evidence-pool';
import { buildCommittedArtifactsResearchInput } from '@/lib/research-v2/committed-positioning-artifacts';
import { corpusToResearchInput } from '@/lib/research-v2/corpus-to-research-input';
import {
  getDeepResearchProgramData,
  loadOwnedResearchSession,
} from '@/lib/research-v2/orchestration-session';
import { commitStrategyBrief } from '@/lib/research-v2/strategy-brief/commit';
import { composeStrategyBrief } from '@/lib/research-v2/strategy-brief/composer';
import {
  STRATEGY_BRIEF_SECTION_ID,
  strategyBriefArtifactSchema,
  type StrategyBriefArtifact,
} from '@/lib/research-v2/strategy-brief/schema';
import { validateStrategyBriefSupport } from '@/lib/research-v2/strategy-brief/support';
import { loadUploadedDocumentContextsForSession } from '@/lib/research-v2/uploaded-document-context.server';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 300;

const STRATEGY_BRIEF_COMPOSE_TIMEOUT_MS = 180_000;

const strategyBriefRequestSchema = z.object({
  runId: z.string().trim().min(1),
  refinement: z.string().trim().min(1).max(2000).nullable().optional(),
});

type StrategyBriefRequest = z.infer<typeof strategyBriefRequestSchema>;
type SupabaseAdminClient = ReturnType<typeof createAdminClient>;

interface LoadParentArtifactInput {
  supabase: SupabaseAdminClient;
  userId: string;
  runId: string;
}

interface LoadPriorStrategyBriefInput {
  supabase: SupabaseAdminClient;
  parentAuditRunId: string;
}

interface StrategyBriefJobInput {
  committedSectionMarkdown: Record<string, string>;
  evidencePool: EvidencePool;
  evidencePoolSlice: string;
  onboardingFrame: string;
  parentAuditRunId: string;
  priorBrief: StrategyBriefArtifact | null;
  refinement: string | null;
  runId: string;
  supabase: SupabaseAdminClient;
  userId: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
}

async function readRequestJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

function normalizeJson(value: unknown): unknown {
  if (value === undefined) {
    return null;
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(normalizeJson);
  }

  const record = asRecord(value);
  if (record === null) {
    return String(value);
  }

  return Object.fromEntries(
    Object.keys(record)
      .sort()
      .map((key): [string, unknown] => [key, normalizeJson(record[key])]),
  );
}

function formatEntryPayload(payload: unknown): string {
  try {
    return JSON.stringify(normalizeJson(payload), null, 2) ?? 'null';
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `[unserializable payload: ${message}]`;
  }
}

function formatStrategyBriefEvidenceEntry(
  entry: EvidencePoolEntry,
  index: number,
): string {
  return [
    `### Evidence ${index + 1}: ${entry.kind}`,
    `toolName: ${entry.toolName}`,
    `fetchedAt: ${entry.fetchedAt}`,
    `sourceUrl: ${entry.sourceUrl ?? 'none'}`,
    `sectionId: ${entry.sectionId ?? 'run-level'}`,
    'payload:',
    formatEntryPayload(entry.payload),
  ].join('\n');
}

function truncateToLimit(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }

  return `${value.slice(0, maxChars)}\n[truncated to ${maxChars} characters]`;
}

function formatStrategyBriefEvidencePoolSlice(pool: EvidencePool): string {
  const entries = [...pool.entries].sort(
    (left, right) => Date.parse(right.fetchedAt) - Date.parse(left.fetchedAt),
  );

  if (entries.length === 0) {
    return 'Strategy brief evidence pool\nNo pooled evidence is available for strategyBrief.';
  }

  const body = entries
    .map((entry, index) => formatStrategyBriefEvidenceEntry(entry, index))
    .join('\n\n');

  return truncateToLimit(
    `Strategy brief evidence pool\nSelected ${entries.length} pooled evidence item(s) for strategyBrief.\n\n${body}`,
    STRUCTURER_EVIDENCE_POOL_CHAR_LIMIT,
  );
}

function readEvidenceSourceUrls(pool: EvidencePool): string[] {
  return [
    ...new Set(
      pool.entries
        .map((entry) => entry.sourceUrl)
        .filter((sourceUrl): sourceUrl is string => sourceUrl !== undefined),
    ),
  ];
}

function readParentArtifactId(data: unknown): string | null {
  const id = asRecord(data)?.id;
  return typeof id === 'string' && id.trim().length > 0 ? id : null;
}

function readPriorBriefData(data: unknown): unknown {
  return asRecord(data)?.data ?? null;
}

async function loadParentArtifactId({
  supabase,
  userId,
  runId,
}: LoadParentArtifactInput): Promise<string | null> {
  const { data, error } = await supabase
    .from('research_artifacts')
    .select('id')
    .eq('user_id', userId)
    .eq('run_id', runId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `strategy_brief_parent_lookup_failed: runId=${runId} userId=${userId} message=${error.message}`,
    );
  }

  return readParentArtifactId(data);
}

async function loadPriorStrategyBrief({
  supabase,
  parentAuditRunId,
}: LoadPriorStrategyBriefInput): Promise<StrategyBriefArtifact | null> {
  const { data, error } = await supabase
    .from('research_artifact_sections')
    .select('data')
    .eq('artifact_id', parentAuditRunId)
    .eq('zone', STRATEGY_BRIEF_SECTION_ID)
    .maybeSingle();

  if (error) {
    throw new Error(
      `strategy_brief_prior_lookup_failed: parentAuditRunId=${parentAuditRunId} message=${error.message}`,
    );
  }

  const parsed = strategyBriefArtifactSchema.safeParse(readPriorBriefData(data));
  return parsed.success ? parsed.data : null;
}

function readCommittedSectionMarkdown(
  researchInput: ResearchInput,
): Record<string, string> | null {
  const markdown = researchInput.committedPositioningSectionMarkdown ?? {};
  const missingSections = POSITIONING_SECTION_IDS.filter((sectionId) => {
    const value = markdown[sectionId];
    return typeof value !== 'string' || value.trim().length === 0;
  });

  if (missingSections.length > 0) {
    return null;
  }

  return Object.fromEntries(
    POSITIONING_SECTION_IDS.map((sectionId) => [
      sectionId,
      markdown[sectionId] ?? '',
    ]),
  );
}

function parseUnsupportedAngleNames(messages: readonly string[]): Set<string> {
  const names = new Set<string>();

  for (const message of messages) {
    const match = /^angle "([^"]+)"/.exec(message);
    if (match?.[1] !== undefined) {
      names.add(match[1]);
    }
  }

  return names;
}

function applySupportValidation({
  artifact,
  committedSectionIds,
  evidenceSourceUrls,
}: {
  artifact: StrategyBriefArtifact;
  committedSectionIds: readonly string[];
  evidenceSourceUrls: readonly string[];
}): StrategyBriefArtifact {
  const support = validateStrategyBriefSupport({
    body: artifact.body,
    committedSectionIds,
    evidenceSourceUrls,
  });

  if (support.ok) {
    return artifact;
  }

  const unsupportedAngleNames = parseUnsupportedAngleNames(
    support.unsupported,
  );
  const supportedAngles = artifact.body.angles.filter(
    (angle) => !unsupportedAngleNames.has(angle.name),
  );
  const angles =
    unsupportedAngleNames.size > 0 && supportedAngles.length > 0
      ? supportedAngles
      : artifact.body.angles;

  return strategyBriefArtifactSchema.parse({
    ...artifact,
    body: {
      ...artifact.body,
      angles,
      gaps: [
        ...artifact.body.gaps,
        ...support.unsupported.map((message) => `Evidence gap: ${message}`),
      ],
    },
  });
}

async function runStrategyBriefJob(input: StrategyBriefJobInput): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    STRATEGY_BRIEF_COMPOSE_TIMEOUT_MS,
  );

  try {
    const artifact = await composeStrategyBrief({
      committedSectionMarkdown: input.committedSectionMarkdown,
      evidencePoolSlice: input.evidencePoolSlice,
      onboardingFrame: input.onboardingFrame,
      refinement: input.refinement,
      priorBrief: input.priorBrief,
      abortSignal: controller.signal,
    });
    const supportedArtifact = applySupportValidation({
      artifact,
      committedSectionIds: POSITIONING_SECTION_IDS,
      evidenceSourceUrls: readEvidenceSourceUrls(input.evidencePool),
    });

    await commitStrategyBrief({
      supabase: input.supabase,
      userId: input.userId,
      runId: input.runId,
      artifact: supportedArtifact,
    });

    console.info('[strategy-brief] committed', {
      userId: input.userId,
      runId: input.runId,
      parentAuditRunId: input.parentAuditRunId,
      sectionId: STRATEGY_BRIEF_SECTION_ID,
      revision:
        supportedArtifact.body.changelog.at(-1)?.revision ?? 'unknown',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[strategy-brief] compose_or_commit_failed', {
      userId: input.userId,
      runId: input.runId,
      parentAuditRunId: input.parentAuditRunId,
      sectionId: STRATEGY_BRIEF_SECTION_ID,
      message,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = strategyBriefRequestSchema.safeParse(
    await readRequestJson(req),
  );
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'invalid_strategy_brief_request',
        message: parsed.error.message,
      },
      { status: 400 },
    );
  }

  const body: StrategyBriefRequest = parsed.data;
  const refinement = body.refinement?.trim() ?? null;
  const supabase = createAdminClient();
  const parentAuditRunId = await loadParentArtifactId({
    supabase,
    userId,
    runId: body.runId,
  });
  const session = await loadOwnedResearchSession({
    userId,
    runId: body.runId,
  });

  if (!session) {
    return NextResponse.json({ error: 'session_not_found' }, { status: 404 });
  }

  if (!parentAuditRunId) {
    return NextResponse.json(
      {
        error: 'positioning_sections_not_ready',
        missing_parent: true,
      },
      { status: 409 },
    );
  }

  const deepResearchProgramData = getDeepResearchProgramData(session);

  const uploadedDocuments = await loadUploadedDocumentContextsForSession({
    metadata: session.metadata,
    supabase,
    userId,
  });
  const baseResearchInput = corpusToResearchInput({
    runId: body.runId,
    deepResearchProgramData,
    onboardingData: session.onboarding_data ?? {},
    ...(uploadedDocuments.length > 0 ? { uploadedDocuments } : {}),
  });
  const committedResearchInput = await buildCommittedArtifactsResearchInput({
    baseResearchInput,
    parentAuditRunId,
    supabase,
  });

  if (!committedResearchInput.ok) {
    return committedResearchInput.response;
  }

  const committedSectionMarkdown = readCommittedSectionMarkdown(
    committedResearchInput.researchInput,
  );
  if (committedSectionMarkdown === null) {
    return NextResponse.json(
      {
        error: 'positioning_sections_not_ready',
        message:
          'All six committed positioning sections need markdown before strategyBrief can be composed',
      },
      { status: 409 },
    );
  }

  const store = createResearchArtifactsEvidencePoolStore(
    supabase as unknown as SupabaseEvidencePoolClient,
  );
  const artifactData = await store.readArtifactData({
    parentAuditRunId,
    runId: body.runId,
  });
  const evidencePool = readEvidencePoolFromArtifactData(artifactData);
  const evidencePoolSlice = formatStrategyBriefEvidencePoolSlice(evidencePool);
  const onboardingFrame = buildOnboardingStrategicFrame(
    committedResearchInput.researchInput,
  );
  const priorBrief = await loadPriorStrategyBrief({
    supabase,
    parentAuditRunId,
  });

  after(() =>
    runStrategyBriefJob({
      committedSectionMarkdown,
      evidencePool,
      evidencePoolSlice,
      onboardingFrame,
      parentAuditRunId,
      priorBrief,
      refinement,
      runId: body.runId,
      supabase,
      userId,
    }),
  );

  return NextResponse.json(
    {
      ok: true,
      status: 'queued',
      sectionId: STRATEGY_BRIEF_SECTION_ID,
      runId: body.runId,
    },
    { status: 202 },
  );
}
