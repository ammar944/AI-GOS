// src/lib/chat/agents/edit-agent.ts
// Edit Agent for interpreting natural language edit requests and generating proposed changes

import { createOpenRouterClient, MODELS } from '@/lib/openrouter/client';
import { BlueprintSection, EditIntent } from '../types';

/**
 * Result of an edit operation - the proposed change
 */
export interface EditResult {
  /** Which section the edit applies to */
  section: BlueprintSection;
  /** Dot-notation path to the field (e.g., "recommendedPositioning" or "painPoints.primary[0]") */
  fieldPath: string;
  /** Current value before edit */
  oldValue: unknown;
  /** Proposed new value */
  newValue: unknown;
  /** Explanation of why this change addresses the request */
  explanation: string;
  /** Human-readable diff preview */
  diffPreview: string;
  /** Always true - edits require user confirmation */
  requiresConfirmation: true;
}

/**
 * Context needed for the edit agent
 */
export interface EditContext {
  /** The full current data for the section being edited */
  fullSection: Record<string, unknown>;
  /** The classified edit intent */
  intent: EditIntent;
  /** Optional chat history for context */
  chatHistory?: { role: 'user' | 'assistant'; content: string }[];
}

/**
 * Response from the edit agent
 */
export interface EditResponse {
  /** The edit result if successful */
  result: EditResult;
  /** Token usage */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Cost of the edit operation */
  cost: number;
}

const EDIT_SYSTEM_PROMPT = `You are an expert editor for Strategic Blueprint documents.
Your role is to interpret user edit requests and generate precise field-level changes.

RULES:
1. Identify the EXACT field to edit based on the user's request
2. The fieldPath must use dot notation (e.g., "recommendedPositioning", "painPoints.primary[0]")
3. The new value MUST match the original data type exactly:
   - If original is a string, new value must be a string
   - If original is an array, new value must be an array
   - If original is a number, new value must be a number
   - If original is an object, new value must be an object with same structure
4. Provide a clear explanation of WHY this change addresses the user's request
5. Be conservative - only change what the user asked for

RESPONSE FORMAT:
You must respond with a valid JSON object containing:
{
  "fieldPath": "string - dot notation path to field",
  "oldValue": "current value (any type)",
  "newValue": "proposed new value (same type as oldValue)",
  "explanation": "string - why this change addresses the request"
}

AVAILABLE SECTIONS AND THEIR COMMON FIELDS:

industryMarketOverview:
- categorySnapshot (object with category, market, perspective)
- painPoints (object with primary[], secondary[])
- psychologicalDrivers (object with fears[], desires[], motivators[], objections[])
- recommendedPositioning (string)
- keyInsights (string[])
- sources (Citation[])

icpAnalysisValidation:
- icpViability (object with score, rationale, strengthFactors[], riskFactors[])
- targetingRecommendations (string[])
- sources (Citation[])

offerAnalysisViability:
- offerStrength (object with overallScore and sub-scores)
- offerRecommendations (string[])
- sources (Citation[])

competitorAnalysis:
- competitors (array of competitor objects with name, strengths[], weaknesses[], positioning, etc.)
- competitiveGaps (string[])
- strategicRecommendations (string[])
- sources (Citation[])

crossAnalysisSynthesis:
- executiveSummary (string)
- strategicRecommendations (object with immediate[], shortTerm[], longTerm[])
- nextSteps (string[])
- sources (Citation[])`;

/**
 * Generate a human-readable diff preview
 */
function generateDiffPreview(oldValue: unknown, newValue: unknown): string {
  const formatValue = (val: unknown): string => {
    if (typeof val === 'string') {
      // Truncate long strings
      return val.length > 100 ? `"${val.substring(0, 97)}..."` : `"${val}"`;
    }
    if (Array.isArray(val)) {
      if (val.length === 0) return '[]';
      if (typeof val[0] === 'string') {
        return `[${val.map(v => `"${v}"`).join(', ')}]`;
      }
      return `[${val.length} items]`;
    }
    if (typeof val === 'object' && val !== null) {
      return JSON.stringify(val, null, 2);
    }
    return String(val);
  };

  const oldFormatted = formatValue(oldValue);
  const newFormatted = formatValue(newValue);

  return `- Old: ${oldFormatted}\n+ New: ${newFormatted}`;
}

/**
 * Get the current value at a field path
 */
function getValueAtPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.').flatMap(part => {
    // Handle array notation like "painPoints.primary[0]"
    const match = part.match(/^(.+)\[(\d+)\]$/);
    if (match) {
      return [match[1], parseInt(match[2], 10)];
    }
    return [part];
  });

  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof part === 'number') {
      if (!Array.isArray(current)) return undefined;
      current = current[part];
    } else {
      if (typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[part];
    }
  }
  return current;
}

/**
 * Handle an edit request and generate proposed changes
 */
export async function handleEdit(context: EditContext): Promise<EditResponse> {
  const { fullSection, intent, chatHistory = [] } = context;

  // Build the user message with section data and edit request
  const userMessage = `## Current Section Data (${intent.section}):
\`\`\`json
${JSON.stringify(fullSection, null, 2)}
\`\`\`

## User's Edit Request:
Field hint: "${intent.field}"
Desired change: "${intent.desiredChange}"

Analyze the section data and generate the precise field-level edit to address this request.
Return ONLY the JSON response with fieldPath, oldValue, newValue, and explanation.`;

  const messages = [
    { role: 'system' as const, content: EDIT_SYSTEM_PROMPT },
    ...chatHistory.slice(-4).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: userMessage },
  ];

  const client = createOpenRouterClient();
  const response = await client.chatJSON<{
    fieldPath: string;
    oldValue: unknown;
    newValue: unknown;
    explanation: string;
  }>({
    model: MODELS.CLAUDE_SONNET,
    messages,
    temperature: 0.2, // Low temperature for precision
    maxTokens: 2048,
    jsonMode: true,
  });

  const { data, usage, cost } = response;

  // Validate the field path exists in section data
  const actualOldValue = getValueAtPath(fullSection, data.fieldPath);

  // Generate diff preview
  const diffPreview = generateDiffPreview(
    actualOldValue !== undefined ? actualOldValue : data.oldValue,
    data.newValue
  );

  const result: EditResult = {
    section: intent.section,
    fieldPath: data.fieldPath,
    oldValue: actualOldValue !== undefined ? actualOldValue : data.oldValue,
    newValue: data.newValue,
    explanation: data.explanation,
    diffPreview,
    requiresConfirmation: true,
  };

  return {
    result,
    usage,
    cost,
  };
}
