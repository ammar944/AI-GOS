// src/lib/chat/intent-router.ts
// Intent classification service for routing chat messages to appropriate agents

import { createOpenRouterClient, MODELS } from '@/lib/openrouter/client';
import {
  ChatIntent,
  IntentClassificationResult,
  BlueprintSection,
} from './types';

/**
 * System prompt for intent classification.
 * Describes the blueprint structure and available intent types.
 */
const INTENT_SYSTEM_PROMPT = `You are an intent classifier for a Strategic Blueprint document system.

The blueprint has 5 sections:
1. industryMarketOverview - Market landscape, pain points, psychological drivers, messaging opportunities
2. icpAnalysisValidation - ICP coherence check, viability, reachability, pain-solution fit, risk assessment
3. offerAnalysisViability - Offer strength scores (1-10), red flags, recommendations
4. competitorAnalysis - Competitor profiles, ad hooks, funnel patterns, gaps and opportunities
5. crossAnalysisSynthesis - Key insights, recommended positioning, messaging angles, platform recommendations, next steps

Classify the user's message into one of these intents:
- question: User wants information from the blueprint (asking what, who, how many, etc.)
- edit: User wants to change/modify something in the blueprint (update, change, fix, modify)
- explain: User wants to understand WHY something is the way it is (why, reasoning, explain)
- regenerate: User wants to redo/recreate a section with new instructions (redo, regenerate, rewrite)
- general: General conversation, greetings, or unclear intent

Return JSON only with this exact structure:
{
  "type": "question|edit|explain|regenerate|general",
  "topic": "what they're asking about (for question/general)",
  "sections": ["relevant section names"] (for question - array of section names),
  "section": "specific section name" (for edit/explain/regenerate - single section),
  "field": "specific field path if known" (for edit/explain),
  "desiredChange": "what they want changed" (for edit),
  "whatToExplain": "what needs explanation" (for explain),
  "instructions": "special instructions" (for regenerate)
}

Include only the fields relevant to the classified intent type.`;

/**
 * Valid blueprint section names for validation
 */
const VALID_SECTIONS: Set<string> = new Set([
  'industryMarketOverview',
  'icpAnalysisValidation',
  'offerAnalysisViability',
  'competitorAnalysis',
  'crossAnalysisSynthesis',
]);

/**
 * Validate and cast a section string to BlueprintSection type
 */
function validateSection(section: unknown): BlueprintSection | null {
  if (typeof section === 'string' && VALID_SECTIONS.has(section)) {
    return section as BlueprintSection;
  }
  return null;
}

/**
 * Validate and cast an array of section strings to BlueprintSection[]
 */
function validateSections(sections: unknown): BlueprintSection[] {
  if (!Array.isArray(sections)) {
    return [];
  }
  return sections
    .map(s => validateSection(s))
    .filter((s): s is BlueprintSection => s !== null);
}

/**
 * Parse the raw classifier response into a typed ChatIntent
 */
function parseIntentResponse(raw: Record<string, unknown>): ChatIntent {
  const type = raw.type as string;

  switch (type) {
    case 'question':
      return {
        type: 'question',
        topic: (raw.topic as string) || 'unknown',
        sections: validateSections(raw.sections),
      };

    case 'edit': {
      const section = validateSection(raw.section);
      if (!section) {
        // Default to crossAnalysisSynthesis if section is invalid
        return {
          type: 'edit',
          section: 'crossAnalysisSynthesis',
          field: (raw.field as string) || '',
          desiredChange: (raw.desiredChange as string) || '',
        };
      }
      return {
        type: 'edit',
        section,
        field: (raw.field as string) || '',
        desiredChange: (raw.desiredChange as string) || '',
      };
    }

    case 'explain': {
      const section = validateSection(raw.section);
      if (!section) {
        return {
          type: 'explain',
          section: 'crossAnalysisSynthesis',
          field: (raw.field as string) || '',
          whatToExplain: (raw.whatToExplain as string) || '',
        };
      }
      return {
        type: 'explain',
        section,
        field: (raw.field as string) || '',
        whatToExplain: (raw.whatToExplain as string) || '',
      };
    }

    case 'regenerate': {
      const section = validateSection(raw.section);
      if (!section) {
        return {
          type: 'regenerate',
          section: 'crossAnalysisSynthesis',
          instructions: (raw.instructions as string) || '',
        };
      }
      return {
        type: 'regenerate',
        section,
        instructions: (raw.instructions as string) || '',
      };
    }

    case 'general':
    default:
      return {
        type: 'general',
        topic: (raw.topic as string) || 'conversation',
      };
  }
}

/**
 * Classify a user message into an intent for routing to the appropriate agent.
 *
 * Uses Claude Sonnet for classification (Haiku not available on OpenRouter).
 * Temperature 0 for deterministic classification.
 *
 * @param message - The user's chat message
 * @returns Classification result with intent, usage, and cost
 */
export async function classifyIntent(
  message: string
): Promise<IntentClassificationResult> {
  const client = createOpenRouterClient();

  const response = await client.chat({
    model: MODELS.CLAUDE_SONNET,
    messages: [
      { role: 'system', content: INTENT_SYSTEM_PROMPT },
      { role: 'user', content: message },
    ],
    temperature: 0,
    maxTokens: 256,
    jsonMode: true,
  });

  // Parse the JSON response
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(response.content);
  } catch {
    // Default to general intent on parse failure
    parsed = { type: 'general', topic: 'unknown' };
  }

  const intent = parseIntentResponse(parsed);

  return {
    intent,
    usage: response.usage,
    cost: response.cost,
  };
}
