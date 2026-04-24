// GTM stage: enrich-brief.
// Slice 1 Lane D2 — merges identity fields from the ingest-identity skill
// into the brief's `fields` object. Fallback path (no fragment, scaffold
// output from the skill) leaves the brief unchanged.

import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { loadSkill } from '../runtime/skill-loader';
import type { GtmBriefSnapshot } from '../schemas/gtm/gtm-brief-snapshot';
import type { GtmBrief, GtmBriefField } from '../schemas/gtm/gtm-brief';
import type { EvidenceSource } from '../schemas/gtm/evidence';

export interface AgentIdentityFragment {
  run_id?: string;
  company_name: string;
  domain: string;
  category: string;
  core_keywords?: string[];
  negative_keywords?: string[];
  sources: Array<{ source_url: string; retrieved_at: string; describes: string }>;
  generated_at?: string;
}

export interface IdentityCardShape {
  run_id: string;
  company_name: string;
  domain: string;
  category: string;
  core_keywords: string[];
  negative_keywords: string[];
  sources: Array<{ source_url: string; retrieved_at: string; describes: string }>;
  generated_at: string;
}

export interface EnrichBriefStageInput {
  briefSnapshot: GtmBriefSnapshot;
  agentFragment?: AgentIdentityFragment;
  skillsRoot?: string;
  cleanupRunDir?: boolean;
}

export interface EnrichBriefStageResult {
  brief: GtmBrief;
  skillExitCode: number;
  skillRunDir: string;
  mergedFields: string[];
  identityCard: IdentityCardShape;
  isScaffoldFallback: boolean;
}

const IDENTITY_TO_BRIEF_FIELD = {
  company_name: 'companyName',
  domain: 'companyUrl',
  category: 'category',
} as const;

export async function runStage(input: EnrichBriefStageInput): Promise<EnrichBriefStageResult> {
  const skillsRoot = input.skillsRoot ?? resolve(__dirname, '../../../skills');
  const skillFolder = join(skillsRoot, 'ingest-identity');

  if (!existsSync(skillFolder)) {
    throw new Error(`enrich-brief: skill folder missing: ${skillFolder}`);
  }

  const handle = await loadSkill(skillFolder);
  const runDir = mkdtempSync(join(tmpdir(), 'gtm-enrich-brief-'));

  writeFileSync(
    join(runDir, 'input.json'),
    JSON.stringify(
      {
        run_id: input.briefSnapshot.parentBriefId,
        url: input.briefSnapshot.fields.companyUrl?.value ?? 'https://example.com',
      },
      null,
      2,
    ),
  );

  if (input.agentFragment) {
    mkdirSync(join(runDir, 'fragments'), { recursive: true });
    writeFileSync(
      join(runDir, 'fragments', 'identity.json'),
      JSON.stringify(input.agentFragment, null, 2),
    );
  }

  const invocation = await handle.invoke(runDir);
  if (invocation.exitCode !== 0) {
    if (input.cleanupRunDir !== false) rmSync(runDir, { recursive: true, force: true });
    throw new Error(
      `enrich-brief: ingest-identity skill exited ${invocation.exitCode}. stderr: ${invocation.stderr}`,
    );
  }

  const outputPath = join(runDir, 'output.json');
  if (!existsSync(outputPath)) {
    if (input.cleanupRunDir !== false) rmSync(runDir, { recursive: true, force: true });
    throw new Error(`enrich-brief: ingest-identity produced no output.json at ${outputPath}`);
  }

  const identityCard = JSON.parse(readFileSync(outputPath, 'utf-8')) as IdentityCardShape;
  const isScaffoldFallback = identityCard.sources.some(
    (source) => source.describes === 'scaffold_fallback',
  );

  const mergedFields: string[] = [];
  const brief: GtmBrief = {
    briefId: input.briefSnapshot.parentBriefId,
    clientId: null,
    fields: isScaffoldFallback
      ? input.briefSnapshot.fields
      : mergeIdentityIntoFields(input.briefSnapshot.fields, identityCard, mergedFields),
    createdAt: input.briefSnapshot.briefCreatedAt,
    updatedAt: isScaffoldFallback ? input.briefSnapshot.briefUpdatedAt : new Date().toISOString(),
  };

  if (input.cleanupRunDir !== false) rmSync(runDir, { recursive: true, force: true });

  return {
    brief,
    skillExitCode: invocation.exitCode,
    skillRunDir: runDir,
    mergedFields,
    identityCard,
    isScaffoldFallback,
  };
}

function mergeIdentityIntoFields(
  original: GtmBrief['fields'],
  card: IdentityCardShape,
  mergedFields: string[],
): GtmBrief['fields'] {
  const merged = { ...original } as Record<string, GtmBriefField>;
  const updatedAt = new Date().toISOString();
  const evidenceSources = identitySourcesToEvidence(card.sources, updatedAt);

  for (const [identityKey, briefKey] of Object.entries(IDENTITY_TO_BRIEF_FIELD) as Array<
    [keyof typeof IDENTITY_TO_BRIEF_FIELD, string]
  >) {
    const nextValue = card[identityKey];
    if (typeof nextValue !== 'string' || nextValue.length === 0) continue;
    const existing = merged[briefKey];
    if (!existing) continue;

    if (existing.value === nextValue && existing.status === 'confirmed') continue;

    merged[briefKey] = {
      value: nextValue,
      status: 'suggested',
      confidence: 'high',
      sources: evidenceSources.length > 0 ? evidenceSources : existing.sources,
      updatedBy: 'ai',
      updatedAt,
    };
    mergedFields.push(briefKey);
  }

  return merged as GtmBrief['fields'];
}

function identitySourcesToEvidence(
  sources: IdentityCardShape['sources'],
  capturedAt: string,
): EvidenceSource[] {
  return sources
    .filter((source) => !source.describes.startsWith('scaffold_'))
    .map((source, index): EvidenceSource => {
      const isValidUrl = isHttpUrl(source.source_url);
      return {
        id: `identity-${index}`,
        type: isValidUrl ? 'url' : 'manual_note',
        label: source.describes,
        ...(isValidUrl ? { url: source.source_url } : {}),
        capturedAt: source.retrieved_at ?? capturedAt,
      };
    });
}

function isHttpUrl(candidate: string): boolean {
  try {
    const url = new URL(candidate);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
