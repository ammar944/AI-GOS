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
import type { MediaPlanOutput } from "@/lib/media-plan/output-types";

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
      strategyOverview: "Launch strategy",
      timelineFocus: "90-day sprint",
      strategicPriorities: ["Awareness", "Leads"],
      expectedOutcome: "100 leads",
      positioningStatement: "The fastest solution",
    },
    campaignObjectiveSelection: {
      businessGoal: {
        goal: "lead_generation",
        description: "Generate qualified leads",
      },
      marketingObjective: {
        objective: "conversion",
        description: "Drive conversions",
      },
      platformLogic: {
        salesCycleConsideration: "30 days",
        platformImplications: "Multi-touch needed",
        recommendedPlatform: "meta",
        reasoning: "Best for B2B SaaS",
      },
      finalObjective: {
        statement: "Generate 100 MQLs",
        reasoning: "Aligned with growth goals",
        successCriteria: ["100 MQLs", "$50 CAC"],
      },
    },
    keyInsightsFromResearch: {
      painPoints: {
        primary: "Efficiency",
        secondary: ["Cost", "Speed"],
        howToAddress: "Emphasize ROI",
      },
      differentiation: {
        uniqueStrengths: ["Speed"],
        competitiveAdvantages: ["Price"],
        messagingOpportunities: ["Fast setup"],
      },
      competitorAngles: {
        commonApproaches: ["Enterprise focus"],
        gaps: ["SMB market"],
        opportunities: ["Self-serve"],
      },
      icpClarity: {
        primaryProfile: "SMB CTO",
        buyingBehavior: "ROI-focused",
        decisionMakers: ["CTO"],
        influencers: ["Dev team"],
      },
      offerStrengths: {
        valueProposition: "Fast automation",
        proofPoints: ["Case studies"],
        guarantees: ["30-day trial"],
      },
      topInsights: [
        {
          category: "pain_point",
          insight: "Efficiency is key",
          implication: "Lead with speed messaging",
          confidence: "high",
        },
      ],
    },
    icpAndTargetingStrategy: {
      primaryAudience: {
        name: "SMB CTOs",
        description: "Tech leaders at growing companies",
        demographics: {
          location: ["US"],
        },
        psychographics: {
          interests: ["Technology"],
          values: ["Efficiency"],
          behaviors: ["Early adopter"],
          painPoints: ["Manual processes"],
        },
        priority: "primary",
        estimatedSize: "500K",
      },
      secondaryAudiences: [],
      targetingMethods: [
        {
          method: "job_title",
          configuration: "CTO, VP Engineering",
          platform: "linkedin",
          expectedEffectiveness: "high",
          rationale: "Direct decision makers",
        },
      ],
      audienceReachability: {
        totalAddressableAudience: "1M",
        reachableAudience: "500K",
        platformBreakdown: [
          {
            platform: "meta",
            estimatedReach: "300K",
            cpmEstimate: "$15",
          },
        ],
      },
      exclusions: {
        audiences: ["Enterprise"],
        reasons: ["Different sales cycle"],
      },
    },
    platformAndChannelStrategy: {
      platforms: [
        {
          platform: "meta",
          role: "primary_acquisition",
          whySelected: ["Scale", "Targeting"],
          expectedContribution: [
            {
              metric: "Leads",
              contribution: "60%",
              percentage: 60,
            },
          ],
          tactics: ["Lookalike audiences"],
          campaignTypes: ["Conversions"],
          adFormats: ["Video", "Carousel"],
          placements: ["Feed", "Stories"],
          bestPractices: ["Test creative weekly"],
        },
      ],
      primaryPlatform: {
        platform: "meta",
        rationale: "Best ROI for B2B SaaS",
      },
      platformSynergy: "Meta drives awareness, LinkedIn nurtures",
      crossPlatformConsiderations: ["Consistent messaging"],
      priorityOrder: ["meta", "linkedin"],
    },
    funnelStrategy: {
      funnelFlow: "Awareness -> Consideration -> Conversion",
      stages: [
        {
          stage: "tofu",
          label: "Top of Funnel",
          objective: "Awareness",
          contentTypes: ["Video"],
          channels: ["Meta"],
          keyMessages: ["Speed"],
          cta: "Learn More",
          expectedConversionRate: "5%",
        },
      ],
      conversionPath: [
        {
          step: 1,
          action: "Click ad",
          touchpoint: "Meta ad",
          expectedDropoff: "50%",
        },
      ],
      landingPageRequirements: {
        pageType: "Lead capture",
        requiredElements: ["Headline", "Form"],
        headlineRecommendations: ["Problem-focused"],
        aboveFold: ["Value prop"],
        socialProofNeeded: ["Logos"],
        pageSpeedTarget: "< 3s",
        mobileOptimization: ["Responsive"],
      },
      leadQualification: {
        scoringCriteria: [
          {
            criterion: "Company size",
            points: 10,
            rationale: "Fits ICP",
          },
        ],
        mqlThreshold: 50,
        sqlThreshold: 80,
        qualificationQuestions: ["Budget?"],
        disqualifiers: ["No budget"],
      },
      retargetingPaths: [
        {
          window: "7_day",
          label: "Hot retarget",
          audienceDefinition: "Page visitors",
          messageFocus: "Urgency",
          creativeApproach: "Direct CTA",
          frequencyCap: "3/day",
          expectedEngagement: "10%",
        },
      ],
      attributionModel: "Last touch",
    },
    creativeStrategy: {
      primaryAngles: [
        {
          name: "Speed",
          description: "Emphasize fast results",
          targetEmotion: "Relief",
          keyMessage: "Get results in days",
          exampleHooks: ["Stop waiting"],
          bestPlatforms: ["meta"],
          funnelStage: "tofu",
          priority: "primary",
        },
      ],
      hookPatterns: [
        {
          name: "Problem-Solution",
          description: "State problem, offer solution",
          examples: ["Tired of X? Try Y"],
          whyItWorks: "Relatable",
          bestFormats: ["Video"],
        },
      ],
      formatsNeeded: [
        {
          format: "Video",
          platform: "meta",
          specs: {
            dimensions: "1080x1080",
            duration: "15-30s",
          },
          bestPractices: ["Hook in 3s"],
          priority: "must_have",
          quantityNeeded: 5,
        },
      ],
      testingPlan: {
        methodology: "A/B testing",
        variablesToTest: [
          {
            variable: "Hook",
            variations: ["Problem", "Outcome"],
            priority: "high",
          },
        ],
        timeline: "2 weeks",
        successCriteria: "10% lift",
        significanceThreshold: "95%",
        budgetAllocation: "20%",
      },
      expectedWinners: [
        {
          angle: "Speed",
          reasoning: "Resonates with ICP",
          confidenceLevel: "high",
        },
      ],
      refreshCadence: "Every 2 weeks",
      brandGuidelines: {
        mustInclude: ["Logo"],
        mustAvoid: ["Competitor mentions"],
        toneOfVoice: "Professional but friendly",
      },
    },
    campaignStructure: {
      coldStructure: [
        {
          temperature: "cold",
          name: "Prospecting",
          audienceDefinition: "Lookalikes",
          objective: "Conversions",
          budgetAllocation: 60,
          bidStrategy: "Lowest cost",
          targeting: {
            includes: ["Interests"],
            excludes: ["Customers"],
          },
          expectedCpm: "$15",
          expectedResults: "50 leads",
        },
      ],
      warmStructure: [],
      hotStructure: [],
      retargetingSegments: [
        {
          name: "Website visitors",
          source: "Pixel",
          timeWindow: "30 days",
          message: "Come back",
          creativeApproach: "Testimonial",
          frequencyCap: "3/day",
          priority: 1,
        },
      ],
      scalingStructure: {
        scalingTriggers: [
          {
            metric: "CPA",
            threshold: "< $40",
            action: "Increase budget 20%",
          },
        ],
        approach: "Gradual",
        budgetIncrements: "20%",
        monitoringFrequency: "Daily",
        rollbackCriteria: ["CPA > $60"],
      },
      namingConventions: {
        campaignPattern: "[Platform]_[Objective]_[Audience]",
        campaignExample: "META_CONV_LOOKALIKE",
        adSetPattern: "[Targeting]_[Creative]",
        adSetExample: "INT_VIDEO",
        adPattern: "[Hook]_[Format]_[Date]",
        adExample: "SPEED_VIDEO_0101",
        utmStructure: {
          source: "meta",
          medium: "paid",
          campaign: "prospecting",
          content: "video",
        },
      },
      accountStructureOverview: "Campaign > Ad Set > Ad",
    },
    kpisAndPerformanceModel: {
      primaryKpis: [
        {
          metric: "Cost per Lead",
          target: "$50",
          unit: "USD",
          benchmark: "$40-60",
          measurementMethod: "Platform + CRM",
          reportingFrequency: "daily",
        },
      ],
      secondaryKpis: [],
      benchmarkExpectations: [
        {
          metric: "CPL",
          pessimistic: "$70",
          realistic: "$50",
          optimistic: "$35",
        },
      ],
      cacModel: {
        targetCac: 200,
        calculation: [
          {
            component: "Ad spend",
            value: "$150",
            percentage: 75,
          },
        ],
        byChannel: [
          {
            channel: "meta",
            estimatedCac: 180,
            rationale: "Efficient for B2B",
          },
        ],
        optimizationLevers: ["Creative testing"],
      },
      breakEvenMath: {
        breakEvenPoint: {
          customers: 50,
          revenue: 25000,
          timeframe: "3 months",
        },
        revenuePerCustomer: 500,
        contributionMargin: "70%",
        timeToBreakEven: "2 months",
        assumptions: ["$500 ACV"],
        sensitivityAnalysis: [
          {
            variable: "CAC",
            impact: "10% change = 1 month delay",
          },
        ],
      },
      metricsSchedule: {
        daily: [
          {
            metric: "Spend",
            threshold: "$200",
            action: "Monitor",
          },
        ],
        weekly: [
          {
            metric: "CPL",
            threshold: "$60",
            action: "Optimize",
          },
        ],
        monthly: [
          {
            metric: "CAC",
            target: "$200",
            reviewProcess: "Strategy review",
          },
        ],
      },
      northStarMetric: {
        metric: "MQLs",
        target: "100/month",
        rationale: "Drives pipeline",
      },
    },
    budgetAllocationAndScaling: {
      initialBudget: {
        totalMonthly: 5000,
        daily: 166,
        currency: "USD",
        testingPhase: {
          duration: "2 weeks",
          budget: 2000,
          objective: "Find winners",
        },
        scalingPhase: {
          budget: 3000,
          objective: "Scale winners",
        },
      },
      platformAllocation: [
        {
          platform: "meta",
          amount: 4000,
          percentage: 80,
          rationale: "Primary acquisition",
          expectedReturn: "60 leads",
          minimumViableSpend: 2000,
        },
      ],
      funnelAllocation: [
        {
          stage: "tofu",
          percentage: 60,
          amount: 3000,
          rationale: "Awareness focus",
        },
      ],
      scalingRules: [
        {
          name: "Performance scale",
          trigger: "CPA < $40",
          action: "Increase 20%",
          budgetChange: "+20%",
          validationPeriod: "3 days",
          riskLevel: "low",
        },
      ],
      efficiencyCurves: [
        {
          spendLevel: "$5K",
          expectedEfficiency: "High",
          marginalCpa: "$45",
          notes: "Sweet spot",
        },
      ],
      reallocationTriggers: [
        {
          trigger: "Meta CPL > $70",
          from: "meta",
          to: "linkedin",
          condition: "2 weeks sustained",
        },
      ],
      monthlyRoadmap: [
        {
          month: 1,
          budget: 5000,
          focus: "Testing",
          expectedResults: "50 leads",
        },
      ],
    },
    risksAndMitigation: {
      topRisks: [
        {
          id: "R1",
          category: "budget",
          description: "CPL exceeds target",
          severity: "medium",
          likelihood: "possible",
          impact: "Reduced lead volume",
          warningSignals: ["CPL trending up"],
        },
      ],
      mitigationSteps: [
        {
          riskId: "R1",
          action: "Pause underperformers",
          timing: "reactive",
          owner: "Media buyer",
          resourcesNeeded: ["Dashboard"],
          successCriteria: "CPL < $60",
        },
      ],
      dependencies: [
        {
          name: "Landing page",
          description: "Needs to be ready",
          type: "internal",
          status: "met",
          mitigation: "Use existing page",
          impactIfNotMet: "Campaign delay",
        },
      ],
      contingencyPlans: [
        {
          scenario: "Platform ban",
          response: "Shift to LinkedIn",
          trigger: "Account suspension",
        },
      ],
      riskMonitoring: {
        frequency: "Daily",
        metrics: ["CPL", "Spend"],
        escalationPath: "Media buyer -> Manager",
      },
    },
    metadata: {
      generatedAt: new Date().toISOString(),
      version: "1.0",
      processingTime: 10000,
      totalCost: 1.5,
      modelsUsed: ["claude-sonnet", "gpt-4o"],
      overallConfidence: 80,
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
        expect(state?.currentStage).toBe("plan-complete");
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
      expect(getGenerationState()?.currentStage).toBe("plan-complete");
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
      expect(progress.state?.currentStage).toBe("plan-complete");
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

      expect(getGenerationState()?.currentStage).toBe("plan-complete");

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
        JSON.stringify({ currentStage: "plan-complete", lastUpdated: new Date().toISOString() })
      );

      clearMediaPlan();

      // State should remain plan-complete because no blueprint to revert to
      const state = getGenerationState();
      expect(state?.currentStage).toBe("plan-complete");
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

      expect(getGenerationState()?.currentStage).toBe("plan-complete");

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

      expect(Array.isArray(retrieved?.executiveSummary.strategicPriorities)).toBe(true);
      expect(retrieved?.executiveSummary.strategicPriorities).toContain("Awareness");
    });
  });
});
