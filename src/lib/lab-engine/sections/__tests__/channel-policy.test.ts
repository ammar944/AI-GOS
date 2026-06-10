import { describe, expect, it } from "vitest";

import type { OnboardingSnapshot } from "../../artifacts/artifact-envelope";
import {
  buildChannelPolicyPromptLines,
  checkPaidMediaChannelPolicy,
  deriveChannelPolicy,
  parseAcvBand,
  parseMonthlyBudgetUsd,
} from "../channel-policy";

function onboarding(
  economics?: NonNullable<OnboardingSnapshot["economics"]>,
): OnboardingSnapshot {
  return {
    primaryGoal: "Grow qualified demos",
    targetSegments: ["performance marketers"],
    keyOffers: ["ad fraud detection"],
    distributionChannels: ["Paid social"],
    constraints: [],
    notes: "test brief",
    ...(economics === undefined ? {} : { economics }),
  };
}

describe("parseAcvBand", () => {
  it("maps the onboarding enum tokens to SOP bands", () => {
    expect(parseAcvBand("lt_1k").band).toBe("low");
    expect(parseAcvBand("1k_10k").band).toBe("mid");
    expect(parseAcvBand("10k_50k").band).toBe("high");
    expect(parseAcvBand("gt_50k").band).toBe("high");
  });

  it("maps the canonical radio labels to the same bands as their enums", () => {
    expect(parseAcvBand("<$1K").band).toBe("low");
    expect(parseAcvBand("$1K–$10K").band).toBe("mid");
    expect(parseAcvBand("$10K–$50K").band).toBe("high");
    expect(parseAcvBand("$50K+").band).toBe("high");
  });

  it("bands bare amounts by the SOP thresholds", () => {
    expect(parseAcvBand("$2,000").band).toBe("low");
    expect(parseAcvBand("$4k annual").band).toBe("mid");
    expect(parseAcvBand("$24,000").band).toBe("high");
  });

  it("returns unknown for missing or unparseable signals", () => {
    expect(parseAcvBand(undefined).band).toBe("unknown");
    expect(parseAcvBand("varies by deal").band).toBe("unknown");
  });
});

describe("parseMonthlyBudgetUsd", () => {
  it("parses common brief budget strings", () => {
    expect(parseMonthlyBudgetUsd("$3,000 / month")).toBe(3000);
    expect(parseMonthlyBudgetUsd("$3k")).toBe(3000);
    expect(parseMonthlyBudgetUsd("10000")).toBe(10000);
    expect(parseMonthlyBudgetUsd(undefined)).toBeNull();
  });
});

describe("deriveChannelPolicy", () => {
  it("forbids Meta for high-ACV briefs (the Anura branch)", () => {
    const policy = deriveChannelPolicy(
      onboarding({ acv: "10k_50k", monthlyAdBudget: "$3,000 / month" }),
    );
    expect(policy.constrained).toBe(true);
    expect(policy.acvBand).toBe("high");
    expect(policy.allowedPlatforms).toEqual(["linkedin", "google"]);
    expect(policy.forbiddenPlatforms.map((f) => f.platform)).toEqual(["meta"]);
    // $3k/mo is under both LinkedIn ($5k) and Google ($5k) minimums.
    expect(policy.budgetConflicts).toHaveLength(2);
    expect(policy.budgetConflicts[0]).toContain("platform minimum");
  });

  it("allows Meta + Google for low-ACV briefs with no conflicts at $3k", () => {
    const policy = deriveChannelPolicy(
      onboarding({ acv: "lt_1k", monthlyAdBudget: "$3,000" }),
    );
    expect(policy.allowedPlatforms).toEqual(["meta", "google"]);
    expect(policy.forbiddenPlatforms.map((f) => f.platform)).toEqual([
      "linkedin",
    ]);
    // Meta minimum is exactly $3k -> no Meta conflict; Google $5k -> conflict.
    expect(policy.budgetConflicts).toHaveLength(1);
    expect(policy.budgetConflicts[0]).toContain("Google");
  });

  it("is advisory (unconstrained) when ACV is unknown", () => {
    const policy = deriveChannelPolicy(onboarding());
    expect(policy.constrained).toBe(false);
    expect(policy.forbiddenPlatforms).toHaveLength(0);
  });
});

describe("checkPaidMediaChannelPolicy", () => {
  const highAcvPolicy = deriveChannelPolicy(
    onboarding({ acv: "gt_50k", monthlyAdBudget: "$3,000 / month" }),
  );

  it("rejects the Anura-shaped Meta plan on a high-ACV policy", () => {
    const errors = checkPaidMediaChannelPolicy({
      body: {
        campaignOverview: {
          platform: "Meta Advertising",
          prose: "Meta Advertising · Phase 1 & 2. Monthly budget $3,000.",
        },
        audienceTypes: [
          { archetype: "Broad Prospecting — Interest Stack", detail: "Layered interest targeting." },
          { archetype: "High Intent — ABM ICP List + 1% Lookalike", detail: "Meta 1% Lookalike seeded from uploaded list." },
          { archetype: "AI Optimized — Advantage+", detail: "Meta Advantage+ with minimal constraints." },
        ],
      },
      policy: highAcvPolicy,
    });

    expect(errors.some((e) => e.includes("campaignOverview.platform"))).toBe(
      true,
    );
    expect(
      errors.filter((e) => e.includes("body.audienceTypes[")).length,
    ).toBeGreaterThanOrEqual(2);
    // Budget conflicts unsurfaced in prose -> flagged.
    expect(
      errors.some((e) => e.includes('the prose does not surface it')),
    ).toBe(true);
  });

  it("passes a LinkedIn + Google plan that surfaces the budget conflict", () => {
    const errors = checkPaidMediaChannelPolicy({
      body: {
        campaignOverview: {
          platform: "LinkedIn + Google Ads",
          prose:
            "LinkedIn + Google staged entry: the $3,000/mo brief budget is below the SOP platform minimum for both channels, so Phase 1 runs Google search capture only with a raise recommendation.",
        },
        audienceTypes: [
          { archetype: "Firmographic Stack", detail: "LinkedIn industry/size/seniority targeting." },
          { archetype: "ABM Company List + Predictive Audiences", detail: "Uploaded TAG member company list on LinkedIn." },
          { archetype: "Search Capture", detail: "Google solution-aware search themes + competitor brand terms." },
        ],
      },
      policy: highAcvPolicy,
    });

    expect(errors).toEqual([]);
  });

  it("requires the platform field to name an allowed platform", () => {
    const errors = checkPaidMediaChannelPolicy({
      body: {
        campaignOverview: { platform: "Paid Media", prose: "platform minimum surfaced." },
        audienceTypes: [],
      },
      policy: highAcvPolicy,
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("does not name an SOP-allowed platform");
  });

  it("returns no errors when the policy is unconstrained", () => {
    const errors = checkPaidMediaChannelPolicy({
      body: {
        campaignOverview: { platform: "Meta Advertising", prose: "x" },
        audienceTypes: [
          { archetype: "AI Optimized — Advantage+", detail: "Meta Advantage+." },
        ],
      },
      policy: deriveChannelPolicy(onboarding()),
    });
    expect(errors).toEqual([]);
  });
});

describe("buildChannelPolicyPromptLines", () => {
  const input = { onboarding: onboarding({ acv: "10k_50k", monthlyAdBudget: "$3,000 / month" }) };

  it("returns [] for non-paid-media sections", () => {
    expect(
      buildChannelPolicyPromptLines(
        { sectionOutputSchemaName: "BuyerICPSectionOutput" },
        input,
      ),
    ).toEqual([]);
  });

  it("emits a binding block with forbidden platforms and conflicts for paid media", () => {
    const lines = buildChannelPolicyPromptLines(
      { sectionOutputSchemaName: "PaidMediaPlanSectionOutput" },
      input,
    );
    const text = lines.join("\n");
    expect(text).toContain("BINDING");
    expect(text).toContain("LinkedIn + Google");
    expect(text).toContain("FORBIDDEN: Meta");
    expect(text).toContain("BUDGET CONFLICT");
    expect(text).toContain('"platform minimum"');
  });

  it("emits an advisory block when the ACV signal is missing", () => {
    const lines = buildChannelPolicyPromptLines(
      { sectionOutputSchemaName: "PaidMediaPlanSectionOutput" },
      { onboarding: onboarding() },
    );
    const text = lines.join("\n");
    expect(text).not.toContain("BINDING");
    expect(text).toContain("Do not default to Meta out of template habit");
  });
});
