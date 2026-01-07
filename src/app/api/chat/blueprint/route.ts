// src/app/api/chat/blueprint/route.ts
// Session-based chat API - receives blueprint context directly, no DB required

import { NextRequest, NextResponse } from 'next/server';
import { createOpenRouterClient, MODELS } from '@/lib/openrouter/client';

interface ChatRequest {
  message: string;
  blueprint: Record<string, unknown>;
  chatHistory?: { role: 'user' | 'assistant'; content: string }[];
}

interface PendingEdit {
  section: string;
  fieldPath: string;
  oldValue: unknown;
  newValue: unknown;
  explanation: string;
  diffPreview: string;
}

interface RelatedFactor {
  section: string;
  factor: string;
  relevance: string;
}

interface ChatResponse {
  response: string;
  confidence: 'high' | 'medium' | 'low';
  /** Single edit for backwards compatibility */
  pendingEdit?: PendingEdit;
  /** Multiple edits for batch operations */
  pendingEdits?: PendingEdit[];
  /** Related factors for explanation responses */
  relatedFactors?: RelatedFactor[];
  /** Whether this response is an explanation */
  isExplanation?: boolean;
  metadata: {
    tokensUsed: number;
    cost: number;
    processingTime: number;
  };
}

/**
 * System prompt for the blueprint chat assistant.
 * Handles Q&A, explanations, and edit requests.
 */
const SYSTEM_PROMPT = `You are an expert assistant for Strategic Blueprint documents. You help users understand their blueprint and make edits.

The blueprint has 5 sections:
1. industryMarketOverview - Market landscape, pain points, psychological drivers, messaging opportunities
2. icpAnalysisValidation - ICP coherence check, viability, reachability, pain-solution fit, risk assessment
3. offerAnalysisViability - Offer strength scores (1-10), red flags, recommendations
4. competitorAnalysis - Competitor profiles, ad hooks, funnel patterns, gaps and opportunities
5. crossAnalysisSynthesis - Key insights, recommended positioning, messaging angles, platform recommendations

CAPABILITIES:
1. **Questions**: Answer questions about any part of the blueprint using the provided context
2. **Edits**: When user wants to change something, propose specific edits (one or multiple)

FOR QUESTIONS:
- Answer directly and concisely using the blueprint data
- Reference specific sections when relevant
- If information isn't in the blueprint, say so

FOR EDIT REQUESTS (user wants to change/update/modify something):
- Identify ALL fields that need to change to fulfill the request
- If the request requires changes to multiple fields or sections, propose ALL edits together
- Respond with a JSON block containing an array of edits:

\`\`\`json
{
  "isEdit": true,
  "edits": [
    {
      "section": "sectionName",
      "fieldPath": "path.to.field",
      "oldValue": "current value",
      "newValue": "proposed new value",
      "explanation": "Why this specific change is needed"
    },
    {
      "section": "anotherSection",
      "fieldPath": "another.field",
      "oldValue": "current value",
      "newValue": "proposed new value",
      "explanation": "Why this change complements the first"
    }
  ]
}
\`\`\`

FIELD PATH EXAMPLES:
- "recommendedPositioning" (string in crossAnalysisSynthesis)
- "painPoints.primary[0]" (first primary pain point)
- "competitors[0].positioning" (first competitor's positioning)
- "offerStrength.differentiation" (differentiation score)
- "primaryMessagingAngles" (array in crossAnalysisSynthesis)
- "messagingOpportunities.opportunities" (array in industryMarketOverview)

MULTI-EDIT SCENARIOS (always propose multiple edits for these):
- "Rebrand to focus on X" → Update positioning + messaging angles + relevant pain points
- "Change target audience" → Update ICP fields + adjust messaging + update competitive gaps
- "Emphasize feature Y" → Update positioning + add to messaging angles + adjust offer analysis
- "Add competitor Z" → Add to competitors array + update gaps analysis

Always explain the overall strategy and each individual change before the JSON block.

FOR EXPLANATIONS (user asks "why" or "explain" something):
- Explain the reasoning behind the recommendation or assessment
- Reference specific data points from the blueprint as evidence
- Connect related factors from different sections to show how they influenced the decision
- Respond with a JSON block:

\`\`\`json
{
  "isExplanation": true,
  "explanation": "Clear explanation answering the why question...",
  "relatedFactors": [
    {"section": "sectionName", "factor": "what contributed", "relevance": "how it connects"},
    {"section": "anotherSection", "factor": "another factor", "relevance": "its connection"}
  ],
  "confidence": "high|medium|low"
}
\`\`\`

EXPLANATION TRIGGERS (detect these patterns):
- "Why is..." / "Why does..."
- "Explain..." / "Can you explain..."
- "How come..." / "What's the reasoning..."
- "Why did you recommend..." / "Why was X chosen..."

CROSS-SECTION CONNECTIONS to highlight:
- Industry pain points -> ICP pain-solution fit -> Messaging angles
- Competitor weaknesses -> Competitive gaps -> Positioning recommendations
- Psychological drivers -> Messaging opportunities -> Primary messaging angles
- Offer strength scores -> Risk assessment -> Strategic recommendations`;

/**
 * Generate a diff preview for the edit
 */
function generateDiffPreview(oldValue: unknown, newValue: unknown): string {
  const formatValue = (val: unknown): string => {
    if (typeof val === 'string') {
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

  return `- Old: ${formatValue(oldValue)}\n+ New: ${formatValue(newValue)}`;
}

/**
 * Extract edits from AI response if present (supports single or multiple edits)
 */
function extractEdits(response: string): { text: string; edits: PendingEdit[] } {
  // Look for JSON block with edit(s)
  const jsonMatch = response.match(/```json\s*(\{[\s\S]*?"isEdit"\s*:\s*true[\s\S]*?\})\s*```/);

  if (!jsonMatch) {
    return { text: response, edits: [] };
  }

  try {
    const editData = JSON.parse(jsonMatch[1]);

    if (!editData.isEdit) {
      return { text: response, edits: [] };
    }

    const edits: PendingEdit[] = [];

    // Handle new array format
    if (editData.edits && Array.isArray(editData.edits)) {
      for (const e of editData.edits) {
        if (e.section && e.fieldPath) {
          edits.push({
            section: e.section,
            fieldPath: e.fieldPath,
            oldValue: e.oldValue,
            newValue: e.newValue,
            explanation: e.explanation || '',
            diffPreview: generateDiffPreview(e.oldValue, e.newValue),
          });
        }
      }
    }
    // Handle legacy single-edit format for backwards compatibility
    else if (editData.section && editData.fieldPath) {
      edits.push({
        section: editData.section,
        fieldPath: editData.fieldPath,
        oldValue: editData.oldValue,
        newValue: editData.newValue,
        explanation: editData.explanation || '',
        diffPreview: generateDiffPreview(editData.oldValue, editData.newValue),
      });
    }

    if (edits.length > 0) {
      // Remove the JSON block from the text response
      const text = response.replace(/```json[\s\S]*?```/, '').trim();
      return { text, edits };
    }
  } catch {
    // JSON parse failed, return original
  }

  return { text: response, edits: [] };
}

/**
 * Extract explanation from AI response if present
 */
function extractExplanation(response: string): {
  text: string;
  explanation: string | null;
  relatedFactors: RelatedFactor[];
  confidence: 'high' | 'medium' | 'low' | null;
} {
  // Look for JSON block with explanation
  const jsonMatch = response.match(/```json\s*(\{[\s\S]*?"isExplanation"\s*:\s*true[\s\S]*?\})\s*```/);

  if (!jsonMatch) {
    return { text: response, explanation: null, relatedFactors: [], confidence: null };
  }

  try {
    const explainData = JSON.parse(jsonMatch[1]);

    if (!explainData.isExplanation) {
      return { text: response, explanation: null, relatedFactors: [], confidence: null };
    }

    // Remove the JSON block from the text response
    const text = response.replace(/```json[\s\S]*?```/, '').trim();

    return {
      text,
      explanation: explainData.explanation || null,
      relatedFactors: explainData.relatedFactors || [],
      confidence: explainData.confidence || 'medium',
    };
  } catch {
    // JSON parse failed, return original
  }

  return { text: response, explanation: null, relatedFactors: [], confidence: null };
}

/**
 * Summarize blueprint for context (to fit in prompt)
 */
function summarizeBlueprint(blueprint: Record<string, unknown>): string {
  const sections: string[] = [];

  // Section 1: Industry & Market
  const s1 = blueprint.industryMarketOverview as Record<string, unknown> | undefined;
  if (s1) {
    const painPoints = s1.painPoints as { primary?: string[]; secondary?: string[] } | undefined;
    sections.push(`## Industry & Market Overview
- Category: ${(s1.categorySnapshot as Record<string, unknown>)?.category || 'N/A'}
- Primary Pain Points: ${painPoints?.primary?.slice(0, 3).join('; ') || 'N/A'}
- Messaging Opportunities: ${((s1.messagingOpportunities as Record<string, unknown>)?.opportunities as string[])?.slice(0, 3).join('; ') || 'N/A'}`);
  }

  // Section 2: ICP Analysis
  const s2 = blueprint.icpAnalysisValidation as Record<string, unknown> | undefined;
  if (s2) {
    const verdict = s2.finalVerdict as Record<string, unknown> | undefined;
    sections.push(`## ICP Analysis
- Status: ${verdict?.status || 'N/A'}
- Reasoning: ${verdict?.reasoning || 'N/A'}`);
  }

  // Section 3: Offer Analysis
  const s3 = blueprint.offerAnalysisViability as Record<string, unknown> | undefined;
  if (s3) {
    const strength = s3.offerStrength as Record<string, unknown> | undefined;
    const rec = s3.recommendation as Record<string, unknown> | undefined;
    sections.push(`## Offer Analysis
- Overall Score: ${strength?.overallScore || 'N/A'}/10
- Recommendation: ${rec?.status || 'N/A'}`);
  }

  // Section 4: Competitors
  const s4 = blueprint.competitorAnalysis as Record<string, unknown> | undefined;
  if (s4) {
    const competitors = s4.competitors as { name?: string; positioning?: string }[] | undefined;
    sections.push(`## Competitor Analysis
- Competitors: ${competitors?.map(c => c.name).join(', ') || 'N/A'}
- Gaps: ${(s4.gapsAndOpportunities as Record<string, unknown>)?.messagingOpportunities?.toString().slice(0, 200) || 'N/A'}`);
  }

  // Section 5: Synthesis
  const s5 = blueprint.crossAnalysisSynthesis as Record<string, unknown> | undefined;
  if (s5) {
    sections.push(`## Cross-Analysis Synthesis
- Recommended Positioning: ${s5.recommendedPositioning || 'N/A'}
- Primary Messaging Angles: ${(s5.primaryMessagingAngles as string[])?.slice(0, 3).join('; ') || 'N/A'}
- Next Steps: ${(s5.nextSteps as string[])?.slice(0, 3).join('; ') || 'N/A'}`);
  }

  return sections.join('\n\n');
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: ChatRequest = await request.json();

    if (!body.message?.trim()) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    if (!body.blueprint || typeof body.blueprint !== 'object') {
      return NextResponse.json(
        { error: 'Blueprint context is required' },
        { status: 400 }
      );
    }

    // Build context from blueprint
    const blueprintSummary = summarizeBlueprint(body.blueprint);

    // For edit requests, include the full relevant section
    const fullBlueprintJSON = JSON.stringify(body.blueprint, null, 2);

    // Build messages
    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      {
        role: 'user' as const,
        content: `Here is the current Strategic Blueprint:\n\n${blueprintSummary}\n\n---\n\nFull Blueprint Data (for edits):\n\`\`\`json\n${fullBlueprintJSON}\n\`\`\``,
      },
      // Include chat history
      ...(body.chatHistory || []).slice(-6).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      // Current message
      { role: 'user' as const, content: body.message },
    ];

    // Call OpenRouter
    const client = createOpenRouterClient();
    const aiResponse = await client.chat({
      model: MODELS.CLAUDE_SONNET,
      messages,
      temperature: 0.3,
      maxTokens: 2048,
    });

    // Extract edits if present
    const { text, edits } = extractEdits(aiResponse.content);

    // Extract explanations if present (only if no edits)
    const explainResult = edits.length === 0 ? extractExplanation(aiResponse.content) : null;
    const hasExplanation = explainResult?.explanation !== null;

    // Determine confidence based on response
    let confidence: 'high' | 'medium' | 'low' = 'medium';
    if (edits.length > 0) {
      confidence = 'high'; // Edits are structured
    } else if (hasExplanation && explainResult?.confidence) {
      confidence = explainResult.confidence;
    } else if (aiResponse.content.includes("I don't") || aiResponse.content.includes("isn't in")) {
      confidence = 'low';
    }

    // Format response with edit details or explanation
    let responseText = hasExplanation ? (explainResult?.text || text) : text;
    let relatedFactors: RelatedFactor[] | undefined;

    if (edits.length > 0) {
      const editSummaries = edits.map((edit, i) =>
        `### Edit ${edits.length > 1 ? `${i + 1}: ` : ''}${edit.section} / ${edit.fieldPath}\n${edit.explanation}\n\n\`\`\`diff\n${edit.diffPreview}\n\`\`\``
      ).join('\n\n');

      responseText = `${text}\n\n**Proposed ${edits.length > 1 ? `Edits (${edits.length})` : 'Edit'}:**\n\n${editSummaries}\n\nClick **Confirm ${edits.length > 1 ? 'All' : 'Edit'}** below to apply, or **Cancel** to discard.`;
    } else if (hasExplanation && explainResult) {
      // Format explanation with related factors
      responseText = explainResult.explanation || responseText;
      relatedFactors = explainResult.relatedFactors;
    }

    const response: ChatResponse = {
      response: responseText,
      confidence,
      // Keep single edit for backwards compatibility
      pendingEdit: edits.length === 1 ? edits[0] : undefined,
      // Always include full array
      pendingEdits: edits.length > 0 ? edits : undefined,
      // Include explanation data
      relatedFactors: relatedFactors && relatedFactors.length > 0 ? relatedFactors : undefined,
      isExplanation: hasExplanation || undefined,
      metadata: {
        tokensUsed: aiResponse.usage.totalTokens,
        cost: aiResponse.cost,
        processingTime: Date.now() - startTime,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Blueprint chat error:', error);

    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to process chat message', details: message },
      { status: 500 }
    );
  }
}
