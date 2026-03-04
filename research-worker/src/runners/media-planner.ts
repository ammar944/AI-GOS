// Runner: Media Planner
// Opus sub-agent with access to live platform data (Google Ads, Meta Ads, GA4)
// Runs after synthesizeResearch to produce a channel-specific media plan with
// real account data where available, benchmarks where not.

import type { BetaContentBlock } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { createClient, runWithBackoff, extractJson } from '../runner';
import { googleAdsTool, metaAdsTool, ga4Tool } from '../tools';
import type { ResearchResult } from '../supabase';

const MEDIA_PLANNER_SYSTEM_PROMPT = `You are a senior paid media planner building an execution-ready media plan.

You have access to live platform data tools — use them to ground recommendations in actual account performance and real audience data.

AVAILABLE TOOLS:
- googleAds: Live Google Ads campaign performance (if credentials configured)
- metaAds: Live Meta Ads Manager performance (if credentials configured)
- ga4: Live Google Analytics 4 traffic and conversion data (if credentials configured)

TOOL USAGE STRATEGY:
1. Try ga4 first (focus: channels) to understand current traffic source mix and conversion rates
2. Try ga4 (focus: sessions) for baseline traffic metrics
3. Try googleAds (dateRange: 30d) to get current Google Ads performance benchmarks
4. Try metaAds (dateRange: 30d) for Meta performance benchmarks
5. If a tool returns available: false, skip it and work with industry benchmarks instead

GRACEFUL DEGRADATION:
When live data is unavailable, use the platform benchmarks from the synthesis context and note that recommendations are based on industry benchmarks rather than account data.

MEDIA PLAN OUTPUT REQUIREMENTS:

For each recommended platform:
1. Budget allocation (dollar amount AND percentage)
2. Campaign structure (campaign types, ad group structure, targeting approach)
3. Audience strategy (who to target, how to build the funnel layers)
4. Creative requirements (format, quantity, key message for each layer)
5. Performance benchmarks (expected CTR, CPC, CPL, ROAS based on real data or industry benchmarks)
6. Launch sequence (which campaigns to launch first and why)
7. Optimization schedule (what to review weekly vs monthly)

BUDGET TIER RULES (same as synthesis):
- Under $2k/month: 1 primary platform, 20-30% retargeting only
- $2k-$5k/month: 1 primary + 1 secondary + 1 testing (if each gets $500+)
- $5k-$15k/month: Full multi-platform
- Over $15k/month: Aggressive multi-platform with funnel stage budgets

OUTPUT FORMAT:
Respond with JSON only. No preamble. Start with {.

{
  "dataSourced": {
    "googleAdsConnected": boolean,
    "metaAdsConnected": boolean,
    "ga4Connected": boolean,
    "note": "string — brief note on data sources used"
  },
  "channelPlan": [
    {
      "platform": "string",
      "role": "primary | secondary | testing | retargeting",
      "monthlyBudget": number,
      "budgetPercentage": number,
      "campaignStructure": {
        "campaigns": [
          {
            "name": "string — e.g. 'Brand_Search_Exact'",
            "type": "string — Search | Display | Performance Max | etc.",
            "dailyBudget": number,
            "targeting": "string — targeting approach",
            "bidStrategy": "string"
          }
        ],
        "totalCampaigns": number
      },
      "audienceStrategy": {
        "coldAudiences": ["string — targeting specs"],
        "warmAudiences": ["string — retargeting specs"],
        "lookalikes": ["string — if applicable"]
      },
      "creativeRequirements": {
        "formats": ["string"],
        "quantity": number,
        "keyMessage": "string",
        "cta": "string"
      },
      "expectedPerformance": {
        "ctr": "string e.g. '2.5-4%'",
        "cpc": "string e.g. '$3.50-5.20'",
        "cpl": "string e.g. '$45-70'",
        "roas": "string e.g. '3.2x' or 'N/A'",
        "dataSource": "live_account | industry_benchmark"
      },
      "launchWeek": number,
      "optimizationCadence": "string"
    }
  ],
  "launchSequence": [
    {
      "week": number,
      "actions": ["string"],
      "budget": number,
      "milestone": "string"
    }
  ],
  "creativeCalendar": {
    "week1to2": ["string — creative deliverables"],
    "week3to4": ["string — creative deliverables"],
    "month2": ["string — creative deliverables"]
  },
  "kpiFramework": {
    "northStar": "string — the one KPI that matters most",
    "leadingIndicators": ["string — early signals"],
    "weeklyReview": ["string — what to check weekly"],
    "monthlyReview": ["string — what to check monthly"],
    "goNoGoCriteria": "string — when to scale vs pause"
  },
  "budgetSummary": {
    "totalMonthly": number,
    "byPlatform": [{ "platform": "string", "amount": number, "percentage": number }],
    "contingency": number,
    "note": "string"
  }
}`;

export async function runMediaPlanner(context: string): Promise<ResearchResult> {
  const client = createClient();
  const startTime = Date.now();

  try {
    const finalMsg = await runWithBackoff(
      () => {
        const runner = client.beta.messages.toolRunner({
          model: 'claude-sonnet-4-6',
          max_tokens: 10000,
          tools: [googleAdsTool, metaAdsTool, ga4Tool],
          system: MEDIA_PLANNER_SYSTEM_PROMPT,
          messages: [{
            role: 'user',
            content: `Build an execution-ready media plan based on this research context:\n\n${context}`,
          }],
        });
        return Promise.race([
          runner.runUntilDone(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Media planner timed out after 150s')), 150_000),
          ),
        ]);
      },
      'mediaPlanner',
    );

    const textBlock = finalMsg.content.findLast(
      (b: BetaContentBlock) => b.type === 'text',
    );
    const resultText = textBlock && 'text' in textBlock ? textBlock.text : '';

    let data: unknown;
    try {
      data = extractJson(resultText);
    } catch {
      console.error('[mediaPlanner] JSON extraction failed:', resultText.slice(0, 300));
      data = { summary: resultText };
    }

    return {
      status: 'complete',
      section: 'mediaPlan',
      data,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      status: 'error',
      section: 'mediaPlan',
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    };
  }
}
