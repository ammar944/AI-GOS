import { describe, expect, it, vi } from "vitest";

import {
  projectMarkdownToTypedBody,
  type ProjectGenerateFn,
} from "../agentic-glm-projector";

// A minimal-but-valid VoC body the injected generate fn returns. Mirrors the
// real markdown's high-value blocks (adAngles + outcomeProof) so completeness[]
// reports them populated. NO live GLM is used.
const VALID_VOC_BODY = {
  strategicInsight: {
    strategicVerdict:
      "Legacy help desks were built for B2C email queues; the wedge is API-first, channel-native support for technical B2B teams.",
    keyTension: {
      tension:
        "Buyers are locked into Zendesk/Intercom yet pay escalating add-on pricing.",
      side: "Bet on the switchers feeling the per-resolution AI pricing pinch.",
      costOfPosition:
        "Conceding the install-base inertia that keeps incumbents sticky.",
    },
  },
  fourForcesBalanceVerdict: {
    push: "Add-on pricing spirals and dated interfaces push buyers to look.",
    pull: "API depth and native Slack/Teams support pull technical teams in.",
    anxiety: "Switching cost and migration risk create hesitation.",
    habit: "Years of wiring around the incumbent inbox keep teams in place.",
    balanceVerdict: "Push + pull beat anxiety + habit at renewal moments.",
  },
  painLanguage: {
    prose: "The loudest pains are pricing add-ons and bolted-on Slack support.",
    quotes: [
      {
        verbatimText:
          "I dislike that everything is an add-on. You have to purchase everything individually and it can get quite pricy.",
        source: "g2",
        sourceUrl:
          "g2.com/survey_responses/zendesk-for-customer-service-review-4530447",
        painTheme: "pricing add-ons",
        painIntensity: "high",
      },
      {
        verbatimText:
          "Intercom does B2C very well. They don't do B2B as well is what I'm discovering.",
        source: "other",
        sourceUrl: "plain.com/blog/intercom-alternatives-b2b-saas-2026",
        painTheme: "b2b mismatch",
        painIntensity: "high",
      },
    ],
  },
  objections: {
    prose: "Prospects worry switching is too painful and Plain too immature.",
    items: [
      {
        objectionText:
          "We're already invested in Zendesk/Intercom — switching is too painful.",
        category: "switching-cost",
        frequency: "recurring",
        howToHandle: "Counter with 1-3 day implementation and migration support.",
        sourceUrl: "reddit.com/r/SaaS",
      },
    ],
  },
  switchingStories: {
    prose: "Teams left when pricing tipped or Slack integrations broke.",
    stories: [
      {
        priorSolution: "Zendesk",
        reasonToLeave:
          "Six API calls just to edit one Slack message; dated interface.",
        decisionPath: "Evaluated Plain during a pilot and switched.",
        sourceUrl: "plain.com/customers/sanity",
      },
    ],
  },
  decisionCriteria: {
    prose: "Buyers weigh API flexibility and native Slack support.",
    criteria: [
      {
        criterion: "API depth for custom AI agents",
        statedBy: "champion",
        evidenceQuote: "the API is incredibly powerful, and the people.",
        sourceUrl: "plain.com/customers/n8n",
      },
    ],
  },
  successLanguage: {
    prose: "Winners describe night-and-day satisfaction gains.",
    quotes: [
      {
        verbatimText:
          "It was night and day. Support engineers were visibly happier using Plain even in the pilot phase.",
        source: "other",
        sourceUrl: "plain.com/customers/sanity",
        afterStatePattern: "team satisfaction jump",
      },
    ],
  },
  adAngles: [
    {
      angle: "The Intercom pricing trap",
      targeting: "Intercom customers feeling the per-resolution pinch",
      hook: "Plain includes AI in base pricing — $39/seat, no per-resolution fees.",
      sourcePainTheme: "pricing add-ons",
      sourceUrl: "uk.trustpilot.com/review/intercom.io?page=4",
    },
    {
      angle: "Your customers are in Slack. Your support tool isn't.",
      targeting: "Zendesk/Intercom teams losing Slack threads",
      hook: "Plain makes Slack-native support native. No add-ons, no broken threads.",
      sourcePainTheme: "bolted-on Slack",
    },
  ],
  outcomeProof: [
    {
      company: "Sanity",
      metric: "120% increase in team satisfaction",
      beforeAfter: "after switching from Zendesk",
      sourceUrl: "plain.com/customers/sanity",
    },
    {
      company: "n8n",
      metric: "60% of tickets handled by AI",
      beforeAfter: "20x volume increase supported",
      sourceUrl: "plain.com/customers/n8n",
    },
  ],
};

const VOC_MARKDOWN_WITH_BLOCKS = [
  "# Voice of the Customer",
  "## Ad Angles to Test",
  "### Angle 1: The Intercom pricing trap",
  "**Named customer outcomes:**",
  "- Sanity: 120% increase in team satisfaction",
].join("\n");

describe("projectMarkdownToTypedBody", () => {
  it("validates an injected valid VoC body and reports high-value blocks populated", async () => {
    const generate: ProjectGenerateFn = vi
      .fn()
      .mockResolvedValue(JSON.stringify(VALID_VOC_BODY));

    const result = await projectMarkdownToTypedBody({
      sectionId: "positioningVoiceOfCustomer",
      markdown: VOC_MARKDOWN_WITH_BLOCKS,
      transcript: [],
      generate,
    });

    expect(result.validates).toBe(true);
    expect(result.zodError).toBeUndefined();
    // generate is called exactly once when round-1 validates.
    expect(generate).toHaveBeenCalledTimes(1);

    const adAngles = result.completeness.find((c) => c.block === "adAngles");
    expect(adAngles).toBeDefined();
    expect(adAngles?.sourceHadIt).toBe(true);
    expect(adAngles?.typedCount).toBe(2);

    const outcomeProof = result.completeness.find(
      (c) => c.block === "outcomeProof",
    );
    expect(outcomeProof?.sourceHadIt).toBe(true);
    expect(outcomeProof?.typedCount).toBe(2);
  });

  it("strips a ```json code fence before parsing", async () => {
    const fenced = "```json\n" + JSON.stringify(VALID_VOC_BODY) + "\n```";
    const generate: ProjectGenerateFn = vi.fn().mockResolvedValue(fenced);

    const result = await projectMarkdownToTypedBody({
      sectionId: "positioningVoiceOfCustomer",
      markdown: VOC_MARKDOWN_WITH_BLOCKS,
      transcript: [],
      generate,
    });

    expect(result.validates).toBe(true);
  });

  it("attempts ONE repair round on a Zod failure and reports zodError if still failing", async () => {
    // Round 1: missing required painLanguage -> invalid. Round 2: still invalid.
    const broken = { strategicInsight: VALID_VOC_BODY.strategicInsight };
    const generate: ProjectGenerateFn = vi
      .fn()
      .mockResolvedValueOnce(JSON.stringify(broken))
      .mockResolvedValueOnce(JSON.stringify(broken));

    const result = await projectMarkdownToTypedBody({
      sectionId: "positioningVoiceOfCustomer",
      markdown: VOC_MARKDOWN_WITH_BLOCKS,
      transcript: [],
      generate,
    });

    expect(result.validates).toBe(false);
    expect(result.zodError).toBeDefined();
    // round 1 + one repair round = two calls.
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("recovers when round-1 is invalid but the repair round fixes it", async () => {
    const broken = { strategicInsight: VALID_VOC_BODY.strategicInsight };
    const generate: ProjectGenerateFn = vi
      .fn()
      .mockResolvedValueOnce(JSON.stringify(broken))
      .mockResolvedValueOnce(JSON.stringify(VALID_VOC_BODY));

    const result = await projectMarkdownToTypedBody({
      sectionId: "positioningVoiceOfCustomer",
      markdown: VOC_MARKDOWN_WITH_BLOCKS,
      transcript: [],
      generate,
    });

    expect(result.validates).toBe(true);
    expect(generate).toHaveBeenCalledTimes(2);
  });
});
