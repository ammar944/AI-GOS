/**
 * Round-3 validator sanity tests — proves that validators fire the
 * intended warnings on concrete scenarios that mirror production payloads.
 *
 * Three scenarios:
 *   (a) The failure mode Mahdy flagged — $3k PLG plan with 2 platforms,
 *       CAC/CPL numeric targets, and paid-media levers. Should surface
 *       warnings across platform-count, channel-grounding (TikTok un-cited),
 *       PLG viability (CAC leak + lead vocabulary), and benchmark levers.
 *   (b) Well-formed $10k SLG plan with valid Skok benchmarks, process
 *       levers, and 2 campaigns. Should pass cleanly.
 *   (c) Correct $3k PLG plan with single platform, single campaign,
 *       displayMode rationale-only. Should pass cleanly.
 */

import { describe, expect, it } from 'vitest';
import {
  validateBudgetMath,
  validateCampaignCountByBudget,
  validatePlatformCountByBudget,
  validateChannelGrounding,
  validateIndustryBenchmarks,
  validateLtvCacViability,
  validateStrategicFrame,
} from '../validators/media-plan';
import type { z } from 'zod';
import type {
  channelMixBudgetSchema,
  audienceCampaignSchema,
  measurementGuardrailsSchema,
} from '../contracts';

type ChannelMixBudget = z.infer<typeof channelMixBudgetSchema>;
type AudienceCampaign = z.infer<typeof audienceCampaignSchema>;
type MeasurementGuardrails = z.infer<typeof measurementGuardrailsSchema>;

function buildStrategicFrame(overrides: Partial<ChannelMixBudget['strategicFrame']> = {}) {
  return {
    businessModelApplied: 'plg' as const,
    businessModelConfidence: 'high' as const,
    awarenessLevelApplied: 'solution-aware' as const,
    awarenessLevelConfidence: 'medium' as const,
    salesCycleCeilingDays: 14,
    salesCycleCeilingRationale: '14-day free trial → 14-day ceiling.',
    funnelSplitRationale:
      'Under $5k DR cold-launch → 100% conversion. The conversion campaign IS the education.',
    inMarketTierMix: { inMarket: 100, needsConvinced: 0, coldMass: 0 },
    ...overrides,
  };
}

describe('Round-3 media-plan validators — production sanity', () => {
  describe('Scenario A: the Choros failure mode (pre-round-3)', () => {
    const context =
      '[userId:test] [businessModelType:plg] [awarenessLevel:solution-aware]' +
      'Free trial offer. $18/mo product. Competitors: lovable.dev, aura.com — ' +
      'both advertise on Meta and Google per competitorIntel.adActivity.platforms.';

    const channelMix: ChannelMixBudget = {
      strategicFrame: buildStrategicFrame(),
      platforms: [
        {
          name: 'Meta',
          role: 'primary-acquisition',
          monthlySpend: 1000,
          percentage: 33.3,
          rationale: 'Meta primary for PLG trial acquisition.',
        },
        {
          name: 'Google',
          role: 'primary-acquisition',
          monthlySpend: 1000,
          percentage: 33.3,
          rationale: 'Google search for intent capture.',
        },
        {
          name: 'TikTok',
          role: 'testing',
          monthlySpend: 1000,
          percentage: 33.4,
          rationale: 'TikTok for viral reach.',
        },
      ],
      budgetSummary: {
        totalMonthly: 3000,
        funnelSplit: {
          awareness: 20,
          consideration: 30,
          conversion: 50,
          displayMode: 'chart',
        },
        rampUpWeeks: 2,
      },
      dailyCeilings: [
        { platform: 'Meta', dailyBudget: 33.3, minimumMet: true },
        { platform: 'Google', dailyBudget: 33.3, minimumMet: true },
        { platform: 'TikTok', dailyBudget: 33.4, minimumMet: true },
      ],
    };

    const audienceCampaign: AudienceCampaign = {
      segments: [
        {
          name: 'Cold_Lead_Gen_SaaS_VPs',
          description: 'Generate leads from cold VPs at SaaS companies.',
          targetingParams: { title: 'VP of Engineering' },
          estimatedReach: '100k-250k',
          funnelPosition: 'top',
          priority: 8,
        },
      ],
      campaigns: [
        {
          platform: 'Meta',
          name: 'Meta Conversion',
          objective: 'Conversions',
          adSets: [{ name: 'Cold_VPs', segment: 'Cold_Lead_Gen_SaaS_VPs', budget: 1000 }],
        },
        {
          platform: 'Google',
          name: 'Google Search',
          objective: 'Conversions',
          adSets: [{ name: 'Intent_Keywords', segment: 'Cold_Lead_Gen_SaaS_VPs', budget: 1000 }],
        },
      ],
    };

    const measurement: MeasurementGuardrails = {
      industryBenchmarks: [
        {
          metric: 'Target CAC for PLG',
          range: '$600 CAC',
          source: 'Industry benchmark',
          interpretation: 'Aim for $600 CAC per paying customer.',
          leversToMoveIt: [
            'Increase Meta budget to 70% of spend',
            'Shift platform to LinkedIn for better intent',
          ],
        },
      ],
      salesProcessGuidance: {
        diagnosticNote:
          'Audit MQL-to-SQL conversion rate and time-to-first-touch on inbound leads.',
        improvementLevers: [
          'Reduce SQL-to-opportunity time',
          'Add a pre-call MQL qualifier',
        ],
      },
      risks: [
        {
          risk: 'Budget exhaustion',
          category: 'budget',
          severity: 'high',
          likelihood: 'high',
          mitigation: 'Monitor daily spend.',
          earlyWarning: 'Daily spend variance > 20%.',
          launchBlocker: true,
        },
      ],
      trackingRequirements: [],
    };

    it('flags platform count exceeding $5k ceiling + $1,500 floor', () => {
      const warnings = validatePlatformCountByBudget(channelMix);
      const codes = warnings.map((w) => w.code);
      expect(codes).toContain('too_many_platforms_for_budget');
      expect(codes.filter((c) => c === 'platform_below_spend_floor').length).toBe(3);
    });

    it('flags TikTok as not grounded in upstream research', () => {
      const warnings = validateChannelGrounding(channelMix, context);
      const codes = warnings.map((w) => w.code);
      expect(codes).toContain('platform_not_grounded');
      expect(warnings.some((w) => w.message.includes('TikTok'))).toBe(true);
    });

    it('forces funnelSplit.displayMode to rationale-only at small budget', () => {
      const { data, warnings } = validateBudgetMath(channelMix);
      expect(data.budgetSummary.funnelSplit.displayMode).toBe('rationale-only');
      expect(warnings.some((w) => w.includes("displayMode forced to 'rationale-only'"))).toBe(
        true,
      );
    });

    it('flags campaign count exceeding $5k=1 budget gate', () => {
      const warnings = validateCampaignCountByBudget(audienceCampaign, 3000);
      const codes = warnings.map((w) => w.code);
      expect(codes).toContain('too_many_campaigns_for_budget');
    });

    it('catches paid-media levers inside industryBenchmarks', () => {
      const warnings = validateIndustryBenchmarks(measurement);
      const codes = warnings.map((w) => w.code);
      expect(codes).toContain('benchmark_lever_is_paid_media');
    });

    it('catches PLG CAC/CPL numeric leak + lead vocabulary', () => {
      const warnings = validateLtvCacViability(measurement, context);
      const codes = warnings.map((w) => w.code);
      expect(codes).toContain('plg_cac_numeric_leak');
      expect(codes).toContain('plg_lead_vocabulary_leak');
    });
  });

  describe('Scenario B: well-formed $10k SLG plan', () => {
    const context =
      '[userId:test] [businessModelType:slg] [awarenessLevel:solution-aware] ' +
      'Competitors run Meta + Google + LinkedIn per competitorIntel.adActivity.platforms.';

    const channelMix: ChannelMixBudget = {
      strategicFrame: buildStrategicFrame({
        businessModelApplied: 'slg',
        inMarketTierMix: { inMarket: 60, needsConvinced: 30, coldMass: 10 },
      }),
      platforms: [
        {
          name: 'LinkedIn',
          role: 'primary-acquisition',
          monthlySpend: 7000,
          percentage: 70,
          rationale: 'LinkedIn for B2B SLG — competitor-grounded.',
        },
        {
          name: 'Google',
          role: 'primary-acquisition',
          monthlySpend: 3000,
          percentage: 30,
          rationale: 'Google search for bottom-funnel intent.',
        },
      ],
      budgetSummary: {
        totalMonthly: 10000,
        funnelSplit: {
          awareness: 5,
          consideration: 0,
          conversion: 95,
          displayMode: 'rationale-only',
        },
        rampUpWeeks: 2,
      },
      dailyCeilings: [
        { platform: 'LinkedIn', dailyBudget: 233.33, minimumMet: true },
        { platform: 'Google', dailyBudget: 100, minimumMet: true },
      ],
    };

    const audienceCampaign: AudienceCampaign = {
      segments: [
        {
          name: 'VP_Eng_Enterprise',
          description: 'VP Engineering at 200-1000 employee B2B SaaS.',
          targetingParams: { title: 'VP of Engineering' },
          estimatedReach: '80k',
          funnelPosition: 'top',
          priority: 9,
        },
      ],
      campaigns: [
        {
          platform: 'LinkedIn',
          name: 'LI VP Eng Demo Requests',
          objective: 'Demo requests',
          adSets: [{ name: 'VP_Eng_ToF', segment: 'VP_Eng_Enterprise', budget: 7000 }],
        },
        {
          platform: 'Google',
          name: 'Brand + Category',
          objective: 'Demo requests',
          adSets: [{ name: 'Brand', segment: 'VP_Eng_Enterprise', budget: 3000 }],
        },
      ],
    };

    const measurement: MeasurementGuardrails = {
      industryBenchmarks: [
        {
          metric: 'MQL-to-SQL conversion rate',
          range: '15-25%',
          source: 'Skok SaaS benchmark',
          interpretation:
            'Post-PMF-scaling stage: aim inside this range. Below 15% suggests ICP mismatch.',
          leversToMoveIt: [
            'Add a budget qualifier field in the demo form to filter before the call',
            'Re-score MQLs on demo show rate rather than form submit',
          ],
        },
        {
          metric: 'CAC payback period',
          range: '12-18 months',
          source: 'Skok SaaS benchmark',
          interpretation: 'At this scale, payback beyond 18 months signals pricing or retention gaps.',
          leversToMoveIt: [
            'Introduce annual billing incentive to flatten payback curve',
            'Strengthen retention via onboarding health-check at day 30',
          ],
        },
      ],
      salesProcessGuidance: {
        diagnosticNote:
          'Median time to first outreach and demo show rate drive SLG conversion.',
        improvementLevers: [
          'Reduce time-to-first-touch on demo requests to under 5 minutes',
          'Add a pre-call budget qualifier',
          'Follow the sales SOP for first-call objection handling',
        ],
      },
      risks: [],
      trackingRequirements: [
        { platform: 'LinkedIn', requirement: 'Insight Tag', status: 'required' },
        { platform: 'Google', requirement: 'gtag', status: 'required' },
      ],
    };

    it('passes platform-count gate', () => {
      expect(validatePlatformCountByBudget(channelMix)).toEqual([]);
    });

    it('passes channel grounding (Meta alias allows LinkedIn/Google substrings)', () => {
      const warnings = validateChannelGrounding(channelMix, context);
      expect(warnings).toEqual([]);
    });

    it('passes campaign-count gate at $10k', () => {
      expect(validateCampaignCountByBudget(audienceCampaign, 10000)).toEqual([]);
    });

    it('passes industry benchmarks validation', () => {
      expect(validateIndustryBenchmarks(measurement)).toEqual([]);
    });

    it('passes LTV:CAC viability (SLG context, no PLG leaks)', () => {
      expect(validateLtvCacViability(measurement, context)).toEqual([]);
    });

    it('passes strategicFrame validation', () => {
      expect(validateStrategicFrame(channelMix).warnings).toEqual([]);
    });
  });

  describe('Scenario C: correct $3k PLG plan', () => {
    const context =
      '[userId:test] [businessModelType:plg] [awarenessLevel:solution-aware] ' +
      'Competitors run Meta + Google per competitorIntel.adActivity.platforms.';

    const channelMix: ChannelMixBudget = {
      strategicFrame: buildStrategicFrame({
        inMarketTierMix: { inMarket: 100, needsConvinced: 0, coldMass: 0 },
      }),
      platforms: [
        {
          name: 'Meta',
          role: 'primary-acquisition',
          monthlySpend: 3000,
          percentage: 100,
          rationale: 'Single platform per small-budget-discipline.',
        },
      ],
      budgetSummary: {
        totalMonthly: 3000,
        funnelSplit: {
          awareness: 0,
          consideration: 0,
          conversion: 100,
          displayMode: 'rationale-only',
        },
        rampUpWeeks: 2,
      },
      dailyCeilings: [{ platform: 'Meta', dailyBudget: 100, minimumMet: true }],
    };

    const audienceCampaign: AudienceCampaign = {
      segments: [
        {
          name: 'Cold_PLG_Trials',
          description: 'Cold acquisition for free-trial starts.',
          targetingParams: { interest: 'SaaS' },
          estimatedReach: '50k',
          funnelPosition: 'top',
          priority: 9,
        },
      ],
      campaigns: [
        {
          platform: 'Meta',
          name: 'Meta Trial Acquisition',
          objective: 'Trial starts',
          adSets: [{ name: 'Cold_Interest', segment: 'Cold_PLG_Trials', budget: 3000 }],
          singleCampaignRationale:
            'Single campaign at $3k per Brooke single-campaign-first. Splitting into two halves neither to $1.5k/mo, below the data-sufficiency floor.',
        },
      ],
    };

    it('passes platform-count gate (single platform)', () => {
      expect(validatePlatformCountByBudget(channelMix)).toEqual([]);
    });

    it('passes channel grounding', () => {
      expect(validateChannelGrounding(channelMix, context)).toEqual([]);
    });

    it('passes campaign-count gate with singleCampaignRationale present', () => {
      expect(validateCampaignCountByBudget(audienceCampaign, 3000)).toEqual([]);
    });

    it('keeps displayMode rationale-only (no rewrite needed)', () => {
      const { data, warnings } = validateBudgetMath(channelMix);
      expect(data.budgetSummary.funnelSplit.displayMode).toBe('rationale-only');
      expect(warnings.some((w) => w.includes('displayMode forced'))).toBe(false);
    });

    it('flags missing rationale when campaign count is 1 but field is empty', () => {
      const withoutRationale: AudienceCampaign = {
        ...audienceCampaign,
        campaigns: audienceCampaign.campaigns.map((c) => ({
          ...c,
          singleCampaignRationale: undefined,
        })),
      };
      const warnings = validateCampaignCountByBudget(withoutRationale, 3000);
      expect(warnings.map((w) => w.code)).toContain('missing_single_campaign_rationale');
    });
  });
});
