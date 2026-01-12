import { describe, it, expect } from "vitest";
import { z } from "zod";
import * as schemas from "../schemas";

// =============================================================================
// Media Plan Schema Tests
// =============================================================================

describe("Media Plan Schemas", () => {
  // ===========================================================================
  // Enum Schemas
  // ===========================================================================

  describe("Enum Schemas", () => {
    describe("businessGoalSchema", () => {
      it.each([
        "revenue_growth",
        "lead_generation",
        "brand_awareness",
        "market_expansion",
        "customer_acquisition",
        "product_launch",
        "customer_retention",
        "market_share",
      ])("accepts valid value: %s", (value) => {
        const result = schemas.businessGoalSchema.safeParse(value);
        expect(result.success).toBe(true);
      });

      it("rejects invalid value", () => {
        const result = schemas.businessGoalSchema.safeParse("invalid_goal");
        expect(result.success).toBe(false);
      });
    });

    describe("marketingObjectiveSchema", () => {
      it.each([
        "awareness",
        "consideration",
        "conversion",
        "retention",
        "advocacy",
      ])("accepts valid value: %s", (value) => {
        const result = schemas.marketingObjectiveSchema.safeParse(value);
        expect(result.success).toBe(true);
      });

      it("rejects invalid value", () => {
        const result = schemas.marketingObjectiveSchema.safeParse("invalid");
        expect(result.success).toBe(false);
      });
    });

    describe("targetingMethodSchema", () => {
      it.each([
        "interest_based",
        "lookalike",
        "retargeting",
        "job_title",
        "industry",
        "company_size",
        "behavioral",
        "contextual",
        "custom_audience",
        "keyword",
      ])("accepts valid value: %s", (value) => {
        const result = schemas.targetingMethodSchema.safeParse(value);
        expect(result.success).toBe(true);
      });

      it("rejects invalid value", () => {
        const result = schemas.targetingMethodSchema.safeParse("invalid_method");
        expect(result.success).toBe(false);
      });
    });

    describe("platformNameSchema", () => {
      it.each([
        "meta",
        "google_ads",
        "linkedin",
        "tiktok",
        "youtube",
        "twitter",
        "pinterest",
        "snapchat",
        "microsoft_ads",
        "programmatic",
        "reddit",
        "quora",
      ])("accepts valid value: %s", (value) => {
        const result = schemas.platformNameSchema.safeParse(value);
        expect(result.success).toBe(true);
      });

      it("rejects invalid value", () => {
        const result = schemas.platformNameSchema.safeParse("facebook");
        expect(result.success).toBe(false);
      });
    });

    describe("platformRoleSchema", () => {
      it.each([
        "primary_acquisition",
        "secondary_acquisition",
        "retargeting",
        "awareness",
        "consideration",
        "remarketing",
        "testing",
      ])("accepts valid value: %s", (value) => {
        const result = schemas.platformRoleSchema.safeParse(value);
        expect(result.success).toBe(true);
      });

      it("rejects invalid value", () => {
        const result = schemas.platformRoleSchema.safeParse("invalid_role");
        expect(result.success).toBe(false);
      });
    });

    describe("funnelStageSchema", () => {
      it.each(["tofu", "mofu", "bofu"])("accepts valid value: %s", (value) => {
        const result = schemas.funnelStageSchema.safeParse(value);
        expect(result.success).toBe(true);
      });

      it("rejects invalid value", () => {
        const result = schemas.funnelStageSchema.safeParse("lofu");
        expect(result.success).toBe(false);
      });
    });

    describe("audienceTemperatureSchema", () => {
      it.each(["cold", "warm", "hot"])("accepts valid value: %s", (value) => {
        const result = schemas.audienceTemperatureSchema.safeParse(value);
        expect(result.success).toBe(true);
      });

      it("rejects invalid value", () => {
        const result = schemas.audienceTemperatureSchema.safeParse("lukewarm");
        expect(result.success).toBe(false);
      });
    });

    describe("riskCategorySchema", () => {
      it.each([
        "budget",
        "creative",
        "targeting",
        "platform",
        "market",
        "technical",
        "compliance",
        "competition",
        "timing",
      ])("accepts valid value: %s", (value) => {
        const result = schemas.riskCategorySchema.safeParse(value);
        expect(result.success).toBe(true);
      });

      it("rejects invalid value", () => {
        const result = schemas.riskCategorySchema.safeParse("invalid_category");
        expect(result.success).toBe(false);
      });
    });

    describe("riskSeveritySchema", () => {
      it.each(["low", "medium", "high", "critical"])("accepts valid value: %s", (value) => {
        const result = schemas.riskSeveritySchema.safeParse(value);
        expect(result.success).toBe(true);
      });

      it("rejects invalid value", () => {
        const result = schemas.riskSeveritySchema.safeParse("extreme");
        expect(result.success).toBe(false);
      });
    });

    describe("riskLikelihoodSchema", () => {
      it.each(["unlikely", "possible", "likely", "very_likely"])("accepts valid value: %s", (value) => {
        const result = schemas.riskLikelihoodSchema.safeParse(value);
        expect(result.success).toBe(true);
      });

      it("rejects invalid value", () => {
        const result = schemas.riskLikelihoodSchema.safeParse("certain");
        expect(result.success).toBe(false);
      });
    });
  });

  // ===========================================================================
  // Section 1: Executive Summary
  // ===========================================================================

  describe("Section 1: executiveSummarySchema", () => {
    const validExecutiveSummary = {
      strategyOverview: "Comprehensive multi-channel strategy",
      timelineFocus: "Q1 2025",
      strategicPriorities: ["Lead generation", "Brand awareness"],
      expectedOutcome: "Increase leads by 50%",
      positioningStatement: "Premium solution for enterprise",
    };

    it("accepts valid executive summary", () => {
      const result = schemas.executiveSummarySchema.safeParse(validExecutiveSummary);
      expect(result.success).toBe(true);
    });

    it("rejects missing strategyOverview", () => {
      const { strategyOverview, ...incomplete } = validExecutiveSummary;
      const result = schemas.executiveSummarySchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it("rejects missing timelineFocus", () => {
      const { timelineFocus, ...incomplete } = validExecutiveSummary;
      const result = schemas.executiveSummarySchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it("rejects missing strategicPriorities", () => {
      const { strategicPriorities, ...incomplete } = validExecutiveSummary;
      const result = schemas.executiveSummarySchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it("rejects missing expectedOutcome", () => {
      const { expectedOutcome, ...incomplete } = validExecutiveSummary;
      const result = schemas.executiveSummarySchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it("rejects missing positioningStatement", () => {
      const { positioningStatement, ...incomplete } = validExecutiveSummary;
      const result = schemas.executiveSummarySchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it("allows extra fields via passthrough", () => {
      const withExtra = { ...validExecutiveSummary, extraField: "extra value" };
      const result = schemas.executiveSummarySchema.safeParse(withExtra);
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as Record<string, unknown>).extraField).toBe("extra value");
      }
    });

    it("validates strategicPriorities is an array", () => {
      const invalid = { ...validExecutiveSummary, strategicPriorities: "not an array" };
      const result = schemas.executiveSummarySchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  // ===========================================================================
  // Section 2: Campaign Objective Selection
  // ===========================================================================

  describe("Section 2: campaignObjectiveSelectionSchema", () => {
    const validCampaignObjective = {
      businessGoal: {
        goal: "revenue_growth",
        description: "Increase annual revenue by 30%",
      },
      marketingObjective: {
        objective: "conversion",
        description: "Drive qualified leads to sales",
      },
      platformLogic: {
        salesCycleConsideration: "Long B2B sales cycle",
        platformImplications: "LinkedIn for professional targeting",
        recommendedPlatform: "linkedin",
        reasoning: "B2B audience with high intent",
      },
      finalObjective: {
        statement: "Generate 500 qualified leads per month",
        reasoning: "Based on historical conversion rates",
        successCriteria: ["500+ leads/month", "< $100 CPL"],
      },
    };

    it("accepts valid campaign objective", () => {
      const result = schemas.campaignObjectiveSelectionSchema.safeParse(validCampaignObjective);
      expect(result.success).toBe(true);
    });

    it("rejects invalid businessGoal.goal enum", () => {
      const invalid = {
        ...validCampaignObjective,
        businessGoal: { ...validCampaignObjective.businessGoal, goal: "invalid_goal" },
      };
      const result = schemas.campaignObjectiveSelectionSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("rejects invalid marketingObjective.objective enum", () => {
      const invalid = {
        ...validCampaignObjective,
        marketingObjective: { ...validCampaignObjective.marketingObjective, objective: "invalid" },
      };
      const result = schemas.campaignObjectiveSelectionSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("rejects missing platformLogic", () => {
      const { platformLogic, ...incomplete } = validCampaignObjective;
      const result = schemas.campaignObjectiveSelectionSchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it("rejects missing finalObjective.successCriteria", () => {
      const invalid = {
        ...validCampaignObjective,
        finalObjective: {
          statement: "Test",
          reasoning: "Test",
          // missing successCriteria
        },
      };
      const result = schemas.campaignObjectiveSelectionSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("allows extra fields via passthrough", () => {
      const withExtra = { ...validCampaignObjective, customField: "custom" };
      const result = schemas.campaignObjectiveSelectionSchema.safeParse(withExtra);
      expect(result.success).toBe(true);
    });
  });

  // ===========================================================================
  // Section 3: Key Insights From Research
  // ===========================================================================

  describe("Section 3: keyInsightsFromResearchSchema", () => {
    const validStrategicInsight: z.infer<typeof schemas.strategicInsightSchema> = {
      category: "pain_point",
      insight: "Customers struggle with complex onboarding",
      implication: "Simplify initial setup process",
      confidence: "high",
      source: "Customer interviews",
    };

    const validKeyInsights = {
      painPoints: {
        primary: "Time-consuming manual processes",
        secondary: ["High costs", "Lack of visibility"],
        howToAddress: "Automated workflows",
      },
      differentiation: {
        uniqueStrengths: ["AI-powered", "Real-time analytics"],
        competitiveAdvantages: ["Lower TCO", "Better UX"],
        messagingOpportunities: ["Efficiency gains", "ROI focus"],
      },
      competitorAngles: {
        commonApproaches: ["Feature-based selling"],
        gaps: ["No real-time reporting"],
        opportunities: ["Position on outcomes"],
      },
      icpClarity: {
        primaryProfile: "Marketing Director at mid-market SaaS",
        buyingBehavior: "Research-heavy, committee decision",
        decisionMakers: ["CMO", "VP Marketing"],
        influencers: ["Marketing Ops", "Sales Ops"],
      },
      offerStrengths: {
        valueProposition: "10x faster campaign deployment",
        proofPoints: ["Case study A", "Case study B"],
        guarantees: ["30-day money back"],
      },
      topInsights: [validStrategicInsight],
    };

    describe("strategicInsightSchema", () => {
      it.each([
        "pain_point",
        "differentiation",
        "competitor",
        "icp",
        "offer",
      ])("accepts valid category: %s", (category) => {
        const insight = { ...validStrategicInsight, category };
        const result = schemas.strategicInsightSchema.safeParse(insight);
        expect(result.success).toBe(true);
      });

      it("rejects invalid category", () => {
        const invalid = { ...validStrategicInsight, category: "invalid_category" };
        const result = schemas.strategicInsightSchema.safeParse(invalid);
        expect(result.success).toBe(false);
      });

      it.each(["high", "medium", "low"])("accepts valid confidence: %s", (confidence) => {
        const insight = { ...validStrategicInsight, confidence };
        const result = schemas.strategicInsightSchema.safeParse(insight);
        expect(result.success).toBe(true);
      });

      it("source is optional", () => {
        const { source, ...withoutSource } = validStrategicInsight;
        const result = schemas.strategicInsightSchema.safeParse(withoutSource);
        expect(result.success).toBe(true);
      });
    });

    it("accepts valid key insights", () => {
      const result = schemas.keyInsightsFromResearchSchema.safeParse(validKeyInsights);
      expect(result.success).toBe(true);
    });

    it("rejects missing painPoints", () => {
      const { painPoints, ...incomplete } = validKeyInsights;
      const result = schemas.keyInsightsFromResearchSchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it("rejects missing differentiation", () => {
      const { differentiation, ...incomplete } = validKeyInsights;
      const result = schemas.keyInsightsFromResearchSchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it("rejects empty topInsights array with invalid item", () => {
      const invalid = {
        ...validKeyInsights,
        topInsights: [{ category: "invalid" }], // invalid item
      };
      const result = schemas.keyInsightsFromResearchSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("allows extra fields via passthrough", () => {
      const withExtra = { ...validKeyInsights, aiGenerated: true };
      const result = schemas.keyInsightsFromResearchSchema.safeParse(withExtra);
      expect(result.success).toBe(true);
    });
  });

  // ===========================================================================
  // Section 4: ICP and Targeting Strategy
  // ===========================================================================

  describe("Section 4: icpAndTargetingStrategySchema", () => {
    const validAudienceSegment: z.infer<typeof schemas.audienceSegmentSchema> = {
      name: "Enterprise Decision Makers",
      description: "Senior executives at large companies",
      demographics: {
        ageRange: "35-55",
        gender: "All",
        location: ["United States", "Canada"],
        income: "$150k+",
        education: "Bachelor's or higher",
      },
      psychographics: {
        interests: ["Business technology", "Leadership"],
        values: ["Efficiency", "Innovation"],
        behaviors: ["Research-oriented", "Multi-vendor evaluation"],
        painPoints: ["Budget constraints", "Integration complexity"],
      },
      professional: {
        jobTitles: ["CTO", "VP Engineering"],
        industries: ["SaaS", "FinTech"],
        companySize: ["500-1000", "1000+"],
        seniorityLevel: ["Director", "VP", "C-Suite"],
      },
      priority: "primary",
      estimatedSize: "2.5M",
    };

    const validTargetingMethod: z.infer<typeof schemas.targetingMethodConfigSchema> = {
      method: "lookalike",
      configuration: "1% lookalike from customer list",
      platform: "meta",
      expectedEffectiveness: "high",
      rationale: "Strong signal from existing customers",
    };

    const validIcpStrategy = {
      primaryAudience: validAudienceSegment,
      secondaryAudiences: [],
      targetingMethods: [validTargetingMethod],
      audienceReachability: {
        totalAddressableAudience: "10M",
        reachableAudience: "2.5M",
        platformBreakdown: [
          { platform: "meta", estimatedReach: "1.5M", cpmEstimate: "$15" },
        ],
      },
      exclusions: {
        audiences: ["Existing customers"],
        reasons: ["Already converted"],
      },
    };

    describe("audienceSegmentSchema", () => {
      it.each(["primary", "secondary", "tertiary"])("accepts valid priority: %s", (priority) => {
        const segment = { ...validAudienceSegment, priority };
        const result = schemas.audienceSegmentSchema.safeParse(segment);
        expect(result.success).toBe(true);
      });

      it("rejects invalid priority", () => {
        const invalid = { ...validAudienceSegment, priority: "quaternary" };
        const result = schemas.audienceSegmentSchema.safeParse(invalid);
        expect(result.success).toBe(false);
      });

      it("professional is optional", () => {
        const { professional, ...withoutPro } = validAudienceSegment;
        const result = schemas.audienceSegmentSchema.safeParse(withoutPro);
        expect(result.success).toBe(true);
      });

      it("validates nested demographics.location is array", () => {
        const invalid = {
          ...validAudienceSegment,
          demographics: { ...validAudienceSegment.demographics, location: "USA" },
        };
        const result = schemas.audienceSegmentSchema.safeParse(invalid);
        expect(result.success).toBe(false);
      });
    });

    describe("targetingMethodConfigSchema", () => {
      it.each([
        "interest_based",
        "lookalike",
        "retargeting",
        "job_title",
        "industry",
        "company_size",
        "behavioral",
        "contextual",
        "custom_audience",
        "keyword",
      ])("accepts valid method: %s", (method) => {
        const config = { ...validTargetingMethod, method };
        const result = schemas.targetingMethodConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      });

      it.each(["high", "medium", "low"])("accepts valid expectedEffectiveness: %s", (effectiveness) => {
        const config = { ...validTargetingMethod, expectedEffectiveness: effectiveness };
        const result = schemas.targetingMethodConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      });
    });

    it("accepts valid ICP and targeting strategy", () => {
      const result = schemas.icpAndTargetingStrategySchema.safeParse(validIcpStrategy);
      expect(result.success).toBe(true);
    });

    it("rejects missing primaryAudience", () => {
      const { primaryAudience, ...incomplete } = validIcpStrategy;
      const result = schemas.icpAndTargetingStrategySchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it("validates nested targetingMethods array", () => {
      const invalid = {
        ...validIcpStrategy,
        targetingMethods: [{ method: "invalid_method" }],
      };
      const result = schemas.icpAndTargetingStrategySchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("allows extra fields via passthrough", () => {
      const withExtra = { ...validIcpStrategy, customData: { test: true } };
      const result = schemas.icpAndTargetingStrategySchema.safeParse(withExtra);
      expect(result.success).toBe(true);
    });
  });

  // ===========================================================================
  // Section 5: Platform and Channel Strategy
  // ===========================================================================

  describe("Section 5: platformAndChannelStrategySchema", () => {
    const validPlatformStrategy: z.infer<typeof schemas.platformStrategySchema> = {
      platform: "meta",
      role: "primary_acquisition",
      whySelected: ["Large audience", "Advanced targeting"],
      expectedContribution: [
        { metric: "Leads", contribution: "40%", percentage: 40 },
      ],
      tactics: ["Retargeting", "Lookalike audiences"],
      campaignTypes: ["Conversions", "Lead Gen"],
      adFormats: ["Image", "Video", "Carousel"],
      placements: ["Feed", "Stories", "Reels"],
      bestPractices: ["Test creative weekly", "Rotate ads"],
    };

    const validPlatformChannelStrategy = {
      platforms: [validPlatformStrategy],
      primaryPlatform: {
        platform: "meta" as const,
        rationale: "Largest reach for B2C audience",
      },
      platformSynergy: "Meta for acquisition, Google for intent",
      crossPlatformConsiderations: ["Consistent branding", "Attribution tracking"],
      priorityOrder: ["meta", "google_ads", "linkedin"] as const,
    };

    describe("platformStrategySchema", () => {
      it("accepts valid platform strategy", () => {
        const result = schemas.platformStrategySchema.safeParse(validPlatformStrategy);
        expect(result.success).toBe(true);
      });

      it.each([
        "meta",
        "google_ads",
        "linkedin",
        "tiktok",
        "youtube",
        "twitter",
        "pinterest",
        "snapchat",
        "microsoft_ads",
        "programmatic",
        "reddit",
        "quora",
      ])("accepts valid platform: %s", (platform) => {
        const strategy = { ...validPlatformStrategy, platform };
        const result = schemas.platformStrategySchema.safeParse(strategy);
        expect(result.success).toBe(true);
      });

      it.each([
        "primary_acquisition",
        "secondary_acquisition",
        "retargeting",
        "awareness",
        "consideration",
        "remarketing",
        "testing",
      ])("accepts valid role: %s", (role) => {
        const strategy = { ...validPlatformStrategy, role };
        const result = schemas.platformStrategySchema.safeParse(strategy);
        expect(result.success).toBe(true);
      });

      it("rejects invalid platform", () => {
        const invalid = { ...validPlatformStrategy, platform: "facebook" };
        const result = schemas.platformStrategySchema.safeParse(invalid);
        expect(result.success).toBe(false);
      });

      it("rejects invalid role", () => {
        const invalid = { ...validPlatformStrategy, role: "invalid_role" };
        const result = schemas.platformStrategySchema.safeParse(invalid);
        expect(result.success).toBe(false);
      });

      it("validates expectedContribution array structure", () => {
        const invalid = {
          ...validPlatformStrategy,
          expectedContribution: [{ metric: "Leads" }], // missing contribution and percentage
        };
        const result = schemas.platformStrategySchema.safeParse(invalid);
        expect(result.success).toBe(false);
      });
    });

    it("accepts valid platform and channel strategy", () => {
      const result = schemas.platformAndChannelStrategySchema.safeParse(validPlatformChannelStrategy);
      expect(result.success).toBe(true);
    });

    it("rejects invalid primaryPlatform.platform enum", () => {
      const invalid = {
        ...validPlatformChannelStrategy,
        primaryPlatform: { platform: "invalid", rationale: "test" },
      };
      const result = schemas.platformAndChannelStrategySchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("validates priorityOrder contains valid platform names", () => {
      const invalid = {
        ...validPlatformChannelStrategy,
        priorityOrder: ["invalid_platform"],
      };
      const result = schemas.platformAndChannelStrategySchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("allows extra fields via passthrough", () => {
      const withExtra = { ...validPlatformChannelStrategy, notes: "Additional notes" };
      const result = schemas.platformAndChannelStrategySchema.safeParse(withExtra);
      expect(result.success).toBe(true);
    });
  });

  // ===========================================================================
  // Section 6: Funnel Strategy
  // ===========================================================================

  describe("Section 6: funnelStrategySchema", () => {
    const validFunnelStageConfig: z.infer<typeof schemas.funnelStageConfigSchema> = {
      stage: "tofu",
      label: "Awareness",
      objective: "Build awareness and trust",
      contentTypes: ["Blog posts", "Videos", "Infographics"],
      channels: ["Meta", "YouTube", "LinkedIn"],
      keyMessages: ["Industry leader", "Trusted by 10k+ companies"],
      cta: "Learn More",
      expectedConversionRate: "2-3%",
    };

    const validRetargetingPath: z.infer<typeof schemas.retargetingPathSchema> = {
      window: "7_day",
      label: "Hot Retargeting",
      audienceDefinition: "Website visitors in last 7 days",
      messageFocus: "Urgency and social proof",
      offer: "Free trial",
      creativeApproach: "Testimonial-focused",
      frequencyCap: "3x per day",
      expectedEngagement: "5% CTR",
    };

    const validLandingPageRequirements: z.infer<typeof schemas.landingPageRequirementsSchema> = {
      pageType: "Lead capture",
      requiredElements: ["Headline", "Form", "Social proof"],
      headlineRecommendations: ["Problem-focused", "Benefit-driven"],
      aboveFold: ["Value prop", "CTA", "Hero image"],
      socialProofNeeded: ["Customer logos", "Testimonials"],
      formFields: ["Email", "Company", "Role"],
      pageSpeedTarget: "<3s",
      mobileOptimization: ["Responsive design", "Touch-friendly CTA"],
    };

    const validLeadQualification: z.infer<typeof schemas.leadQualificationSchema> = {
      scoringCriteria: [
        { criterion: "Company size", points: 10, rationale: "Enterprise = higher value" },
      ],
      mqlThreshold: 50,
      sqlThreshold: 80,
      qualificationQuestions: ["Budget?", "Timeline?"],
      disqualifiers: ["Students", "Competitors"],
    };

    const validFunnelStrategy = {
      funnelFlow: "TOFU -> MOFU -> BOFU -> Conversion",
      stages: [validFunnelStageConfig],
      conversionPath: [
        { step: 1, action: "View ad", touchpoint: "Meta Feed", expectedDropoff: "80%" },
      ],
      landingPageRequirements: validLandingPageRequirements,
      leadQualification: validLeadQualification,
      retargetingPaths: [validRetargetingPath],
      attributionModel: "Last-click with view-through",
    };

    describe("funnelStageConfigSchema", () => {
      it.each(["tofu", "mofu", "bofu"])("accepts valid stage: %s", (stage) => {
        const config = { ...validFunnelStageConfig, stage };
        const result = schemas.funnelStageConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      });

      it("rejects invalid stage", () => {
        const invalid = { ...validFunnelStageConfig, stage: "lofu" };
        const result = schemas.funnelStageConfigSchema.safeParse(invalid);
        expect(result.success).toBe(false);
      });
    });

    describe("retargetingPathSchema", () => {
      it.each(["7_day", "14_day", "30_day", "60_day", "90_day", "180_day"])("accepts valid window: %s", (window) => {
        const path = { ...validRetargetingPath, window };
        const result = schemas.retargetingPathSchema.safeParse(path);
        expect(result.success).toBe(true);
      });

      it("rejects invalid window", () => {
        const invalid = { ...validRetargetingPath, window: "365_day" };
        const result = schemas.retargetingPathSchema.safeParse(invalid);
        expect(result.success).toBe(false);
      });

      it("offer is optional", () => {
        const { offer, ...withoutOffer } = validRetargetingPath;
        const result = schemas.retargetingPathSchema.safeParse(withoutOffer);
        expect(result.success).toBe(true);
      });
    });

    describe("landingPageRequirementsSchema", () => {
      it("accepts valid landing page requirements", () => {
        const result = schemas.landingPageRequirementsSchema.safeParse(validLandingPageRequirements);
        expect(result.success).toBe(true);
      });

      it("formFields is optional", () => {
        const { formFields, ...withoutFormFields } = validLandingPageRequirements;
        const result = schemas.landingPageRequirementsSchema.safeParse(withoutFormFields);
        expect(result.success).toBe(true);
      });
    });

    it("accepts valid funnel strategy", () => {
      const result = schemas.funnelStrategySchema.safeParse(validFunnelStrategy);
      expect(result.success).toBe(true);
    });

    it("rejects missing stages", () => {
      const { stages, ...incomplete } = validFunnelStrategy;
      const result = schemas.funnelStrategySchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it("rejects invalid stage enum in stages array", () => {
      const invalid = {
        ...validFunnelStrategy,
        stages: [{ ...validFunnelStageConfig, stage: "invalid" }],
      };
      const result = schemas.funnelStrategySchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("allows extra fields via passthrough", () => {
      const withExtra = { ...validFunnelStrategy, version: "2.0" };
      const result = schemas.funnelStrategySchema.safeParse(withExtra);
      expect(result.success).toBe(true);
    });
  });

  // ===========================================================================
  // Section 7: Creative Strategy
  // ===========================================================================

  describe("Section 7: creativeStrategySchema", () => {
    const validCreativeAngle: z.infer<typeof schemas.creativeAngleSchema> = {
      name: "Problem-Agitation-Solution",
      description: "Address pain point, amplify, then solve",
      targetEmotion: "Relief",
      keyMessage: "Stop wasting time on manual processes",
      exampleHooks: ["Tired of...", "What if you could..."],
      bestPlatforms: ["meta", "linkedin"],
      funnelStage: "tofu",
      priority: "primary",
    };

    const validHookPattern: z.infer<typeof schemas.hookPatternSchema> = {
      name: "Question Hook",
      description: "Open with a provocative question",
      examples: ["Are you still...?", "What if...?"],
      whyItWorks: "Engages curiosity",
      bestFormats: ["Video", "Static"],
    };

    const validCreativeFormat: z.infer<typeof schemas.creativeFormatSchema> = {
      format: "Video",
      platform: "meta",
      specs: {
        dimensions: "1080x1920",
        duration: "15-60s",
        fileType: "MP4",
        maxFileSize: "4GB",
      },
      bestPractices: ["Hook in first 3s", "Captions required"],
      priority: "must_have",
      quantityNeeded: 10,
    };

    const validTestingPlan: z.infer<typeof schemas.creativeTestingPlanSchema> = {
      methodology: "A/B testing with statistical significance",
      variablesToTest: [
        { variable: "Headline", variations: ["Version A", "Version B"], priority: "high" },
      ],
      timeline: "2 weeks per test",
      successCriteria: "20% improvement in CTR",
      significanceThreshold: "95%",
      budgetAllocation: "20% of total budget",
    };

    const validCreativeStrategy = {
      primaryAngles: [validCreativeAngle],
      hookPatterns: [validHookPattern],
      formatsNeeded: [validCreativeFormat],
      testingPlan: validTestingPlan,
      expectedWinners: [
        { angle: "Problem-Agitation-Solution", reasoning: "Historical performance", confidenceLevel: "high" as const },
      ],
      refreshCadence: "Every 2 weeks",
      brandGuidelines: {
        mustInclude: ["Logo", "Brand colors"],
        mustAvoid: ["Competitor mentions", "Negative language"],
        toneOfVoice: "Professional yet approachable",
      },
    };

    describe("creativeAngleSchema", () => {
      it("accepts valid creative angle", () => {
        const result = schemas.creativeAngleSchema.safeParse(validCreativeAngle);
        expect(result.success).toBe(true);
      });

      it.each(["tofu", "mofu", "bofu"])("accepts valid funnelStage: %s", (stage) => {
        const angle = { ...validCreativeAngle, funnelStage: stage };
        const result = schemas.creativeAngleSchema.safeParse(angle);
        expect(result.success).toBe(true);
      });

      it.each(["primary", "secondary", "tertiary"])("accepts valid priority: %s", (priority) => {
        const angle = { ...validCreativeAngle, priority };
        const result = schemas.creativeAngleSchema.safeParse(angle);
        expect(result.success).toBe(true);
      });

      it("validates bestPlatforms contains valid platform names", () => {
        const invalid = { ...validCreativeAngle, bestPlatforms: ["invalid_platform"] };
        const result = schemas.creativeAngleSchema.safeParse(invalid);
        expect(result.success).toBe(false);
      });
    });

    describe("creativeFormatSchema", () => {
      it.each(["must_have", "should_have", "nice_to_have"])("accepts valid priority: %s", (priority) => {
        const format = { ...validCreativeFormat, priority };
        const result = schemas.creativeFormatSchema.safeParse(format);
        expect(result.success).toBe(true);
      });

      it("validates platform enum", () => {
        const invalid = { ...validCreativeFormat, platform: "invalid" };
        const result = schemas.creativeFormatSchema.safeParse(invalid);
        expect(result.success).toBe(false);
      });

      it("specs fields are optional", () => {
        const minimal = { ...validCreativeFormat, specs: {} };
        const result = schemas.creativeFormatSchema.safeParse(minimal);
        expect(result.success).toBe(true);
      });
    });

    describe("creativeTestingPlanSchema", () => {
      it("accepts valid testing plan", () => {
        const result = schemas.creativeTestingPlanSchema.safeParse(validTestingPlan);
        expect(result.success).toBe(true);
      });

      it.each(["high", "medium", "low"])("accepts valid variablesToTest priority: %s", (priority) => {
        const plan = {
          ...validTestingPlan,
          variablesToTest: [{ variable: "Test", variations: ["A"], priority }],
        };
        const result = schemas.creativeTestingPlanSchema.safeParse(plan);
        expect(result.success).toBe(true);
      });
    });

    it("accepts valid creative strategy", () => {
      const result = schemas.creativeStrategySchema.safeParse(validCreativeStrategy);
      expect(result.success).toBe(true);
    });

    it("rejects missing primaryAngles", () => {
      const { primaryAngles, ...incomplete } = validCreativeStrategy;
      const result = schemas.creativeStrategySchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it("rejects invalid confidenceLevel in expectedWinners", () => {
      const invalid = {
        ...validCreativeStrategy,
        expectedWinners: [{ angle: "Test", reasoning: "Test", confidenceLevel: "invalid" }],
      };
      const result = schemas.creativeStrategySchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("allows extra fields via passthrough", () => {
      const withExtra = { ...validCreativeStrategy, aiGenerated: true };
      const result = schemas.creativeStrategySchema.safeParse(withExtra);
      expect(result.success).toBe(true);
    });
  });

  // ===========================================================================
  // Section 8: Campaign Structure
  // ===========================================================================

  describe("Section 8: campaignStructureSchema", () => {
    const validCampaignSegment: z.infer<typeof schemas.campaignStructureSegmentSchema> = {
      temperature: "cold",
      name: "Cold Prospecting - Interest Based",
      audienceDefinition: "Interest-based targeting for new prospects",
      objective: "Generate awareness and initial engagement",
      budgetAllocation: 40,
      bidStrategy: "Lowest cost",
      targeting: {
        includes: ["Interest: Marketing", "Interest: SaaS"],
        excludes: ["Website visitors", "Existing customers"],
      },
      expectedCpm: "$12-15",
      expectedResults: "0.5% CTR, $50 CPL",
    };

    const validRetargetingSegment: z.infer<typeof schemas.retargetingSegmentSchema> = {
      name: "Cart Abandoners",
      source: "Website pixel",
      timeWindow: "7 days",
      message: "Complete your purchase",
      creativeApproach: "Dynamic product ads",
      frequencyCap: "3x per day",
      priority: 1,
    };

    const validScalingStructure: z.infer<typeof schemas.scalingStructureSchema> = {
      scalingTriggers: [
        { metric: "ROAS", threshold: ">3x", action: "Increase budget 20%" },
      ],
      approach: "Horizontal scaling first, then vertical",
      budgetIncrements: "20% every 3 days",
      monitoringFrequency: "Daily",
      rollbackCriteria: ["ROAS < 2x for 3 days", "CPL > $100"],
    };

    const validNamingConventions: z.infer<typeof schemas.namingConventionsSchema> = {
      campaignPattern: "[Platform]_[Objective]_[Audience]_[Date]",
      campaignExample: "META_CONV_COLD_2025Q1",
      adSetPattern: "[Targeting]_[Placement]_[Budget]",
      adSetExample: "LAL1_FEED_D50",
      adPattern: "[Angle]_[Format]_[Version]",
      adExample: "PAS_VIDEO_V1",
      utmStructure: {
        source: "{{platform}}",
        medium: "paid_social",
        campaign: "{{campaign_name}}",
        content: "{{ad_name}}",
        term: "{{targeting}}",
      },
    };

    const validCampaignStructure = {
      coldStructure: [validCampaignSegment],
      warmStructure: [{ ...validCampaignSegment, temperature: "warm" as const }],
      hotStructure: [{ ...validCampaignSegment, temperature: "hot" as const }],
      retargetingSegments: [validRetargetingSegment],
      scalingStructure: validScalingStructure,
      namingConventions: validNamingConventions,
      accountStructureOverview: "3-tier structure: Cold, Warm, Hot",
    };

    describe("campaignStructureSegmentSchema", () => {
      it.each(["cold", "warm", "hot"])("accepts valid temperature: %s", (temperature) => {
        const segment = { ...validCampaignSegment, temperature };
        const result = schemas.campaignStructureSegmentSchema.safeParse(segment);
        expect(result.success).toBe(true);
      });

      it("rejects invalid temperature", () => {
        const invalid = { ...validCampaignSegment, temperature: "lukewarm" };
        const result = schemas.campaignStructureSegmentSchema.safeParse(invalid);
        expect(result.success).toBe(false);
      });

      it("validates targeting.includes is array", () => {
        const invalid = {
          ...validCampaignSegment,
          targeting: { includes: "not array", excludes: [] },
        };
        const result = schemas.campaignStructureSegmentSchema.safeParse(invalid);
        expect(result.success).toBe(false);
      });
    });

    describe("scalingStructureSchema", () => {
      it("accepts valid scaling structure", () => {
        const result = schemas.scalingStructureSchema.safeParse(validScalingStructure);
        expect(result.success).toBe(true);
      });

      it("validates scalingTriggers array structure", () => {
        const invalid = {
          ...validScalingStructure,
          scalingTriggers: [{ metric: "ROAS" }], // missing threshold and action
        };
        const result = schemas.scalingStructureSchema.safeParse(invalid);
        expect(result.success).toBe(false);
      });
    });

    describe("namingConventionsSchema", () => {
      it("accepts valid naming conventions", () => {
        const result = schemas.namingConventionsSchema.safeParse(validNamingConventions);
        expect(result.success).toBe(true);
      });

      it("utmStructure.term is optional", () => {
        const { term, ...utmWithoutTerm } = validNamingConventions.utmStructure;
        const withoutTerm = {
          ...validNamingConventions,
          utmStructure: utmWithoutTerm,
        };
        const result = schemas.namingConventionsSchema.safeParse(withoutTerm);
        expect(result.success).toBe(true);
      });
    });

    it("accepts valid campaign structure", () => {
      const result = schemas.campaignStructureSchema.safeParse(validCampaignStructure);
      expect(result.success).toBe(true);
    });

    it("rejects missing coldStructure", () => {
      const { coldStructure, ...incomplete } = validCampaignStructure;
      const result = schemas.campaignStructureSchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it("validates temperature in structure arrays matches expected value", () => {
      const invalid = {
        ...validCampaignStructure,
        coldStructure: [{ ...validCampaignSegment, temperature: "hot" }], // wrong temperature
      };
      // Note: Schema doesn't enforce temperature matching array name, this should pass
      const result = schemas.campaignStructureSchema.safeParse(invalid);
      expect(result.success).toBe(true); // Schema allows any valid temperature
    });

    it("allows extra fields via passthrough", () => {
      const withExtra = { ...validCampaignStructure, customField: "test" };
      const result = schemas.campaignStructureSchema.safeParse(withExtra);
      expect(result.success).toBe(true);
    });
  });

  // ===========================================================================
  // Section 9: KPIs and Performance Model
  // ===========================================================================

  describe("Section 9: kpisAndPerformanceModelSchema", () => {
    const validKpiDefinition: z.infer<typeof schemas.kpiDefinitionSchema> = {
      metric: "Cost Per Lead",
      target: "$50",
      unit: "USD",
      benchmark: "Industry avg: $75",
      measurementMethod: "Platform reporting + CRM",
      reportingFrequency: "weekly",
    };

    const validCacModel: z.infer<typeof schemas.cacModelSchema> = {
      targetCac: 150,
      calculation: [
        { component: "Ad spend", value: "$100", percentage: 67 },
        { component: "Creative", value: "$30", percentage: 20 },
        { component: "Tools", value: "$20", percentage: 13 },
      ],
      byChannel: [
        { channel: "Meta", estimatedCac: 120, rationale: "Strong targeting" },
        { channel: "LinkedIn", estimatedCac: 200, rationale: "Higher CPMs" },
      ],
      optimizationLevers: ["Creative testing", "Audience refinement"],
    };

    const validBreakEvenAnalysis: z.infer<typeof schemas.breakEvenAnalysisSchema> = {
      breakEvenPoint: {
        customers: 100,
        revenue: 50000,
        timeframe: "6 months",
      },
      revenuePerCustomer: 500,
      contributionMargin: "40%",
      timeToBreakEven: "6 months",
      assumptions: ["10% conversion rate", "6 month payback"],
      sensitivityAnalysis: [
        { variable: "Conversion rate", impact: "+/-1% = $5k revenue impact" },
      ],
    };

    const validMetricsSchedule: z.infer<typeof schemas.metricsScheduleSchema> = {
      daily: [
        { metric: "Spend", threshold: "< $500", action: "Alert if over" },
      ],
      weekly: [
        { metric: "CPL", threshold: "< $60", action: "Optimize if over" },
      ],
      monthly: [
        { metric: "ROAS", target: "> 3x", reviewProcess: "Team meeting" },
      ],
    };

    const validKpisPerformanceModel = {
      primaryKpis: [validKpiDefinition],
      secondaryKpis: [{ ...validKpiDefinition, metric: "Click-Through Rate" }],
      benchmarkExpectations: [
        { metric: "CTR", pessimistic: "0.5%", realistic: "1%", optimistic: "2%" },
      ],
      cacModel: validCacModel,
      breakEvenMath: validBreakEvenAnalysis,
      metricsSchedule: validMetricsSchedule,
      northStarMetric: {
        metric: "Qualified Leads",
        target: "500 per month",
        rationale: "Directly ties to revenue goals",
      },
    };

    describe("kpiDefinitionSchema", () => {
      it.each(["daily", "weekly", "monthly"])("accepts valid reportingFrequency: %s", (freq) => {
        const kpi = { ...validKpiDefinition, reportingFrequency: freq };
        const result = schemas.kpiDefinitionSchema.safeParse(kpi);
        expect(result.success).toBe(true);
      });

      it("rejects invalid reportingFrequency", () => {
        const invalid = { ...validKpiDefinition, reportingFrequency: "hourly" };
        const result = schemas.kpiDefinitionSchema.safeParse(invalid);
        expect(result.success).toBe(false);
      });
    });

    describe("cacModelSchema", () => {
      it("accepts valid CAC model", () => {
        const result = schemas.cacModelSchema.safeParse(validCacModel);
        expect(result.success).toBe(true);
      });

      it("validates targetCac is a number", () => {
        const invalid = { ...validCacModel, targetCac: "150" };
        const result = schemas.cacModelSchema.safeParse(invalid);
        expect(result.success).toBe(false);
      });

      it("validates byChannel array structure", () => {
        const invalid = {
          ...validCacModel,
          byChannel: [{ channel: "Meta" }], // missing estimatedCac and rationale
        };
        const result = schemas.cacModelSchema.safeParse(invalid);
        expect(result.success).toBe(false);
      });
    });

    describe("breakEvenAnalysisSchema", () => {
      it("accepts valid break-even analysis", () => {
        const result = schemas.breakEvenAnalysisSchema.safeParse(validBreakEvenAnalysis);
        expect(result.success).toBe(true);
      });

      it("validates breakEvenPoint.customers is a number", () => {
        const invalid = {
          ...validBreakEvenAnalysis,
          breakEvenPoint: { ...validBreakEvenAnalysis.breakEvenPoint, customers: "100" },
        };
        const result = schemas.breakEvenAnalysisSchema.safeParse(invalid);
        expect(result.success).toBe(false);
      });
    });

    describe("metricsScheduleSchema", () => {
      it("accepts valid metrics schedule", () => {
        const result = schemas.metricsScheduleSchema.safeParse(validMetricsSchedule);
        expect(result.success).toBe(true);
      });

      it("validates daily array item structure", () => {
        const invalid = {
          ...validMetricsSchedule,
          daily: [{ metric: "Spend" }], // missing threshold and action
        };
        const result = schemas.metricsScheduleSchema.safeParse(invalid);
        expect(result.success).toBe(false);
      });

      it("validates monthly array item structure", () => {
        const invalid = {
          ...validMetricsSchedule,
          monthly: [{ metric: "ROAS" }], // missing target and reviewProcess
        };
        const result = schemas.metricsScheduleSchema.safeParse(invalid);
        expect(result.success).toBe(false);
      });
    });

    it("accepts valid KPIs and performance model", () => {
      const result = schemas.kpisAndPerformanceModelSchema.safeParse(validKpisPerformanceModel);
      expect(result.success).toBe(true);
    });

    it("rejects missing primaryKpis", () => {
      const { primaryKpis, ...incomplete } = validKpisPerformanceModel;
      const result = schemas.kpisAndPerformanceModelSchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it("rejects missing northStarMetric", () => {
      const { northStarMetric, ...incomplete } = validKpisPerformanceModel;
      const result = schemas.kpisAndPerformanceModelSchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it("allows extra fields via passthrough", () => {
      const withExtra = { ...validKpisPerformanceModel, customMetrics: [] };
      const result = schemas.kpisAndPerformanceModelSchema.safeParse(withExtra);
      expect(result.success).toBe(true);
    });
  });

  // ===========================================================================
  // Section 10: Budget Allocation and Scaling
  // ===========================================================================

  describe("Section 10: budgetAllocationAndScalingSchema", () => {
    const validInitialBudget: z.infer<typeof schemas.initialBudgetSchema> = {
      totalMonthly: 10000,
      daily: 333,
      currency: "USD",
      testingPhase: {
        duration: "2 weeks",
        budget: 2000,
        objective: "Identify winning audiences",
      },
      scalingPhase: {
        budget: 8000,
        objective: "Scale winning campaigns",
      },
    };

    const validPlatformBudgetAllocation: z.infer<typeof schemas.platformBudgetAllocationSchema> = {
      platform: "meta",
      amount: 5000,
      percentage: 50,
      rationale: "Largest audience reach",
      expectedReturn: "3x ROAS",
      minimumViableSpend: 1000,
    };

    const validScalingRule: z.infer<typeof schemas.scalingRuleSchema> = {
      name: "Performance Scale Up",
      trigger: "ROAS > 3x for 3 days",
      action: "Increase budget 20%",
      budgetChange: "+20%",
      validationPeriod: "3 days",
      riskLevel: "low",
    };

    const validBudgetAllocationScaling = {
      initialBudget: validInitialBudget,
      platformAllocation: [validPlatformBudgetAllocation],
      funnelAllocation: [
        { stage: "tofu" as const, percentage: 50, amount: 5000, rationale: "Awareness focus" },
        { stage: "mofu" as const, percentage: 30, amount: 3000, rationale: "Nurture leads" },
        { stage: "bofu" as const, percentage: 20, amount: 2000, rationale: "Conversions" },
      ],
      scalingRules: [validScalingRule],
      efficiencyCurves: [
        { spendLevel: "$5k", expectedEfficiency: "3x ROAS", marginalCpa: "$50", notes: "Sweet spot" },
      ],
      reallocationTriggers: [
        { trigger: "Platform underperforming", from: "Meta", to: "Google", condition: "ROAS < 2x for 7 days" },
      ],
      monthlyRoadmap: [
        { month: 1, budget: 10000, focus: "Testing", expectedResults: "Identify winners" },
      ],
    };

    describe("initialBudgetSchema", () => {
      it("accepts valid initial budget", () => {
        const result = schemas.initialBudgetSchema.safeParse(validInitialBudget);
        expect(result.success).toBe(true);
      });

      it("validates totalMonthly is a number", () => {
        const invalid = { ...validInitialBudget, totalMonthly: "10000" };
        const result = schemas.initialBudgetSchema.safeParse(invalid);
        expect(result.success).toBe(false);
      });

      it("validates testingPhase.budget is a number", () => {
        const invalid = {
          ...validInitialBudget,
          testingPhase: { ...validInitialBudget.testingPhase, budget: "2000" },
        };
        const result = schemas.initialBudgetSchema.safeParse(invalid);
        expect(result.success).toBe(false);
      });
    });

    describe("platformBudgetAllocationSchema", () => {
      it("accepts valid platform budget allocation", () => {
        const result = schemas.platformBudgetAllocationSchema.safeParse(validPlatformBudgetAllocation);
        expect(result.success).toBe(true);
      });

      it("validates platform enum", () => {
        const invalid = { ...validPlatformBudgetAllocation, platform: "invalid" };
        const result = schemas.platformBudgetAllocationSchema.safeParse(invalid);
        expect(result.success).toBe(false);
      });

      it("validates amount is a number", () => {
        const invalid = { ...validPlatformBudgetAllocation, amount: "5000" };
        const result = schemas.platformBudgetAllocationSchema.safeParse(invalid);
        expect(result.success).toBe(false);
      });
    });

    describe("scalingRuleSchema", () => {
      it.each(["low", "medium", "high"])("accepts valid riskLevel: %s", (riskLevel) => {
        const rule = { ...validScalingRule, riskLevel };
        const result = schemas.scalingRuleSchema.safeParse(rule);
        expect(result.success).toBe(true);
      });

      it("rejects invalid riskLevel", () => {
        const invalid = { ...validScalingRule, riskLevel: "critical" };
        const result = schemas.scalingRuleSchema.safeParse(invalid);
        expect(result.success).toBe(false);
      });
    });

    it("accepts valid budget allocation and scaling", () => {
      const result = schemas.budgetAllocationAndScalingSchema.safeParse(validBudgetAllocationScaling);
      expect(result.success).toBe(true);
    });

    it("rejects missing initialBudget", () => {
      const { initialBudget, ...incomplete } = validBudgetAllocationScaling;
      const result = schemas.budgetAllocationAndScalingSchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it("validates funnelAllocation.stage enum", () => {
      const invalid = {
        ...validBudgetAllocationScaling,
        funnelAllocation: [{ stage: "invalid", percentage: 100, amount: 10000, rationale: "Test" }],
      };
      const result = schemas.budgetAllocationAndScalingSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("allows extra fields via passthrough", () => {
      const withExtra = { ...validBudgetAllocationScaling, notes: "Additional notes" };
      const result = schemas.budgetAllocationAndScalingSchema.safeParse(withExtra);
      expect(result.success).toBe(true);
    });
  });

  // ===========================================================================
  // Section 11: Risks and Mitigation
  // ===========================================================================

  describe("Section 11: risksAndMitigationSchema", () => {
    const validRisk: z.infer<typeof schemas.riskSchema> = {
      id: "RISK-001",
      category: "budget",
      description: "Budget exhaustion before results",
      severity: "high",
      likelihood: "possible",
      impact: "Campaign stops prematurely",
      warningSignals: ["Spend pace > 110%", "No conversions after 5 days"],
    };

    const validMitigationStep: z.infer<typeof schemas.mitigationStepSchema> = {
      riskId: "RISK-001",
      action: "Implement daily budget caps",
      timing: "preventive",
      owner: "Media Buyer",
      resourcesNeeded: ["Platform access", "Reporting dashboard"],
      successCriteria: "Spend within 10% of daily target",
    };

    const validDependency: z.infer<typeof schemas.dependencySchema> = {
      name: "Landing Page",
      description: "Optimized landing page ready",
      type: "internal",
      status: "in_progress",
      mitigation: "Use existing page as fallback",
      impactIfNotMet: "Lower conversion rates",
    };

    const validRisksMitigation = {
      topRisks: [validRisk],
      mitigationSteps: [validMitigationStep],
      dependencies: [validDependency],
      contingencyPlans: [
        { scenario: "Budget runs out early", response: "Pause and reallocate", trigger: "80% budget spent" },
      ],
      riskMonitoring: {
        frequency: "Daily",
        metrics: ["Spend", "CPL", "ROAS"],
        escalationPath: "Media Buyer -> Account Manager -> Director",
      },
    };

    describe("riskSchema", () => {
      it.each([
        "budget",
        "creative",
        "targeting",
        "platform",
        "market",
        "technical",
        "compliance",
        "competition",
        "timing",
      ])("accepts valid category: %s", (category) => {
        const risk = { ...validRisk, category };
        const result = schemas.riskSchema.safeParse(risk);
        expect(result.success).toBe(true);
      });

      it.each(["low", "medium", "high", "critical"])("accepts valid severity: %s", (severity) => {
        const risk = { ...validRisk, severity };
        const result = schemas.riskSchema.safeParse(risk);
        expect(result.success).toBe(true);
      });

      it.each(["unlikely", "possible", "likely", "very_likely"])("accepts valid likelihood: %s", (likelihood) => {
        const risk = { ...validRisk, likelihood };
        const result = schemas.riskSchema.safeParse(risk);
        expect(result.success).toBe(true);
      });

      it("rejects invalid category", () => {
        const invalid = { ...validRisk, category: "invalid" };
        const result = schemas.riskSchema.safeParse(invalid);
        expect(result.success).toBe(false);
      });

      it("rejects invalid severity", () => {
        const invalid = { ...validRisk, severity: "extreme" };
        const result = schemas.riskSchema.safeParse(invalid);
        expect(result.success).toBe(false);
      });

      it("rejects invalid likelihood", () => {
        const invalid = { ...validRisk, likelihood: "certain" };
        const result = schemas.riskSchema.safeParse(invalid);
        expect(result.success).toBe(false);
      });
    });

    describe("mitigationStepSchema", () => {
      it.each(["preventive", "reactive", "contingent"])("accepts valid timing: %s", (timing) => {
        const step = { ...validMitigationStep, timing };
        const result = schemas.mitigationStepSchema.safeParse(step);
        expect(result.success).toBe(true);
      });

      it("rejects invalid timing", () => {
        const invalid = { ...validMitigationStep, timing: "immediate" };
        const result = schemas.mitigationStepSchema.safeParse(invalid);
        expect(result.success).toBe(false);
      });
    });

    describe("dependencySchema", () => {
      it.each(["internal", "external", "technical", "resource"])("accepts valid type: %s", (type) => {
        const dep = { ...validDependency, type };
        const result = schemas.dependencySchema.safeParse(dep);
        expect(result.success).toBe(true);
      });

      it.each(["met", "in_progress", "at_risk", "blocked"])("accepts valid status: %s", (status) => {
        const dep = { ...validDependency, status };
        const result = schemas.dependencySchema.safeParse(dep);
        expect(result.success).toBe(true);
      });

      it("rejects invalid type", () => {
        const invalid = { ...validDependency, type: "invalid" };
        const result = schemas.dependencySchema.safeParse(invalid);
        expect(result.success).toBe(false);
      });

      it("rejects invalid status", () => {
        const invalid = { ...validDependency, status: "invalid" };
        const result = schemas.dependencySchema.safeParse(invalid);
        expect(result.success).toBe(false);
      });
    });

    it("accepts valid risks and mitigation", () => {
      const result = schemas.risksAndMitigationSchema.safeParse(validRisksMitigation);
      expect(result.success).toBe(true);
    });

    it("rejects missing topRisks", () => {
      const { topRisks, ...incomplete } = validRisksMitigation;
      const result = schemas.risksAndMitigationSchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it("rejects missing riskMonitoring", () => {
      const { riskMonitoring, ...incomplete } = validRisksMitigation;
      const result = schemas.risksAndMitigationSchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it("allows extra fields via passthrough", () => {
      const withExtra = { ...validRisksMitigation, lastReviewed: "2025-01-01" };
      const result = schemas.risksAndMitigationSchema.safeParse(withExtra);
      expect(result.success).toBe(true);
    });
  });

  // ===========================================================================
  // Metadata Schema
  // ===========================================================================

  describe("mediaPlanMetadataSchema", () => {
    const validMetadata = {
      generatedAt: "2025-01-12T10:00:00Z",
      version: "1.0.0",
      processingTime: 45000,
      totalCost: 0.15,
      inputHash: "abc123",
      modelsUsed: ["gpt-4", "claude-3"],
      overallConfidence: 0.85,
      validUntil: "2025-02-12T10:00:00Z",
    };

    it("accepts valid metadata", () => {
      const result = schemas.mediaPlanMetadataSchema.safeParse(validMetadata);
      expect(result.success).toBe(true);
    });

    it("inputHash is optional", () => {
      const { inputHash, ...withoutHash } = validMetadata;
      const result = schemas.mediaPlanMetadataSchema.safeParse(withoutHash);
      expect(result.success).toBe(true);
    });

    it("validUntil is optional", () => {
      const { validUntil, ...withoutValid } = validMetadata;
      const result = schemas.mediaPlanMetadataSchema.safeParse(withoutValid);
      expect(result.success).toBe(true);
    });

    it("validates processingTime is a number", () => {
      const invalid = { ...validMetadata, processingTime: "45000" };
      const result = schemas.mediaPlanMetadataSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("validates totalCost is a number", () => {
      const invalid = { ...validMetadata, totalCost: "0.15" };
      const result = schemas.mediaPlanMetadataSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("validates modelsUsed is an array", () => {
      const invalid = { ...validMetadata, modelsUsed: "gpt-4" };
      const result = schemas.mediaPlanMetadataSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("allows extra fields via passthrough", () => {
      const withExtra = { ...validMetadata, environment: "production" };
      const result = schemas.mediaPlanMetadataSchema.safeParse(withExtra);
      expect(result.success).toBe(true);
    });
  });

  // ===========================================================================
  // Complete Media Plan Output Schema
  // ===========================================================================

  describe("mediaPlanOutputSchema", () => {
    // Build a complete valid media plan by reusing components
    const buildValidMediaPlan = () => ({
      executiveSummary: {
        strategyOverview: "Test strategy",
        timelineFocus: "Q1 2025",
        strategicPriorities: ["Priority 1"],
        expectedOutcome: "Outcome",
        positioningStatement: "Position",
      },
      campaignObjectiveSelection: {
        businessGoal: { goal: "revenue_growth", description: "Desc" },
        marketingObjective: { objective: "conversion", description: "Desc" },
        platformLogic: {
          salesCycleConsideration: "Test",
          platformImplications: "Test",
          recommendedPlatform: "meta",
          reasoning: "Test",
        },
        finalObjective: {
          statement: "Test",
          reasoning: "Test",
          successCriteria: ["Criteria"],
        },
      },
      keyInsightsFromResearch: {
        painPoints: { primary: "Pain", secondary: [], howToAddress: "Address" },
        differentiation: {
          uniqueStrengths: [],
          competitiveAdvantages: [],
          messagingOpportunities: [],
        },
        competitorAngles: { commonApproaches: [], gaps: [], opportunities: [] },
        icpClarity: {
          primaryProfile: "Profile",
          buyingBehavior: "Behavior",
          decisionMakers: [],
          influencers: [],
        },
        offerStrengths: { valueProposition: "Value", proofPoints: [], guarantees: [] },
        topInsights: [],
      },
      icpAndTargetingStrategy: {
        primaryAudience: {
          name: "Audience",
          description: "Desc",
          demographics: { location: [] },
          psychographics: { interests: [], values: [], behaviors: [], painPoints: [] },
          priority: "primary",
          estimatedSize: "1M",
        },
        secondaryAudiences: [],
        targetingMethods: [],
        audienceReachability: {
          totalAddressableAudience: "1M",
          reachableAudience: "500K",
          platformBreakdown: [],
        },
        exclusions: { audiences: [], reasons: [] },
      },
      platformAndChannelStrategy: {
        platforms: [],
        primaryPlatform: { platform: "meta", rationale: "Test" },
        platformSynergy: "Test",
        crossPlatformConsiderations: [],
        priorityOrder: ["meta"],
      },
      funnelStrategy: {
        funnelFlow: "Flow",
        stages: [],
        conversionPath: [],
        landingPageRequirements: {
          pageType: "Lead",
          requiredElements: [],
          headlineRecommendations: [],
          aboveFold: [],
          socialProofNeeded: [],
          pageSpeedTarget: "3s",
          mobileOptimization: [],
        },
        leadQualification: {
          scoringCriteria: [],
          mqlThreshold: 50,
          sqlThreshold: 80,
          qualificationQuestions: [],
          disqualifiers: [],
        },
        retargetingPaths: [],
        attributionModel: "Last-click",
      },
      creativeStrategy: {
        primaryAngles: [],
        hookPatterns: [],
        formatsNeeded: [],
        testingPlan: {
          methodology: "A/B",
          variablesToTest: [],
          timeline: "2 weeks",
          successCriteria: "20% lift",
          significanceThreshold: "95%",
          budgetAllocation: "20%",
        },
        expectedWinners: [],
        refreshCadence: "Weekly",
        brandGuidelines: { mustInclude: [], mustAvoid: [], toneOfVoice: "Professional" },
      },
      campaignStructure: {
        coldStructure: [],
        warmStructure: [],
        hotStructure: [],
        retargetingSegments: [],
        scalingStructure: {
          scalingTriggers: [],
          approach: "Horizontal",
          budgetIncrements: "20%",
          monitoringFrequency: "Daily",
          rollbackCriteria: [],
        },
        namingConventions: {
          campaignPattern: "Pattern",
          campaignExample: "Example",
          adSetPattern: "Pattern",
          adSetExample: "Example",
          adPattern: "Pattern",
          adExample: "Example",
          utmStructure: { source: "s", medium: "m", campaign: "c", content: "c" },
        },
        accountStructureOverview: "Overview",
      },
      kpisAndPerformanceModel: {
        primaryKpis: [],
        secondaryKpis: [],
        benchmarkExpectations: [],
        cacModel: {
          targetCac: 100,
          calculation: [],
          byChannel: [],
          optimizationLevers: [],
        },
        breakEvenMath: {
          breakEvenPoint: { customers: 100, revenue: 50000, timeframe: "6 months" },
          revenuePerCustomer: 500,
          contributionMargin: "40%",
          timeToBreakEven: "6 months",
          assumptions: [],
          sensitivityAnalysis: [],
        },
        metricsSchedule: { daily: [], weekly: [], monthly: [] },
        northStarMetric: { metric: "Leads", target: "500", rationale: "Revenue" },
      },
      budgetAllocationAndScaling: {
        initialBudget: {
          totalMonthly: 10000,
          daily: 333,
          currency: "USD",
          testingPhase: { duration: "2 weeks", budget: 2000, objective: "Test" },
          scalingPhase: { budget: 8000, objective: "Scale" },
        },
        platformAllocation: [],
        funnelAllocation: [],
        scalingRules: [],
        efficiencyCurves: [],
        reallocationTriggers: [],
        monthlyRoadmap: [],
      },
      risksAndMitigation: {
        topRisks: [],
        mitigationSteps: [],
        dependencies: [],
        contingencyPlans: [],
        riskMonitoring: { frequency: "Daily", metrics: [], escalationPath: "Path" },
      },
      metadata: {
        generatedAt: "2025-01-12T10:00:00Z",
        version: "1.0.0",
        processingTime: 45000,
        totalCost: 0.15,
        modelsUsed: ["gpt-4"],
        overallConfidence: 0.85,
      },
    });

    it("accepts valid complete media plan", () => {
      const result = schemas.mediaPlanOutputSchema.safeParse(buildValidMediaPlan());
      expect(result.success).toBe(true);
    });

    it("rejects missing executiveSummary section", () => {
      const { executiveSummary, ...incomplete } = buildValidMediaPlan();
      const result = schemas.mediaPlanOutputSchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it("rejects missing campaignObjectiveSelection section", () => {
      const { campaignObjectiveSelection, ...incomplete } = buildValidMediaPlan();
      const result = schemas.mediaPlanOutputSchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it("rejects missing keyInsightsFromResearch section", () => {
      const { keyInsightsFromResearch, ...incomplete } = buildValidMediaPlan();
      const result = schemas.mediaPlanOutputSchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it("rejects missing icpAndTargetingStrategy section", () => {
      const { icpAndTargetingStrategy, ...incomplete } = buildValidMediaPlan();
      const result = schemas.mediaPlanOutputSchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it("rejects missing platformAndChannelStrategy section", () => {
      const { platformAndChannelStrategy, ...incomplete } = buildValidMediaPlan();
      const result = schemas.mediaPlanOutputSchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it("rejects missing funnelStrategy section", () => {
      const { funnelStrategy, ...incomplete } = buildValidMediaPlan();
      const result = schemas.mediaPlanOutputSchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it("rejects missing creativeStrategy section", () => {
      const { creativeStrategy, ...incomplete } = buildValidMediaPlan();
      const result = schemas.mediaPlanOutputSchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it("rejects missing campaignStructure section", () => {
      const { campaignStructure, ...incomplete } = buildValidMediaPlan();
      const result = schemas.mediaPlanOutputSchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it("rejects missing kpisAndPerformanceModel section", () => {
      const { kpisAndPerformanceModel, ...incomplete } = buildValidMediaPlan();
      const result = schemas.mediaPlanOutputSchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it("rejects missing budgetAllocationAndScaling section", () => {
      const { budgetAllocationAndScaling, ...incomplete } = buildValidMediaPlan();
      const result = schemas.mediaPlanOutputSchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it("rejects missing risksAndMitigation section", () => {
      const { risksAndMitigation, ...incomplete } = buildValidMediaPlan();
      const result = schemas.mediaPlanOutputSchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it("rejects missing metadata section", () => {
      const { metadata, ...incomplete } = buildValidMediaPlan();
      const result = schemas.mediaPlanOutputSchema.safeParse(incomplete);
      expect(result.success).toBe(false);
    });

    it("rejects invalid nested enum in section", () => {
      const plan = buildValidMediaPlan();
      plan.campaignObjectiveSelection.businessGoal.goal = "invalid" as typeof plan.campaignObjectiveSelection.businessGoal.goal;
      const result = schemas.mediaPlanOutputSchema.safeParse(plan);
      expect(result.success).toBe(false);
    });

    it("allows extra fields via passthrough", () => {
      const withExtra = { ...buildValidMediaPlan(), customSection: { data: "test" } };
      const result = schemas.mediaPlanOutputSchema.safeParse(withExtra);
      expect(result.success).toBe(true);
    });
  });

  // ===========================================================================
  // MEDIA_PLAN_SECTION_SCHEMAS Constant
  // ===========================================================================

  describe("MEDIA_PLAN_SECTION_SCHEMAS", () => {
    it("contains all 11 section schemas", () => {
      const expectedKeys = [
        "executiveSummary",
        "campaignObjectiveSelection",
        "keyInsightsFromResearch",
        "icpAndTargetingStrategy",
        "platformAndChannelStrategy",
        "funnelStrategy",
        "creativeStrategy",
        "campaignStructure",
        "kpisAndPerformanceModel",
        "budgetAllocationAndScaling",
        "risksAndMitigation",
      ];

      expect(Object.keys(schemas.MEDIA_PLAN_SECTION_SCHEMAS)).toEqual(expectedKeys);
    });

    it("each key maps to the correct schema", () => {
      expect(schemas.MEDIA_PLAN_SECTION_SCHEMAS.executiveSummary).toBe(schemas.executiveSummarySchema);
      expect(schemas.MEDIA_PLAN_SECTION_SCHEMAS.campaignObjectiveSelection).toBe(schemas.campaignObjectiveSelectionSchema);
      expect(schemas.MEDIA_PLAN_SECTION_SCHEMAS.keyInsightsFromResearch).toBe(schemas.keyInsightsFromResearchSchema);
      expect(schemas.MEDIA_PLAN_SECTION_SCHEMAS.icpAndTargetingStrategy).toBe(schemas.icpAndTargetingStrategySchema);
      expect(schemas.MEDIA_PLAN_SECTION_SCHEMAS.platformAndChannelStrategy).toBe(schemas.platformAndChannelStrategySchema);
      expect(schemas.MEDIA_PLAN_SECTION_SCHEMAS.funnelStrategy).toBe(schemas.funnelStrategySchema);
      expect(schemas.MEDIA_PLAN_SECTION_SCHEMAS.creativeStrategy).toBe(schemas.creativeStrategySchema);
      expect(schemas.MEDIA_PLAN_SECTION_SCHEMAS.campaignStructure).toBe(schemas.campaignStructureSchema);
      expect(schemas.MEDIA_PLAN_SECTION_SCHEMAS.kpisAndPerformanceModel).toBe(schemas.kpisAndPerformanceModelSchema);
      expect(schemas.MEDIA_PLAN_SECTION_SCHEMAS.budgetAllocationAndScaling).toBe(schemas.budgetAllocationAndScalingSchema);
      expect(schemas.MEDIA_PLAN_SECTION_SCHEMAS.risksAndMitigation).toBe(schemas.risksAndMitigationSchema);
    });

    it("all schemas in MEDIA_PLAN_SECTION_SCHEMAS are Zod schemas", () => {
      Object.values(schemas.MEDIA_PLAN_SECTION_SCHEMAS).forEach((schema) => {
        expect(typeof schema.safeParse).toBe("function");
      });
    });
  });

  // ===========================================================================
  // mediaPlanProgressSchema
  // ===========================================================================

  describe("mediaPlanProgressSchema", () => {
    const validProgress = {
      currentSection: "executiveSummary",
      completedSections: ["metadata"],
      partialOutput: { executiveSummary: { strategyOverview: "In progress..." } },
      progressPercentage: 15,
      progressMessage: "Generating executive summary...",
    };

    it("accepts valid progress", () => {
      const result = schemas.mediaPlanProgressSchema.safeParse(validProgress);
      expect(result.success).toBe(true);
    });

    it("allows currentSection to be null", () => {
      const withNull = { ...validProgress, currentSection: null };
      const result = schemas.mediaPlanProgressSchema.safeParse(withNull);
      expect(result.success).toBe(true);
    });

    it("error is optional", () => {
      const result = schemas.mediaPlanProgressSchema.safeParse(validProgress);
      expect(result.success).toBe(true);
    });

    it("accepts progress with error", () => {
      const withError = { ...validProgress, error: "API timeout" };
      const result = schemas.mediaPlanProgressSchema.safeParse(withError);
      expect(result.success).toBe(true);
    });

    it("validates progressPercentage is a number", () => {
      const invalid = { ...validProgress, progressPercentage: "15%" };
      const result = schemas.mediaPlanProgressSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("validates completedSections is an array", () => {
      const invalid = { ...validProgress, completedSections: "metadata" };
      const result = schemas.mediaPlanProgressSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("allows extra fields via passthrough", () => {
      const withExtra = { ...validProgress, startedAt: "2025-01-12T10:00:00Z" };
      const result = schemas.mediaPlanProgressSchema.safeParse(withExtra);
      expect(result.success).toBe(true);
    });
  });
});
