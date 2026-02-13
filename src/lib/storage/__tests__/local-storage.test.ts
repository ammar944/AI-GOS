/**
 * Unit tests for localStorage utility functions
 *
 * Tests cover:
 * - STORAGE_KEYS constant
 * - Get/Set operations (onboarding, blueprint, media plan)
 * - GenerationState tracking and transitions
 * - Utility functions (hasSavedProgress, getSavedProgress)
 * - Clear functions (clearAllSavedData, clearMediaPlan, clearBlueprintAndPlan)
 * - Error handling (localStorage failures)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  STORAGE_KEYS,
  getOnboardingData,
  setOnboardingData,
  getStrategicBlueprint,
  setStrategicBlueprint,
  getMediaPlan,
  setMediaPlan,
  getGenerationState,
  hasSavedProgress,
  getSavedProgress,
  clearAllSavedData,
  clearMediaPlan,
  clearBlueprintAndPlan,
  type GenerationState,
} from "../local-storage";
import type { OnboardingFormData } from "@/lib/onboarding/types";
import type { StrategicBlueprintOutput } from "@/lib/strategic-blueprint/output-types";
import type { MediaPlanOutput } from "@/lib/media-plan/types";

// =============================================================================
// Mock Data Factories
// =============================================================================

function createMockOnboardingData(): OnboardingFormData {
  return {
    businessBasics: {
      businessName: "Test Company",
      websiteUrl: "https://test.com",
    },
    icp: {
      primaryIcpDescription: "Test ICP",
      industryVertical: "Technology",
      jobTitles: "CTO",
      companySize: ["11-50"],
      geography: "US",
      easiestToClose: "SMBs",
      buyingTriggers: "Growth",
      bestClientSources: ["referrals"],
    },
    productOffer: {
      productDescription: "Test product",
      coreDeliverables: "Core feature",
      offerPrice: 100,
      pricingModel: ["monthly"],
      valueProp: "Value",
      currentFunnelType: ["lead_form"],
    },
    marketCompetition: {
      topCompetitors: "Competitor A",
      uniqueEdge: "Our edge",
      marketBottlenecks: "Market issue",
    },
    customerJourney: {
      situationBeforeBuying: "Pain point",
      desiredTransformation: "Success state",
      commonObjections: "Price concern",
      salesCycleLength: "14_to_30_days",
    },
    brandPositioning: {
      brandPositioning: "Market leader",
    },
    assetsProof: {},
    budgetTargets: {
      monthlyAdBudget: 5000,
      campaignDuration: "ongoing",
    },
    compliance: {},
  };
}

function createMockBlueprint(): StrategicBlueprintOutput {
  return {
    industryMarketOverview: {
      categorySnapshot: {
        category: "SaaS",
        marketMaturity: "growing",
        awarenessLevel: "medium",
        buyingBehavior: "roi_based",
        averageSalesCycle: "30-60 days",
        seasonality: "Q4 stronger",
      },
      marketDynamics: {
        demandDrivers: ["Digital transformation"],
        buyingTriggers: ["Growth needs"],
        barriersToPurchase: ["Budget constraints"],
        macroRisks: {
          regulatoryConcerns: "Data privacy",
          marketDownturnRisks: "Moderate",
          industryConsolidation: "Low",
        },
      },
      painPoints: {
        primary: ["Efficiency"],
        secondary: ["Cost"],
      },
      psychologicalDrivers: {
        drivers: [{ driver: "FOMO", description: "Fear of missing out" }],
      },
      audienceObjections: {
        objections: [{ objection: "Price", howToAddress: "ROI focus" }],
      },
      messagingOpportunities: {
        opportunities: ["Efficiency gains"],
        summaryRecommendations: ["Focus on ROI"],
      },
    },
    icpAnalysisValidation: {
      coherenceCheck: {
        clearlyDefined: true,
        reachableThroughPaidChannels: true,
        adequateScale: true,
        hasPainOfferSolves: true,
        hasBudgetAndAuthority: true,
      },
      painSolutionFit: {
        primaryPain: "Efficiency",
        offerComponentSolvingIt: "Automation",
        fitAssessment: "strong",
        notes: "Good fit",
      },
      marketReachability: {
        metaVolume: true,
        linkedInVolume: true,
        googleSearchDemand: true,
        contradictingSignals: [],
      },
      economicFeasibility: {
        hasBudget: true,
        purchasesSimilar: true,
        tamAlignedWithCac: true,
        notes: "Feasible",
      },
      riskAssessment: {
        reachability: "low",
        budget: "low",
        painStrength: "low",
        competitiveness: "medium",
      },
      finalVerdict: {
        status: "validated",
        reasoning: "ICP is validated",
        recommendations: ["Proceed"],
      },
    },
    offerAnalysisViability: {
      offerClarity: {
        clearlyArticulated: true,
        solvesRealPain: true,
        benefitsEasyToUnderstand: true,
        transformationMeasurable: true,
        valuePropositionObvious: true,
      },
      offerStrength: {
        painRelevance: 8,
        urgency: 7,
        differentiation: 7,
        tangibility: 8,
        proof: 6,
        pricingLogic: 8,
        overallScore: 7.3,
      },
      marketOfferFit: {
        marketWantsNow: true,
        competitorsOfferSimilar: true,
        priceMatchesExpectations: true,
        proofStrongForColdTraffic: true,
        transformationBelievable: true,
      },
      redFlags: [],
      recommendation: {
        status: "proceed",
        reasoning: "Strong offer",
        actionItems: ["Launch campaigns"],
      },
    },
    competitorAnalysis: {
      competitors: [
        {
          name: "Competitor A",
          positioning: "Enterprise",
          offer: "Full suite",
          price: "$500/mo",
          funnels: "Demo",
          adPlatforms: ["meta", "linkedin"],
          strengths: ["Brand"],
          weaknesses: ["Price"],
        },
      ],
      creativeLibrary: {
        adHooks: ["Save time"],
        creativeFormats: {
          ugc: true,
          carousels: true,
          statics: true,
          testimonial: true,
          productDemo: false,
        },
      },
      funnelBreakdown: {
        landingPagePatterns: ["Hero + CTA"],
        headlineStructure: ["Problem-Solution"],
        ctaHierarchy: ["Primary + Secondary"],
        socialProofPatterns: ["Logos"],
        leadCaptureMethods: ["Form"],
        formFriction: "low",
      },
      marketStrengths: ["Established brands"],
      marketWeaknesses: ["Slow innovation"],
      gapsAndOpportunities: {
        messagingOpportunities: ["Speed"],
        creativeOpportunities: ["UGC"],
        funnelOpportunities: ["Self-serve"],
      },
    },
    crossAnalysisSynthesis: {
      keyInsights: [
        {
          insight: "Market is growing",
          source: "Research",
          implication: "Good timing",
          priority: "high",
        },
      ],
      recommendedPositioning: "Agile solution for growing businesses",
      primaryMessagingAngles: ["Speed", "ROI"],
      recommendedPlatforms: [
        {
          platform: "Meta",
          reasoning: "High reach",
          priority: "primary",
        },
      ],
      criticalSuccessFactors: ["Strong creative"],
      potentialBlockers: ["Budget"],
      nextSteps: ["Launch test campaigns"],
    },
    metadata: {
      generatedAt: new Date().toISOString(),
      version: "1.0",
      processingTime: 5000,
      totalCost: 0.5,
      modelsUsed: ["claude-sonnet"],
      overallConfidence: 85,
    },
  };
}

function createMockMediaPlan(): MediaPlanOutput {
  return {
    executiveSummary: {
      overview: "Launch strategy",
      primaryObjective: "Generate 100 MQLs",
      recommendedMonthlyBudget: 5000,
      timelineToResults: "4-6 weeks",
      topPriorities: ["Awareness", "Leads", "Optimization"],
    },
    platformStrategy: [
      {
        platform: "Meta",
        rationale: "Best for B2B SaaS",
        budgetPercentage: 60,
        monthlySpend: 3000,
        campaignTypes: ["Lead Gen", "Retargeting"],
        targetingApproach: "Lookalike audiences based on CRM data",
        expectedCplRange: { min: 35, max: 60 },
        priority: "primary",
        adFormats: ["Single Image", "Carousel"],
        placements: ["Facebook News Feed", "Instagram Stories"],
        synergiesWithOtherPlatforms: "Retargets LinkedIn traffic",
      },
      {
        platform: "LinkedIn",
        rationale: "Direct access to decision makers",
        budgetPercentage: 40,
        monthlySpend: 2000,
        campaignTypes: ["Sponsored Content"],
        targetingApproach: "Job title targeting",
        expectedCplRange: { min: 50, max: 90 },
        priority: "secondary",
        adFormats: ["Sponsored Content"],
        placements: ["LinkedIn Feed"],
        synergiesWithOtherPlatforms: "Feeds Meta retargeting pool",
      },
    ],
    budgetAllocation: {
      totalMonthlyBudget: 5000,
      platformBreakdown: [
        { platform: "Meta", monthlyBudget: 3000, percentage: 60 },
        { platform: "LinkedIn", monthlyBudget: 2000, percentage: 40 },
      ],
      dailyCeiling: 200,
      rampUpStrategy: "Start at 50% budget for week 1, scale to 100% by week 3",
      funnelSplit: [
        { stage: "cold", percentage: 60, rationale: "New brand" },
        { stage: "warm", percentage: 25, rationale: "Retargeting" },
        { stage: "hot", percentage: 15, rationale: "Conversion" },
      ],
      monthlyRoadmap: [
        { month: 1, budget: 3000, focus: "Testing", scalingTriggers: ["CPL <$60"] },
        { month: 2, budget: 4000, focus: "Scale", scalingTriggers: ["ROAS >2x"] },
        { month: 3, budget: 5000, focus: "Optimize", scalingTriggers: ["SQL rate >12%"] },
      ],
    },
    campaignPhases: [
      {
        name: "Foundation & Testing",
        phase: 1,
        durationWeeks: 4,
        objective: "Find winning audiences and creatives",
        activities: ["Launch test campaigns", "A/B test creatives"],
        successCriteria: ["CPL below $60", "3+ winning ad sets identified"],
        estimatedBudget: 5000,
      },
      {
        name: "Scale Winners",
        phase: 2,
        durationWeeks: 4,
        objective: "Scale winning campaigns to target volume",
        activities: ["Increase budget on winners", "Expand lookalikes"],
        successCriteria: ["100 leads/month", "CPL below $50"],
        estimatedBudget: 5000,
      },
    ],
    kpiTargets: [
      {
        metric: "Cost Per Lead",
        target: "<$50",
        timeframe: "Month 2",
        measurementMethod: "Platform + CRM tracking",
        type: "primary",
        benchmark: "Industry avg $85-120",
      },
      {
        metric: "Monthly Leads",
        target: "100",
        timeframe: "Month 3",
        measurementMethod: "CRM pipeline",
        type: "primary",
        benchmark: "Typical for $5K/mo B2B spend",
      },
      {
        metric: "SQL Rate",
        target: "15%",
        timeframe: "Ongoing",
        measurementMethod: "CRM qualification tracking",
        type: "secondary",
        benchmark: "B2B SaaS avg 10-20%",
      },
    ],
    icpTargeting: {
      segments: [
        { name: "VP Marketing SaaS", description: "Mid-market VP Marketing", targetingParameters: ["Job Title: VP Marketing"], estimatedReach: "120K-250K on Meta", funnelPosition: "cold" },
        { name: "Website Retarget", description: "Past visitors", targetingParameters: ["Website Visitors 30d"], estimatedReach: "1K-5K", funnelPosition: "warm" },
      ],
      platformTargeting: [
        { platform: "Meta", interests: ["SaaS"], jobTitles: ["VP Marketing"], customAudiences: ["Website visitors"], lookalikeAudiences: ["1% Lookalike"], exclusions: ["Existing customers"] },
      ],
      demographics: "25-55, US, B2B decision makers",
      psychographics: "ROI-focused, tech-savvy",
      geographicTargeting: "US only",
      reachabilityAssessment: "High reachability via Meta and LinkedIn",
    },
    campaignStructure: {
      campaigns: [
        { name: "Meta_Cold_VPMarketing_LeadGen", objective: "Lead Generation", platform: "Meta", funnelStage: "cold", dailyBudget: 100, adSets: [{ name: "Interest Targeting", targeting: "SaaS interests", adsToTest: 4, bidStrategy: "Lowest Cost" }] },
        { name: "Meta_Warm_Retarget", objective: "Conversions", platform: "Meta", funnelStage: "warm", dailyBudget: 50, adSets: [{ name: "Website Retarget 30d", targeting: "Website visitors", adsToTest: 3, bidStrategy: "Cost Cap $50" }] },
      ],
      namingConvention: { campaignPattern: "[Platform]_[Funnel]_[Audience]", adSetPattern: "[Audience]_[Type]", adPattern: "[Angle]_[Format]_[Version]", utmStructure: { source: "facebook", medium: "paid_social", campaign: "{{campaign.name}}", content: "{{ad.name}}" } },
      retargetingSegments: [{ name: "Website 30d", source: "Website pixel", lookbackDays: 30, messagingApproach: "Social proof + urgency" }],
      negativeKeywords: [],
    },
    creativeStrategy: {
      angles: [
        { name: "Pain Agitation", description: "Highlight ICP pain points", exampleHook: "87% of VPs waste $50K/year", bestForFunnelStages: ["cold"], platforms: ["Meta"] },
        { name: "Social Proof", description: "Leverage customer results", exampleHook: "How Company X cut CPL by 40%", bestForFunnelStages: ["cold", "warm"], platforms: ["Meta", "LinkedIn"] },
        { name: "Authority", description: "Expert positioning", exampleHook: "The framework 500+ SaaS companies use", bestForFunnelStages: ["cold"], platforms: ["LinkedIn"] },
      ],
      formatSpecs: [
        { format: "Single Image", dimensions: "1080x1080", platform: "Meta", copyGuideline: "125-150 chars primary text" },
        { format: "Carousel", dimensions: "1080x1080", platform: "Meta", copyGuideline: "5-7 cards, story arc" },
      ],
      testingPlan: [
        { phase: "Week 1-2: Hook Testing", variantsToTest: 4, methodology: "A/B test hooks", testingBudget: 500, durationDays: 14, successCriteria: "CTR >1.5%" },
        { phase: "Week 3-4: Format Testing", variantsToTest: 3, methodology: "Test formats", testingBudget: 500, durationDays: 14, successCriteria: "CPL <$60" },
      ],
      refreshCadence: [{ platform: "Meta", refreshIntervalDays: 21, fatigueSignals: ["CTR drops >30%"] }],
      brandGuidelines: [{ category: "Tone", guideline: "Professional but approachable" }],
    },
    performanceModel: {
      cacModel: { targetCAC: 500, targetCPL: 50, leadToSqlRate: 15, sqlToCustomerRate: 25, expectedMonthlyLeads: 100, expectedMonthlySQLs: 15, expectedMonthlyCustomers: 4, estimatedLTV: 5000, ltvToCacRatio: "10:1" },
      monitoringSchedule: { daily: ["Check spend pacing", "Review disapprovals"], weekly: ["Analyze creative performance", "Review search terms"], monthly: ["Full funnel analysis", "Budget reallocation"] },
    },
    riskMonitoring: {
      risks: [
        { risk: "Meta CPL exceeds $100", category: "budget", severity: "high", likelihood: "medium", mitigation: "Start with $50/day cap", contingency: "Shift to Google Search" },
        { risk: "Creative fatigue within 14 days", category: "creative", severity: "medium", likelihood: "medium", mitigation: "Prepare 3 backup creatives", contingency: "Pause and refresh" },
        { risk: "Audience too narrow on LinkedIn", category: "audience", severity: "medium", likelihood: "low", mitigation: "Expand job titles", contingency: "Reallocate to Meta" },
        { risk: "Platform policy change", category: "platform", severity: "high", likelihood: "low", mitigation: "Diversify across 2+ platforms", contingency: "Shift budget to compliant channels" },
      ],
      assumptions: ["Landing page converts at >2%", "CRM data available within 2 weeks"],
    },
    metadata: {
      generatedAt: new Date().toISOString(),
      version: "2.0.0",
      processingTime: 10000,
      totalCost: 0.15,
      modelUsed: "claude-sonnet-4-20250514",
    },
  };
}

// =============================================================================
// Test Suite
// =============================================================================

describe("LocalStorage", () => {
  // Setup and teardown
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  // ===========================================================================
  // STORAGE_KEYS Tests
  // ===========================================================================

  describe("STORAGE_KEYS", () => {
    it("defines all required storage keys", () => {
      expect(STORAGE_KEYS).toHaveProperty("ONBOARDING_DATA");
      expect(STORAGE_KEYS).toHaveProperty("STRATEGIC_BLUEPRINT");
      expect(STORAGE_KEYS).toHaveProperty("MEDIA_PLAN");
      expect(STORAGE_KEYS).toHaveProperty("GENERATION_STATE");
    });

    it("uses aigog_ prefix for all keys", () => {
      Object.values(STORAGE_KEYS).forEach((key) => {
        expect(key).toMatch(/^aigog_/);
      });
    });

    it("has unique values for all keys", () => {
      const values = Object.values(STORAGE_KEYS);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);
    });
  });

  // ===========================================================================
  // Onboarding Data Tests
  // ===========================================================================

  describe("Onboarding Data", () => {
    describe("getOnboardingData", () => {
      it("returns null when no data is stored", () => {
        expect(getOnboardingData()).toBeNull();
      });

      it("returns stored data when set", () => {
        const mockData = createMockOnboardingData();
        setOnboardingData(mockData);
        expect(getOnboardingData()).toEqual(mockData);
      });

      it("returns null when stored data is invalid JSON", () => {
        localStorage.setItem(STORAGE_KEYS.ONBOARDING_DATA, "invalid json");
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        expect(getOnboardingData()).toBeNull();
        expect(consoleSpy).toHaveBeenCalled();

        consoleSpy.mockRestore();
      });
    });

    describe("setOnboardingData", () => {
      it("stores data and returns true on success", () => {
        const mockData = createMockOnboardingData();
        const result = setOnboardingData(mockData);

        expect(result).toBe(true);
        expect(localStorage.getItem(STORAGE_KEYS.ONBOARDING_DATA)).not.toBeNull();
      });

      it("updates generation state to onboarding", () => {
        const mockData = createMockOnboardingData();
        setOnboardingData(mockData);

        const state = getGenerationState();
        expect(state).not.toBeNull();
        expect(state?.currentStage).toBe("onboarding");
        expect(state?.lastUpdated).toBeDefined();
      });

      it("handles localStorage.setItem failure gracefully", () => {
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        // Use vi.spyOn to properly mock the prototype method
        const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
          throw new Error("QuotaExceeded");
        });

        const mockData = createMockOnboardingData();
        const result = setOnboardingData(mockData);

        expect(result).toBe(false);
        expect(consoleSpy).toHaveBeenCalled();

        setItemSpy.mockRestore();
        consoleSpy.mockRestore();
      });
    });
  });

  // ===========================================================================
  // Strategic Blueprint Tests
  // ===========================================================================

  describe("Strategic Blueprint", () => {
    describe("getStrategicBlueprint", () => {
      it("returns null when no blueprint is stored", () => {
        expect(getStrategicBlueprint()).toBeNull();
      });

      it("returns stored blueprint when set", () => {
        const mockBlueprint = createMockBlueprint();
        setStrategicBlueprint(mockBlueprint);
        expect(getStrategicBlueprint()).toEqual(mockBlueprint);
      });
    });

    describe("setStrategicBlueprint", () => {
      it("stores blueprint and returns true on success", () => {
        const mockBlueprint = createMockBlueprint();
        const result = setStrategicBlueprint(mockBlueprint);

        expect(result).toBe(true);
        expect(localStorage.getItem(STORAGE_KEYS.STRATEGIC_BLUEPRINT)).not.toBeNull();
      });

      it("updates generation state to blueprint-complete", () => {
        const mockBlueprint = createMockBlueprint();
        setStrategicBlueprint(mockBlueprint);

        const state = getGenerationState();
        expect(state).not.toBeNull();
        expect(state?.currentStage).toBe("blueprint-complete");
      });
    });
  });

  // ===========================================================================
  // Media Plan Tests
  // ===========================================================================

  describe("Media Plan", () => {
    describe("getMediaPlan", () => {
      it("returns null when no media plan is stored", () => {
        expect(getMediaPlan()).toBeNull();
      });

      it("returns stored media plan when set", () => {
        const mockPlan = createMockMediaPlan();
        setMediaPlan(mockPlan);
        expect(getMediaPlan()).toEqual(mockPlan);
      });
    });

    describe("setMediaPlan", () => {
      it("stores media plan and returns true on success", () => {
        const mockPlan = createMockMediaPlan();
        const result = setMediaPlan(mockPlan);

        expect(result).toBe(true);
        expect(localStorage.getItem(STORAGE_KEYS.MEDIA_PLAN)).not.toBeNull();
      });

      it("updates generation state to plan-complete", () => {
        const mockPlan = createMockMediaPlan();
        setMediaPlan(mockPlan);

        const state = getGenerationState();
        expect(state).not.toBeNull();
        expect(state?.currentStage).toBe("media-plan-complete");
      });
    });
  });

  // ===========================================================================
  // Generation State Tests
  // ===========================================================================

  describe("Generation State Tracking", () => {
    it("tracks state transitions: onboarding -> blueprint-complete -> plan-complete", () => {
      // Set onboarding data
      setOnboardingData(createMockOnboardingData());
      expect(getGenerationState()?.currentStage).toBe("onboarding");

      // Set blueprint
      setStrategicBlueprint(createMockBlueprint());
      expect(getGenerationState()?.currentStage).toBe("blueprint-complete");

      // Set media plan
      setMediaPlan(createMockMediaPlan());
      expect(getGenerationState()?.currentStage).toBe("media-plan-complete");
    });

    it("includes lastUpdated timestamp in state", () => {
      const beforeSet = new Date();
      setOnboardingData(createMockOnboardingData());
      const afterSet = new Date();

      const state = getGenerationState();
      expect(state?.lastUpdated).toBeDefined();

      // Parse the ISO timestamp to compare as dates
      const stateTimestamp = new Date(state!.lastUpdated);
      expect(stateTimestamp.getTime()).toBeGreaterThanOrEqual(beforeSet.getTime());
      expect(stateTimestamp.getTime()).toBeLessThanOrEqual(afterSet.getTime());
    });

    it("returns null when no state exists", () => {
      expect(getGenerationState()).toBeNull();
    });
  });

  // ===========================================================================
  // hasSavedProgress Tests
  // ===========================================================================

  describe("hasSavedProgress", () => {
    it("returns false when no state exists", () => {
      expect(hasSavedProgress()).toBe(false);
    });

    it("returns false when state.currentStage is onboarding", () => {
      setOnboardingData(createMockOnboardingData());
      expect(hasSavedProgress()).toBe(false);
    });

    it("returns true when state.currentStage is blueprint-complete", () => {
      setStrategicBlueprint(createMockBlueprint());
      expect(hasSavedProgress()).toBe(true);
    });

    it("returns true when state.currentStage is plan-complete", () => {
      setMediaPlan(createMockMediaPlan());
      expect(hasSavedProgress()).toBe(true);
    });
  });

  // ===========================================================================
  // getSavedProgress Tests
  // ===========================================================================

  describe("getSavedProgress", () => {
    it("returns all null when nothing is saved", () => {
      const progress = getSavedProgress();

      expect(progress.onboardingData).toBeNull();
      expect(progress.strategicBlueprint).toBeNull();
      expect(progress.mediaPlan).toBeNull();
      expect(progress.state).toBeNull();
    });

    it("returns populated object when all data exists", () => {
      const mockOnboarding = createMockOnboardingData();
      const mockBlueprint = createMockBlueprint();
      const mockPlan = createMockMediaPlan();

      setOnboardingData(mockOnboarding);
      setStrategicBlueprint(mockBlueprint);
      setMediaPlan(mockPlan);

      const progress = getSavedProgress();

      expect(progress.onboardingData).toEqual(mockOnboarding);
      expect(progress.strategicBlueprint).toEqual(mockBlueprint);
      expect(progress.mediaPlan).toEqual(mockPlan);
      expect(progress.state).not.toBeNull();
      expect(progress.state?.currentStage).toBe("media-plan-complete");
    });

    it("returns partial data when only some data exists", () => {
      const mockOnboarding = createMockOnboardingData();
      setOnboardingData(mockOnboarding);

      const progress = getSavedProgress();

      expect(progress.onboardingData).toEqual(mockOnboarding);
      expect(progress.strategicBlueprint).toBeNull();
      expect(progress.mediaPlan).toBeNull();
      expect(progress.state?.currentStage).toBe("onboarding");
    });
  });

  // ===========================================================================
  // clearAllSavedData Tests
  // ===========================================================================

  describe("clearAllSavedData", () => {
    it("removes all 4 storage keys", () => {
      setOnboardingData(createMockOnboardingData());
      setStrategicBlueprint(createMockBlueprint());
      setMediaPlan(createMockMediaPlan());

      const result = clearAllSavedData();

      expect(result).toBe(true);
      expect(localStorage.getItem(STORAGE_KEYS.ONBOARDING_DATA)).toBeNull();
      expect(localStorage.getItem(STORAGE_KEYS.STRATEGIC_BLUEPRINT)).toBeNull();
      expect(localStorage.getItem(STORAGE_KEYS.MEDIA_PLAN)).toBeNull();
      expect(localStorage.getItem(STORAGE_KEYS.GENERATION_STATE)).toBeNull();
    });

    it("hasSavedProgress returns false after clear", () => {
      setStrategicBlueprint(createMockBlueprint());
      expect(hasSavedProgress()).toBe(true);

      clearAllSavedData();
      expect(hasSavedProgress()).toBe(false);
    });

    it("works even when some keys do not exist", () => {
      setOnboardingData(createMockOnboardingData());
      // Don't set blueprint or media plan

      const result = clearAllSavedData();
      expect(result).toBe(true);
    });
  });

  // ===========================================================================
  // clearMediaPlan Tests
  // ===========================================================================

  describe("clearMediaPlan", () => {
    it("removes only the media plan", () => {
      setOnboardingData(createMockOnboardingData());
      setStrategicBlueprint(createMockBlueprint());
      setMediaPlan(createMockMediaPlan());

      const result = clearMediaPlan();

      expect(result).toBe(true);
      expect(getOnboardingData()).not.toBeNull();
      expect(getStrategicBlueprint()).not.toBeNull();
      expect(getMediaPlan()).toBeNull();
    });

    it("updates state to blueprint-complete if blueprint exists", () => {
      setOnboardingData(createMockOnboardingData());
      setStrategicBlueprint(createMockBlueprint());
      setMediaPlan(createMockMediaPlan());

      expect(getGenerationState()?.currentStage).toBe("media-plan-complete");

      clearMediaPlan();

      expect(getGenerationState()?.currentStage).toBe("blueprint-complete");
    });

    it("does not change state if blueprint does not exist", () => {
      // Set media plan directly without blueprint
      localStorage.setItem(
        STORAGE_KEYS.MEDIA_PLAN,
        JSON.stringify(createMockMediaPlan())
      );
      localStorage.setItem(
        STORAGE_KEYS.GENERATION_STATE,
        JSON.stringify({ currentStage: "media-plan-complete", lastUpdated: new Date().toISOString() })
      );

      clearMediaPlan();

      // State should remain plan-complete because no blueprint to revert to
      const state = getGenerationState();
      expect(state?.currentStage).toBe("media-plan-complete");
    });
  });

  // ===========================================================================
  // clearBlueprintAndPlan Tests
  // ===========================================================================

  describe("clearBlueprintAndPlan", () => {
    it("removes blueprint and media plan", () => {
      setOnboardingData(createMockOnboardingData());
      setStrategicBlueprint(createMockBlueprint());
      setMediaPlan(createMockMediaPlan());

      const result = clearBlueprintAndPlan();

      expect(result).toBe(true);
      expect(getStrategicBlueprint()).toBeNull();
      expect(getMediaPlan()).toBeNull();
    });

    it("keeps onboarding data", () => {
      const mockOnboarding = createMockOnboardingData();
      setOnboardingData(mockOnboarding);
      setStrategicBlueprint(createMockBlueprint());
      setMediaPlan(createMockMediaPlan());

      clearBlueprintAndPlan();

      expect(getOnboardingData()).toEqual(mockOnboarding);
    });

    it("updates state to onboarding", () => {
      setOnboardingData(createMockOnboardingData());
      setStrategicBlueprint(createMockBlueprint());
      setMediaPlan(createMockMediaPlan());

      expect(getGenerationState()?.currentStage).toBe("media-plan-complete");

      clearBlueprintAndPlan();

      expect(getGenerationState()?.currentStage).toBe("onboarding");
    });
  });

  // ===========================================================================
  // Error Handling Tests
  // ===========================================================================

  describe("Error Handling", () => {
    it("handles localStorage.getItem returning invalid JSON", () => {
      localStorage.setItem(STORAGE_KEYS.ONBOARDING_DATA, "{invalid:json}");
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = getOnboardingData();

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("handles localStorage.removeItem failure gracefully", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      // Use vi.spyOn to properly mock the prototype method
      const removeItemSpy = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
        throw new Error("Permission denied");
      });

      // Set data first (restore temporarily to set data)
      removeItemSpy.mockRestore();
      setOnboardingData(createMockOnboardingData());

      // Re-mock removeItem for the clear operation
      const removeItemSpyAgain = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
        throw new Error("Permission denied");
      });

      const result = clearAllSavedData();

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();

      removeItemSpyAgain.mockRestore();
      consoleSpy.mockRestore();
    });

    it("handles empty string in localStorage gracefully", () => {
      localStorage.setItem(STORAGE_KEYS.STRATEGIC_BLUEPRINT, "");

      // Empty string should return null, not crash
      expect(getStrategicBlueprint()).toBeNull();
    });
  });

  // ===========================================================================
  // Data Persistence Tests
  // ===========================================================================

  describe("Data Persistence", () => {
    it("persists complex nested objects correctly", () => {
      const mockBlueprint = createMockBlueprint();
      setStrategicBlueprint(mockBlueprint);

      const retrieved = getStrategicBlueprint();

      // Check nested structure is preserved
      expect(retrieved?.industryMarketOverview.categorySnapshot.category).toBe("SaaS");
      expect(retrieved?.competitorAnalysis.competitors[0].name).toBe("Competitor A");
      expect(retrieved?.metadata.totalCost).toBe(0.5);
    });

    it("preserves array data correctly", () => {
      const mockPlan = createMockMediaPlan();
      setMediaPlan(mockPlan);

      const retrieved = getMediaPlan();

      expect(Array.isArray(retrieved?.executiveSummary.topPriorities)).toBe(true);
      expect(retrieved?.executiveSummary.topPriorities).toContain("Awareness");
    });
  });
});
