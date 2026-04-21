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
// Bumped from 4000 → 5000 to accommodate 2 new classification fields
// (businessModelType, awarenessLevel) without risking mid-JSON truncation.
const IDENTITY_MAX_TOKENS = 5000;
const IDENTITY_TIMEOUT_MS = 45_000;

const VALID_BUSINESS_MODEL_TYPES = new Set([
  'plg',
  'slg',
  'ecommerce',
  'transactional',
  'marketplace',
  'unknown',
]);

const VALID_AWARENESS_LEVELS = new Set([
  'unaware',
  'problem-aware',
  'solution-aware',
  'product-aware',
  'most-aware',
  'unknown',
]);

/** Coerce a classification field to a valid enum value, defaulting to 'unknown'. */
function coerceClassification(value: unknown, validSet: Set<string>): string {
  if (typeof value !== 'string') return 'unknown';
  const normalized = value.trim().toLowerCase();
  return validSet.has(normalized) ? normalized : 'unknown';
}

/**
 * Extract a metadata tag value (e.g. `[salesMotion:product-led]`) from the
 * context string. Normalizes to lowercase. Returns null when absent.
 */
function extractContextTag(context: string, tag: string): string | null {
  const match = context.match(new RegExp(`\\[${tag}:([^\\]]+)\\]`));
  return match?.[1]?.trim().toLowerCase() ?? null;
}

/**
 * v3 onboarding (2026-04-21): user-stated §1 signals override LLM inference
 * for businessModelType. Pure input-side enhancement — the resolver's
 * output schema is unchanged; downstream runners still consume
 * businessModelType as today.
 *
 * Precedence:
 *   salesMotion=product-led → plg (hard)
 *   salesMotion=sales-led   → slg (hard)
 *   salesMotion=hybrid      → keep LLM inference
 *   fallback: if LLM returned 'unknown' AND conversionPath is a strong
 *   signal, hard-map from conversionPath:
 *     direct-checkout → ecommerce
 *     demo-required   → slg
 */
export function applyV3BusinessModelHardMap(coerced: Record<string, unknown>, context: string): void {
  const salesMotion = extractContextTag(context, 'salesMotion');
  if (salesMotion === 'product-led') {
    coerced.businessModelType = 'plg';
    return;
  }
  if (salesMotion === 'sales-led') {
    coerced.businessModelType = 'slg';
    return;
  }

  if (coerced.businessModelType === 'unknown') {
    const conversionPath = extractContextTag(context, 'conversionPath');
    if (conversionPath === 'direct-checkout') {
      coerced.businessModelType = 'ecommerce';
    } else if (conversionPath === 'demo-required') {
      coerced.businessModelType = 'slg';
    }
  }
}

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

BUSINESS MODEL TYPE CLASSIFICATION (required):
Classify into ONE of these enums. If signals are split or unclear, output 'unknown' — do NOT guess.

- 'plg': product-led growth. Signals: free trial, freemium, self-serve signup, low-to-mid price ($5–$500/mo), no demo required.
- 'slg': sales-led growth. Signals: demo required before purchase, dedicated sales team, mid-to-high ACV ($5k+/yr), committee buying.
- 'ecommerce': direct online purchase. Signals: online store, product catalog, checkout on-site, AOV $20–$500.
- 'transactional': local service or one-time booking. Signals: service-based, booking/appointment driven, one-off purchases.
- 'marketplace': two-sided market. Signals: separate supply and demand sides, commission/transaction fee revenue model.
- 'unknown': signals are genuinely ambiguous or missing.

AWARENESS LEVEL CLASSIFICATION (required — Eugene Schwartz 5 levels):
Classify the TARGET MARKET's awareness of the product category/problem.

- 'unaware': market doesn't know the problem exists. New/emerging categories.
- 'problem-aware': market knows the problem, doesn't know solution category exists.
- 'solution-aware': market knows solution category exists, evaluating options.
- 'product-aware': market knows your brand specifically, comparing alternatives.
- 'most-aware': market has considered buying, needs trigger to close.
- 'unknown': insufficient signal to classify.

RESPONSE BUDGET (mandatory — enforce ruthlessly):
- Total output must stay under 1800 tokens. Truncated JSON is unusable.
- category / subcategory: max 6 words each
- businessModel: max 20 words, one sentence
- businessModelType / awarenessLevel: single enum token only (see lists above)
- coreProduct: max 30 words, one sentence
- buyer / jobToBeDone: max 15 words each
- coreKeywords / negativeKeywords: max 8 items, max 4 words per item
- evidence.websiteSignals / onboardingSignals / conflicts: max 5 items each, max 15 words per item
- ambiguityFlags: max 4 items, short phrases

OUTPUT FORMAT:
Return ONLY a JSON object. No preamble, no markdown fences. Start with { end with }.

{
  "schemaVersion": 1,
  "category": "string — specific product category",
  "subcategory": "string — narrower classification",
  "businessModel": "string — how they make money (free text)",
  "businessModelType": "plg|slg|ecommerce|transactional|marketplace|unknown",
  "awarenessLevel": "unaware|problem-aware|solution-aware|product-aware|most-aware|unknown",
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
    const stopReason = (response as { stop_reason?: string }).stop_reason;
    const wasTruncated = stopReason === 'max_tokens';

    if (wasTruncated) {
      console.warn('[identity] hit max_tokens cap', {
        stopReason,
        length: resultText.length,
        maxTokens: IDENTITY_MAX_TOKENS,
      });
    }

    let parsed: unknown;
    try {
      parsed = extractJson(resultText);
    } catch {
      console.error('[identity] JSON extraction failed', {
        length: resultText.length,
        stopReason,
        head: resultText.slice(0, 200),
        tail: resultText.slice(-200),
      });
      parsed = null;
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      const flag = wasTruncated ? 'truncated-output' : 'json-parse-failed';
      const fallbackCard = buildFallbackCard(context, flag);
      return {
        status: 'partial',
        section: 'identityResolution',
        durationMs: Date.now() - startTime,
        data: fallbackCard,
        rawText: resultText,
        error: wasTruncated
          ? `Identity resolver hit max_tokens (${IDENTITY_MAX_TOKENS}); fallback card used.`
          : 'Identity resolver returned non-JSON response; fallback card used.',
      };
    }

    // Coerce classification fields to valid enums — defends against the model
    // returning "Product-led" or "PLG SaaS" when the schema expects the literal
    // token 'plg'. Invalid values collapse to 'unknown' which downstream
    // runners (e.g. media plan) treat as a classification-confidence flag.
    const coerced = parsed as Record<string, unknown>;
    coerced.businessModelType = coerceClassification(
      coerced.businessModelType,
      VALID_BUSINESS_MODEL_TYPES,
    );
    coerced.awarenessLevel = coerceClassification(
      coerced.awarenessLevel,
      VALID_AWARENESS_LEVELS,
    );

    // v3 onboarding §1 hard-map: user-stated salesMotion/conversionPath
    // overrides LLM inference on businessModelType.
    applyV3BusinessModelHardMap(coerced, context);

    await emitRunnerProgress(onProgress, 'output', 'identity resolution complete');

    return {
      status: 'complete',
      section: 'identityResolution',
      durationMs: Date.now() - startTime,
      data: coerced,
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
    businessModelType: 'unknown',
    awarenessLevel: 'unknown',
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
