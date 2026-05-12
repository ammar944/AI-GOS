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

import { extractJson, emitRunnerProgress, type RunnerProgressReporter } from '../runner';
import { type ResearchResult } from '../supabase';
import {
  POSITIONING_SUBAGENTS,
  isPositioningSubagentId,
} from '../agents/subagents';
import {
  buildContextWithRefinement,
  formatJourneySectionArtifactMarkdown,
  type JourneySectionSpec,
} from './journey-section-synthesis';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

const SUBAGENT_TIMEOUT_MS = 4 * 60 * 1000;

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

interface SubagentEnvelope {
  sectionTitle?: string;
  verdict?: string;
  statusSummary?: string;
  confidence?: number;
  keyFindings?: unknown;
  evidenceQuotes?: unknown;
  risksOrGaps?: unknown;
  recommendedMoves?: unknown;
  sources?: unknown;
}

export async function runJourneySectionViaSubagent(
  spec: JourneySectionSpec,
  context: string,
  onProgress?: RunnerProgressReporter,
  chatRefinement?: string,
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

Use the confirmed company corpus, prior approved Journey artifacts, and any tool calls needed. Produce ONLY the normalized JSON envelope (no prose).

CONTEXT:
${refinedContext}`;

  // P2 fix: AbortController so the timeout actually cancels the in-flight
  // agent.generate() (and its tool calls). Previously Promise.race resolved
  // the timeout but the agent kept running, burning Anthropic quota until
  // the model returned.
  const controller = new AbortController();
  const timeoutHandle = setTimeout(
    () => controller.abort(new Error(`Subagent timeout after ${SUBAGENT_TIMEOUT_MS / 1000}s`)),
    SUBAGENT_TIMEOUT_MS,
  );

  try {
    const result = await agent.generate({
      prompt,
      abortSignal: controller.signal,
    });

    clearTimeout(timeoutHandle);
    const rawText = (result as { text?: string }).text ?? '';
    const parsed = extractJson(rawText);
    if (!isRecord(parsed)) {
      await emitRunnerProgress(onProgress, 'error', 'Subagent returned non-object JSON');
      return {
        status: 'error',
        section: spec.section,
        error: 'Subagent returned non-object JSON',
        durationMs: Date.now() - startTime,
      };
    }

    const envelope = parsed as SubagentEnvelope;
    const sectionTitle = asString(envelope.sectionTitle) ?? spec.title;
    const verdict = asString(envelope.verdict) ?? 'Pending review';
    const statusSummary =
      asString(envelope.statusSummary) ??
      `${sectionTitle} produced by the ${spec.section} subagent.`;
    const confidence =
      typeof envelope.confidence === 'number'
        ? Math.max(0, Math.min(10, envelope.confidence))
        : 5;

    const finalEnvelope: Record<string, unknown> = {
      sectionTitle,
      verdict,
      statusSummary,
      confidence,
      agentRuntime: 'ai-sdk-subagent',
      keyFindings: Array.isArray(envelope.keyFindings) ? envelope.keyFindings : [],
      evidenceQuotes: Array.isArray(envelope.evidenceQuotes) ? envelope.evidenceQuotes : [],
      risksOrGaps: Array.isArray(envelope.risksOrGaps) ? envelope.risksOrGaps : [],
      recommendedMoves: Array.isArray(envelope.recommendedMoves)
        ? envelope.recommendedMoves
        : [],
      sources: Array.isArray(envelope.sources) ? envelope.sources : [],
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
    await emitRunnerProgress(onProgress, 'error', message);
    return {
      status: 'error',
      section: spec.section,
      error: message,
      durationMs: Date.now() - startTime,
    };
  }
}
