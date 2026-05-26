// Session-kickoff helper for the Managed Agents positioning audit path.
//
// Used by:
//   - src/app/api/research-v2/orchestrate/route.ts (when executionMode is
//     'managed' and MANAGED_AGENTS_POSITIONING_ENABLED is on)
//   - scripts/managed-agents-section-canary.mjs
//
// Returns the Anthropic session_id + session_thread_id and the existing
// parent_audit_run_id / section_run_ids from seed_orchestration. The
// webhook handler routes incoming events back to those ids.
//
// Kicks off all six positioning specialists by default. Tests can pass
// a narrower `sections` list to scope a kickoff to a subset.

import type { PositioningSectionId } from '@/lib/ai/prompts/positioning-skills';
import {
  POSITIONING_SECTION_IDS,
  isPositioningSectionId,
} from '@/lib/ai/prompts/positioning-skills';
import { seedOrchestration } from '@/lib/research-v2/orchestrate-db';
import { createAdminClient } from '@/lib/supabase/server';

import {
  createOrReuseCoordinatorAgent,
  createOrReuseEnvironment,
  createOrReuseSpecialistAgent,
  createSession,
} from './agents';
import { ManagedAgentsClient } from './client';
import { sectionArtifactSchemas } from './section-artifact-schemas';

export interface StartManagedAuditInput {
  userId: string;
  runId: string;
  /** Frozen GTM brief — passed to the coordinator/specialists as context. */
  gtmBrief: Record<string, unknown>;
  /** Reviewed corpus excerpt — preserved through the session metadata. */
  corpusExcerpt?: Record<string, unknown> | null;
  /**
   * Sections to kick off in this audit. Defaults to all six positioning
   * sections (the production behavior). Tests and one-off canaries can pass
   * a narrower list to scope a kickoff to a single section.
   */
  sections?: readonly PositioningSectionId[];
  /** Override the client (tests inject a mock). */
  client?: ManagedAgentsClient;
  /** Override the agent factory module (tests inject mocks). */
  factories?: {
    createOrReuseEnvironment: typeof createOrReuseEnvironment;
    createOrReuseSpecialistAgent: typeof createOrReuseSpecialistAgent;
    createOrReuseCoordinatorAgent: typeof createOrReuseCoordinatorAgent;
    createSession: typeof createSession;
  };
  /** Override seedOrchestration for tests. */
  seedOrchestrationImpl?: typeof seedOrchestration;
  /** Reuse env/agent/coordinator ids when set (saves API calls in tests/dev). */
  reuse?: {
    environmentId?: string | null;
    coordinatorAgentId?: string | null;
    specialistAgentIds?: Partial<Record<PositioningSectionId, string>>;
  };
}

export interface StartManagedAuditResult {
  parentAuditRunId: string;
  sectionRunIds: Array<{
    sectionId: PositioningSectionId;
    sectionRunId: string;
    ordinal: number;
    reused: boolean;
  }>;
  environmentId: string;
  coordinatorAgentId: string;
  specialistAgentIds: Partial<Record<PositioningSectionId, string>>;
  sessionId: string;
}

const DEFAULT_KICKOFF_SECTIONS: readonly PositioningSectionId[] = POSITIONING_SECTION_IDS;

function buildKickoffMessage(input: {
  parentAuditRunId: string;
  sections: ReadonlyArray<{ sectionId: PositioningSectionId; sectionRunId: string }>;
  gtmBrief: Record<string, unknown>;
  corpusExcerpt: Record<string, unknown> | null;
}): string {
  const roster = input.sections
    .map(
      (entry) =>
        `  - ${entry.sectionId} (${sectionArtifactSchemas[entry.sectionId].label}) — section_run_id=${entry.sectionRunId}`,
    )
    .join('\n');
  return [
    `AI-GOS positioning audit kickoff. parent_audit_run_id=${input.parentAuditRunId}.`,
    '',
    'Delegate each section below to its specialist. Each specialist MUST include section_run_id in its save_*_artifact input so AI-GOS can route the commit:',
    roster,
    '',
    'GTM brief snapshot (do not modify):',
    '```json',
    JSON.stringify(input.gtmBrief, null, 2),
    '```',
    '',
    input.corpusExcerpt
      ? `Corpus excerpt:\n\`\`\`json\n${JSON.stringify(input.corpusExcerpt, null, 2)}\n\`\`\``
      : 'No corpus excerpt provided for this kickoff.',
  ].join('\n');
}

export async function startManagedAudit(
  input: StartManagedAuditInput,
): Promise<StartManagedAuditResult> {
  const factories = input.factories ?? {
    createOrReuseEnvironment,
    createOrReuseSpecialistAgent,
    createOrReuseCoordinatorAgent,
    createSession,
  };
  const client = input.client ?? new ManagedAgentsClient();
  const seedImpl = input.seedOrchestrationImpl ?? seedOrchestration;

  // 1. Always seed the parent+six children via the canonical RPC so the
  //    artifact_view / chips / Supabase realtime keep working unchanged.
  const seeded = await seedImpl({
    userId: input.userId,
    runId: input.runId,
    zones: POSITIONING_SECTION_IDS,
  });

  // 2. Resolve the section list this kickoff is responsible for. The
  //    default is all six positioning sections; callers can scope to a
  //    subset by passing input.sections.
  const requestedSections = input.sections ?? DEFAULT_KICKOFF_SECTIONS;
  const sectionsToRun = seeded.section_run_ids.filter(
    (
      row,
    ): row is typeof row & { section_id: PositioningSectionId } =>
      isPositioningSectionId(row.section_id) &&
      requestedSections.includes(row.section_id),
  );

  // 3. Create / reuse environment + specialist agents.
  const env = await factories.createOrReuseEnvironment({
    client,
    environmentId: input.reuse?.environmentId ?? null,
    metadata: {
      project: 'AI-GOS',
      surface: 'managed-agents',
      run_id: input.runId,
    },
  });

  const specialistAgentIds: Partial<Record<PositioningSectionId, string>> = {};
  for (const row of sectionsToRun) {
    const agent = await factories.createOrReuseSpecialistAgent({
      client,
      sectionId: row.section_id,
      agentId: input.reuse?.specialistAgentIds?.[row.section_id] ?? null,
      metadata: {
        project: 'AI-GOS',
        run_id: input.runId,
        section: row.section_id,
      },
    });
    specialistAgentIds[row.section_id] = agent.id;
  }

  const coordinator = await factories.createOrReuseCoordinatorAgent({
    client,
    agentId: input.reuse?.coordinatorAgentId ?? null,
    specialists: sectionsToRun.map((row) => ({
      sectionId: row.section_id,
      agentId: specialistAgentIds[row.section_id] as string,
    })),
    metadata: {
      project: 'AI-GOS',
      run_id: input.runId,
      surface: 'managed-agents-coordinator',
    },
  });

  // 4. Start the session and post the kickoff user.message.
  const session = await factories.createSession({
    client,
    agentId: coordinator.id,
    environmentId: env.id,
    metadata: {
      project: 'AI-GOS',
      run_id: input.runId,
      parent_audit_run_id: seeded.parent_audit_run_id,
    },
  });
  const kickoff = buildKickoffMessage({
    parentAuditRunId: seeded.parent_audit_run_id,
    sections: sectionsToRun.map((row) => ({
      sectionId: row.section_id,
      sectionRunId: row.section_run_id,
    })),
    gtmBrief: input.gtmBrief,
    corpusExcerpt: input.corpusExcerpt ?? null,
  });
  await client.sendEvents(session.id, [
    { type: 'user.message', content: [{ type: 'text', text: kickoff }] },
  ]);

  // 5. Persist the session/thread mapping on each section run for later
  //    fan-in / observation. Best-effort: failures here do not block the
  //    audit since the canonical state is the webhook event log.
  try {
    const admin = createAdminClient();
    for (const row of sectionsToRun) {
      await admin
        .from('research_section_runs')
        .update({
          telemetry: {
            managed_agents: {
              session_id: session.id,
              coordinator_agent_id: coordinator.id,
              environment_id: env.id,
              specialist_agent_id: specialistAgentIds[row.section_id] ?? null,
            },
          },
        })
        .eq('id', row.section_run_id);
    }
  } catch (err) {
    console.warn('[managed-agents/start-audit] telemetry update best-effort failed:', err);
  }

  return {
    parentAuditRunId: seeded.parent_audit_run_id,
    sectionRunIds: sectionsToRun.map((row) => ({
      sectionId: row.section_id,
      sectionRunId: row.section_run_id,
      ordinal: row.ordinal,
      reused: row.reused,
    })),
    environmentId: env.id,
    coordinatorAgentId: coordinator.id,
    specialistAgentIds,
    sessionId: session.id,
  };
}
