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
import { generateText, Output } from 'ai';

import { emitRunnerProgress, type RunnerProgressReporter } from '../runner';
import { type ResearchResult } from '../supabase';
import { composeAbortSignals } from '../agent-tools/_shared';
import {
  POSITIONING_SUBAGENTS,
  isPositioningSubagentId,
} from '../agents/subagents';
import {
  PositioningEnvelopeSchema,
  type PositioningEnvelope,
} from '../agents/subagents/envelope-schema';
import {
  buildContextWithRefinement,
  formatJourneySectionArtifactMarkdown,
  type JourneySectionSpec,
} from './journey-section-synthesis';

const REPAIR_MODEL = anthropic('claude-haiku-4-5');
const REPAIR_TIMEOUT_MS = 60 * 1000;

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
        schema: PositioningEnvelopeSchema,
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
  } catch {
    clearTimeout(handle);
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

const SUBAGENT_TIMEOUT_MS = 4 * 60 * 1000;

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

/**
 * Best-effort coercion of a partial / raw payload into the envelope shape.
 * Used by the partial-recovery path when the tool loop crashed before
 * producing a schema-valid final answer. The happy path reads
 * `result.output` directly (already typed + validated).
 */
function coerceEnvelope(value: unknown): PositioningEnvelope | null {
  const parsed = PositioningEnvelopeSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  return null;
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

  const prompt = `Specialist agent: ${spec.title}
Mission: ${spec.mission}
Output emphasis: ${spec.outputEmphasis.join(', ')}

Run your tools, gather evidence, then return the structured positioning envelope. The runtime constrains your final answer to a JSON schema — populate every field. Cite a sourceUrl for every keyFinding when possible. confidence is a 0–10 self-rating; honesty > advocacy.

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

  // Phase 5: track the most recent step's text so we can recover partial
  // output if the tool loop fails before emitting a final envelope.
  let lastStepText = '';
  let stepCount = 0;
  const MAX_EXPECTED_STEPS = 6;

  try {
    const result = await agent.generate({
      prompt,
      abortSignal: composedSignal,
      onStepFinish: ({ text }: { text?: string }) => {
        stepCount += 1;
        if (typeof text === 'string' && text.trim().length > 0) {
          lastStepText = text;
        }
      },
    });

    clearTimeout(timeoutHandle);

    // Happy path: AI SDK v6 Output.object() guarantees the final answer
    // matches PositioningEnvelopeSchema. No manual JSON parse, no
    // "No parseable JSON found" failure mode.
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

    // Phase 5 — partial-output recovery.
    //
    // If the tool loop captured any step text before erroring, surface
    // a best-effort partial snapshot. With Output.object() schema
    // enforcement on the happy path, this only fires when the agent
    // errored or hit step cap without emitting a schema-valid envelope.
    // We do NOT attempt to parse `lastStepText` as JSON — intermediate
    // step text is rarely a complete envelope. Instead we snapshot
    // whatever the loop produced so the section row gets context, not
    // a hard error with empty data.
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
