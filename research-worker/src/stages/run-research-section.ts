// GTM stage dispatcher: run-research-section.
// Slice 1 Lane D4 — threads an agent-produced competitor fragment through
// the research-competitor skill and reads its final output back into the
// workflow result. Other research sections (market, icp, voc, demand-intent,
// offer-funnel) stay fixture-backed until their skills are implemented in
// later slices.

import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  existsSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { loadSkill } from '../runtime/skill-loader';
import type { GtmBriefSnapshot } from '../schemas/gtm/gtm-brief-snapshot';

export type ResearchSectionKey =
  | 'research-market-category'
  | 'research-buyer-icp'
  | 'research-competitors'
  | 'research-voc'
  | 'research-demand-intent'
  | 'research-offer-funnel';

export type CompetitorEntryType =
  | 'subject'
  | 'direct'
  | 'indirect'
  | 'status_quo'
  | 'diy';

export interface AgentCompetitorFragmentEntry {
  name: string;
  type: CompetitorEntryType;
  source_url: string;
  retrieved_at: string;
}

export interface AgentCompetitorFragment {
  run_id?: string;
  source_company_name: string;
  competitor_set: AgentCompetitorFragmentEntry[];
  generated_at?: string;
  tool_calls_used?: string[];
}

export interface RunResearchSectionInput {
  section: ResearchSectionKey;
  briefSnapshot: GtmBriefSnapshot;
  agentFragment?: AgentCompetitorFragment;
  skillsRoot?: string;
  cleanupRunDir?: boolean;
}

export interface RunResearchSectionResult {
  section: ResearchSectionKey;
  skillInvoked: boolean;
  skillExitCode?: number;
  skillRunDir?: string;
  skillOutput?: unknown;
  mergedCompetitors: number;
  notes: string;
}

export async function runStage(input: RunResearchSectionInput): Promise<RunResearchSectionResult> {
  if (input.section !== 'research-competitors') {
    return {
      section: input.section,
      skillInvoked: false,
      mergedCompetitors: 0,
      notes: `${input.section} skill not implemented yet; fixture-backed in slice 1.`,
    };
  }

  const skillsRoot = input.skillsRoot ?? resolve(__dirname, '../../../skills');
  const skillFolder = join(skillsRoot, 'research-competitor');

  if (!existsSync(skillFolder)) {
    throw new Error(`run-research-section: skill folder missing: ${skillFolder}`);
  }

  const runDir = mkdtempSync(join(tmpdir(), 'gtm-competitors-'));
  const sourceCompanyName =
    input.agentFragment?.source_company_name ??
    input.briefSnapshot.fields.companyName?.value ??
    'Example';
  const runId = input.agentFragment?.run_id ?? input.briefSnapshot.parentBriefId;
  const generatedAt = input.agentFragment?.generated_at ?? new Date().toISOString();

  const seedOutput = buildSeedOutput({
    runId,
    sourceCompanyName,
    generatedAt,
    agentFragment: input.agentFragment,
    briefSnapshot: input.briefSnapshot,
  });
  writeFileSync(join(runDir, 'output.json'), JSON.stringify(seedOutput, null, 2));

  const handle = await loadSkill(skillFolder);
  const invocation = await handle.invoke(runDir);

  let skillOutput: unknown;
  const outputPath = join(runDir, 'output.json');
  if (invocation.exitCode === 0 && existsSync(outputPath)) {
    try {
      skillOutput = JSON.parse(readFileSync(outputPath, 'utf-8'));
    } catch (err) {
      // Leave skillOutput undefined; caller falls back to fixture.
      skillOutput = undefined;
      invocation.stderr += `\n[run-research-section] output.json unparseable: ${(err as Error).message}`;
    }
  }

  if (input.cleanupRunDir !== false) {
    rmSync(runDir, { recursive: true, force: true });
  }

  const mergedCompetitors = seedOutput.competitor_set.length;

  const notes =
    invocation.exitCode === 0
      ? `research-competitor skill invoked; ${mergedCompetitors} competitor(s) in set${
          input.agentFragment ? ' (agent fragment)' : ' (scaffold seed)'
        }.`
      : `research-competitor exited ${invocation.exitCode}; falling back to fixture. stderr: ${invocation.stderr.slice(0, 200)}`;

  return {
    section: input.section,
    skillInvoked: true,
    skillExitCode: invocation.exitCode,
    skillRunDir: runDir,
    skillOutput,
    mergedCompetitors,
    notes,
  };
}

interface SeedOutputInput {
  runId: string;
  sourceCompanyName: string;
  generatedAt: string;
  agentFragment?: AgentCompetitorFragment;
  briefSnapshot: GtmBriefSnapshot;
}

interface CompetitorSetEntry {
  name: string;
  type: CompetitorEntryType;
  source_url: string;
  retrieved_at: string;
}

interface SeedOutput {
  run_id: string;
  source_company_name: string;
  generated_at: string;
  tool_calls_used: string[];
  competitor_set: CompetitorSetEntry[];
  positioning_taxonomy: unknown[];
  pricing_reality: unknown[];
  share_of_voice: {
    search_terms_owned: unknown[];
    communities_owned: unknown[];
    publications_owned: unknown[];
    evidence_per_claim: unknown[];
    source_url: string;
    retrieved_at: string;
  };
  review_mined_feedback: unknown[];
  competitor_narrative_arc: unknown[];
  paid_social_ad_inventory: unknown[];
  paid_search_ad_inventory: unknown[];
  ad_activity_signals: unknown[];
  organic_vs_paid_narrative_delta: unknown[];
}

function buildSeedOutput(input: SeedOutputInput): SeedOutput {
  const fallbackSourceUrl =
    input.briefSnapshot.fields.companyUrl?.value ?? 'https://example.com';
  const normalizedSourceUrl = normalizeUrl(fallbackSourceUrl);

  const competitorSet = buildCompetitorSet({
    sourceCompanyName: input.sourceCompanyName,
    generatedAt: input.generatedAt,
    fallbackSourceUrl: normalizedSourceUrl,
    agentFragment: input.agentFragment,
  });

  return {
    run_id: input.runId,
    source_company_name: input.sourceCompanyName,
    generated_at: input.generatedAt,
    tool_calls_used: input.agentFragment?.tool_calls_used ?? [],
    competitor_set: competitorSet,
    positioning_taxonomy: [],
    pricing_reality: [],
    share_of_voice: {
      search_terms_owned: [],
      communities_owned: [],
      publications_owned: [],
      evidence_per_claim: [],
      source_url: normalizedSourceUrl,
      retrieved_at: input.generatedAt,
    },
    review_mined_feedback: [],
    competitor_narrative_arc: [],
    paid_social_ad_inventory: [],
    paid_search_ad_inventory: [],
    ad_activity_signals: [],
    organic_vs_paid_narrative_delta: [],
  };
}

interface BuildCompetitorSetInput {
  sourceCompanyName: string;
  generatedAt: string;
  fallbackSourceUrl: string;
  agentFragment?: AgentCompetitorFragment;
}

function buildCompetitorSet(input: BuildCompetitorSetInput): CompetitorSetEntry[] {
  const entries: CompetitorSetEntry[] = input.agentFragment
    ? input.agentFragment.competitor_set.map((entry) => ({
        name: entry.name,
        type: entry.type,
        source_url: normalizeUrl(entry.source_url),
        retrieved_at: entry.retrieved_at,
      }))
    : [];

  const subjectLower = input.sourceCompanyName.toLowerCase();
  const hasSubject = entries.some(
    (entry) => entry.type === 'subject' || entry.name.toLowerCase() === subjectLower,
  );
  if (!hasSubject) {
    entries.unshift({
      name: input.sourceCompanyName,
      type: 'subject',
      source_url: input.fallbackSourceUrl,
      retrieved_at: input.generatedAt,
    });
  }

  return entries;
}

function normalizeUrl(candidate: string): string {
  const trimmed = candidate.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed.replace(/^\/+/, '')}`;
}
