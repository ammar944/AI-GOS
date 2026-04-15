// research-worker/src/identity/resolve-identity.ts
// Resolves a canonical product identity from onboarding research data.
// Runs during onboarding, NOT as a pipeline section.
// Output stored in profile all_fields.identityCard.

import {
  createClient,
  emitRunnerProgress,
  extractJson,
  runWithBackoff,
  type RunnerProgressReporter,
} from '../runner';
import type { ResearchResult } from '../supabase';

import { MODELS } from '../models';

const IDENTITY_MODEL = process.env.IDENTITY_RESOLVER_MODEL ?? MODELS.FAST;
const IDENTITY_MAX_TOKENS = 2000;
const IDENTITY_TIMEOUT_MS = 15_000;

const IDENTITY_SYSTEM_PROMPT = `You are a product classification specialist. Given research data about a company (website content, Perplexity intel, onboarding fields), produce a canonical product identity.

RULES:
- The research data (website scrape + Perplexity analysis) is ground truth for what the company ACTUALLY does
- The user's onboarding description is their perspective, which may be vague or inaccurate
- If research data and user description CONFLICT, trust the research data and flag the conflict in evidence.conflicts
- Category should be specific enough to find the right competitors
  GOOD: "AI Whiteboard / Visual Collaboration Tool"
  BAD: "AI Software" or "Technology Company"
- coreKeywords are the terms you'd use to search for competitors in this exact space
- negativeKeywords are terms that lead to WRONG categories
  Example for Poppy AI: negativeKeywords = ["video generation", "video editing"]
- buyer should be the actual purchase decision maker, not a generic title
- jobToBeDone should describe the core job the product does in the buyer's language

CONFIDENCE SCORING:
- 90-100: Research data clearly confirms the product category, multiple signals agree
- 70-89: Research data supports the category but some ambiguity exists
- 50-69: Significant ambiguity — product could plausibly fit multiple categories
- Below 50: Research data is insufficient or contradicts the user's description

OUTPUT FORMAT:
Return ONLY a JSON object. No preamble, no markdown fences. Start with { end with }.

{
  "schemaVersion": 1,
  "category": "string — specific product category",
  "subcategory": "string — narrower classification",
  "businessModel": "string — how they make money",
  "coreProduct": "string — one sentence: what the customer actually buys",
  "coreKeywords": ["string — search terms for finding competitors in this exact space"],
  "negativeKeywords": ["string — search terms that lead to WRONG categories"],
  "buyer": "string — who makes the purchase decision",
  "jobToBeDone": "string — core job the product does for the buyer",
  "confidence": 0-100,
  "ambiguityFlags": ["string — what's unclear or could be wrong"],
  "evidence": {
    "websiteSignals": ["string — key signals from the website/research"],
    "onboardingSignals": ["string — what the user said in onboarding"],
    "conflicts": ["string — where research and user disagree"]
  }
}`;

/**
 * Extract a single field value from a context string using label: value patterns.
 * Matches "- Label: value" and "Label: value" formats.
 */
function extractFieldFromContext(context: string, label: string): string | null {
  const pattern = new RegExp(`^\\s*-?\\s*${label}\\s*:\\s*(.+)$`, 'im');
  const match = context.match(pattern);
  if (match?.[1]) {
    const value = match[1].trim();
    if (value.length > 0) return value;
  }
  return null;
}

export async function resolveProductIdentity(
  context: string,
  onProgress?: RunnerProgressReporter,
): Promise<ResearchResult> {
  const client = createClient();
  const startTime = Date.now();

  try {
    await emitRunnerProgress(onProgress, 'runner', 'resolving product identity');

    const response = await runWithBackoff(
      () => {
        const call = client.messages.create({
          model: IDENTITY_MODEL,
          max_tokens: IDENTITY_MAX_TOKENS,
          system: IDENTITY_SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: `Classify the product identity from this research data:\n\n${context}`,
            },
          ],
        });

        return Promise.race([
          call,
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error(`Identity resolver timed out after ${IDENTITY_TIMEOUT_MS / 1000}s`)),
              IDENTITY_TIMEOUT_MS,
            ),
          ),
        ]);
      },
      'resolveIdentity',
    );

    await emitRunnerProgress(onProgress, 'analysis', 'extracting identity card');

    const textBlock = response.content.findLast((b: { type: string }) => b.type === 'text');
    const resultText = textBlock && 'text' in textBlock ? (textBlock as { type: string; text: string }).text : '';

    let parsed: unknown;
    try {
      parsed = extractJson(resultText);
    } catch {
      console.error('[identity] JSON extraction failed:', resultText.slice(0, 300));
      parsed = null;
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      const fallbackCard = buildFallbackCard(context, 'json-parse-failed');
      return {
        status: 'partial',
        section: 'identityResolution',
        durationMs: Date.now() - startTime,
        data: fallbackCard,
        rawText: resultText,
        error: 'Identity resolver returned non-JSON response; fallback card used.',
      };
    }

    await emitRunnerProgress(onProgress, 'output', 'identity resolution complete');

    return {
      status: 'complete',
      section: 'identityResolution',
      durationMs: Date.now() - startTime,
      data: parsed,
      rawText: resultText,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[identity] resolveProductIdentity failed:', errorMsg);

    const fallbackCard = buildFallbackCard(context, 'resolver-failed-fallback');
    return {
      status: 'partial',
      section: 'identityResolution',
      durationMs: Date.now() - startTime,
      data: fallbackCard,
      error: errorMsg,
    };
  }
}

function buildFallbackCard(context: string, flag: string): Record<string, unknown> {
  return {
    schemaVersion: 1,
    category: 'Unknown',
    subcategory: 'Unknown',
    businessModel: extractFieldFromContext(context, 'Business Model') ?? 'Unknown',
    coreProduct: extractFieldFromContext(context, 'Product') ?? 'Unknown',
    coreKeywords: [],
    negativeKeywords: [],
    buyer: 'Unknown',
    jobToBeDone: 'Unknown',
    confidence: 20,
    ambiguityFlags: [flag],
    evidence: {
      websiteSignals: [],
      onboardingSignals: [],
      conflicts: [],
    },
  };
}
