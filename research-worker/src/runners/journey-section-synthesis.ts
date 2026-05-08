import type { BetaContentBlock } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import {
  buildRunnerTelemetry,
  createClient,
  emitArtifactProgress,
  emitRunnerProgress,
  extractJson,
  runStreamedToolRunner,
  runWithBackoff,
  type RunnerProgressReporter,
} from '../runner';
import type { ResearchResult } from '../supabase';
import { buildDeepResearchContainerParams } from '../anthropic-skills';
import { MODELS } from '../models';
import { maybeCachedSystem } from '../utils/prompt-cache';

const JOURNEY_SECTION_MODEL = process.env.RESEARCH_JOURNEY_SECTION_MODEL ?? MODELS.STANDARD;
const JOURNEY_SECTION_MAX_TOKENS = Number(process.env.RESEARCH_JOURNEY_SECTION_MAX_TOKENS ?? 18000);
const JOURNEY_SECTION_TIMEOUT_MS = Number(process.env.RESEARCH_JOURNEY_SECTION_TIMEOUT_MS ?? 600000);

export interface JourneySectionSpec {
  section: string;
  title: string;
  skill: string;
  mission: string;
  outputEmphasis: string[];
}

const SECTION_SPECS = {
  industryMarket: {
    section: 'industryMarket',
    title: 'Market Category Specialist',
    skill: 'ai-gos-market-category-intelligence',
    mission: 'Define the category, market forces, demand drivers, urgency, maturity, and strategic openings for the company.',
    outputEmphasis: ['category definition', 'market demand', 'timing signals', 'white-space opportunities'],
  },
  competitors: {
    section: 'competitors',
    title: 'Competitive Positioning Specialist',
    skill: 'ai-gos-competitive-positioning',
    mission: 'Identify direct/adjacent competitors, compare positioning, isolate gaps, and recommend defensible differentiation.',
    outputEmphasis: ['competitor set', 'positioning gaps', 'proof gaps', 'differentiation moves'],
  },
  icpValidation: {
    section: 'icpValidation',
    title: 'Buyer & ICP Specialist',
    skill: 'ai-gos-buyer-icp-validation',
    mission: 'Validate the buyer segment, jobs-to-be-done, pains, triggers, objections, buying committee, and qualification signals.',
    outputEmphasis: ['buyer definition', 'pain intensity', 'purchase triggers', 'qualification filters'],
  },
  offerAnalysis: {
    section: 'offerAnalysis',
    title: 'Offer Diagnostic Specialist',
    skill: 'ai-gos-offer-performance-diagnostic',
    mission: 'Diagnose the current offer, value equation, conversion risks, proof assets, objections, and offer improvement moves.',
    outputEmphasis: ['offer strength', 'value equation', 'risk reversals', 'conversion bottlenecks'],
  },
  keywordIntel: {
    section: 'keywordIntel',
    title: 'Demand & Intent Specialist',
    skill: 'ai-gos-demand-intent-signals',
    mission: 'Map demand language, search intent, problem-aware queries, competitor/category keywords, and content/ad angles.',
    outputEmphasis: ['intent clusters', 'demand language', 'paid/search angles', 'content opportunities'],
  },
  crossAnalysis: {
    section: 'crossAnalysis',
    title: 'GTM Synthesis Specialist',
    skill: 'ai-gos-gtm-synthesis',
    mission: 'Synthesize the prior artifacts into GTM strategy, strategic narrative, channel priorities, campaign thesis, and next actions.',
    outputEmphasis: ['strategic narrative', 'GTM priorities', 'campaign thesis', 'activation plan'],
  },
  mediaPlan: {
    section: 'mediaPlan',
    title: 'Activation Plan Specialist',
    skill: 'ai-gos-activation-plan',
    mission: 'Turn the GTM research into an execution-ready media and activation plan with campaigns, audiences, messaging, and measurement.',
    outputEmphasis: ['campaign structure', 'audience targeting', 'message angles', 'measurement plan'],
  },
} as const satisfies Record<string, JourneySectionSpec>;

const SYSTEM_PROMPT = `You are AI-GOS's Anthropic Platform Skills section synthesis orchestrator.

You are NOT the legacy AI-GOS schema runner. Do not produce old section schemas such as categorySnapshot, marketDynamics, validatedPersona, offerStrength, campaignGroups, or workspace cards.

You have access to AI-GOS GTM Platform Skills through the Anthropic container. Use those skills as the specialist-agent methodology layer. Use web search only where the provided corpus is insufficient or needs freshness checks. Use code execution only for scratch organization/validation.

Return ONLY valid JSON. No markdown fences. Shape:
{
  "source": "anthropicPlatformSkills",
  "agentRuntime": "anthropic-platform-skills",
  "sectionTitle": "string",
  "specialistAgent": "string",
  "skillUsed": "string",
  "verdict": "string",
  "statusSummary": "string",
  "confidence": 0,
  "keyFindings": [{"title":"string","detail":"string","evidence":"string","sourceUrl":"string or null"}],
  "evidenceQuotes": [{"quote":"string","source":"string","url":"string or null","interpretation":"string"}],
  "risksOrGaps": ["string"],
  "recommendedMoves": ["string"],
  "sources": [{"title":"string","url":"string","whyItMatters":"string"}]
}

Rules:
- Every important claim needs evidence or an explicit gap.
- Make the output read like a GTM strategist report artifact, not a JSON form fill.
- If the corpus lacks evidence, name the missing source and continue with a bounded recommendation.
- Keep findings concrete and client-useful.`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function normalizeSectionPayload(
  parsed: Record<string, unknown>,
  spec: JourneySectionSpec,
): Record<string, unknown> {
  return {
    source: 'anthropicPlatformSkills',
    agentRuntime: 'anthropic-platform-skills',
    sectionTitle: asString(parsed.sectionTitle) ?? spec.title,
    specialistAgent: asString(parsed.specialistAgent) ?? spec.title,
    skillUsed: asString(parsed.skillUsed) ?? spec.skill,
    verdict: asString(parsed.verdict) ?? asString(parsed.statusSummary) ?? `${spec.title} completed with source-backed findings.`,
    statusSummary: asString(parsed.statusSummary) ?? `Synthesized by ${spec.title} using the Anthropic Platform Skills GTM agent team.`,
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 75,
    keyFindings: Array.isArray(parsed.keyFindings) ? parsed.keyFindings : [],
    evidenceQuotes: Array.isArray(parsed.evidenceQuotes) ? parsed.evidenceQuotes : [],
    risksOrGaps: Array.isArray(parsed.risksOrGaps) ? parsed.risksOrGaps : [],
    recommendedMoves: Array.isArray(parsed.recommendedMoves) ? parsed.recommendedMoves : [],
    sources: Array.isArray(parsed.sources) ? parsed.sources : [],
  };
}

function formatStringList(title: string, values: unknown): string | null {
  if (!Array.isArray(values)) {
    return null;
  }

  const lines = values
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => `- ${value.trim()}`);

  return lines.length > 0 ? `### ${title}\n${lines.join('\n')}` : null;
}

function formatFindingLines(value: unknown): string | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const lines = value.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const title = asString(item.title);
    const detail = asString(item.detail) ?? asString(item.evidence);
    if (title && detail) {
      return [`- ${title}: ${detail}`];
    }

    return title ?? detail ? [`- ${title ?? detail ?? ''}`] : [];
  });

  return lines.length > 0 ? `### Key Findings\n${lines.join('\n')}` : null;
}

function formatEvidenceQuoteLines(value: unknown): string | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const lines = value.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const quote = asString(item.quote);
    const interpretation = asString(item.interpretation);
    const source = asString(item.source);
    if (!quote && !interpretation) {
      return [];
    }

    return [`- ${quote ?? interpretation}${source ? ` (${source})` : ''}`];
  });

  return lines.length > 0 ? `### Evidence\n${lines.join('\n')}` : null;
}

export function formatJourneySectionArtifactMarkdown(
  data: Record<string, unknown>,
  spec: JourneySectionSpec,
): string {
  const sectionTitle = asString(data.sectionTitle) ?? spec.title;
  const summary =
    asString(data.statusSummary) ??
    asString(data.verdict) ??
    `${spec.title} is writing a source-backed report section.`;
  const sections = [
    `## ${sectionTitle}\n\n${summary}`,
    formatFindingLines(data.keyFindings),
    formatEvidenceQuoteLines(data.evidenceQuotes),
    formatStringList('Recommended Moves', data.recommendedMoves),
    formatStringList('Risks / Gaps', data.risksOrGaps),
  ].filter((section): section is string => Boolean(section));

  return sections.join('\n\n');
}

export async function runJourneySection(
  spec: JourneySectionSpec,
  context: string,
  onProgress?: RunnerProgressReporter,
): Promise<ResearchResult> {
  const startTime = Date.now();
  try {
    const container = buildDeepResearchContainerParams();
    const client = createClient({ enableSkillsBeta: true });
    await emitRunnerProgress(onProgress, 'runner', `${spec.title} starting`, {
      toolName: spec.skill,
    });
    // Honest streaming contract: we are about to gather evidence, not draft text.
    // Frontend label maps this to "Researching"; tool/runner emissions stream
    // into the activity log while the corpus + web search work happens.
    await emitArtifactProgress(onProgress, {
      type: 'artifact-section-state',
      section: spec.section,
      status: 'researching',
      title: spec.title,
    });

    const finalMsg = await runWithBackoff(
      () => {
        const runner = client.beta.messages.toolRunner({
          model: JOURNEY_SECTION_MODEL,
          max_tokens: JOURNEY_SECTION_MAX_TOKENS,
          stream: true,
          ...(container ? { container } : {}),
          tools: [
            { type: 'web_search_20250305' as const, name: 'web_search' },
            ...(container ? [{ type: 'code_execution_20250825' as const, name: 'code_execution' as const }] : []),
          ],
          system: maybeCachedSystem(SYSTEM_PROMPT) as Parameters<typeof client.beta.messages.toolRunner>[0]['system'],
          messages: [{
            role: 'user',
            content: `Specialist agent: ${spec.title}\nPlatform skill to apply: ${spec.skill}\nMission: ${spec.mission}\nOutput emphasis: ${spec.outputEmphasis.join(', ')}\n\nUse the confirmed company corpus, prior approved Journey artifacts, uploaded/meeting context, and any fresh Anthropic web-search evidence needed. Produce the normalized report artifact JSON only.\n\nCONTEXT:\n${context}`,
          }],
        });
        return Promise.race([
          runStreamedToolRunner(runner, {
            onProgress,
            synthesisMessage: `${spec.title} writing report artifact`,
            maxToolIterations: 8,
          }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Journey section synthesis timed out after ${Math.round(JOURNEY_SECTION_TIMEOUT_MS / 1000)}s`)), JOURNEY_SECTION_TIMEOUT_MS)),
        ]);
      },
      `journey-section:${spec.section}`,
    );

    const textBlock = [...finalMsg.content].reverse().find((b: BetaContentBlock) => b.type === 'text');
    const resultText = textBlock && 'text' in textBlock ? textBlock.text : '';
    const parsed = extractJson(resultText);
    if (!isRecord(parsed)) {
      // Honest streaming contract: research finished but JSON parse failed.
      // Surface the error to the artifact panel so the label flips from
      // "Researching" to "Error" instead of hanging at the start state.
      await emitArtifactProgress(onProgress, {
        type: 'artifact-section-state',
        section: spec.section,
        status: 'error',
        title: spec.title,
      });
      return {
        status: 'error',
        section: spec.section,
        error: 'Anthropic Platform Skills section runner returned non-object JSON',
        durationMs: Date.now() - startTime,
        rawText: resultText,
        telemetry: buildRunnerTelemetry(finalMsg),
      };
    }

    const data = normalizeSectionPayload(parsed, spec);
    // Honest streaming contract: research is done; about to write the real
    // markdown into the artifact. Frontend label maps this to "Drafting".
    // This is the brief window between the JSON returning and the delta being
    // appended — short, but it is the actual drafting moment.
    await emitArtifactProgress(onProgress, {
      type: 'artifact-section-state',
      section: spec.section,
      status: 'drafting',
      title: asString(data.sectionTitle) ?? spec.title,
    });
    await emitArtifactProgress(onProgress, {
      type: 'artifact-delta',
      section: spec.section,
      title: asString(data.sectionTitle) ?? spec.title,
      delta: `\n\n${formatJourneySectionArtifactMarkdown(data, spec)}`,
    });
    await emitArtifactProgress(onProgress, {
      type: 'artifact-section-state',
      section: spec.section,
      status: 'complete',
      title: asString(data.sectionTitle) ?? spec.title,
    });
    await emitArtifactProgress(onProgress, {
      type: 'artifact-finish',
      section: spec.section,
      title: asString(data.sectionTitle) ?? spec.title,
    });
    await emitRunnerProgress(onProgress, 'output', `${spec.title} artifact ready`, {
      toolName: spec.skill,
    });

    return {
      status: 'complete',
      section: spec.section,
      data,
      durationMs: Date.now() - startTime,
      rawText: resultText,
      telemetry: buildRunnerTelemetry(finalMsg),
      provenance: {
        status: 'sourced',
        citationCount: Array.isArray(data.sources) ? data.sources.length : 0,
      },
    };
  } catch (error) {
    await emitArtifactProgress(onProgress, {
      type: 'artifact-section-state',
      section: spec.section,
      status: 'error',
      title: spec.title,
    });
    return {
      status: 'error',
      section: spec.section,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    };
  }
}

export const runJourneyIndustryMarket = (context: string, onProgress?: RunnerProgressReporter) =>
  runJourneySection(SECTION_SPECS.industryMarket, context, onProgress);

export const runJourneyCompetitors = (context: string, onProgress?: RunnerProgressReporter) =>
  runJourneySection(SECTION_SPECS.competitors, context, onProgress);

export const runJourneyICPValidation = (context: string, onProgress?: RunnerProgressReporter) =>
  runJourneySection(SECTION_SPECS.icpValidation, context, onProgress);

export const runJourneyOfferAnalysis = (context: string, onProgress?: RunnerProgressReporter) =>
  runJourneySection(SECTION_SPECS.offerAnalysis, context, onProgress);

export const runJourneyKeywordIntel = (context: string, onProgress?: RunnerProgressReporter) =>
  runJourneySection(SECTION_SPECS.keywordIntel, context, onProgress);

export const runJourneyCrossAnalysis = (context: string, onProgress?: RunnerProgressReporter) =>
  runJourneySection(SECTION_SPECS.crossAnalysis, context, onProgress);

export const runJourneyMediaPlan = (context: string, onProgress?: RunnerProgressReporter) =>
  runJourneySection(SECTION_SPECS.mediaPlan, context, onProgress);
