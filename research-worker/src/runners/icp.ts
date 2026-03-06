import type { BetaContentBlock } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { createClient, runWithBackoff, extractJson } from '../runner';
import type { ResearchResult } from '../supabase';

const ICP_SYSTEM_PROMPT = `You are an expert ICP analyst validating whether a target audience is viable for paid media.

TASK: Critically assess whether this ICP can be profitably targeted with paid ads.

VALIDATION APPROACH:
1. Check targeting feasibility on Meta, LinkedIn, and Google
2. Verify adequate audience scale for testing
3. Assess pain-solution fit strength
4. Evaluate economic feasibility (budget authority, purchasing power)

TOOL USAGE:
Use web_search to gather data on:
1. Audience size, reachability on major ad platforms, and economic profile
2. Industry pain points and frustrations from forums/communities
3. Typical buying behavior, decision process, and competitive ad landscape

BE CRITICAL:
- Flag real concerns, do not sugarcoat
- "validated" = truly ready for ads
- "workable" = proceed with caution
- "invalid" = do not spend money until fixed

TRIGGER EVENT ANALYSIS:
For each ICP segment, identify 4-6 specific trigger events that create an active buying window:
- Event description (e.g., "New CMO hired at target company")
- Estimated annual frequency across TAM
- Urgency level: immediate (0-30 days), near-term (1-3 months), planning-cycle (3-6 months)
- Detection method for paid targeting
- Recommended ad hook tied to this trigger

SEGMENT SIZING:
For each ICP segment, estimate:
- Total addressable accounts (number of companies matching firmographics)
- Total addressable contacts (number of individuals in target roles)
- Segment share of total ICP (as percentage)
- Priority tier (1 = highest) with raw factor scores for: painSeverity (1-10), budgetAuthority (1-10), reachability (1-10), triggerFrequency (1-10)
- Recommended budget weight (percentage of total paid budget)

RISK SCORING:
Assess risks across these categories (1 = low risk, 5 = high risk):
1. audience_reachability — ICP size on target platforms vs budget
2. budget_adequacy — budget vs platform minimums and competitive CPC
3. pain_strength — is pain acute enough for cold traffic conversion?
4. competitive_intensity — ad auction density and competitor spend
5. proof_credibility — can the client substantiate ad claims?

OUTPUT FORMAT:
CRITICAL: Your ENTIRE response MUST be the JSON object ONLY. No preamble, no explanation, no markdown code fences. Start your response with { and end with }.

After completing your research, respond with a JSON object. Structure:
{
  "finalVerdict": {
    "status": "validated | workable | invalid",
    "reasoning": "string — why this verdict was reached",
    "confidenceLevel": "high | medium | low"
  },
  "painSolutionFit": {
    "fitAssessment": "strong | moderate | weak",
    "primaryPain": "string — the core pain this product addresses",
    "fitReasoning": "string — evidence for the fit assessment"
  },
  "segments": [
    {
      "name": "string — segment name",
      "description": "string",
      "totalAddressableAccounts": "string — estimated number",
      "totalAddressableContacts": "string — estimated number",
      "segmentShare": "string — percentage of total ICP",
      "priorityTier": 1,
      "factorScores": {
        "painSeverity": 1-10,
        "budgetAuthority": 1-10,
        "reachability": 1-10,
        "triggerFrequency": 1-10
      },
      "recommendedBudgetWeight": "string — percentage"
    }
  ],
  "triggerEvents": [
    {
      "event": "string — specific trigger event",
      "annualFrequency": "string — estimated frequency across TAM",
      "urgencyLevel": "immediate | near-term | planning-cycle",
      "detectionMethod": "string — how to target this on ad platforms",
      "recommendedAdHook": "string — ad hook tied to this trigger"
    }
  ],
  "riskScores": [
    {
      "category": "string — risk category name",
      "risk": "string — specific risk description",
      "probability": 1-5,
      "impact": 1-5,
      "mitigation": "string — how to mitigate"
    }
  ],
  "platformReachability": {
    "meta": "string — audience size estimate on Meta",
    "linkedin": "string — audience size estimate on LinkedIn",
    "google": "string — search volume and intent assessment"
  }
}`;

export async function runResearchICP(context: string): Promise<ResearchResult> {
  const client = createClient();
  const startTime = Date.now();
  try {
    const finalMsg = await runWithBackoff(
      () => {
        const runner = client.beta.messages.toolRunner({
          model: 'claude-sonnet-4-6',
          max_tokens: 8000,
          tools: [{ type: 'web_search_20250305' as const, name: 'web_search' }],
          system: ICP_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: `Validate the ICP for paid media:\n\n${context}` }],
        });
        return Promise.race([
          runner.runUntilDone(),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Sub-agent timed out after 180s')), 180_000)),
        ]);
      },
      'researchICP',
    );
    const textBlock = finalMsg.content.findLast((b: BetaContentBlock) => b.type === 'text');
    const resultText = textBlock && 'text' in textBlock ? textBlock.text : '';
    let data: unknown;
    try { data = extractJson(resultText); } catch {
      console.error('[icp] JSON extraction failed:', resultText.slice(0, 300));
      data = { summary: resultText };
    }
    return { status: 'complete', section: 'icpValidation', data, durationMs: Date.now() - startTime };
  } catch (error) {
    return { status: 'error', section: 'icpValidation', error: error instanceof Error ? error.message : String(error), durationMs: Date.now() - startTime };
  }
}
