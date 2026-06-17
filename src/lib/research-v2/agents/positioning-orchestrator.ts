/**
 * Phase 4: positioning orchestrator agent.
 *
 * Lives frontend-side (src/lib/) because it composes orchestrator-level
 * meta-tools that talk to Supabase + dispatch routes — NOT the subagent
 * tools which stay worker-side. The orchestrator does NOT do research
 * itself; it orchestrates re-runs, surgical edits, and Q&A over the
 * already-committed artifact.
 *
 * Reference: design doc lines 525-577 (Phase 4) and Premise 3 (parent
 * agent + 5 tool delegations).
 */

import 'server-only';

import { anthropic } from '@ai-sdk/anthropic';
import { ToolLoopAgent, stepCountIs, tool, type Tool } from 'ai';
import { z } from 'zod';

import { POSITIONING_SECTION_IDS } from '@/lib/ai/prompts/positioning-skills';
import { SectionToolBudget } from '@/lib/lab-engine/agents/budget';
import { buildToolMap } from '@/lib/lab-engine/agents/tool-registry';

const ZoneIdSchema = z.enum(POSITIONING_SECTION_IDS);

const ORCHESTRATOR_INSTRUCTIONS = `You are the orchestrator for an AI-GOS positioning audit.

You operate on a structured artifact (thesis + 6 zones). You can:
  - rerunSection({ zone, refinement }) — start a new section_run_id, dispatch worker
  - draftStrategyBrief({ refinement }) — compose or recompose the Offer & Angle Brief from committed sections
  - reviseStrategyBrief({ patches, changelogSummary, rationale }) — apply scoped corrections to the committed Offer & Angle Brief
  - editSectionField({ zone, path, value, reason }) — edit ANY field inside a committed section's typed body via commit_artifact_section. The path is a dotted body path with [index] brackets (e.g. keyFindings[2].finding, competitorSet[0].name, marketSize.tam, sources[1].url). Do NOT prefix "body." — it is added automatically. The edit is rejected if the path doesn't resolve or if the result fails the section's schema.
  - explainSource({ sourceId }) — read sources, narrate
  - summarizeArtifact() — read current state, return brief
  - web_search and perplexity_research — bounded gap-filling research lookups when the current artifact context is not enough

You mostly orchestrate over committed evidence. Be terse. When the user asks for new section research, use rerunSection. When the user asks for the offer, angles, reframe, or initial positioning take, use draftStrategyBrief. When they ask for a small correction to the committed brief, use reviseStrategyBrief and describe what changed. When the user asks to fix one field inside a section (a competitor name, a TAM number, an ICP attribute, a source URL, a key finding's wording), use editSectionField with the exact body path — never re-run a whole section for a one-line change. Read the section snapshot in your system context to choose the right path and index. Treat gaps as gaps. Never fabricate evidence, quotes, numbers, companies, or market claims.`;

// ---------------------------------------------------------------------------
// Tool: rerunSection — dispatch a fresh run for one zone with optional
// refinement context. Phase 5 adds the abort-current-run step; Phase 4
// keeps it minimal and just calls start_section_run.
// ---------------------------------------------------------------------------

const rerunSection = tool({
  description:
    'Rerun a positioning section with optional refinement. Use when the user wants fresh research, not a surgical edit. Set usePartialContext=true when the section previously errored and the user wants to build on the partial snapshot.',
  inputSchema: z.object({
    zone: ZoneIdSchema,
    refinement: z
      .string()
      .optional()
      .describe(
        'Optional natural-language refinement (e.g. "focus on enterprise tier").',
      ),
    usePartialContext: z
      .boolean()
      .optional()
      .describe(
        'When true, the retry includes the prior partial markdown as <previous_attempt_partial> context.',
      ),
  }),
  execute: async ({ zone, refinement, usePartialContext }) => {
    return {
      type: 'rerun-requested' as const,
      zone,
      refinement: refinement ?? null,
      usePartialContext: usePartialContext === true,
      message: `Queued rerun for ${zone}${refinement ? ` (refinement: ${refinement})` : ''}${usePartialContext ? ' [building on partial output]' : ''}.`,
      _intent: 'rerun_section',
      _payload: {
        zone,
        refinement: refinement ?? null,
        usePartialContext: usePartialContext === true,
      },
    };
  },
});

// ---------------------------------------------------------------------------
// Tool: draftStrategyBrief — compose or recompose the capstone brief.
// ---------------------------------------------------------------------------

const draftStrategyBrief = tool({
  description:
    'Draft (or redraft) the Offer & Angle Brief from the committed research sections. Use when the operator asks for the strategy brief, a reframe, or an initial positioning take.',
  inputSchema: z.object({
    refinement: z
      .string()
      .optional()
      .describe(
        'Operator framing/corrections to apply, verbatim where possible.',
      ),
  }),
  execute: async ({ refinement }) => {
    return {
      type: 'strategy-brief-requested' as const,
      refinement: refinement ?? null,
      message:
        'Drafting the Offer & Angle Brief from committed research. It will appear above the sections in about a minute.',
      _intent: 'draft_strategy_brief',
      _payload: { refinement: refinement ?? null },
    };
  },
});

// ---------------------------------------------------------------------------
// Tool: reviseStrategyBrief — surgical strategy-brief patch.
// ---------------------------------------------------------------------------

const reviseStrategyBrief = tool({
  description:
    'Apply scoped patches to the committed strategy brief (path/value pairs) with a changelog entry. Use for small corrections; use draftStrategyBrief with refinement for reframes.',
  inputSchema: z.object({
    patches: z
      .array(
        z.object({
          path: z.string().min(1),
          value: z.string(),
        }),
      )
      .min(1)
      .describe(
        'applyPatch paths into the brief body, e.g. positioning.oneLiner or angles[0].adFrame.',
      ),
    changelogSummary: z.string().min(1),
    rationale: z.string().min(1),
  }),
  execute: async ({ patches, changelogSummary, rationale }) => {
    return {
      type: 'strategy-brief-revision-requested' as const,
      patchCount: patches.length,
      message: 'Applying the revision to the strategy brief.',
      _intent: 'revise_strategy_brief',
      _payload: { patches, changelogSummary, rationale },
    };
  },
});

// ---------------------------------------------------------------------------
// Tool: editSectionField — edit ANY field inside a committed section's typed
// body via commit_artifact_section. Replaces the dead editClaim/editNarrative
// pair, which patched paths (keyFindings[n].title / artifact.markdown) that do
// not exist in the typed envelope — committed sections store content under
// body.* (e.g. body.keyFindings[n].finding). The chat route resolves `path`
// against the section's body, schema-validates the patched body for that zone,
// and commits via commitChatPatchAuto. Invalid paths / schema failures are
// rejected with a clear message rather than writing a malformed body.
// ---------------------------------------------------------------------------

const editSectionField = tool({
  description:
    "Edit a single field inside a committed section's typed body. Use for one-line corrections — a competitor name, a TAM number, an ICP attribute, a source URL, a key finding's wording. The path is a dotted body path with [index] brackets (e.g. keyFindings[2].finding, competitorSet[0].name, sources[1].url); do NOT prefix it with \"body.\". The edit is rejected if the path doesn't resolve or the result fails the section schema. Do NOT use to add new items — use rerunSection for that.",
  inputSchema: z.object({
    zone: ZoneIdSchema,
    path: z
      .string()
      .min(1)
      .describe(
        'Dotted body path with optional [index] brackets, relative to the section body (no "body." prefix). E.g. keyFindings[0].finding, competitorSet[2].name, marketSize.tam, sources[1].url.',
      ),
    value: z
      .string()
      .describe('Replacement value for the field at `path`.'),
    reason: z.string().optional(),
  }),
  execute: async ({ zone, path, value, reason }) => {
    return {
      type: 'edit-section-field-requested' as const,
      zone,
      path,
      value,
      reason: reason ?? null,
      message: `Editing ${zone} field ${path}: "${value.slice(0, 80)}"`,
      _intent: 'edit_section_field',
      _payload: { zone, path, value, reason: reason ?? null },
    };
  },
});

// ---------------------------------------------------------------------------
// Tool: explainSource — read a source and narrate.
// ---------------------------------------------------------------------------

const explainSource = tool({
  description:
    'Explain why a particular source is cited in the artifact. Pulls the source row from the normalized tables and narrates its relevance to the zone that cited it.',
  inputSchema: z.object({
    sourceId: z.string(),
  }),
  execute: async ({ sourceId }) => {
    return {
      type: 'explain-source-pending' as const,
      sourceId,
      message: `Lookup for source ${sourceId} — narration happens in the orchestrator's next step using the artifact context already in scope.`,
    };
  },
});

// ---------------------------------------------------------------------------
// Tool: summarizeArtifact — read current state, return brief.
// ---------------------------------------------------------------------------

const summarizeArtifact = tool({
  description:
    "Return a one-paragraph summary of the artifact's current state: which zones are complete, which are running, key thesis points.",
  inputSchema: z.object({}),
  execute: async () => {
    return {
      type: 'summarize-pending' as const,
      message:
        'Summary will be composed in the orchestrator narration using the artifact snapshot the chat route attaches as system context.',
    };
  },
});

// ---------------------------------------------------------------------------
// Exported agent
// ---------------------------------------------------------------------------

export function createPositioningOrchestratorTools(): Record<string, Tool> {
  const chatResearchTools = buildToolMap(
    ['web_search', 'perplexity_research'],
    {
      budget: new SectionToolBudget(4),
      webSearchMaxUses: 4,
    },
  );

  return {
    rerunSection,
    draftStrategyBrief,
    reviseStrategyBrief,
    editSectionField,
    explainSource,
    summarizeArtifact,
    ...chatResearchTools,
  };
}

export const positioningOrchestratorTools = createPositioningOrchestratorTools();

export function createPositioningOrchestratorAgent(): ToolLoopAgent {
  return new ToolLoopAgent({
    model: anthropic('claude-sonnet-4-6'),
    instructions: ORCHESTRATOR_INSTRUCTIONS,
    tools: createPositioningOrchestratorTools(),
    stopWhen: stepCountIs(8),
    experimental_telemetry: {
      isEnabled: true,
      functionId: 'positioning-orchestrator',
    },
  });
}

export const positioningOrchestratorAgent = createPositioningOrchestratorAgent();

export type OrchestratorIntent =
  | 'rerun_section'
  | 'draft_strategy_brief'
  | 'revise_strategy_brief'
  | 'edit_section_field'
  | 'explain_source'
  | 'summarize_artifact';

/**
 * Helper: extract structured intents from the agent's tool-call messages so
 * the chat route's onFinish can apply them (dispatch worker, commit edits).
 * Returns the list of pending side-effects in the order the orchestrator
 * invoked them.
 */
export interface OrchestratorSideEffect {
  intent: OrchestratorIntent;
  payload: Record<string, unknown>;
}

export function extractOrchestratorSideEffects(
  toolResults: Array<{ output?: unknown }> | undefined,
): OrchestratorSideEffect[] {
  if (!Array.isArray(toolResults)) return [];
  const effects: OrchestratorSideEffect[] = [];
  for (const result of toolResults) {
    const out = result.output;
    if (!out || typeof out !== 'object') continue;
    const record = out as Record<string, unknown>;
    const intent = record._intent;
    const payload = record._payload;
    if (
      typeof intent === 'string' &&
      payload &&
      typeof payload === 'object'
    ) {
      effects.push({
        intent: intent as OrchestratorIntent,
        payload: payload as Record<string, unknown>,
      });
    }
  }
  return effects;
}
