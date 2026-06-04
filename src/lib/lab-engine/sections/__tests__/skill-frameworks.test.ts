import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

interface SkillFrameworkSpec {
  readonly slug: string;
  readonly anchorTerms: readonly string[];
  readonly schemaPaths: readonly string[];
}

const antiInventionPhrases = [
  "instead of inventing",
  "do not turn analyst opinion",
  "not as fabricated cards",
] as const;

const frameworkSpecs: readonly SkillFrameworkSpec[] = [
  {
    slug: "positioning-market-category",
    anchorTerms: [
      "April Dunford",
      "competitive alternatives",
      "differentiated category frame",
      "adjacent confusion",
      "compete-vs-create",
      "white-space opening",
      "derivation order",
      "keyword-demand-reachable-revenue",
      "commercial-intent-share",
      "categoryDefinition",
      "marketSize",
      "structuralForces",
      "categoryMaturity",
    ],
    schemaPaths: [
      "body.categoryDefinition.prose",
      "body.marketSize.signals",
      "body.marketSize.bottomUpTam",
      "body.categoryDefinition.adjacentCategories",
      "body.structuralForces.prose",
      "body.categoryMaturity.prose",
      "body.marketSize.prose",
    ],
  },
  {
    slug: "positioning-buyer-icp",
    anchorTerms: [
      "five-layer ICP",
      "firmographic",
      "technographic",
      "psychographic",
      "trigger events",
      "dominant awareness level",
      "disqualifier",
      "firmographic cuts",
      "personas",
      "awareness levels",
      "triggers",
      "venues",
    ],
    schemaPaths: [
      "body.icpExistenceCheck.prose",
      "body.icpExistenceCheck.firmographicCuts",
      "body.buyingContext.triggers",
      "body.personaReality.personas",
      "body.buyingContext.prose",
      "body.awarenessDistribution.levels",
      "body.awarenessDistribution.prose",
      "body.clusters.prose",
      "body.clusters.venues",
    ],
  },
  {
    slug: "positioning-competitor-landscape",
    anchorTerms: [
      "April Dunford",
      "Competitive alternatives",
      "2x2 perceptual map",
      "Know/Say/Show",
      "status-quo",
      "DIY",
      "axis of competition",
      "we lose when",
      "exploitable weakness",
      "proof gap",
      "narrative arc",
      "competitors",
      "axes",
      "pricing reality",
      "weaknesses",
      "ad presence",
      "narrative arcs",
    ],
    schemaPaths: [
      "body.competitorSet.competitors",
      "body.competitorSet.prose",
      "body.positioningTaxonomy.axes",
      "body.pricingReality.dataPoints",
      "body.publicWeaknesses.items",
      "body.narrativeArcs.arcs",
      "body.adPresence.signals",
    ],
  },
  {
    slug: "positioning-voice-of-customer",
    anchorTerms: [
      "JTBD Four Forces",
      "Push",
      "Pull",
      "Anxiety",
      "Habit",
      "desired-outcome",
      "pain themes",
      "trigger language",
      "objections",
      "decision criteria",
      "success language",
    ],
    schemaPaths: [
      "body.painLanguage.prose",
      "body.painLanguage.quotes",
      "body.switchingStories.stories.reasonToLeave",
      "body.switchingStories.prose",
      "body.objections.items",
      "body.decisionCriteria.criteria",
      "body.successLanguage.quotes",
    ],
  },
  {
    slug: "positioning-demand-intent",
    anchorTerms: [
      "two-axis demand taxonomy",
      "funnel depth",
      "demand type",
      "competitor-alternative",
      "capture-vs-creation",
      "measured-vs-estimated",
      "keyword demand",
      "question mining",
      "content gaps",
      "intent signals",
      "venue map",
    ],
    schemaPaths: [
      "body.keywordDemand.keywords",
      "body.questionMining.questions",
      "body.contentGaps.gaps",
      "body.intentSignals.items",
      "body.keywordDemand.prose",
      "body.contentGaps.prose",
      "body.venueMap.venues",
    ],
  },
  {
    slug: "positioning-offer-diagnostic",
    anchorTerms: [
      "Command-of-the-Message",
      "negative consequence",
      "positive business outcome",
      "Required capabilities",
      "Defensible / Comparative / Assumed",
      "proof gap",
      "offerMarketFit",
      "funnelDiagnosis",
      "channelTruth",
      "retentionHealth",
      "redFlags",
    ],
    schemaPaths: [
      "body.offerMarketFit.proofPoints",
      "body.funnelDiagnosis.breaks",
      "body.retentionHealth.signals",
      "body.offerMarketFit.prose",
      "body.funnelDiagnosis.prose",
      "body.redFlags.items",
      "body.channelTruth.channels",
    ],
  },
];

function readSkillMarkdown(slug: string): string {
  return readFileSync(
    join(process.cwd(), "src/lib/lab-engine/skills", slug, "SKILL.md"),
    "utf8",
  );
}

function getFrameworkBlocks(markdown: string): string[] {
  const headingPattern = /^## GTM Framework Lens$/gm;
  const matches = Array.from(markdown.matchAll(headingPattern));

  return matches.map((match): string => {
    const startIndex = match.index ?? 0;
    const nextHeadingIndex = markdown
      .slice(startIndex + match[0].length)
      .search(/\n## /);

    if (nextHeadingIndex === -1) {
      return markdown.slice(startIndex);
    }

    return markdown.slice(
      startIndex,
      startIndex + match[0].length + nextHeadingIndex,
    );
  });
}

describe("positioning skill GTM framework lenses", (): void => {
  it("keeps one framework lens block with expected anchors in each Tier-1 positioning skill", (): void => {
    for (const spec of frameworkSpecs) {
      const frameworkBlocks = getFrameworkBlocks(readSkillMarkdown(spec.slug));

      expect(frameworkBlocks, spec.slug).toHaveLength(1);

      const frameworkBlock = frameworkBlocks[0];
      for (const anchorTerm of spec.anchorTerms) {
        expect(frameworkBlock, `${spec.slug}: ${anchorTerm}`).toContain(
          anchorTerm,
        );
      }

      for (const schemaPath of spec.schemaPaths) {
        expect(frameworkBlock, `${spec.slug}: ${schemaPath}`).toContain(
          schemaPath,
        );
      }

      expect(frameworkBlock, `${spec.slug}: evidence gap`).toContain(
        "evidence gap",
      );
      expect(
        antiInventionPhrases.some((phrase): boolean =>
          frameworkBlock.includes(phrase),
        ),
        `${spec.slug}: anti-invention instruction`,
      ).toBe(true);
    }
  });
});
