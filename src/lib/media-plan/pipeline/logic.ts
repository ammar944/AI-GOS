// Pipeline Stage 3: APPLY LOGIC
// Model: GPT-4o - Apply decision rules for platform selection, budget, funnel, KPIs

import { createOpenRouterClient, MODELS } from "@/lib/openrouter/client";
import type { ExtractedData, ResearchData, LogicData } from "../types";

const SYSTEM_PROMPT = `You are a media planning strategist who applies proven decision frameworks to create advertising strategies. Your job is to take research data and apply logical rules to determine:

1. PLATFORM SELECTION - Based on sales cycle and audience
2. BUDGET ALLOCATION - How to split spend across platforms
3. FUNNEL TYPE - Which funnel strategy fits the offer
4. KPI TARGETS - Realistic goals based on benchmarks

DECISION RULES TO APPLY:

Platform Selection Rules:
- Short sales cycle (<14 days) → Primary: Meta Ads, Google Ads (direct response)
- Long sales cycle (>14 days) → Primary: LinkedIn, YouTube, Content Marketing (nurture-focused)
- B2B audience → Add LinkedIn as primary or secondary
- B2C audience → Prioritize Meta, TikTok, Google
- High-ticket offers (>$5000) → Add retargeting, email nurture
- Low-ticket offers (<$500) → Focus on volume platforms (Meta, Google)

Budget Allocation Rules:
- Primary platform: 50-60% of budget
- Secondary platform: 25-35% of budget
- Retargeting: 10-15% of budget
- Testing reserve: 5-10% of budget

Funnel Type Rules:
- Low-ticket + short cycle → Direct Response Funnel (Ad → Landing Page → Purchase)
- Mid-ticket + moderate cycle → Lead Magnet Funnel (Ad → Lead Magnet → Email → Sale)
- High-ticket + long cycle → Application Funnel (Ad → Content → Application → Call → Sale)

KPI Calculation Rules:
- Target ROAS = Offer Price / Target CPA
- Target CPA = Budget / Expected Conversions
- Expected CTR = Industry benchmark average
- Expected Conversion Rate = Industry benchmark average

Be specific with numbers. All budget allocations must sum to 100%.`;

function buildUserPrompt(extracted: ExtractedData, research: ResearchData): string {
  return `Apply decision rules to create a media strategy for this campaign:

EXTRACTED DATA:
- Industry: ${extracted.industry.name} (${extracted.industry.vertical})
- Audience: ${extracted.audience.demographics}
- Pain Points: ${extracted.audience.painPoints.join(", ")}
- Budget: $${extracted.budget.total.toLocaleString()}
- Offer: ${extracted.offer.type.replace(/_/g, " ")} at $${extracted.offer.price.toLocaleString()}
- Sales Cycle: ${extracted.salesCycle.complexity} (~${extracted.salesCycle.daysEstimate} days)

RESEARCH DATA:
- Market Trends: ${research.marketOverview.trends.join(", ")}
- Competitor Channels: ${research.competitors.map(c => c.channels.join(", ")).join("; ")}
- Audience Platforms: ${research.audienceInsights.platforms.join(", ")}

BENCHMARKS:
- CPC: $${research.benchmarks.cpc.average.toFixed(2)} (range: $${research.benchmarks.cpc.low.toFixed(2)}-$${research.benchmarks.cpc.high.toFixed(2)})
- CPM: $${research.benchmarks.cpm.average.toFixed(2)}
- CTR: ${(research.benchmarks.ctr.average * 100).toFixed(2)}%
- Conversion Rate: ${(research.benchmarks.conversionRate.average * 100).toFixed(2)}%

Return a JSON object with this exact structure:
{
  "platforms": [
    {
      "name": "string - platform name (e.g., Meta Ads, Google Ads, LinkedIn)",
      "priority": "primary" | "secondary",
      "reason": "string - why this platform based on the decision rules",
      "budgetPercentage": number (0-100, all must sum to 100)
    }
  ],
  "budgetAllocation": [
    {
      "platform": "string - platform or category name",
      "amount": number (dollar amount),
      "percentage": number (0-100)
    }
  ],
  "funnelType": {
    "name": "string - funnel name (Direct Response, Lead Magnet, or Application)",
    "stages": ["array", "of", "funnel", "stages"],
    "reason": "string - why this funnel type fits"
  },
  "kpiTargets": [
    {
      "metric": "string - metric name (CPA, ROAS, CTR, Conversion Rate, etc.)",
      "target": number,
      "unit": "string - unit (dollars, percent, ratio)",
      "rationale": "string - how this target was calculated"
    }
  ]
}

Include 2-4 platforms, ensure budget percentages sum to exactly 100, and provide 4-6 KPI targets.`;
}

export interface LogicStageResult {
  data: LogicData;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost: number;
  duration: number;
}

export async function runLogicStage(
  extracted: ExtractedData,
  research: ResearchData
): Promise<LogicStageResult> {
  const startTime = Date.now();
  const client = createOpenRouterClient();

  const response = await client.chatJSON<LogicData>({
    model: MODELS.GPT_4O,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(extracted, research) },
    ],
    temperature: 0.4,
    maxTokens: 3072,
  });

  const data = response.data;

  // Validate budget allocation sums to 100%
  const totalPercentage = data.budgetAllocation.reduce(
    (sum, item) => sum + item.percentage,
    0
  );

  // Normalize if not exactly 100
  if (Math.abs(totalPercentage - 100) > 1) {
    const factor = 100 / totalPercentage;
    data.budgetAllocation = data.budgetAllocation.map((item) => ({
      ...item,
      percentage: Math.round(item.percentage * factor),
      amount: Math.round((item.percentage * factor / 100) * extracted.budget.total),
    }));
  }

  // Ensure amounts match percentages based on actual budget
  data.budgetAllocation = data.budgetAllocation.map((item) => ({
    ...item,
    amount: Math.round((item.percentage / 100) * extracted.budget.total),
  }));

  // Update platform budgetPercentage to match allocation
  const platformBudgets = new Map(
    data.budgetAllocation.map((a) => [a.platform.toLowerCase(), a.percentage])
  );
  data.platforms = data.platforms.map((p) => ({
    ...p,
    budgetPercentage:
      platformBudgets.get(p.name.toLowerCase()) || p.budgetPercentage,
  }));

  return {
    data,
    usage: response.usage,
    cost: response.cost,
    duration: Date.now() - startTime,
  };
}
