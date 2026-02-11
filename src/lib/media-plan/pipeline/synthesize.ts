// Pipeline Stage 4: SYNTHESIZE
// Model: Claude Sonnet - Generate the final Strategic Research Blueprint

import { generateObject } from "ai";
import { anthropic, MODELS, estimateCost } from "@/lib/ai/providers";
import { mediaPlanBlueprintSchema } from "../schemas";
import type {
  ExtractedData,
  ResearchData,
  LogicData,
  MediaPlanBlueprint,
} from "../types";

const SYSTEM_PROMPT = `You are an expert marketing strategist who writes comprehensive, actionable media plans. Your job is to synthesize research data, strategic decisions, and market insights into a polished Strategic Research Blueprint.

Your writing style:
- Clear and actionable
- Data-driven with specific numbers
- Professional but accessible
- Focused on practical implementation

The blueprint should be ready for a marketing team to execute immediately.`;

function buildUserPrompt(
  extracted: ExtractedData,
  research: ResearchData,
  logic: LogicData
): string {
  return `Create a Strategic Research Blueprint for this campaign. Synthesize all the data into a cohesive, actionable document.

=== CAMPAIGN CONTEXT ===
Industry: ${extracted.industry.name} (${extracted.industry.vertical} > ${extracted.industry.subNiche})
Target Audience: ${extracted.audience.demographics}
Psychographics: ${extracted.audience.psychographics}
Pain Points: ${extracted.audience.painPoints.join("; ")}

Ideal Customer: ${extracted.icp.description}
- Key Characteristics: ${extracted.icp.characteristics.join(", ")}
- Buying Behavior: ${extracted.icp.buyingBehavior}

Budget: $${extracted.budget.total.toLocaleString()} ${extracted.budget.currency}
Offer: ${extracted.offer.type.replace(/_/g, " ")} at $${extracted.offer.price.toLocaleString()}
Sales Cycle: ${extracted.salesCycle.complexity} (~${extracted.salesCycle.daysEstimate} days)

=== MARKET RESEARCH ===
Market Size: ${research.marketOverview.size}
Market Growth: ${research.marketOverview.growth}
Key Trends: ${research.marketOverview.trends.join("; ")}

Top Competitors:
${research.competitors.map((c) => `- ${c.name}: ${c.positioning} (Channels: ${c.channels.join(", ")})`).join("\n")}

Industry Benchmarks:
- CPC: $${research.benchmarks.cpc.low.toFixed(2)}-$${research.benchmarks.cpc.high.toFixed(2)} (avg: $${research.benchmarks.cpc.average.toFixed(2)})
- CPM: $${research.benchmarks.cpm.low.toFixed(2)}-$${research.benchmarks.cpm.high.toFixed(2)} (avg: $${research.benchmarks.cpm.average.toFixed(2)})
- CTR: ${(research.benchmarks.ctr.low * 100).toFixed(2)}%-${(research.benchmarks.ctr.high * 100).toFixed(2)}% (avg: ${(research.benchmarks.ctr.average * 100).toFixed(2)}%)
- Conversion Rate: ${(research.benchmarks.conversionRate.low * 100).toFixed(2)}%-${(research.benchmarks.conversionRate.high * 100).toFixed(2)}% (avg: ${(research.benchmarks.conversionRate.average * 100).toFixed(2)}%)

Audience Insights:
- Active Platforms: ${research.audienceInsights.platforms.join(", ")}
- Content Preferences: ${research.audienceInsights.contentPreferences.join(", ")}
- Peak Engagement: ${research.audienceInsights.peakEngagementTimes.join(", ")}

=== STRATEGIC DECISIONS ===
Selected Platforms:
${logic.platforms.map((p) => `- ${p.name} (${p.priority}): ${p.reason} [${p.budgetPercentage}% budget]`).join("\n")}

Budget Allocation:
${logic.budgetAllocation.map((b) => `- ${b.platform}: $${b.amount.toLocaleString()} (${b.percentage}%)`).join("\n")}

Funnel Strategy: ${logic.funnelType.name}
- Stages: ${logic.funnelType.stages.join(" → ")}
- Rationale: ${logic.funnelType.reason}

KPI Targets:
${logic.kpiTargets.map((k) => `- ${k.metric}: ${k.target} ${k.unit} (${k.rationale})`).join("\n")}

=== SOURCES ===
${research.sources.map((s) => `- ${s.title}: ${s.url}`).join("\n")}

---

Return a JSON object with this exact structure:
{
  "executiveSummary": "string - 2-3 paragraph overview of the entire strategy, key recommendations, and expected outcomes",
  "platformStrategy": [
    {
      "platform": "string - platform name",
      "rationale": "string - detailed explanation of why this platform",
      "tactics": ["array", "of", "specific", "tactics", "to", "use"],
      "budget": number (dollar amount)
    }
  ],
  "budgetBreakdown": [
    {
      "category": "string - budget category",
      "amount": number,
      "percentage": number,
      "notes": "string - what this covers"
    }
  ],
  "funnelStrategy": {
    "type": "string - funnel type name",
    "stages": [
      {
        "name": "string - stage name",
        "objective": "string - what to achieve",
        "channels": ["array", "of", "channels"],
        "content": ["array", "of", "content", "types"]
      }
    ]
  },
  "adAngles": [
    {
      "angle": "string - the angle/approach",
      "hook": "string - attention-grabbing hook text",
      "targetEmotion": "string - emotion being triggered",
      "example": "string - example ad headline or copy"
    }
  ],
  "kpiTargets": [
    {
      "metric": "string - metric name",
      "target": "string - target value with unit",
      "benchmark": "string - industry benchmark for comparison"
    }
  ],
  "sources": [
    {
      "title": "string - source title",
      "url": "string - source URL"
    }
  ],
  "metadata": {
    "generatedAt": "${new Date().toISOString()}",
    "totalCost": 0,
    "processingTime": 0
  }
}

Create 3-5 ad angles with compelling hooks. Make the executive summary persuasive and comprehensive.`;
}

export interface SynthesizeStageResult {
  data: MediaPlanBlueprint;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  cost: number;
  duration: number;
}

export async function runSynthesizeStage(
  extracted: ExtractedData,
  research: ResearchData,
  logic: LogicData
): Promise<SynthesizeStageResult> {
  const startTime = Date.now();

  const result = await generateObject({
    model: anthropic(MODELS.CLAUDE_SONNET),
    schema: mediaPlanBlueprintSchema,
    system: SYSTEM_PROMPT,
    prompt: buildUserPrompt(extracted, research, logic),
    temperature: 0.6,
    maxOutputTokens: 4096,
  });

  const data = result.object as MediaPlanBlueprint;

  // Ensure metadata is set
  data.metadata = {
    generatedAt: new Date().toISOString(),
    totalCost: 0, // Will be updated by orchestrator
    processingTime: 0, // Will be updated by orchestrator
  };

  // Ensure sources from research are included
  if (!data.sources || data.sources.length === 0) {
    data.sources = research.sources;
  }

  // Ensure all required arrays exist
  if (!data.platformStrategy) data.platformStrategy = [];
  if (!data.budgetBreakdown) data.budgetBreakdown = [];
  if (!data.adAngles) data.adAngles = [];
  if (!data.kpiTargets) data.kpiTargets = [];

  const inputTokens = result.usage.inputTokens ?? 0;
  const outputTokens = result.usage.outputTokens ?? 0;
  const cost = estimateCost(MODELS.CLAUDE_SONNET, inputTokens, outputTokens);

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
