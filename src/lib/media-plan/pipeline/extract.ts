// Pipeline Stage 1: EXTRACT
// Model: Claude Haiku - Parse form inputs into structured data

import { generateObject } from "ai";
import { anthropic, MODELS, estimateCost } from "@/lib/ai/providers";
import { extractedDataSchema } from "../schemas";
import type {
  NicheFormData,
  BriefingFormData,
  ExtractedData,
  SalesCycleLength,
} from "../types";

const SALES_CYCLE_DAYS: Record<SalesCycleLength, number> = {
  less_than_7_days: 5,
  "7_to_14_days": 10,
  "14_to_30_days": 22,
  more_than_30_days: 45,
};

const SYSTEM_PROMPT = `You are a marketing data extraction specialist. Your job is to parse raw marketing form inputs and structure them into a detailed, organized JSON format.

Analyze the inputs carefully and extract:
1. Industry details - identify the vertical, sub-niche, and market category
2. Audience information - demographics, psychographics, and pain points
3. ICP (Ideal Customer Profile) - characteristics and buying behavior
4. Budget context - interpret the total budget
5. Offer classification - determine if low/mid/high ticket based on price
6. Sales cycle analysis - complexity based on length

For offer type classification:
- low_ticket: under $500
- mid_ticket: $500 - $5,000
- high_ticket: over $5,000

For sales cycle complexity:
- simple: less than 7 days
- moderate: 7-30 days
- complex: over 30 days`;

function buildUserPrompt(niche: NicheFormData, briefing: BriefingFormData): string {
  return `Parse the following marketing inputs into structured data:

NICHE INFORMATION:
- Industry: ${niche.industry}
- Target Audience: ${niche.audience}
- Ideal Customer Profile (ICP): ${niche.icp}

BRIEFING DETAILS:
- Total Budget: $${briefing.budget.toLocaleString()}
- Offer Price: $${briefing.offerPrice.toLocaleString()}
- Sales Cycle Length: ${briefing.salesCycleLength.replace(/_/g, " ")}

Return a JSON object with this exact structure:
{
  "industry": {
    "name": "string - main industry name",
    "vertical": "string - industry vertical/category",
    "subNiche": "string - specific sub-niche"
  },
  "audience": {
    "demographics": "string - age, gender, location, income level",
    "psychographics": "string - interests, values, lifestyle",
    "painPoints": ["array", "of", "pain", "points"]
  },
  "icp": {
    "description": "string - summary of ideal customer",
    "characteristics": ["array", "of", "key", "characteristics"],
    "buyingBehavior": "string - how they make purchase decisions"
  },
  "budget": {
    "total": number,
    "currency": "USD"
  },
  "offer": {
    "price": number,
    "type": "low_ticket" | "mid_ticket" | "high_ticket"
  },
  "salesCycle": {
    "length": "${briefing.salesCycleLength}",
    "daysEstimate": number,
    "complexity": "simple" | "moderate" | "complex"
  }
}`;
}

export interface ExtractStageResult {
  data: ExtractedData;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  cost: number;
  duration: number;
}

export async function runExtractStage(
  niche: NicheFormData,
  briefing: BriefingFormData
): Promise<ExtractStageResult> {
  const startTime = Date.now();

  const result = await generateObject({
    model: anthropic(MODELS.CLAUDE_HAIKU),
    schema: extractedDataSchema,
    system: SYSTEM_PROMPT,
    prompt: buildUserPrompt(niche, briefing),
    temperature: 0.3,
    maxOutputTokens: 2048,
  });

  // Validate and ensure required fields
  const data = result.object as ExtractedData;

  // Ensure sales cycle has correct values from input
  data.salesCycle.length = briefing.salesCycleLength;
  data.salesCycle.daysEstimate = SALES_CYCLE_DAYS[briefing.salesCycleLength];

  // Ensure budget matches input
  data.budget.total = briefing.budget;
  data.offer.price = briefing.offerPrice;

  const inputTokens = result.usage.inputTokens ?? 0;
  const outputTokens = result.usage.outputTokens ?? 0;
  const cost = estimateCost(MODELS.CLAUDE_HAIKU, inputTokens, outputTokens);

  return {
    data,
    usage: {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
    },
    cost,
    duration: Date.now() - startTime,
  };
}
