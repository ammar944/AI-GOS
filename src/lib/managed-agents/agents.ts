// Managed Agents agent + environment + session factories.
//
// Phase 1 ships:
//   - createEnvironment() — limited networking allowlist by default
//     (env config widened in Phase 2 — see the handoff).
//   - createMarketCategoryAgent() — Section 01 specialist.
//   - createCoordinatorAgent() — placeholder roster with only MarketCategory
//     for P1. Will be extended to all 6 specialists in P3.
//
// R4 hard rule: every MCP toolset declaration MUST set
// permission_policy: never_ask, and any attached platform skill MUST have
// the read tool enabled in agent_toolset_20260401.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { PositioningSectionId } from '@/lib/ai/prompts/positioning-skills';

import type { ManagedAgentsClient } from './client';
import { sectionArtifactSchemas } from './section-artifact-schemas';

const REPO_ROOT = process.cwd();

const DEFAULT_MODEL = 'claude-opus-4-7';

const PLATFORM_SKILL_DIR_BY_SECTION: Record<PositioningSectionId, string> = {
  positioningMarketCategory: 'ai-gos-market-category-intelligence',
  positioningBuyerICP: 'ai-gos-buyer-icp-validation',
  positioningCompetitorLandscape: 'ai-gos-competitive-positioning',
  positioningVoiceOfCustomer: 'ai-gos-voc-objection-evidence',
  positioningDemandIntent: 'ai-gos-demand-intent-signals',
  positioningOfferDiagnostic: 'ai-gos-offer-performance-diagnostic',
};

const MAX_SKILL_PROMPT_CHARS = 16_000;

/**
 * Reads the SKILL.md content from research-worker/platform-skills/<name>/.
 * This is file I/O only — we do NOT import code from research-worker/.
 * Cached per call site via module-scope memoization.
 */
const skillCache = new Map<string, string>();

export async function readPlatformSkillMarkdown(
  sectionId: PositioningSectionId,
): Promise<string> {
  const cached = skillCache.get(sectionId);
  if (cached) return cached;

  const dir = PLATFORM_SKILL_DIR_BY_SECTION[sectionId];
  if (!dir) {
    throw new Error(`No platform skill directory mapped for section ${sectionId}`);
  }
  const path = join(REPO_ROOT, 'research-worker', 'platform-skills', dir, 'SKILL.md');
  const text = await readFile(path, 'utf8');
  const trimmed = text.slice(0, MAX_SKILL_PROMPT_CHARS);
  skillCache.set(sectionId, trimmed);
  return trimmed;
}

// ----------------------------------------------------------------------------
// MCP toolsets and built-in toolsets
// ----------------------------------------------------------------------------

export interface McpToolsetDefinition {
  type: 'mcp_toolset';
  name: string;
  server: {
    type: 'http';
    url: string;
    headers?: Record<string, string>;
  };
  permission_policy: 'never_ask' | 'always_ask';
}

export function firecrawlMcpToolset(): McpToolsetDefinition | null {
  const apiKey = process.env.FIRECRAWL_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    type: 'mcp_toolset',
    name: 'firecrawl',
    server: {
      type: 'http',
      url: 'https://mcp.firecrawl.dev/v1/mcp',
      headers: { Authorization: `Bearer ${apiKey}` },
    },
    // R4 hard rule.
    permission_policy: 'never_ask',
  };
}

export function perplexityMcpToolset(): McpToolsetDefinition | null {
  const apiKey = process.env.PERPLEXITY_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    type: 'mcp_toolset',
    name: 'perplexity',
    server: {
      type: 'http',
      url: 'https://mcp.perplexity.ai/v1/mcp',
      headers: { Authorization: `Bearer ${apiKey}` },
    },
    // R4 hard rule.
    permission_policy: 'never_ask',
  };
}

export function defaultMcpToolsets(): McpToolsetDefinition[] {
  return [firecrawlMcpToolset(), perplexityMcpToolset()].filter(
    (toolset): toolset is McpToolsetDefinition => toolset !== null,
  );
}

// agent_toolset_20260401 with read enabled is required when platform skills
// are attached (R4 second clause).
export const READ_CAPABLE_AGENT_TOOLSET = {
  type: 'agent_toolset_20260401' as const,
  default_config: { enabled: false } as const,
  configs: [{ name: 'read', enabled: true }],
};

// ----------------------------------------------------------------------------
// save_<section>_artifact custom tools
// ----------------------------------------------------------------------------

export interface CustomToolDefinition {
  type: 'custom';
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

function buildSaveArtifactTool(sectionId: PositioningSectionId): CustomToolDefinition {
  const entry = sectionArtifactSchemas[sectionId];
  return {
    type: 'custom',
    name: entry.toolName,
    description: [
      `Validate and persist the completed ${entry.label} Section Artifact.`,
      'Call this only after assembling the full artifact with the nested keys named in the SKILL.md schema.',
      'AI-GOS validates the artifact against the mirrored Zod schema and minimum validator.',
      'Returns ok:true when both pass; ok:false with repair_feedback for validation failures — revise the same artifact shape and retry.',
    ].join(' '),
    input_schema: {
      type: 'object',
      properties: {
        artifact: {
          type: 'object',
          description: `Complete ${entry.label} artifact matching the schema in your SKILL.md prompt.`,
        },
        confidence_notes: {
          type: 'string',
          description:
            'Optional free-form notes on confidence, source gaps, or evidence the runner should preserve.',
        },
      },
      required: ['artifact'],
    },
  };
}

// ----------------------------------------------------------------------------
// Environment factory
// ----------------------------------------------------------------------------

export interface CreateEnvironmentOptions {
  client: ManagedAgentsClient;
  /**
   * Optional reuse path: when set, no POST is made and the existing
   * environment id is returned.
   */
  environmentId?: string | null;
  /** Display name. Defaults to a timestamped AI-GOS name. */
  name?: string;
  /** Override networking config; Phase 1 default is unrestricted. */
  networking?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface CreatedEnvironment {
  id: string;
  reused: boolean;
  raw?: Record<string, unknown>;
}

export async function createOrReuseEnvironment(
  options: CreateEnvironmentOptions,
): Promise<CreatedEnvironment> {
  if (options.environmentId && options.environmentId.trim()) {
    return { id: options.environmentId.trim(), reused: true };
  }

  const body = {
    name: options.name ?? `aigos-managed-agents-${Date.now()}`,
    description: 'AI-GOS positioning audit environment.',
    metadata: options.metadata ?? { project: 'AI-GOS', surface: 'managed-agents' },
    config: {
      type: 'cloud',
      // Phase 1 leaves networking open; Phase 2 will tighten this to a
      // limited allowlist (see the handoff R2 mitigation).
      networking: options.networking ?? { type: 'unrestricted' },
    },
  };
  const raw = (await options.client.request<{ id: string }>('/environments', {
    method: 'POST',
    body,
  })) as Record<string, unknown> & { id: string };
  return { id: raw.id, reused: false, raw };
}

// ----------------------------------------------------------------------------
// Specialist agent factory
// ----------------------------------------------------------------------------

export interface CreateSpecialistAgentOptions {
  client: ManagedAgentsClient;
  sectionId: PositioningSectionId;
  /** Optional reuse path. */
  agentId?: string | null;
  model?: string;
  /** Override platform skill id. Falls back to env-var-style override. */
  platformSkillId?: string | null;
  mcpToolsets?: McpToolsetDefinition[];
  metadata?: Record<string, unknown>;
}

export interface CreatedAgent {
  id: string;
  version?: number | string;
  reused: boolean;
  sectionId: PositioningSectionId;
  raw?: Record<string, unknown>;
}

function specialistSystemPrompt(
  sectionId: PositioningSectionId,
  skillMarkdown: string,
): string {
  const entry = sectionArtifactSchemas[sectionId];
  return [
    `You are the AI-GOS Managed Agents specialist for ${entry.label}.`,
    `Produce exactly one ${entry.label} Section Artifact and submit it via ${entry.toolName}.`,
    'Use only evidence returned by tools attached to this agent — never invent market data, pricing, sources, or quotes.',
    'When the save tool returns ok:false, treat repair_feedback as actionable validation feedback. Revise the same artifact shape and call the save tool again.',
    'Echo session_thread_id on every custom-tool reply (AI-GOS uses this for multi-thread fan-out).',
    'After save returns ok:true, emit one concise agent.message with verdict, confidence, and any source gaps.',
    '',
    '--- AI-GOS platform skill (verbatim from research-worker/platform-skills) ---',
    skillMarkdown,
  ].join('\n');
}

export async function createOrReuseSpecialistAgent(
  options: CreateSpecialistAgentOptions,
): Promise<CreatedAgent> {
  if (options.agentId && options.agentId.trim()) {
    return {
      id: options.agentId.trim(),
      reused: true,
      sectionId: options.sectionId,
    };
  }

  const skill = await readPlatformSkillMarkdown(options.sectionId);
  const system = specialistSystemPrompt(options.sectionId, skill);
  const mcpToolsets = options.mcpToolsets ?? defaultMcpToolsets();
  const platformSkillId =
    options.platformSkillId?.trim() ||
    process.env[`MANAGED_AGENTS_SKILL_${options.sectionId.toUpperCase()}`]?.trim() ||
    null;

  const body: Record<string, unknown> = {
    name: `AI-GOS ${sectionArtifactSchemas[options.sectionId].label} ${Date.now()}`,
    description: `AI-GOS Managed Agents specialist for ${options.sectionId}.`,
    metadata: options.metadata ?? {
      project: 'AI-GOS',
      surface: 'managed-agents',
      section: options.sectionId,
    },
    model: options.model ?? DEFAULT_MODEL,
    system,
    tools: [READ_CAPABLE_AGENT_TOOLSET, ...mcpToolsets, buildSaveArtifactTool(options.sectionId)],
  };

  if (platformSkillId) {
    body.skills = [
      {
        type: 'custom' as const,
        skill_id: platformSkillId,
        version: 'latest' as const,
      },
    ];
  }

  const raw = (await options.client.request<{ id: string; version?: number | string }>(
    '/agents',
    { method: 'POST', body },
  )) as Record<string, unknown> & { id: string; version?: number | string };
  return {
    id: raw.id,
    version: raw.version,
    reused: false,
    sectionId: options.sectionId,
    raw,
  };
}

// Backwards-compatible alias the handoff calls out by name.
export async function createMarketCategoryAgent(
  options: Omit<CreateSpecialistAgentOptions, 'sectionId'>,
): Promise<CreatedAgent> {
  return createOrReuseSpecialistAgent({
    ...options,
    sectionId: 'positioningMarketCategory',
  });
}

// ----------------------------------------------------------------------------
// Coordinator agent
// ----------------------------------------------------------------------------

export interface CreateCoordinatorAgentOptions {
  client: ManagedAgentsClient;
  agentId?: string | null;
  model?: string;
  /** Specialist agents the coordinator may delegate to. */
  specialists: ReadonlyArray<{
    sectionId: PositioningSectionId;
    agentId: string;
  }>;
  metadata?: Record<string, unknown>;
}

function coordinatorSystemPrompt(
  specialists: CreateCoordinatorAgentOptions['specialists'],
): string {
  const roster = specialists
    .map(
      (entry, index) =>
        `  ${index + 1}. ${entry.sectionId} — ${
          sectionArtifactSchemas[entry.sectionId].label
        } (agent ${entry.agentId})`,
    )
    .join('\n');
  return [
    'You are the AI-GOS audit coordinator.',
    'Delegate each positioning section to its specialist agent.',
    'Wait for all delegations to return committed artifacts.',
    'Do not synthesize, edit, or comment on specialist outputs — your only job is delegation and roll-up confirmation.',
    '',
    'Roster:',
    roster,
    '',
    'When every specialist has confirmed a saved artifact, emit one final agent.message summarizing per-section verdict and any reported source gaps. Then end your turn.',
  ].join('\n');
}

export async function createOrReuseCoordinatorAgent(
  options: CreateCoordinatorAgentOptions,
): Promise<CreatedAgent> {
  if (options.agentId && options.agentId.trim()) {
    return {
      id: options.agentId.trim(),
      reused: true,
      sectionId: options.specialists[0]?.sectionId ?? 'positioningMarketCategory',
    };
  }

  const body: Record<string, unknown> = {
    name: `AI-GOS Audit Coordinator ${Date.now()}`,
    description: 'AI-GOS Managed Agents coordinator that delegates the six positioning sections.',
    metadata: options.metadata ?? {
      project: 'AI-GOS',
      surface: 'managed-agents',
      role: 'coordinator',
    },
    model: options.model ?? DEFAULT_MODEL,
    system: coordinatorSystemPrompt(options.specialists),
    tools: [
      READ_CAPABLE_AGENT_TOOLSET,
      ...options.specialists.map((entry) => ({
        type: 'subagent_toolset_20260401' as const,
        agent: entry.agentId,
        name: entry.sectionId,
      })),
    ],
  };

  const raw = (await options.client.request<{ id: string; version?: number | string }>(
    '/agents',
    { method: 'POST', body },
  )) as Record<string, unknown> & { id: string; version?: number | string };
  return {
    id: raw.id,
    version: raw.version,
    reused: false,
    sectionId: options.specialists[0]?.sectionId ?? 'positioningMarketCategory',
    raw,
  };
}

// Backwards-compatible alias the handoff calls out by name.
export const createCoordinatorAgent = createOrReuseCoordinatorAgent;

// ----------------------------------------------------------------------------
// Session factory
// ----------------------------------------------------------------------------

export interface CreateSessionOptions {
  client: ManagedAgentsClient;
  agentId: string;
  environmentId: string;
  metadata?: Record<string, unknown>;
}

export interface CreatedSession {
  id: string;
  agent: string;
  environment_id: string;
  raw?: Record<string, unknown>;
}

export async function createSession(
  options: CreateSessionOptions,
): Promise<CreatedSession> {
  const raw = (await options.client.request<{
    id: string;
    agent?: string;
    environment_id?: string;
  }>('/sessions', {
    method: 'POST',
    body: {
      agent: options.agentId,
      environment_id: options.environmentId,
      metadata: options.metadata ?? null,
    },
  })) as Record<string, unknown> & {
    id: string;
    agent?: string;
    environment_id?: string;
  };
  return {
    id: raw.id,
    agent: raw.agent ?? options.agentId,
    environment_id: raw.environment_id ?? options.environmentId,
    raw,
  };
}
