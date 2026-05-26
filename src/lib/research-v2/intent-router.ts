import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import type {
  IntentKind,
  IntentPatch,
  IntentResult,
  IntentRouterInput,
} from './intent-router.types';

const INTENT_MODEL = 'claude-sonnet-4-6';

const VALID_SECTION_IDS = new Set([
  'positioningMarketCategory',
  'positioningBuyerICP',
  'positioningCompetitorLandscape',
  'positioningVoiceOfCustomer',
  'positioningDemandIntent',
  'positioningOfferDiagnostic',
  'positioningPaidMediaPlan',
]);

const FALLBACK_INTENT: IntentResult = {
  kind: 'converse',
  target_section: null,
  instruction: '',
  patch: null,
};

const SYSTEM_PROMPT = `You classify user messages for a GTM audit chat.

Return only valid JSON with this exact shape:
{
  "kind": "rerun" | "patch" | "converse",
  "target_section": string | null,
  "instruction": string,
  "patch": { "path": string, "value": unknown } | null
}

Use "rerun" when the user asks to redo, refresh, regenerate, or refocus an audit section.
Use "patch" when the user gives a precise correction to an existing audit artifact.
Use "converse" for questions, discussion, ambiguity, or anything that should not mutate artifacts.

Allowed target_section values:
- positioningMarketCategory
- positioningBuyerICP
- positioningCompetitorLandscape
- positioningVoiceOfCustomer
- positioningDemandIntent
- positioningOfferDiagnostic
- positioningPaidMediaPlan

For patch requests, target the most relevant section and provide a precise patch object.
For rerun requests, target the most relevant section and put the user's requested direction in instruction.
For converse requests, target_section and patch must be null.`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIntentKind(value: unknown): value is IntentKind {
  return value === 'rerun' || value === 'patch' || value === 'converse';
}

function isValidPatch(value: unknown): value is IntentPatch {
  return isRecord(value) && typeof value.path === 'string' && 'value' in value;
}

function isValidTargetSection(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && VALID_SECTION_IDS.has(value));
}

function isValidIntentResult(value: unknown): value is IntentResult {
  if (!isRecord(value)) {
    return false;
  }

  if (!isIntentKind(value.kind)) {
    return false;
  }

  if (!isValidTargetSection(value.target_section)) {
    return false;
  }

  if (typeof value.instruction !== 'string') {
    return false;
  }

  if (value.patch !== null && !isValidPatch(value.patch)) {
    return false;
  }

  if (value.kind === 'patch' && value.patch === null) {
    return false;
  }

  if (value.kind === 'rerun' && typeof value.target_section !== 'string') {
    return false;
  }

  if (value.kind === 'converse' && (value.target_section !== null || value.patch !== null)) {
    return false;
  }

  return true;
}

function buildClassificationPrompt(input: IntentRouterInput): string {
  return JSON.stringify({
    userMessage: input.userMessage,
    auditContext: input.auditContext,
    recentHistory: input.chatHistory.slice(-6),
  });
}

export async function classifyIntent(input: IntentRouterInput): Promise<IntentResult> {
  try {
    const result = await generateText({
      model: anthropic(INTENT_MODEL),
      system: SYSTEM_PROMPT,
      prompt: buildClassificationPrompt(input),
      maxOutputTokens: 500,
      temperature: 0,
    });

    const parsed = JSON.parse(result.text) as unknown;
    if (!isValidIntentResult(parsed)) {
      return FALLBACK_INTENT;
    }

    return parsed;
  } catch {
    return FALLBACK_INTENT;
  }
}
