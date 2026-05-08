import {
  createClient,
  buildRunnerTelemetry,
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

const DEEP_RESEARCH_MODEL = process.env.RESEARCH_DEEP_PROGRAM_MODEL ?? MODELS.STANDARD;
const DEEP_RESEARCH_MAX_TOKENS = Number(process.env.RESEARCH_DEEP_PROGRAM_MAX_TOKENS ?? 20000);
const DEEP_RESEARCH_TIMEOUT_MS = Number(process.env.RESEARCH_DEEP_PROGRAM_TIMEOUT_MS ?? 900000);
const DEEP_RESEARCH_REPAIR_TIMEOUT_MS = Number(process.env.RESEARCH_DEEP_PROGRAM_REPAIR_TIMEOUT_MS ?? 120000);
const DEEP_RESEARCH_REPAIR_MAX_TOKENS = Number(process.env.RESEARCH_DEEP_PROGRAM_REPAIR_MAX_TOKENS ?? 12000);

interface CapturedDeepResearchSource {
  title: string;
  url: string;
}

const DEEP_RESEARCH_SYSTEM_PROMPT = `You are AI-GOS's Deep Research Agent for a supervised GTM workspace.

MISSION
Run one evidence-grounded company/category research pass that extracts and verifies company context for onboarding.
Do not write GTM section cards. Do not synthesize market, ICP, competitor, offer, keyword, or VoC sections.
Your job is to build the company corpus that later section-specific synthesis jobs will use one by one.

STYLE
- Be specific, executive, and useful. No generic strategy filler.
- Every major claim must be backed by a source, quote, user-provided context, or explicit "insufficient evidence" marker.
- Do not invent market size, pricing, CAC, ROAS, search volume, competitor claims, or customer quotes.
- If source coverage is thin, say exactly what is missing and still provide the best grounded diagnosis.
- Keep output concise but complete enough to complete onboarding and seed later section synthesis.

OUTPUT
Return ONLY valid JSON. No markdown fences. Shape:
{
  "corpus": {
    "company": "string",
    "category": "string",
    "researchSummary": "string",
    "sources": [{"title":"string","url":"string","whyItMatters":"string"}],
    "evidence": [{"claim":"string","source":"string","url":"string","quote":"string","confidence":85}]
  },
  "onboardingFields": {
    "companyName": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "businessModel": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "industryVertical": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "primaryIcpDescription": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "jobTitles": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "companySize": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "geography": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "headquartersLocation": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "productDescription": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "coreDeliverables": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "pricingTiers": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "valueProp": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "guarantees": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "topCompetitors": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "uniqueEdge": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "marketProblem": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "situationBeforeBuying": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "desiredTransformation": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "commonObjections": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "brandPositioning": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "testimonialQuote": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "caseStudiesUrl": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "testimonialsUrl": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "pricingUrl": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "demoUrl": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"}
  }
}

ONBOARDING FIELD RULES
- onboardingFields is required. This is the field payload the user reviews before section synthesis.
- Only populate a field when the value is supported by a source in corpus.sources/evidence or by the supplied user context.
- Use concise, normalized field values. Do not paste the same homepage meta description into multiple fields.
- For companyName, return the clean company name, not the page title or SEO title.
- For productDescription, say what the product does in one concise sentence.
- For primaryIcpDescription, describe the buyer/user segment, not a generic customer count claim.
- For coreDeliverables, list concrete product capabilities/features.
- For fields that are not publicly discoverable, set value null, confidence 0, sourceUrl null, and explain the gap.

CRITICAL RETURN CONTRACT
- Do not export, attach, or summarize the final JSON as a file.
- The final assistant response itself must contain the complete JSON object.
- The final response must start with "{" and end with "}". No preamble, no completion note, no file path, no markdown.`;

const DEEP_RESEARCH_REPAIR_SYSTEM_PROMPT = `You repair an AI-GOS Deep Research Agent draft into the required onboarding JSON.

Return ONLY valid JSON. No markdown fences, no preamble.

Rules:
- Use only the supplied original user context, captured sources, and incomplete draft.
- Do not invent facts. Unsupported onboarding fields must be {"value": null, "confidence": 0, "sourceUrl": null, "reasoning": "Not verified in captured evidence."}.
- Preserve source URLs exactly when used.
- The output shape must match the Deep Research Agent contract:
{
  "corpus": {
    "company": "string",
    "category": "string",
    "researchSummary": "string",
    "sources": [{"title":"string","url":"string","whyItMatters":"string"}],
    "evidence": [{"claim":"string","source":"string","url":"string","quote":"string","confidence":85}]
  },
  "onboardingFields": {
    "companyName": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "businessModel": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "industryVertical": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "primaryIcpDescription": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "jobTitles": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "companySize": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "geography": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "headquartersLocation": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "productDescription": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "coreDeliverables": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "pricingTiers": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "valueProp": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "guarantees": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "topCompetitors": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "uniqueEdge": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "marketProblem": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "situationBeforeBuying": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "desiredTransformation": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "commonObjections": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "brandPositioning": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "testimonialQuote": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "caseStudiesUrl": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "testimonialsUrl": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "pricingUrl": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"},
    "demoUrl": {"value":"string or null","confidence":85,"sourceUrl":"string or null","reasoning":"string"}
  }
}`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasAnthropicAuth(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

function tryExtractJson(text: string): unknown | null {
  if (text.trim().length === 0) {
    return null;
  }

  try {
    return extractJson(text);
  } catch {
    return null;
  }
}

function countUsableOnboardingFields(result: Record<string, unknown>): number {
  const data = isRecord(result.data) ? result.data : result;
  const onboardingFields = isRecord(data.onboardingFields)
    ? data.onboardingFields
    : null;

  if (!onboardingFields) {
    return 0;
  }

  return Object.values(onboardingFields).filter((field) => {
    if (typeof field === 'string') {
      return field.trim().length > 0;
    }

    if (!isRecord(field)) {
      return false;
    }

    return (
      typeof field.value === 'string' &&
      field.value.trim().length > 0
    );
  }).length;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readContextField(context: string, label: string): string | null {
  const line = context
    .split('\n')
    .find((candidate) => candidate.toLowerCase().startsWith(`${label.toLowerCase()}:`));
  if (!line) {
    return null;
  }

  return readString(line.slice(line.indexOf(':') + 1));
}

function inferCompanyNameFromContext(context: string): string | null {
  return (
    readContextField(context, 'Company Name') ??
    readContextField(context, 'Website') ??
    readContextField(context, 'websiteUrl')
  );
}

function getDeepResearchCompanyName(parsed: Record<string, unknown>, context: string): string {
  const corpus = isRecord(parsed.corpus) ? parsed.corpus : null;
  const onboardingFields = isRecord(parsed.onboardingFields) ? parsed.onboardingFields : null;
  const companyNameField = isRecord(onboardingFields?.companyName)
    ? onboardingFields.companyName
    : null;

  return (
    readString(corpus?.company) ??
    readString(companyNameField?.value) ??
    inferCompanyNameFromContext(context) ??
    'Company'
  );
}

function formatSourceLine(source: unknown): string | null {
  if (!isRecord(source)) {
    return null;
  }

  const title = readString(source.title);
  const url = readString(source.url);
  const whyItMatters = readString(source.whyItMatters);

  if (!title && !url) {
    return null;
  }

  return `- ${title ?? url}${url ? ` (${url})` : ''}${whyItMatters ? `: ${whyItMatters}` : ''}`;
}

function formatEvidenceLine(evidence: unknown): string | null {
  if (!isRecord(evidence)) {
    return null;
  }

  const claim = readString(evidence.claim);
  const quote = readString(evidence.quote);
  const source = readString(evidence.source);

  if (!claim && !quote) {
    return null;
  }

  return `- ${claim ?? quote}${source ? ` (${source})` : ''}`;
}

function addCapturedSource(
  sources: CapturedDeepResearchSource[],
  source: CapturedDeepResearchSource,
): void {
  if (sources.some((candidate) => candidate.url === source.url)) {
    return;
  }

  sources.push(source);
}

function formatCapturedSources(
  sources: CapturedDeepResearchSource[],
): string {
  if (sources.length === 0) {
    return 'No web sources were captured before repair.';
  }

  return sources
    .slice(0, 24)
    .map((source) => `- ${source.title} (${source.url})`)
    .join('\n');
}

function readMessageText(message: { content?: unknown }): string {
  if (!Array.isArray(message.content)) {
    return '';
  }

  return message.content
    .map((block) => {
      if (!isRecord(block) || block.type !== 'text') {
        return '';
      }

      return typeof block.text === 'string' ? block.text : '';
    })
    .join('\n')
    .trim();
}

export function formatDeepResearchArtifactMarkdown(
  parsed: Record<string, unknown>,
  context: string,
): { title: string; markdown: string } {
  const companyName = getDeepResearchCompanyName(parsed, context);
  const corpus = isRecord(parsed.corpus) ? parsed.corpus : parsed;
  const summary =
    readString(corpus.researchSummary) ??
    'Deep Research Agent built the source-backed company corpus for section synthesis.';
  const evidenceLines = Array.isArray(corpus.evidence)
    ? corpus.evidence.map(formatEvidenceLine).filter((line): line is string => Boolean(line))
    : [];
  const sourceLines = Array.isArray(corpus.sources)
    ? corpus.sources.map(formatSourceLine).filter((line): line is string => Boolean(line))
    : [];
  const sections = [
    `## Deep Research\n\n${summary}`,
    evidenceLines.length > 0
      ? `### Evidence Highlights\n${evidenceLines.slice(0, 5).join('\n')}`
      : null,
    sourceLines.length > 0
      ? `### Sources\n${sourceLines.slice(0, 8).join('\n')}`
      : null,
  ].filter((section): section is string => Boolean(section));

  return {
    title: `${companyName} GTM Research`,
    markdown: sections.join('\n\n'),
  };
}

async function repairDeepResearchJson(
  client: ReturnType<typeof createClient>,
  input: {
    context: string;
    draftText: string;
    sources: CapturedDeepResearchSource[];
  },
): Promise<{
  parsed: Record<string, unknown>;
  rawText: string;
  message: Parameters<typeof buildRunnerTelemetry>[0];
}> {
  const repairMessage = await Promise.race([
    client.messages.create({
      model: DEEP_RESEARCH_MODEL,
      max_tokens: DEEP_RESEARCH_REPAIR_MAX_TOKENS,
      temperature: 0,
      system: maybeCachedSystem(DEEP_RESEARCH_REPAIR_SYSTEM_PROMPT) as Parameters<typeof client.messages.create>[0]['system'],
      messages: [
        {
          role: 'user',
          content: `ORIGINAL USER CONTEXT\n${input.context}\n\nCAPTURED SOURCES\n${formatCapturedSources(input.sources)}\n\nINCOMPLETE DRAFT / MODEL OUTPUT\n${input.draftText || 'No draft text was produced.'}\n\nRepair this into the required JSON object now.`,
        },
      ],
    }),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Deep research repair timed out after ${Math.round(DEEP_RESEARCH_REPAIR_TIMEOUT_MS / 1000)}s`)),
        DEEP_RESEARCH_REPAIR_TIMEOUT_MS,
      ),
    ),
  ]);

  const rawText = readMessageText(repairMessage);
  const parsed = tryExtractJson(rawText);
  if (!parsed || !isRecord(parsed)) {
    throw new Error('Deep research repair returned no parseable JSON');
  }

  return {
    parsed,
    rawText,
    message: repairMessage as Parameters<typeof buildRunnerTelemetry>[0],
  };
}

export async function runDeepResearchProgram(
  context: string,
  onProgress?: RunnerProgressReporter,
): Promise<ResearchResult> {
  const startTime = Date.now();

  try {
    if (!hasAnthropicAuth()) {
      return {
        status: 'error',
        section: 'deepResearchProgram',
        error:
          'ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN is not configured in the research worker environment. Deep research cannot run without direct Anthropic auth.',
        durationMs: Date.now() - startTime,
      };
    }

    const client = createClient({ enableSkillsBeta: true });
    const capturedSources: CapturedDeepResearchSource[] = [];
    let latestTextSnapshot = '';
    const initialArtifactTitle = `${inferCompanyNameFromContext(context) ?? 'Company'} GTM Research`;
    await emitRunnerProgress(onProgress, 'runner', 'starting company research extraction');
    await emitArtifactProgress(onProgress, {
      type: 'artifact-clear',
      section: 'deepResearchProgram',
      title: initialArtifactTitle,
    });
    await emitArtifactProgress(onProgress, {
      type: 'artifact-section-state',
      section: 'deepResearchProgram',
      status: 'researching',
      title: initialArtifactTitle,
    });
    await emitArtifactProgress(onProgress, {
      type: 'artifact-delta',
      section: 'deepResearchProgram',
      title: initialArtifactTitle,
      delta: `# ${initialArtifactTitle}\n\n## Deep Research\n\nDeep Research Agent is building the source-backed corpus...`,
    });
    const finalMsg = await runWithBackoff(
      () => {
        const container = buildDeepResearchContainerParams();
        const runner = client.beta.messages.toolRunner({
          model: DEEP_RESEARCH_MODEL,
          max_tokens: DEEP_RESEARCH_MAX_TOKENS,
          stream: true,
          ...(container ? { container } : {}),
          tools: [
            { type: 'web_search_20250305' as const, name: 'web_search' },
            ...(container ? [{ type: 'code_execution_20250825' as const, name: 'code_execution' as const }] : []),
          ],
          system: maybeCachedSystem(DEEP_RESEARCH_SYSTEM_PROMPT) as Parameters<typeof client.beta.messages.toolRunner>[0]['system'],
          messages: [{
            role: 'user',
            content: `Use the onboarding/prefill context below as confirmed input. Run focused web research once and build the shared company evidence corpus for onboarding. Do not synthesize GTM report sections in this run.\n\n${context}`,
          }],
        });
        return Promise.race([
          runStreamedToolRunner(runner, {
            onProgress,
            synthesisMessage: 'assembling company corpus for onboarding',
            maxToolIterations: 20,
            onTextSnapshot: (snapshot) => {
              latestTextSnapshot = snapshot;
            },
            onWebSearchSource: (source) => {
              addCapturedSource(capturedSources, source);
            },
          }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Deep research program timed out after ${Math.round(DEEP_RESEARCH_TIMEOUT_MS / 1000)}s`)), DEEP_RESEARCH_TIMEOUT_MS)),
        ]);
      },
      'deepResearchProgram',
    );

    const resultText = readMessageText(finalMsg) || latestTextSnapshot;
    let parsed: unknown | null = tryExtractJson(resultText);
    let rawText = resultText;
    let telemetryMessage: Parameters<typeof buildRunnerTelemetry>[0] = finalMsg;

    if (!parsed || !isRecord(parsed)) {
      console.error('[deep-research-program] JSON extraction failed:', {
        assistantTextPreview: resultText.slice(0, 500),
      });
      await emitRunnerProgress(onProgress, 'analysis', 'repairing deep research JSON from captured evidence');
      const repaired = await repairDeepResearchJson(client, {
        context,
        draftText: resultText,
        sources: capturedSources,
      });
      parsed = repaired.parsed;
      rawText = `${resultText}\n\n--- repaired JSON ---\n${repaired.rawText}`.trim();
      telemetryMessage = repaired.message;
    }
    if (!isRecord(parsed)) {
      throw new Error('Deep research returned no parseable JSON after repair');
    }
    const parsedRecord: Record<string, unknown> = parsed;

    const onboardingFieldCount = countUsableOnboardingFields(parsedRecord);
    if (onboardingFieldCount === 0) {
      console.error('[deep-research-program] Missing onboardingFields payload:', {
        keys: Object.keys(parsedRecord),
      });
      await emitArtifactProgress(onProgress, {
        type: 'artifact-section-state',
        section: 'deepResearchProgram',
        status: 'error',
        title: initialArtifactTitle,
      });
      return {
        status: 'error',
        section: 'deepResearchProgram',
        error:
          'Deep research returned no usable onboardingFields. The onboarding review cannot open from shallow prefill data.',
        durationMs: Date.now() - startTime,
        rawText,
        telemetry: buildRunnerTelemetry(telemetryMessage),
      };
    }

    const artifact = formatDeepResearchArtifactMarkdown(parsedRecord, context);
    await emitArtifactProgress(onProgress, {
      type: 'artifact-delta',
      section: 'deepResearchProgram',
      title: artifact.title,
      delta: `\n\n${artifact.markdown}`,
    });
    await emitArtifactProgress(onProgress, {
      type: 'artifact-section-state',
      section: 'deepResearchProgram',
      status: 'complete',
      title: artifact.title,
    });
    await emitArtifactProgress(onProgress, {
      type: 'artifact-finish',
      section: 'deepResearchProgram',
      title: artifact.title,
    });

    return {
      status: 'complete',
      section: 'deepResearchProgram',
      data: parsedRecord,
      artifact,
      durationMs: Date.now() - startTime,
      rawText,
      telemetry: buildRunnerTelemetry(telemetryMessage),
      provenance: {
        status: 'sourced',
        citationCount: Array.isArray((parsedRecord.corpus as Record<string, unknown> | undefined)?.sources)
          ? ((parsedRecord.corpus as Record<string, unknown>).sources as unknown[]).length
          : 0,
      },
    };
  } catch (error) {
    await emitArtifactProgress(onProgress, {
      type: 'artifact-section-state',
      section: 'deepResearchProgram',
      status: 'error',
      title: `${inferCompanyNameFromContext(context) ?? 'Company'} GTM Research`,
    });
    return {
      status: 'error',
      section: 'deepResearchProgram',
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    };
  }
}
