// Pipeline Stage 2: RESEARCH
// Model: Perplexity Sonar - Market research with real-time data and sources

import { createOpenRouterClient, MODELS } from "@/lib/openrouter/client";
import type { ExtractedData, ResearchData } from "../types";

const SYSTEM_PROMPT = `You are a market research analyst specializing in digital advertising and go-to-market strategy. Your job is to research markets, analyze competitors, and provide industry benchmarks.

You have access to real-time web data. Use it to provide:
1. Current market conditions and trends
2. Competitor analysis with specific companies
3. Realistic advertising benchmarks (CPC, CPM, CTR, conversion rates)
4. Audience behavior insights

Always cite your sources with URLs. Be specific with numbers and data points.
Focus on actionable insights for paid advertising campaigns.`;

function buildUserPrompt(extracted: ExtractedData): string {
  return `Research the following market for a paid advertising campaign:

INDUSTRY: ${extracted.industry.name}
VERTICAL: ${extracted.industry.vertical}
SUB-NICHE: ${extracted.industry.subNiche}

TARGET AUDIENCE:
- Demographics: ${extracted.audience.demographics}
- Psychographics: ${extracted.audience.psychographics}
- Pain Points: ${extracted.audience.painPoints.join(", ")}

IDEAL CUSTOMER:
${extracted.icp.description}
- Characteristics: ${extracted.icp.characteristics.join(", ")}
- Buying Behavior: ${extracted.icp.buyingBehavior}

CAMPAIGN CONTEXT:
- Budget: $${extracted.budget.total.toLocaleString()}
- Offer Type: ${extracted.offer.type.replace(/_/g, " ")} ($${extracted.offer.price.toLocaleString()})
- Sales Cycle: ${extracted.salesCycle.complexity} (~${extracted.salesCycle.daysEstimate} days)

Research and return a JSON object with this exact structure:
{
  "marketOverview": {
    "size": "string - estimated market size with numbers",
    "trends": ["array", "of", "current", "market", "trends"],
    "growth": "string - growth rate and direction"
  },
  "competitors": [
    {
      "name": "string - competitor company name",
      "positioning": "string - how they position themselves",
      "channels": ["array", "of", "marketing", "channels", "they", "use"]
    }
  ],
  "benchmarks": {
    "cpc": { "low": number, "high": number, "average": number },
    "cpm": { "low": number, "high": number, "average": number },
    "ctr": { "low": number, "high": number, "average": number },
    "conversionRate": { "low": number, "high": number, "average": number }
  },
  "audienceInsights": {
    "platforms": ["array", "of", "platforms", "where", "audience", "is", "active"],
    "contentPreferences": ["array", "of", "content", "types", "they", "engage", "with"],
    "peakEngagementTimes": ["array", "of", "best", "times", "to", "reach", "them"]
  },
  "sources": [
    {
      "title": "string - source title or description",
      "url": "string - full URL"
    }
  ]
}

Include 3-5 competitors, realistic benchmark ranges for this specific industry, and at least 3 credible sources.
For benchmarks, use decimals for percentages (e.g., 0.02 for 2% CTR, 0.03 for 3% conversion rate).`;
}

export interface ResearchStageResult {
  data: ResearchData;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost: number;
  duration: number;
}

export async function runResearchStage(
  extracted: ExtractedData
): Promise<ResearchStageResult> {
  const startTime = Date.now();
  const client = createOpenRouterClient();

  const response = await client.chatJSON<ResearchData>({
    model: MODELS.PERPLEXITY_SONAR,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(extracted) },
    ],
    temperature: 0.5,
    maxTokens: 4096,
  });

  // Validate benchmarks have reasonable values
  const data = response.data;

  // Ensure benchmarks are present and have valid numbers
  if (!data.benchmarks) {
    data.benchmarks = {
      cpc: { low: 0.5, high: 5.0, average: 2.0 },
      cpm: { low: 5, high: 50, average: 20 },
      ctr: { low: 0.005, high: 0.03, average: 0.015 },
      conversionRate: { low: 0.01, high: 0.05, average: 0.025 },
    };
  }

  // Ensure sources array exists
  if (!data.sources || !Array.isArray(data.sources)) {
    data.sources = [];
  }

  // Ensure competitors array exists
  if (!data.competitors || !Array.isArray(data.competitors)) {
    data.competitors = [];
  }

  return {
    data,
    usage: response.usage,
    cost: response.cost,
    duration: Date.now() - startTime,
  };
}
