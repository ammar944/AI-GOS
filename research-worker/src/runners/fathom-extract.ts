import { createClient, type RunnerProgressReporter } from '../runner';
import type { ResearchResult } from '../supabase';

const EXTRACTION_MODEL = process.env.FATHOM_EXTRACT_MODEL ?? 'claude-haiku-4-5-20251001';
const EXTRACTION_MAX_TOKENS = 4000;

const EXTRACTION_SYSTEM_PROMPT = `You are a sales intelligence analyst extracting actionable insights from a sales call transcript for a paid media strategy team.

RULES:
- Only extract what is EXPLICITLY stated in the transcript. Never infer or fabricate.
- Every insight MUST include the source quote from the transcript when available.
- If a category has no relevant data in the call, return an empty array — do NOT fill with guesses.
- Speaker attribution matters: note WHO said what (prospect vs salesperson).
- Budget figures must be exact quotes, not rounded or estimated.
- Competitor mentions must use the exact name the prospect used.

CONTEXT: This data feeds into an AI research pipeline that produces paid media strategies. The sales call insights are treated as GROUND TRUTH — higher priority than web-scraped data. Accuracy is critical because fabricated insights will contaminate downstream recommendations.

Extract the following categories from the transcript and return them as a JSON object:

1. businessHealthSummary (string): General summary of how the business is going based on the conversation
2. callType (enum: discovery | demo | follow_up | closing | other)
3. painPoints (array): Each has pain, severity (critical|moderate|minor), and optional quote
4. budgetSignals (object): mentionedSpend, willingnessToPay, priceSensitivity (low|medium|high), quotes array
5. competitorMentions (array): Each has name, sentiment (positive|negative|neutral), context, optional quote
6. buyingTriggers (array): Each has trigger, urgency (immediate|near_term|exploratory), optional quote
7. objections (array): Each has objection, optional resolution, optional quote
8. icpSignals (object): companySize, role, industry, decisionProcess, decisionTimeline — all optional strings
9. currentMarketing (object): channels array, whatWorks, whatFails, monthlySpend, quotes array
10. goalsAndOutcomes (object): primaryGoal, successMetrics, desiredTransformation, quotes array
11. notableQuotes (array): Each has quote (verbatim), context, relevance

Return ONLY valid JSON matching this schema. No markdown, no explanation, just the JSON object.`;

export async function runFathomExtraction(
  context: string,
  onProgress?: RunnerProgressReporter,
): Promise<ResearchResult> {
  const startMs = Date.now();
  const client = createClient();

  if (onProgress) {
    await onProgress({ message: 'Analyzing sales call transcript', phase: 'analysis' });
  }

  try {
    const response = await client.messages.create({
      model: EXTRACTION_MODEL,
      max_tokens: EXTRACTION_MAX_TOKENS,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Extract structured sales intelligence from this transcript:\n\n${context}`,
        },
      ],
    });

    if (onProgress) {
      await onProgress({ message: 'Parsing extraction results', phase: 'output' });
    }

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return {
        status: 'error',
        section: 'fathomExtraction',
        error: 'No text content in extraction response',
        durationMs: Date.now() - startMs,
      };
    }

    let parsed: Record<string, unknown>;
    try {
      const rawText = textBlock.text.replace(/^```json?\n?/m, '').replace(/\n?```$/m, '').trim();
      parsed = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      return {
        status: 'error',
        section: 'fathomExtraction',
        error: 'Failed to parse extraction JSON',
        rawText: textBlock.text,
        durationMs: Date.now() - startMs,
      };
    }

    return {
      status: 'complete',
      section: 'fathomExtraction',
      data: parsed,
      durationMs: Date.now() - startMs,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      status: 'error',
      section: 'fathomExtraction',
      error: errorMsg,
      durationMs: Date.now() - startMs,
    };
  }
}
