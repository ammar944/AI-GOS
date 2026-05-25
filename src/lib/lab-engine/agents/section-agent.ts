import {
  forwardAnthropicContainerIdFromLastStep,
  type AnthropicProviderOptions,
} from "@ai-sdk/anthropic";
import {
  generateText,
  NoObjectGeneratedError,
  Output,
  stepCountIs,
  streamText,
  type StepResult,
  type Tool,
  type ToolSet,
  ToolLoopAgent,
} from "ai";
import { z } from "zod";

import type { SectionLanguageModel } from "../ai/models";

type AgentToolResultType = "tool-result" | "tool-error";

export interface AgentStep {
  stepNumber: number;
  finishReason: string;
  text: string;
  toolCalls: Array<{ toolName: string; input: unknown }>;
  toolResults: Array<{
    toolName: string;
    output: unknown;
    input?: unknown;
    type?: AgentToolResultType;
  }>;
}

export interface EvidencePassParams {
  model: SectionLanguageModel;
  instructions: string;
  prompt: string;
  tools: Record<string, unknown>;
  requiredToolSequence?: readonly string[];
  maxStepCount: number;
  maxOutputTokens: number;
  signal?: AbortSignal;
  onStepFinish?: (step: AgentStep) => void;
}

export interface EvidencePassResult {
  steps: AgentStep[];
  text: string;
}

export type EvidencePassRunner = (
  params: EvidencePassParams,
) => Promise<EvidencePassResult>;

export type EvidenceStreamRunner = EvidencePassRunner;

export interface AnswerToolParams {
  model: SectionLanguageModel;
  instructions: string;
  prompt: string;
  externalTools: Record<string, unknown>;
  answerTool: Tool;
  maxStepCount: number;
  maxOutputTokens: number;
  signal?: AbortSignal;
  onStepFinish?: (step: AgentStep) => void;
}

export interface AnswerToolResult {
  steps: AgentStep[];
  text: string;
  answerInput: unknown | undefined;
}

export type AnswerToolRunner = (
  params: AnswerToolParams,
) => Promise<AnswerToolResult>;

export type AnswerToolStreamer = AnswerToolRunner;

export interface RequiredToolStep {
  activeTools: string[];
  toolChoice: "required" | { type: "tool"; toolName: string };
}

type AnswerToolPrepareStep =
  | typeof forwardAnthropicContainerIdFromLastStep
  | (() => RequiredToolStep);
type ToolLoopAgentSettings = ConstructorParameters<typeof ToolLoopAgent>[0];
type AnswerToolProviderOptions = ToolLoopAgentSettings["providerOptions"];

function getPropertyValue(object: unknown, key: string): unknown {
  if (typeof object !== "object" || object === null || !(key in object)) {
    return undefined;
  }

  return object[key as keyof typeof object];
}

function getStringPropertyValue(object: unknown, key: string): string | undefined {
  const value = getPropertyValue(object, key);

  return typeof value === "string" ? value : undefined;
}

function isProviderTool(tools: Record<string, unknown>, toolName: string): boolean {
  const tool = tools[toolName];
  return getPropertyValue(tool, "type") === "provider";
}

export function prepareRequiredToolStep({
  requiredTool,
  tools,
}: {
  requiredTool: string;
  tools: Record<string, unknown>;
}): RequiredToolStep {
  if (isProviderTool(tools, requiredTool)) {
    return {
      activeTools: [requiredTool],
      toolChoice: "required",
    };
  }

  return {
    activeTools: [requiredTool],
    toolChoice: { type: "tool", toolName: requiredTool },
  };
}

function summarizeStep(step: {
  stepNumber: number;
  finishReason: string;
  text: string;
  content?: readonly unknown[];
  toolCalls: Array<{ toolName: string }>;
  toolResults: Array<{ toolName: string }>;
}): AgentStep {
  return {
    stepNumber: step.stepNumber,
    finishReason: step.finishReason,
    text: step.text,
    toolCalls: step.toolCalls.map((toolCall) => ({
      toolName: toolCall.toolName,
      input: getPropertyValue(toolCall, "input"),
    })),
    toolResults: [
      ...step.toolResults.map((toolResult) => ({
        toolName: toolResult.toolName,
        input: getPropertyValue(toolResult, "input"),
        output: getPropertyValue(toolResult, "output"),
        type: "tool-result" as const,
      })),
      ...summarizeToolErrors(step.content),
    ],
  };
}

function summarizeToolErrors(
  content: readonly unknown[] | undefined,
): AgentStep["toolResults"] {
  if (content === undefined) {
    return [];
  }

  return content.flatMap((part) => {
    if (getStringPropertyValue(part, "type") !== "tool-error") {
      return [];
    }

    const toolName = getStringPropertyValue(part, "toolName");

    if (toolName === undefined) {
      return [];
    }

    return [
      {
        toolName,
        input: getPropertyValue(part, "input"),
        output: getPropertyValue(part, "error"),
        type: "tool-error" as const,
      },
    ];
  });
}

function isAnswerToolResult(toolResult: {
  toolName: string;
  type?: AgentToolResultType;
}): boolean {
  return toolResult.toolName === "answer";
}

// The answer tool returns this shape when the model's input fails schema
// validation. It is a normal tool result (so the model can read the issues and
// retry), NOT a successful answer — the loop must keep going.
function isAnswerRejection(output: unknown): boolean {
  return getPropertyValue(output, "__answerRejected") === true;
}

function isSuccessfulAgentAnswerResult(toolResult: {
  toolName: string;
  type?: AgentToolResultType;
  output?: unknown;
}): boolean {
  return (
    isAnswerToolResult(toolResult) &&
    toolResult.type !== "tool-error" &&
    !isAnswerRejection(toolResult.output)
  );
}

function getAnswerInput(steps: readonly AgentStep[]): unknown | undefined {
  let sawAnswerResult = false;

  for (let stepIndex = steps.length - 1; stepIndex >= 0; stepIndex -= 1) {
    const step = steps[stepIndex];

    if (step === undefined) {
      continue;
    }

    for (
      let resultIndex = step.toolResults.length - 1;
      resultIndex >= 0;
      resultIndex -= 1
    ) {
      const toolResult = step.toolResults[resultIndex];

      if (toolResult === undefined || !isAnswerToolResult(toolResult)) {
        continue;
      }

      sawAnswerResult = true;

      if (isSuccessfulAgentAnswerResult(toolResult)) {
        return toolResult.output;
      }
    }
  }

  if (sawAnswerResult) {
    return undefined;
  }

  for (let stepIndex = steps.length - 1; stepIndex >= 0; stepIndex -= 1) {
    const step = steps[stepIndex];

    if (step === undefined) {
      continue;
    }

    for (
      let callIndex = step.toolCalls.length - 1;
      callIndex >= 0;
      callIndex -= 1
    ) {
      const toolCall = step.toolCalls[callIndex];

      if (toolCall?.toolName === "answer") {
        return toolCall.input;
      }
    }
  }

  return undefined;
}

function hasSuccessfulAnswerResult<TOOLS extends ToolSet>({
  steps,
}: {
  steps: Array<StepResult<TOOLS>>;
}): boolean {
  return steps.some((step) =>
    step.toolResults.some(
      (toolResult) =>
        toolResult.toolName === "answer" &&
        !isAnswerRejection(getPropertyValue(toolResult, "output")),
    ),
  );
}

export const defaultEvidencePassRunner: EvidencePassRunner = async (
  params,
): Promise<EvidencePassResult> => {
  const steps: AgentStep[] = [];
  const agent = new ToolLoopAgent({
    model: params.model,
    instructions: params.instructions,
    tools: params.tools as never,
    stopWhen: stepCountIs(params.maxStepCount) as never,
    maxOutputTokens: params.maxOutputTokens,
    prepareStep: ({ stepNumber }) => {
      const requiredTool = params.requiredToolSequence?.[stepNumber];

      if (requiredTool !== undefined) {
        return prepareRequiredToolStep({
          requiredTool,
          tools: params.tools,
        });
      }

      return undefined;
    },
  });
  const result = await agent.generate({
    prompt: params.prompt,
    abortSignal: params.signal,
    onStepFinish: (step) => {
      const summary = summarizeStep(step);
      steps.push(summary);
      params.onStepFinish?.(summary);
    },
  });

  return { steps, text: result.text ?? "" };
};

export const defaultEvidenceStreamRunner: EvidenceStreamRunner = async (
  params,
): Promise<EvidencePassResult> => {
  const steps: AgentStep[] = [];
  const agent = new ToolLoopAgent({
    model: params.model,
    instructions: params.instructions,
    tools: params.tools as never,
    stopWhen: stepCountIs(params.maxStepCount) as never,
    maxOutputTokens: params.maxOutputTokens,
    prepareStep: ({ stepNumber }) => {
      const requiredTool = params.requiredToolSequence?.[stepNumber];

      if (requiredTool !== undefined) {
        return prepareRequiredToolStep({
          requiredTool,
          tools: params.tools,
        });
      }

      return undefined;
    },
  });
  const result = await agent.stream({
    prompt: params.prompt,
    abortSignal: params.signal,
    onStepFinish: (step) => {
      const summary = summarizeStep(step);
      steps.push(summary);
      params.onStepFinish?.(summary);
    },
  });
  let text = "";

  for await (const chunk of result.textStream) {
    text += chunk;
  }

  return { steps, text };
};

export const defaultAnswerToolRunner: AnswerToolRunner = async (
  params,
): Promise<AnswerToolResult> => {
  const steps: AgentStep[] = [];
  const agent = new ToolLoopAgent({
    model: params.model,
    instructions: params.instructions,
    tools: {
      ...params.externalTools,
      answer: params.answerTool,
    } as never,
    stopWhen: [
      stepCountIs(params.maxStepCount),
      hasSuccessfulAnswerResult,
    ] as never,
    maxOutputTokens: params.maxOutputTokens,
    providerOptions: getAnswerToolProviderOptions(params.model),
    prepareStep: getAnswerToolPrepareStep({
      externalTools: params.externalTools,
      model: params.model,
    }),
  });
  const result = await agent.generate({
    prompt: params.prompt,
    abortSignal: params.signal,
    onStepFinish: (step) => {
      const summary = summarizeStep(step);
      steps.push(summary);
      params.onStepFinish?.(summary);
    },
  });

  return {
    steps,
    text: result.text ?? "",
    answerInput: getAnswerInput(steps),
  };
};

export const defaultAnswerToolStreamer: AnswerToolStreamer = async (
  params,
): Promise<AnswerToolResult> => {
  const steps: AgentStep[] = [];
  const agent = new ToolLoopAgent({
    model: params.model,
    instructions: params.instructions,
    tools: {
      ...params.externalTools,
      answer: params.answerTool,
    } as never,
    stopWhen: [
      stepCountIs(params.maxStepCount),
      hasSuccessfulAnswerResult,
    ] as never,
    maxOutputTokens: params.maxOutputTokens,
    providerOptions: getAnswerToolProviderOptions(params.model),
    prepareStep: getAnswerToolPrepareStep({
      externalTools: params.externalTools,
      model: params.model,
    }),
  });
  const result = await agent.stream({
    prompt: params.prompt,
    abortSignal: params.signal,
    onStepFinish: (step) => {
      const summary = summarizeStep(step);
      steps.push(summary);
      params.onStepFinish?.(summary);
    },
  });
  let text = "";

  for await (const chunk of result.textStream) {
    text += chunk;
  }

  return {
    steps,
    text,
    answerInput: getAnswerInput(steps),
  };
};

export interface StructuredCallParams<TOutput> {
  model: SectionLanguageModel;
  schema: z.ZodType<TOutput>;
  schemaName: string;
  schemaDescription: string;
  prompt: string;
  maxOutputTokens: number;
  signal?: AbortSignal;
}

export type StructuredCaller = (
  params: StructuredCallParams<unknown>,
) => Promise<unknown>;

export interface StructuredStreamResult {
  output: PromiseLike<unknown>;
  partialOutputStream: AsyncIterable<unknown>;
}

export type StructuredStreamer = (
  params: StructuredCallParams<unknown>,
) => StructuredStreamResult;

type AnthropicStructuredOutputMode = "jsonTool" | "outputFormat";

function isAnthropicModel(model: SectionLanguageModel): boolean {
  return model.provider.startsWith("anthropic.");
}

function isDeepSeekModel(model: SectionLanguageModel): boolean {
  return model.provider.startsWith("deepseek.");
}

function getAnswerToolProviderOptions(
  model: SectionLanguageModel,
): AnswerToolProviderOptions {
  if (!isDeepSeekModel(model)) {
    return undefined;
  }

  return {
    deepseek: {
      thinking: { type: "disabled" },
    },
  };
}

function getAnthropicPrepareStep(
  model: SectionLanguageModel,
): typeof forwardAnthropicContainerIdFromLastStep | undefined {
  if (!isAnthropicModel(model)) {
    return undefined;
  }

  return forwardAnthropicContainerIdFromLastStep;
}

function hasExternalTools(externalTools: Record<string, unknown>): boolean {
  return Object.keys(externalTools).length > 0;
}

function getRequiredAnswerToolPrepareStep(): () => RequiredToolStep {
  return () => ({
    activeTools: ["answer"],
    toolChoice: { type: "tool", toolName: "answer" },
  });
}

function getAnswerToolPrepareStep({
  externalTools,
  model,
}: {
  externalTools: Record<string, unknown>;
  model: SectionLanguageModel;
}): AnswerToolPrepareStep | undefined {
  if (!isAnthropicModel(model) && !hasExternalTools(externalTools)) {
    return getRequiredAnswerToolPrepareStep();
  }

  return getAnthropicPrepareStep(model);
}

function getStructuredProviderOptions({
  model,
  structuredOutputMode,
}: {
  model: SectionLanguageModel;
  structuredOutputMode: AnthropicStructuredOutputMode;
}): { anthropic: AnthropicProviderOptions } | undefined {
  if (!isAnthropicModel(model)) {
    return undefined;
  }

  return {
    anthropic: {
      structuredOutputMode,
    } satisfies AnthropicProviderOptions,
  };
}

const shallowSubsectionSchema = <TArrayKey extends string>(
  arrayKey: TArrayKey,
  itemSchema: z.ZodType<unknown> = z.unknown(),
): z.ZodObject<Record<"prose" | TArrayKey, z.ZodType<unknown>>> =>
  z
    .object({
      prose: z.string(),
      [arrayKey]: z.array(itemSchema),
    } as Record<"prose" | TArrayKey, z.ZodType<unknown>>)
    .passthrough();

const shallowObjectSubsectionSchema = <TObjectKey extends string>(
  objectKey: TObjectKey,
): z.ZodObject<Record<"prose" | TObjectKey, z.ZodType<unknown>>> =>
  z
    .object({
      prose: z.string(),
      [objectKey]: z.unknown(),
    } as Record<"prose" | TObjectKey, z.ZodType<unknown>>)
    .passthrough();

const genericStructuredProviderOutputSchema = z
  .object({
    sectionTitle: z.string(),
    verdict: z.string(),
    statusSummary: z.string(),
    confidence: z.number(),
    sources: z.array(
      z
        .object({
          title: z.string(),
          url: z.string(),
          publisher: z.string().optional(),
        })
        .passthrough(),
    ),
    body: z.unknown(),
  })
  .passthrough();

const buyerFirmographicCutProviderSchema = z
  .object({
    cutType: z.enum([
      "industry",
      "employeeBands",
      "revenueBands",
      "geography",
      "techStack",
    ]),
    value: z.string(),
    accountCount: z.string().optional(),
    source: z.string(),
    sourceUrl: z.string(),
    dateObserved: z.string(),
  })
  .passthrough();

const buyerPersonaProviderSchema = z
  .object({
    name: z.string(),
    title: z.string(),
    company: z.string(),
    sourceUrl: z.string(),
    role: z.enum([
      "champion",
      "economic-buyer",
      "decision-maker",
      "influencer",
      "end-user",
      "gatekeeper",
    ]),
    seniority: z.string(),
    teamSize: z.string().optional(),
    evidence: z.string(),
  })
  .passthrough();

const buyerAwarenessLevelProviderSchema = z
  .object({
    level: z.enum([
      "unaware",
      "problem-aware",
      "solution-aware",
      "product-aware",
      "most-aware",
    ]),
    share: z.string(),
    evidence: z.string(),
    sampleQuery: z.string().optional(),
  })
  .passthrough();

const buyerTriggerProviderSchema = z
  .object({
    name: z.string(),
    detectionSignal: z.string(),
    window: z.enum(["immediate", "weeks", "quarters"]),
    evidence: z.string(),
    sourceUrl: z.string().optional(),
  })
  .passthrough();

const buyerClusterVenueProviderSchema = z
  .object({
    bucketType: z.enum([
      "community",
      "newsletter",
      "conference",
      "podcast",
      "slack-group",
      "event",
    ]),
    name: z.string(),
    audienceSize: z.string(),
    sourceUrl: z.string(),
    whyItMatters: z.string(),
  })
  .passthrough();

const painQuoteProviderSchema = z
  .object({
    verbatimText: z.string(),
    source: z.enum([
      "g2",
      "reddit",
      "hackernews",
      "sales-call",
      "support-thread",
      "twitter",
      "other",
    ]),
    sourceUrl: z.string(),
    painTheme: z.string(),
    painIntensity: z.enum(["high", "medium", "low"]),
  })
  .passthrough();

const objectionProviderSchema = z
  .object({
    objectionText: z.string(),
    category: z.enum([
      "price",
      "feature",
      "trust",
      "switching-cost",
      "timing",
      "stakeholder",
      "other",
    ]),
    frequency: z.enum(["recurring", "occasional", "one-off"]),
    howToHandle: z.string(),
    sourceUrl: z.string(),
  })
  .passthrough();

const switchingStoryProviderSchema = z
  .object({
    priorSolution: z.string(),
    reasonToLeave: z.string(),
    decisionPath: z.string(),
    exampleCompany: z.string().optional(),
    sourceUrl: z.string(),
  })
  .passthrough();

const decisionCriterionProviderSchema = z
  .object({
    criterion: z.string(),
    statedBy: z.enum(["buyer", "champion", "influencer", "blocker"]),
    evidenceQuote: z.string(),
    sourceUrl: z.string(),
  })
  .passthrough();

const successQuoteProviderSchema = z
  .object({
    verbatimText: z.string(),
    source: z.enum([
      "g2",
      "reddit",
      "hackernews",
      "sales-call",
      "support-thread",
      "twitter",
      "other",
    ]),
    sourceUrl: z.string(),
    afterStatePattern: z.string(),
  })
  .passthrough();

const keywordSignalProviderSchema = z
  .object({
    keyword: z.string(),
    monthlyVolume: z.string(),
    intentType: z.enum([
      "informational",
      "commercial",
      "transactional",
      "navigational",
    ]),
    top3RankingDomains: z.array(z.string()),
    sourceTitle: z.string(),
    sourceUrl: z.string(),
    dateObserved: z.string(),
  })
  .passthrough();

const buyerQuestionProviderSchema = z
  .object({
    question: z.string(),
    surface: z.enum([
      "paa",
      "reddit",
      "quora",
      "community",
      "forum",
      "support-thread",
    ]),
    sourceUrl: z.string(),
    frequency: z.enum(["recurring", "occasional"]),
  })
  .passthrough();

const contentGapProviderSchema = z
  .object({
    topic: z.string(),
    evidenceOfDemand: z.string(),
    weakCompetitorAnswerEvidence: z.string(),
    opportunity: z.string(),
  })
  .passthrough();

const intentSignalProviderSchema = z
  .object({
    signalType: z.enum([
      "job-posting",
      "rfp",
      "news-trigger",
      "funding",
      "leadership-change",
    ]),
    description: z.string(),
    sourceUrl: z.string(),
    exampleCompany: z.string().optional(),
  })
  .passthrough();

const demandVenueProviderSchema = z
  .object({
    name: z.string(),
    venueType: z.enum(["event", "community", "newsletter", "podcast", "slack"]),
    audienceSize: z.string(),
    sourceUrl: z.string(),
  })
  .passthrough();

const fitProofPointProviderSchema = z
  .object({
    metric: z.string(),
    value: z.string(),
    reportedBy: z.enum(["company-own", "external-source"]),
    confidence: z.enum(["high", "medium", "low"]),
    sourceUrl: z.string(),
  })
  .passthrough();

const funnelBreakProviderSchema = z
  .object({
    stageName: z.string(),
    metric: z.string(),
    magnitude: z.string(),
    hypothesis: z.string(),
    sourceUrl: z.string(),
  })
  .passthrough();

const channelEvidenceProviderSchema = z
  .object({
    channelName: z.string(),
    hasWorked: z.enum(["yes", "partial", "no", "unknown"]),
    quantifiedEvidence: z.string(),
    sourceUrl: z.string(),
  })
  .passthrough();

const retentionSignalProviderSchema = z
  .object({
    signalType: z.enum(["activation", "retention", "first-value-moment"]),
    metric: z.string(),
    value: z.string(),
    sourceUrl: z.string(),
  })
  .passthrough();

const redFlagProviderSchema = z
  .object({
    claimedMotion: z.string(),
    actualEvidence: z.string(),
    contradiction: z.string(),
    severity: z.enum(["high", "medium", "low"]),
  })
  .passthrough();

const marketCategoryProviderBodySchema = z
  .object({
    categoryDefinition: shallowSubsectionSchema("adjacentCategories"),
    marketSize: shallowSubsectionSchema("signals"),
    structuralForces: shallowSubsectionSchema("forces"),
    categoryMaturity: shallowObjectSubsectionSchema("classification"),
  })
  .passthrough();

const buyerICPProviderBodySchema = z
  .object({
    icpExistenceCheck: shallowSubsectionSchema(
      "firmographicCuts",
      buyerFirmographicCutProviderSchema,
    ),
    personaReality: shallowSubsectionSchema(
      "personas",
      buyerPersonaProviderSchema,
    ),
    awarenessDistribution: shallowSubsectionSchema(
      "levels",
      buyerAwarenessLevelProviderSchema,
    ),
    buyingContext: shallowSubsectionSchema(
      "triggers",
      buyerTriggerProviderSchema,
    ),
    clusters: shallowSubsectionSchema("venues", buyerClusterVenueProviderSchema),
  })
  .passthrough();

const competitorLandscapeProviderBodySchema = z
  .object({
    competitorSet: shallowSubsectionSchema("competitors"),
    positioningTaxonomy: shallowSubsectionSchema("axes"),
    pricingReality: shallowSubsectionSchema("dataPoints"),
    shareOfVoice: shallowSubsectionSchema("slices"),
    publicWeaknesses: shallowSubsectionSchema("items"),
    narrativeArcs: shallowSubsectionSchema("arcs"),
    adEvidence: shallowSubsectionSchema("advertiserGroups"),
  })
  .passthrough();

const voiceOfCustomerProviderBodySchema = z
  .object({
    painLanguage: shallowSubsectionSchema("quotes", painQuoteProviderSchema),
    objections: shallowSubsectionSchema("items", objectionProviderSchema),
    switchingStories: shallowSubsectionSchema(
      "stories",
      switchingStoryProviderSchema,
    ),
    decisionCriteria: shallowSubsectionSchema(
      "criteria",
      decisionCriterionProviderSchema,
    ),
    successLanguage: shallowSubsectionSchema(
      "quotes",
      successQuoteProviderSchema,
    ),
  })
  .passthrough();

const demandIntentProviderBodySchema = z
  .object({
    keywordDemand: shallowSubsectionSchema(
      "keywords",
      keywordSignalProviderSchema,
    ),
    questionMining: shallowSubsectionSchema(
      "questions",
      buyerQuestionProviderSchema,
    ),
    contentGaps: shallowSubsectionSchema("gaps", contentGapProviderSchema),
    intentSignals: shallowSubsectionSchema("items", intentSignalProviderSchema),
    venueMap: shallowSubsectionSchema("venues", demandVenueProviderSchema),
  })
  .passthrough();

const offerDiagnosticProviderBodySchema = z
  .object({
    offerMarketFit: shallowSubsectionSchema(
      "proofPoints",
      fitProofPointProviderSchema,
    ),
    funnelDiagnosis: shallowSubsectionSchema("breaks", funnelBreakProviderSchema),
    channelTruth: shallowSubsectionSchema(
      "channels",
      channelEvidenceProviderSchema,
    ),
    retentionHealth: shallowSubsectionSchema(
      "signals",
      retentionSignalProviderSchema,
    ),
    redFlags: shallowSubsectionSchema("items", redFlagProviderSchema),
  })
  .passthrough();

const marketCategoryProviderOutputSchema =
  genericStructuredProviderOutputSchema.extend({
    body: marketCategoryProviderBodySchema,
  });

const buyerICPProviderOutputSchema =
  genericStructuredProviderOutputSchema.extend({
    body: buyerICPProviderBodySchema,
  });

const competitorLandscapeProviderOutputSchema =
  genericStructuredProviderOutputSchema.extend({
    body: competitorLandscapeProviderBodySchema,
  });

const voiceOfCustomerProviderOutputSchema =
  genericStructuredProviderOutputSchema.extend({
    body: voiceOfCustomerProviderBodySchema,
  });

const demandIntentProviderOutputSchema =
  genericStructuredProviderOutputSchema.extend({
    body: demandIntentProviderBodySchema,
  });

const offerDiagnosticProviderOutputSchema =
  genericStructuredProviderOutputSchema.extend({
    body: offerDiagnosticProviderBodySchema,
  });

function getStructuredProviderSchema({
  schema,
  schemaName,
}: {
  schema: z.ZodType<unknown>;
  schemaName: string;
}): z.ZodType<unknown> {
  if (schemaName === "MarketCategorySectionOutput") {
    return marketCategoryProviderOutputSchema;
  }

  if (schemaName === "BuyerICPSectionOutput") {
    return buyerICPProviderOutputSchema;
  }

  if (schemaName === "CompetitorLandscapeSectionOutput") {
    return competitorLandscapeProviderOutputSchema;
  }

  if (schemaName === "VoiceOfCustomerSectionOutput") {
    return voiceOfCustomerProviderOutputSchema;
  }

  if (schemaName === "DemandIntentSectionOutput") {
    return demandIntentProviderOutputSchema;
  }

  if (schemaName === "OfferDiagnosticSectionOutput") {
    return offerDiagnosticProviderOutputSchema;
  }

  if (schemaName.endsWith("SectionOutput")) {
    return genericStructuredProviderOutputSchema;
  }

  return schema;
}

function stripProviderSchemaMetadata(value: unknown): unknown {
  if (typeof value !== "object" || value === null || !("$schema" in value)) {
    return value;
  }

  const rest = { ...(value as Record<string, unknown>) };
  delete rest.$schema;

  return rest;
}

function hasObjectKey(
  value: Record<string, unknown>,
  key: string,
): value is Record<string, unknown> & { [K in typeof key]: Record<string, unknown> } {
  return typeof value[key] === "object" && value[key] !== null;
}

function normalizeSectionEnvelope(value: unknown): unknown {
  const stripped = stripProviderSchemaMetadata(value);

  if (typeof stripped !== "object" || stripped === null) {
    return stripped;
  }

  const record = stripped as Record<string, unknown>;

  if (
    record.sectionTitle === undefined &&
    hasObjectKey(record, "body") &&
    typeof record.body.sectionTitle === "string" &&
    hasObjectKey(record.body, "body")
  ) {
    return stripProviderSchemaMetadata(record.body);
  }

  return stripped;
}

function parseJsonToolText({
  schema,
  schemaName,
  text,
}: {
  schema: z.ZodType<unknown>;
  schemaName: string;
  text: string;
}): unknown {
  const trimmedText = text.trim();

  if (trimmedText.length === 0) {
    throw new Error(
      `Structured output ${schemaName} finished as a jsonTool call but returned no JSON text.`,
    );
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(trimmedText) as unknown;
  } catch (error) {
    throw new Error(
      `Structured output ${schemaName} returned invalid jsonTool JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error },
    );
  }

  return schema.parse(normalizeSectionEnvelope(parsed));
}

function isEmptyObjectText(text: string): boolean {
  try {
    const parsed = JSON.parse(text.trim()) as unknown;

    return (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed) &&
      Object.keys(parsed).length === 0
    );
  } catch {
    return false;
  }
}

function shouldUseOutputFormatFallback(schemaName: string): boolean {
  return !schemaName.endsWith("SectionOutput");
}

async function generateStructuredResult({
  params,
  structuredOutputMode,
}: {
  params: StructuredCallParams<unknown>;
  structuredOutputMode: AnthropicStructuredOutputMode;
}): Promise<Awaited<ReturnType<typeof generateText>>> {
  return generateText({
    model: params.model,
    output: Output.object({
      schema:
        structuredOutputMode === "outputFormat"
          ? params.schema
          : getStructuredProviderSchema({
              schema: params.schema,
              schemaName: params.schemaName,
            }),
      name: params.schemaName,
      description: params.schemaDescription,
    }),
    stopWhen: stepCountIs(1),
    maxOutputTokens: params.maxOutputTokens,
    prompt: params.prompt,
    abortSignal: params.signal,
    providerOptions: getStructuredProviderOptions({
      model: params.model,
      structuredOutputMode,
    }),
  });
}

const STRUCTURED_STREAM_TOTAL_MS = 420_000;
const STRUCTURED_STREAM_CHUNK_MS = 90_000;

function streamStructuredResult({
  params,
  structuredOutputMode,
}: {
  params: StructuredCallParams<unknown>;
  structuredOutputMode: AnthropicStructuredOutputMode;
}): ReturnType<typeof streamText> {
  return streamText({
    model: params.model,
    output: Output.object({
      schema:
        structuredOutputMode === "outputFormat"
          ? params.schema
          : getStructuredProviderSchema({
              schema: params.schema,
              schemaName: params.schemaName,
            }),
      name: params.schemaName,
      description: params.schemaDescription,
    }),
    stopWhen: stepCountIs(1),
    maxOutputTokens: params.maxOutputTokens,
    prompt: params.prompt,
    abortSignal: params.signal,
    // AI SDK native timeout — fires inside the iterator if a chunk does not
    // arrive within chunkMs or the call exceeds totalMs. Without this, a
    // parked partialOutputStream would block the for-await consumer in
    // run-section.ts indefinitely (see Codex review 2026-05-22, point #5).
    timeout: {
      totalMs: STRUCTURED_STREAM_TOTAL_MS,
      chunkMs: STRUCTURED_STREAM_CHUNK_MS,
    },
    providerOptions: getStructuredProviderOptions({
      model: params.model,
      structuredOutputMode,
    }),
  });
}

function parseStructuredResult({
  params,
  result,
}: {
  params: StructuredCallParams<unknown>;
  result: Awaited<ReturnType<typeof generateText>>;
}): unknown {
  if (result.text.trim().length > 0) {
    return parseJsonToolText({
      schema: params.schema,
      schemaName: params.schemaName,
      text: result.text,
    });
  }

  if (result.finishReason !== "stop") {
    throw new Error(
      `Structured output ${params.schemaName} ended with finishReason=${result.finishReason} and no JSON text.`,
    );
  }

  return params.schema.parse(result.output);
}

async function callOutputFormatStructured(
  params: StructuredCallParams<unknown>,
): Promise<unknown> {
  try {
    const result = await generateStructuredResult({
      params,
      structuredOutputMode: "outputFormat",
    });

    return parseStructuredResult({ params, result });
  } catch (error) {
    if (
      NoObjectGeneratedError.isInstance(error) &&
      error.text !== undefined &&
      error.text.trim().length > 0
    ) {
      return parseJsonToolText({
        schema: params.schema,
        schemaName: params.schemaName,
        text: error.text,
      });
    }

    throw error;
  }
}

export const defaultStructuredCaller: StructuredCaller = async (
  params: StructuredCallParams<unknown>,
): Promise<unknown> => {
  let result: Awaited<ReturnType<typeof generateText>>;

  try {
    result = await generateStructuredResult({
      params,
      structuredOutputMode: "jsonTool",
    });
  } catch (error) {
    if (
      NoObjectGeneratedError.isInstance(error) &&
      error.text !== undefined &&
      error.text.trim().length > 0
    ) {
      if (
        isEmptyObjectText(error.text) &&
        shouldUseOutputFormatFallback(params.schemaName)
      ) {
        return callOutputFormatStructured(params);
      }

      return parseJsonToolText({
        schema: params.schema,
        schemaName: params.schemaName,
        text: error.text,
      });
    }

    throw error;
  }

  if (
    result.text.trim().length > 0 &&
    isEmptyObjectText(result.text) &&
    shouldUseOutputFormatFallback(params.schemaName)
  ) {
    return callOutputFormatStructured(params);
  }

  return parseStructuredResult({ params, result });
};

function isAbortOrTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();

  return message.includes("abort") || message.includes("timed out");
}

async function parseStreamedStructuredOutput({
  output,
  params,
}: {
  output: PromiseLike<unknown>;
  params: StructuredCallParams<unknown>;
}): Promise<unknown> {
  try {
    return params.schema.parse(normalizeSectionEnvelope(await output));
  } catch (error) {
    if (isAbortOrTimeoutError(error)) {
      throw error;
    }

    return defaultStructuredCaller(params);
  }
}

export const defaultStructuredStreamer: StructuredStreamer = (
  params,
): StructuredStreamResult => {
  const result = streamStructuredResult({
    params,
    structuredOutputMode: "jsonTool",
  });

  return {
    output: parseStreamedStructuredOutput({
      output: result.output,
      params,
    }),
    partialOutputStream: result.partialOutputStream as AsyncIterable<unknown>,
  };
};
