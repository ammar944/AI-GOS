import { createClient, type RunnerProgressReporter } from '../runner';
import type { ResearchResult } from '../supabase';
import { MODELS } from '../models';

const EXTRACTION_MODEL = process.env.MEETING_EXTRACT_MODEL ?? MODELS.FAST;
const EXTRACTION_MAX_TOKENS = 4000;

const EXTRACTION_SYSTEM_PROMPT = `You are a business intelligence analyst extracting actionable insights from a meeting transcript for a paid media strategy team.

The transcript may be from any type of business meeting: discovery calls, demos, strategy sessions, kickoffs, reviews, or other meetings.

RULES:
- Only extract what is EXPLICITLY stated in the transcript. Never infer or fabricate.
- Every insight MUST include the source quote from the transcript when available.
- If a category has no relevant data in the meeting, return an empty array — do NOT fill with guesses.
- Speaker attribution matters: note WHO said what (prospect vs salesperson vs team member).
- Budget figures must be exact quotes, not rounded or estimated.
- Competitor mentions must use the exact name the speaker used.

CONTEXT: This data feeds into an AI research pipeline that produces paid media strategies. The meeting insights are treated as GROUND TRUTH — higher priority than web-scraped data. Accuracy is critical because fabricated insights will contaminate downstream recommendations.

Extract the following categories from the transcript and return them as a JSON object:

1. businessHealthSummary (string): General summary ONLY if explicitly discussed. If not directly stated, return empty string.
2. callType (enum: discovery | demo | follow_up | closing | other)
3. painPoints (array): Each has pain, severity (critical|moderate|minor), and quote (REQUIRED — must be verbatim from transcript)
4. budgetSignals (object): mentionedSpend, willingnessToPay, priceSensitivity (low|medium|high), quotes array (REQUIRED if any budget data present)
5. competitorMentions (array): Each has name, sentiment (positive|negative|neutral), context, quote (REQUIRED)
6. buyingTriggers (array): Each has trigger, urgency (immediate|near_term|exploratory), quote (REQUIRED)
7. objections (array): Each has objection, optional resolution, quote (REQUIRED)
8. icpSignals (object): companySize, role, industry — ONLY fields explicitly stated. Omit decisionProcess and decisionTimeline unless directly quoted.
9. currentMarketing (object): channels array, monthlySpend, quotes array. Omit whatWorks/whatFails unless directly quoted — do NOT infer effectiveness.
10. goalsAndOutcomes (object): primaryGoal, successMetrics (ONLY if stated with specific numbers), quotes array (REQUIRED if any goals present). Omit desiredTransformation unless explicitly stated.
11. notableQuotes (array): Each has quote (verbatim), context, relevance

CRITICAL: Quotes are REQUIRED (not optional) for painPoints, competitorMentions, buyingTriggers, objections, and goalsAndOutcomes. If you cannot find a supporting quote in the transcript, do NOT include that entry.

Return ONLY valid JSON matching this schema. No markdown, no explanation, just the JSON object.`;

export async function runMeetingExtraction(
  context: string,
  onProgress?: RunnerProgressReporter,
): Promise<ResearchResult> {
  const startMs = Date.now();
  const client = createClient();

  if (onProgress) {
    await onProgress({ message: 'Analyzing meeting transcript', phase: 'analysis' });
  }

  try {
    const response = await client.messages.create({
      model: EXTRACTION_MODEL,
      max_tokens: EXTRACTION_MAX_TOKENS,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Extract structured business intelligence from this meeting transcript:\n\n${context}`,
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
        section: 'meetingExtraction',
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
        section: 'meetingExtraction',
        error: 'Failed to parse extraction JSON',
        rawText: textBlock.text,
        durationMs: Date.now() - startMs,
      };
    }

    return {
      status: 'complete',
      section: 'meetingExtraction',
      data: parsed,
      durationMs: Date.now() - startMs,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      status: 'error',
      section: 'meetingExtraction',
      error: errorMsg,
      durationMs: Date.now() - startMs,
    };
  }
}
