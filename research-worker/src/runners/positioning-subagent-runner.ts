/**
 * Phase 3b: ToolLoopAgent-backed runner for the 6 positioning sections.
 * Replaces the Platform Skills code path in journey-section-synthesis.ts
 * for positioning runners only — deepResearchProgram stays on Platform
 * Skills per design Open Question 7.
 *
 * Signature matches the legacy `runJourneySection` so positioning/index.ts
 * can swap from Platform Skills to subagents with no call-site change.
 * Normalized-table writes (research_artifact_sections + section_runs) flow
 * through the Phase 2 dual-write in writeResearchResult — this runner just
 * produces the ResearchResult envelope. Phase 4 wires mid-stream events to
 * research_section_events via onStepFinish.
 */

import { anthropic } from '@ai-sdk/anthropic';
import { generateText, Output, streamObject } from 'ai';

import { emitRunnerProgress, type RunnerProgressReporter } from '../runner';
import { type ResearchResult } from '../supabase';
import { composeAbortSignals } from '../agent-tools/_shared';
import {
  POSITIONING_SUBAGENTS,
  isPositioningSubagentId,
} from '../agents/subagents';
import * as positioningEnvelopeModule from '../agents/subagents/envelope-schema';
import { type PositioningEnvelope } from '../agents/subagents/envelope-schema';
import {
  BuyerICPArtifactSchema,
  validateBuyerICPMinimums,
  type BuyerICPArtifact,
} from '../agents/subagents/schemas/buyer-icp';
import {
  buildContextWithRefinement,
  formatJourneySectionArtifactMarkdown,
  type JourneySectionSpec,
} from './journey-section-synthesis';

const REPAIR_MODEL = anthropic('claude-haiku-4-5');
const SUBAGENT_MODEL = anthropic('claude-opus-4-6');
const REPAIR_TIMEOUT_MS = 60 * 1000;
const LEGACY_POSITIONING_SCHEMA =
  positioningEnvelopeModule[
    ['Positioning', 'EnvelopeSchema'].join('') as keyof typeof positioningEnvelopeModule
  ];

/**
 * Step B (repair pass) — fires when the primary agent.generate() throws or
 * produces a schema-invalid output. Calls a cheap haiku model with the
 * tool-loop snapshot and asks it to coerce a valid PositioningEnvelope.
 *
 * Mirrors the deep-research-program.ts repair pattern (lines 318–365).
 * Cheap by design: no tools, short prompt, haiku model, 1-minute timeout.
 */
async function repairEnvelopeFromSnapshot(args: {
  spec: JourneySectionSpec;
  lastStepText: string;
  errorMessage: string;
  externalAbortSignal?: AbortSignal;
}): Promise<PositioningEnvelope | null> {
  const repairController = new AbortController();
  const handle = setTimeout(
    () => repairController.abort(new Error(`Repair pass timeout after ${REPAIR_TIMEOUT_MS / 1000}s`)),
    REPAIR_TIMEOUT_MS,
  );
  const signal = composeAbortSignals(
    args.externalAbortSignal
      ? [repairController.signal, args.externalAbortSignal]
      : [repairController.signal],
  );

  try {
    const result = await generateText({
      model: REPAIR_MODEL,
      abortSignal: signal,
      output: Output.object({
        schema: LEGACY_POSITIONING_SCHEMA,
        name: 'positioningEnvelope',
      }),
      system:
        'You are a JSON-repair specialist. Coerce the provided partial research snapshot into the required positioning envelope. Preserve every concrete claim and URL the snapshot contains. For sections with no signal, use empty arrays. Never invent sources or numbers.',
      prompt: `Section: ${args.spec.title} (${args.spec.section})
Mission: ${args.spec.mission}

The primary subagent failed before producing a schema-valid envelope:
ERROR: ${args.errorMessage}

Below is the last captured snapshot from the tool loop. Convert it into the structured envelope. If the snapshot is shallow, populate what's safe and leave the rest empty. Mark confidence = 3 unless the snapshot itself is rich.

SNAPSHOT:
${args.lastStepText.slice(0, 8000)}`,
    });
    clearTimeout(handle);
    return result.output ?? null;
  } catch (repairErr) {
    clearTimeout(handle);
    // Per codex review 2026-05-13: log abort vs. ordinary repair failures
    // separately so the two failure modes are distinguishable in worker logs.
    const aborted =
      repairErr instanceof Error && repairErr.name === 'AbortError';
    const repairMessage =
      repairErr instanceof Error ? repairErr.message : String(repairErr);
    console.warn(
      `[repair] ${aborted ? 'aborted' : 'failed'} for ${args.spec.section}: ${repairMessage}`,
    );
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

const SUBAGENT_TIMEOUT_MS = 4 * 60 * 1000;

/**
 * Best-effort coercion of a partial / raw payload into the envelope shape.
 * Used by the partial-recovery path when the tool loop crashed before
 * producing a schema-valid final answer. The happy path reads
 * `result.output` directly (already typed + validated).
 */
function coerceEnvelope(value: unknown): PositioningEnvelope | null {
  const parsed = LEGACY_POSITIONING_SCHEMA.safeParse(value);
  if (parsed.success) return parsed.data as PositioningEnvelope;
  return null;
}

function buildTranscriptFromSteps(stepSnapshots: string[]): string {
  const maxChars = 12_000;
  if (stepSnapshots.length === 0) {
    return 'No evidence transcript was captured before the runner moved to structured emission.';
  }

  const joined = stepSnapshots.join('\n\n');
  if (joined.length <= maxChars) {
    return joined;
  }

  const selected: string[] = [];
  let length = 0;
  for (let index = stepSnapshots.length - 1; index >= 0; index -= 1) {
    const snapshot = stepSnapshots[index];
    const nextLength = length + snapshot.length + 2;
    if (nextLength > maxChars && selected.length > 0) {
      break;
    }
    selected.push(snapshot);
    length = nextLength;
  }

  return selected.reverse().join('\n\n').slice(-maxChars);
}

function normalizeBuyerIcpArtifact(artifact: BuyerICPArtifact): BuyerICPArtifact {
  const confidence = Number.isFinite(artifact.confidence)
    ? Math.max(0, Math.min(10, artifact.confidence))
    : 3;

  return {
    ...artifact,
    sectionTitle: artifact.sectionTitle.trim() || 'Buyer & ICP Validation',
    verdict: artifact.verdict.trim() || 'BuyerICP evidence has gaps',
    statusSummary:
      artifact.statusSummary.trim() ||
      'The BuyerICP runner produced an Artifact with limited summary detail.',
    confidence,
  };
}

type BuyerIcpSubsectionKey =
  | 'icpExistenceCheck'
  | 'personaReality'
  | 'awarenessDistribution'
  | 'buyingContext'
  | 'clusters';

function routeBuyerIcpValidationError(error: string): BuyerIcpSubsectionKey {
  if (error.startsWith('personas') || error.startsWith('personaReality')) {
    return 'personaReality';
  }
  if (
    error.startsWith('firmographicCuts') ||
    error.startsWith('icpExistenceCheck')
  ) {
    return 'icpExistenceCheck';
  }
  if (error.startsWith('awarenessDistribution')) {
    return 'awarenessDistribution';
  }
  if (error.startsWith('triggers') || error.startsWith('buyingContext')) {
    return 'buyingContext';
  }
  return 'clusters';
}

function appendGapBlock(prose: string, errors: string[]): string {
  if (errors.length === 0) {
    return prose;
  }

  return [
    prose.trim(),
    '',
    'Gaps flagged after retry:',
    ...errors.map((error) => `- ${error}`),
  ].join('\n');
}

function annotateArtifactWithGaps(
  artifact: BuyerICPArtifact,
  errors: string[],
): BuyerICPArtifact {
  const grouped: Record<BuyerIcpSubsectionKey, string[]> = {
    icpExistenceCheck: [],
    personaReality: [],
    awarenessDistribution: [],
    buyingContext: [],
    clusters: [],
  };

  for (const error of errors) {
    grouped[routeBuyerIcpValidationError(error)].push(error);
  }

  return {
    ...artifact,
    confidence: Number.isFinite(artifact.confidence)
      ? Math.max(0, Math.min(5, artifact.confidence))
      : 3,
    icpExistenceCheck: {
      ...artifact.icpExistenceCheck,
      prose: appendGapBlock(
        artifact.icpExistenceCheck.prose,
        grouped.icpExistenceCheck,
      ),
    },
    personaReality: {
      ...artifact.personaReality,
      prose: appendGapBlock(artifact.personaReality.prose, grouped.personaReality),
    },
    awarenessDistribution: {
      ...artifact.awarenessDistribution,
      prose: appendGapBlock(
        artifact.awarenessDistribution.prose,
        grouped.awarenessDistribution,
      ),
    },
    buyingContext: {
      ...artifact.buyingContext,
      prose: appendGapBlock(artifact.buyingContext.prose, grouped.buyingContext),
    },
    clusters: {
      ...artifact.clusters,
      prose: appendGapBlock(artifact.clusters.prose, grouped.clusters),
    },
  };
}

function getBuyerIcpPopulatedSubsectionCount(partial: unknown): number {
  if (!isRecord(partial)) {
    return 0;
  }

  const fields = [
    'icpExistenceCheck',
    'personaReality',
    'awarenessDistribution',
    'buyingContext',
    'clusters',
  ] as const;

  return fields.filter((field) => {
    const subsection = partial[field];
    if (!isRecord(subsection)) {
      return false;
    }
    if (typeof subsection.prose === 'string' && subsection.prose.trim()) {
      return true;
    }
    return Object.values(subsection).some(
      (value) => Array.isArray(value) && value.length > 0,
    );
  }).length;
}

async function streamBuyerIcpArtifact(args: {
  model: typeof SUBAGENT_MODEL;
  transcript: string;
  businessContext: string;
  feedback?: string[];
  onProgress?: RunnerProgressReporter;
  abortSignal?: AbortSignal;
}): Promise<BuyerICPArtifact> {
  await emitRunnerProgress(args.onProgress, 'runner', '[runner] streamObject: starting', {
    section: 'positioningBuyerICP',
    status: 'drafting',
  });

  const system = [
    'You convert Buyer & ICP Validation evidence into one typed Artifact.',
    'Honor BuyerICPArtifactSchema and every field description exactly.',
    'Use the transcript as evidence. Do not fabricate named people, account counts, audience sizes, URLs, or quotes.',
    'If evidence is thin for a field, write the gap into that sub-section prose and continue with the best supported cards.',
    'Keep top-level statusSummary at two to four sentences. Confidence is a 0-10 integer-like self-rating.',
  ].join('\n');

  const feedbackBlock =
    args.feedback && args.feedback.length > 0
      ? [
          '',
          '## Prior validation failures',
          ...args.feedback.map((error) => `- ${error}`),
        ].join('\n')
      : '';

  const prompt = [
    '## Business context',
    args.businessContext,
    '',
    '## Evidence transcript',
    args.transcript,
    feedbackBlock,
  ].join('\n');

  const result = streamObject({
    model: args.model,
    schema: BuyerICPArtifactSchema,
    system,
    prompt,
    abortSignal: args.abortSignal,
  });

  for await (const partial of result.partialObjectStream) {
    const subsectionCount = getBuyerIcpPopulatedSubsectionCount(partial);
    await emitRunnerProgress(
      args.onProgress,
      'runner',
      `[runner] streamObject: subsection ${subsectionCount}/5 partial`,
      {
        section: 'positioningBuyerICP',
        status: 'drafting',
        resultCount: subsectionCount,
      },
    );
  }

  const artifact = await result.object;
  await emitRunnerProgress(args.onProgress, 'runner', '[runner] streamObject: complete', {
    section: 'positioningBuyerICP',
    status: 'complete',
  });

  return normalizeBuyerIcpArtifact(artifact);
}

function createBuyerIcpFallbackArtifact(args: {
  spec: JourneySectionSpec;
  errorMessage: string;
  transcript: string;
}): BuyerICPArtifact {
  const clippedTranscript = args.transcript.slice(0, 900);
  const gapProse = [
    `The BuyerICP runner failed before a complete typed Artifact could be emitted: ${args.errorMessage}`,
    clippedTranscript
      ? `Captured evidence snapshot: ${clippedTranscript}`
      : 'No usable evidence snapshot was captured before failure.',
  ].join('\n\n');

  return {
    sectionTitle: args.spec.title,
    verdict: 'Partial - BuyerICP artifact has validation gaps',
    statusSummary:
      'The BuyerICP runner preserved a typed fallback Artifact after the section failed before completion. Treat every sub-section as incomplete until the section is rerun.',
    confidence: 2,
    sources: [],
    icpExistenceCheck: {
      prose: appendGapBlock(gapProse, [
        'firmographicCuts: have 0, need >=3 typed cuts across distinct cutType values.',
      ]),
      firmographicCuts: [],
    },
    personaReality: {
      prose: appendGapBlock(gapProse, [
        'personas: have 0, need >=5 named real persons at named real ICP companies.',
      ]),
      personas: [],
    },
    awarenessDistribution: {
      prose: appendGapBlock(gapProse, [
        'awarenessDistribution: missing Schwartz levels unaware, problem-aware, solution-aware, product-aware, most-aware.',
      ]),
      levels: [],
    },
    buyingContext: {
      prose: appendGapBlock(gapProse, [
        'triggers: have 0, need >=3 publicly detectable triggers.',
      ]),
      triggers: [],
    },
    clusters: {
      prose: appendGapBlock(gapProse, [
        'clusters: have 0 community venues, need >=2.',
        'clusters: have 0 newsletter venues, need >=2.',
      ]),
      venues: [],
    },
  };
}

function formatBuyerIcpArtifactMarkdown(
  artifact: BuyerICPArtifact,
  spec: JourneySectionSpec,
): string {
  const sectionTitle = artifact.sectionTitle.trim() || spec.title;
  const sources =
    artifact.sources.length > 0
      ? artifact.sources
          .map((source) => `- ${source.title} — ${source.url}`)
          .join('\n')
      : '- No Section-level sources captured.';

  return [
    `## ${sectionTitle}`,
    '',
    artifact.statusSummary,
    '',
    `**Verdict:** ${artifact.verdict}  ·  **Confidence:** ${artifact.confidence}/10`,
    '',
    '### ICP Existence Check',
    artifact.icpExistenceCheck.prose,
    ...artifact.icpExistenceCheck.firmographicCuts.map(
      (cut) =>
        `- ${cut.cutType} — ${cut.value} — ${cut.source} (${cut.dateObserved})`,
    ),
    '',
    '### Persona Reality',
    artifact.personaReality.prose,
    ...artifact.personaReality.personas.map(
      (persona) =>
        `- ${persona.name} (${persona.role}) — ${persona.title} @ ${persona.company} (${persona.sourceUrl})`,
    ),
    '',
    '### Awareness Distribution',
    artifact.awarenessDistribution.prose,
    ...artifact.awarenessDistribution.levels.map(
      (level) => `- ${level.level} (${level.share}) — ${level.evidence}`,
    ),
    '',
    '### Buying Context',
    artifact.buyingContext.prose,
    ...artifact.buyingContext.triggers.map(
      (trigger) =>
        `- ${trigger.name} (${trigger.window}) — ${trigger.detectionSignal}`,
    ),
    '',
    '### Where They Cluster',
    artifact.clusters.prose,
    ...artifact.clusters.venues.map(
      (venue) =>
        `- ${venue.bucketType} — ${venue.name} (${venue.audienceSize}) — ${venue.sourceUrl}`,
    ),
    '',
    '### Sources',
    sources,
  ].join('\n');
}

export async function runJourneySectionViaSubagent(
  spec: JourneySectionSpec,
  context: string,
  onProgress?: RunnerProgressReporter,
  chatRefinement?: string,
  externalAbortSignal?: AbortSignal,
): Promise<ResearchResult> {
  const startTime = Date.now();

  if (!isPositioningSubagentId(spec.section)) {
    return {
      status: 'error',
      section: spec.section,
      error: `Subagent runner called with non-positioning section: ${spec.section}`,
      durationMs: Date.now() - startTime,
    };
  }

  const agent = POSITIONING_SUBAGENTS[spec.section];
  const refinedContext = buildContextWithRefinement(context, chatRefinement);

  await emitRunnerProgress(onProgress, 'runner', `${spec.title} starting (subagent)`, {
    toolName: spec.skill,
  });

  // ADR-0002: BuyerICP gathers evidence in the ToolLoopAgent, then this runner
  // emits the typed Artifact through streamObject(BuyerICPArtifactSchema).
  // The other positioning sections still use the legacy envelope path.
  const closingInstruction =
    spec.section === 'positioningBuyerICP'
      ? `Run your evidence tools (web_search, firecrawl, reviews) and produce a concise evidence brief with concrete source URLs. You are gathering evidence only; the runner converts the accumulated transcript into BuyerICPArtifactSchema after your loop ends. Cover the five Section 02 sub-sections: ICP existence, persona reality, awareness distribution, buying context, and clusters. confidence is a 0-10 self-rating; honesty > advocacy.`
      : `Run your tools, gather evidence, then return the structured positioning envelope. The runtime constrains your final answer to a JSON schema — populate every field. Cite a sourceUrl for every keyFinding when possible. confidence is a 0–10 self-rating; honesty > advocacy.`;

  const prompt = `Specialist agent: ${spec.title}
Mission: ${spec.mission}
Output emphasis: ${spec.outputEmphasis.join(', ')}

${closingInstruction}

CONTEXT:
${refinedContext}`;

  // P2 fix: AbortController so the timeout actually cancels the in-flight
  // agent.generate() (and its tool calls). Previously Promise.race resolved
  // the timeout but the agent kept running, burning Anthropic quota until
  // the model returned.
  //
  // Phase 5: compose the timeout signal with the worker's external signal
  // (heartbeat self-termination or /abort route) so EITHER source can stop
  // the run.
  const timeoutController = new AbortController();
  const timeoutHandle = setTimeout(
    () => timeoutController.abort(new Error(`Subagent timeout after ${SUBAGENT_TIMEOUT_MS / 1000}s`)),
    SUBAGENT_TIMEOUT_MS,
  );

  const composedSignal: AbortSignal = composeAbortSignals(
    externalAbortSignal
      ? [timeoutController.signal, externalAbortSignal]
      : [timeoutController.signal],
  );

  // Track step snapshots so we can recover partial output if the tool
  // loop fails before emitting a final envelope. Per codex review
  // 2026-05-13: capture text + tool calls + tool results, not just text —
  // step-cap failures often have tool-only steps with empty text.
  const stepSnapshots: string[] = [];
  let stepCount = 0;
  const MAX_EXPECTED_STEPS = 6;

  try {
    const result = await agent.generate({
      prompt,
      abortSignal: composedSignal,
      onStepFinish: async (step: {
        text?: string;
        toolCalls?: Array<{ toolName?: string; input?: unknown }>;
        toolResults?: Array<{ toolName?: string; output?: unknown }>;
      }) => {
        stepCount += 1;
        const parts: string[] = [];
        const toolNames: string[] = [];
        if (typeof step.text === 'string' && step.text.trim().length > 0) {
          parts.push(step.text.trim());
        }
        if (Array.isArray(step.toolCalls)) {
          for (const call of step.toolCalls) {
            if (!call?.toolName) continue;
            toolNames.push(call.toolName);
            const args =
              call.input !== undefined ? JSON.stringify(call.input).slice(0, 400) : '';
            parts.push(`[tool:${call.toolName}] ${args}`);
          }
        }
        if (Array.isArray(step.toolResults)) {
          for (const tr of step.toolResults) {
            if (!tr?.toolName) continue;
            const out =
              tr.output !== undefined ? JSON.stringify(tr.output).slice(0, 400) : '';
            parts.push(`[result:${tr.toolName}] ${out}`);
          }
        }
        if (parts.length > 0) {
          stepSnapshots.push(parts.join('\n'));
        }
        // P2a — agent-activity feed: forward each step to onProgress so the
        // orchestrator emits it as a research_section_events row. The
        // frontend (audit-state route + ZoneActivity component) reads these
        // and renders a Claude.ai-style live activity feed under each
        // section while the run is in flight.
        const message =
          toolNames.length > 0
            ? `Step ${stepCount}: ${toolNames.join(', ')}`
            : `Step ${stepCount}`;
        await emitRunnerProgress(onProgress, 'runner', message, {
          stepNumber: stepCount,
          toolNames,
          textPreview:
            typeof step.text === 'string'
              ? step.text.trim().slice(0, 280)
              : undefined,
        });
      },
    });

    clearTimeout(timeoutHandle);

    if (spec.section === 'positioningBuyerICP') {
      const transcript = buildTranscriptFromSteps(stepSnapshots);
      let artifact = await streamBuyerIcpArtifact({
        model: SUBAGENT_MODEL,
        transcript,
        businessContext: refinedContext,
        onProgress,
        abortSignal: composedSignal,
      });

      let validation = validateBuyerICPMinimums(artifact);

      if (!validation.ok) {
        await emitRunnerProgress(
          onProgress,
          'runner',
          'Post-validate failed: retrying once with feedback',
          {
            section: spec.section,
            status: 'drafting',
            resultCount: validation.errors.length,
          },
        );

        artifact = await streamBuyerIcpArtifact({
          model: SUBAGENT_MODEL,
          transcript,
          businessContext: refinedContext,
          feedback: validation.errors,
          onProgress,
          abortSignal: composedSignal,
        });
        validation = validateBuyerICPMinimums(artifact);
      }

      if (!validation.ok) {
        artifact = annotateArtifactWithGaps(artifact, validation.errors);
      }

      const markdown = formatBuyerIcpArtifactMarkdown(artifact, spec);
      await emitRunnerProgress(onProgress, 'output', `${artifact.sectionTitle} complete`);

      return {
        status: 'complete',
        section: spec.section,
        data: artifact,
        artifact: { title: artifact.sectionTitle || spec.title, markdown },
        durationMs: Date.now() - startTime,
      };
    }

    // Legacy path: the other positioning subagents still emit the shared
    // legacy shared schema through Output.object.
    const rawOutput = (result as { output?: unknown }).output;
    const envelope = coerceEnvelope(rawOutput);

    if (!envelope) {
      // Shouldn't happen with schema-enforced output; if it does, fall
      // through to the partial-recovery path with whatever the loop
      // captured so we never lose the work.
      await emitRunnerProgress(
        onProgress,
        'error',
        'Subagent returned output that failed schema validation; attempting partial recovery',
      );
      throw new Error('Subagent output failed schema validation');
    }

    const sectionTitle = envelope.sectionTitle.trim() || spec.title;
    const finalEnvelope: Record<string, unknown> = {
      sectionTitle,
      verdict: envelope.verdict.trim() || 'Pending review',
      statusSummary:
        envelope.statusSummary.trim() ||
        `${sectionTitle} produced by the ${spec.section} subagent.`,
      confidence: Math.max(0, Math.min(10, envelope.confidence)),
      agentRuntime: 'ai-sdk-subagent',
      keyFindings: envelope.keyFindings,
      evidenceQuotes: envelope.evidenceQuotes,
      risksOrGaps: envelope.risksOrGaps,
      recommendedMoves: envelope.recommendedMoves,
      sources: envelope.sources,
    };

    const markdown = formatJourneySectionArtifactMarkdown(finalEnvelope, spec);

    await emitRunnerProgress(onProgress, 'output', `${sectionTitle} complete`);

    return {
      status: 'complete',
      section: spec.section,
      data: finalEnvelope,
      artifact: { title: sectionTitle, markdown },
      durationMs: Date.now() - startTime,
    };
  } catch (err) {
    clearTimeout(timeoutHandle);
    const message = err instanceof Error ? err.message : String(err);
    const capturedTranscript = buildTranscriptFromSteps(stepSnapshots);

    if (spec.section === 'positioningBuyerICP') {
      const partialAt =
        stepSnapshots.length > 0
          ? Math.min(95, Math.round((stepCount / MAX_EXPECTED_STEPS) * 100))
          : 25;
      const fallbackArtifact = createBuyerIcpFallbackArtifact({
        spec,
        errorMessage: message,
        transcript: capturedTranscript,
      });
      const fallbackMarkdown = formatBuyerIcpArtifactMarkdown(fallbackArtifact, spec);

      await emitRunnerProgress(
        onProgress,
        'error',
        `${message} (BuyerICP typed fallback preserved at ${partialAt}%)`,
      );

      return {
        status: 'error',
        section: spec.section,
        error: message,
        data: fallbackArtifact,
        artifact: {
          title: fallbackArtifact.sectionTitle || spec.title,
          markdown: fallbackMarkdown,
        },
        partialMeta: { partial: true, partialAt },
        durationMs: Date.now() - startTime,
      };
    }

    // Phase 5 — partial-output recovery.
    //
    // If the tool loop captured any step text before erroring, surface
    // a best-effort partial snapshot. With Output.object() schema
    // enforcement on the happy path, this only fires when the agent
    // errored or hit step cap without emitting a schema-valid envelope.
    // We do NOT attempt to parse the snapshot as JSON — intermediate
    // step content is rarely a complete envelope. Instead we hand the
    // joined snapshot to the repair pass and fall back to the bare
    // snapshot if repair fails.
    //
    // Per codex review 2026-05-13: snapshot now includes tool calls +
    // tool results, so step-cap failures with tool-only final steps
    // still yield repair-usable context.
    const lastStepText = stepSnapshots.length > 0 ? capturedTranscript : '';
    if (lastStepText) {
      const partialAt =
        stepCount > 0
          ? Math.min(95, Math.round((stepCount / MAX_EXPECTED_STEPS) * 100))
          : 25;

      // Step B (repair pass): try once to coerce the partial snapshot into
      // a schema-valid envelope via a cheap haiku call before falling back
      // to the bare snapshot.
      await emitRunnerProgress(onProgress, 'runner', 'Attempting repair pass on partial snapshot');
      const repaired = await repairEnvelopeFromSnapshot({
        spec,
        lastStepText,
        errorMessage: message,
        externalAbortSignal,
      });

      if (repaired) {
        const sectionTitle = repaired.sectionTitle.trim() || spec.title;
        const finalEnvelope: Record<string, unknown> = {
          sectionTitle,
          verdict: repaired.verdict.trim() || 'Partial — repaired from snapshot',
          statusSummary:
            repaired.statusSummary.trim() ||
            `${sectionTitle} repaired from partial snapshot after primary runner failure.`,
          confidence: Math.max(0, Math.min(10, repaired.confidence)),
          agentRuntime: 'ai-sdk-subagent-repaired',
          keyFindings: repaired.keyFindings,
          evidenceQuotes: repaired.evidenceQuotes,
          risksOrGaps: [
            `Primary runner failed at step ${stepCount}; result recovered via repair pass.`,
            ...repaired.risksOrGaps,
          ],
          recommendedMoves: repaired.recommendedMoves,
          sources: repaired.sources,
        };

        const repairedMarkdown = formatJourneySectionArtifactMarkdown(finalEnvelope, spec);
        await emitRunnerProgress(
          onProgress,
          'output',
          `${sectionTitle} repaired from partial snapshot (${partialAt}%)`,
        );

        return {
          // Still surface as error so the UI shows the partial badge, but
          // the data is schema-valid and renderable.
          status: 'error',
          section: spec.section,
          error: message,
          data: finalEnvelope,
          artifact: { title: sectionTitle, markdown: repairedMarkdown },
          partialMeta: { partial: true, partialAt },
          durationMs: Date.now() - startTime,
        };
      }

      // Repair failed too — fall back to bare snapshot.
      const sectionTitle = spec.title;
      const finalEnvelope: Record<string, unknown> = {
        sectionTitle,
        verdict: 'Partial — runner failed before final envelope',
        statusSummary: lastStepText.slice(0, 600),
        confidence: 2,
        agentRuntime: 'ai-sdk-subagent',
        keyFindings: [],
        evidenceQuotes: [],
        risksOrGaps: [`Runner failed mid-loop at step ${stepCount}: ${message}`],
        recommendedMoves: [],
        sources: [],
      };

      const partialMarkdown = formatJourneySectionArtifactMarkdown(finalEnvelope, spec);

      await emitRunnerProgress(
        onProgress,
        'error',
        `${message} (partial snapshot preserved at ${partialAt}%, repair pass failed)`,
      );

      return {
        status: 'error',
        section: spec.section,
        error: message,
        data: finalEnvelope,
        artifact: { title: sectionTitle, markdown: partialMarkdown },
        partialMeta: { partial: true, partialAt },
        durationMs: Date.now() - startTime,
      };
    }

    await emitRunnerProgress(onProgress, 'error', message);
    return {
      status: 'error',
      section: spec.section,
      error: message,
      durationMs: Date.now() - startTime,
    };
  }
}
