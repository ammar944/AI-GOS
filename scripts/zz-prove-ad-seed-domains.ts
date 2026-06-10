import path from "node:path";

import { config as loadEnv } from "dotenv";

import { getRegistrableDomain } from "@/lib/lab-engine/domain-utils";
import type { ResearchInput } from "@/lib/lab-engine/artifacts/artifact-envelope";
import type { CorpusToResearchInputParams } from "@/lib/research-v2/corpus-to-research-input";

const repoRoot = process.cwd();

loadEnv({ path: path.join(repoRoot, ".env.local"), override: false });

type ResolvedBy = "name-shape" | "corpus" | "search" | "none";

interface ProofRow {
  advertiser: string;
  domain?: string;
  resolvedBy: ResolvedBy;
}

function buildFixture(): CorpusToResearchInputParams {
  return {
    runId: "zz-prove-ad-seed-domains-0f0ee220-fixture",
    deepResearchProgramData: {
      corpus: {
        researchSummary:
          "Airtable competes with collaboration and work-management platforms in the GTM brief.",
        sources: [
          {
            title: "Airtable homepage",
            url: "https://www.airtable.com/",
          },
          {
            title: "Notion official site",
            url: "https://www.notion.so/product",
          },
          {
            title: "ClickUp official site",
            url: "https://clickup.com/features",
          },
        ],
        evidence: [
          {
            claim: "Notion and ClickUp appear in the competitor corpus.",
            quote:
              "Competitor references include https://www.notion.so/product and https://clickup.com/features.",
            source: "Competitor corpus snippet",
            url: "https://www.notion.so/product",
          },
        ],
      },
      onboardingFields: {
        companyName: { value: "Airtable" },
        industryVertical: { value: "Collaborative work management" },
        productDescription: {
          value:
            "Airtable helps teams build workflow apps and collaborate on operational data.",
        },
        primaryIcpDescription: {
          value:
            "Operations and GTM teams that need configurable workflow software.",
        },
        coreDeliverables: {
          value: ["Workflow apps", "Collaboration database"],
        },
        topCompetitors: {
          value: "Notion, monday.com, ClickUp, Smartsheet, Coda",
        },
      },
    },
    onboardingData: {
      websiteUrl: "https://www.airtable.com/",
      primaryGoal: "Probe competitor ad identity resolution.",
      distributionChannels: ["paid search", "paid social"],
      constraints: ["Use only trusted competitor domains."],
    },
    now: () => new Date("2026-06-10T12:00:00.000Z"),
  };
}

function layerOneResolvedBy({
  domain,
  seedName,
}: {
  domain: string | undefined;
  seedName: string;
}): ResolvedBy {
  if (domain === undefined) {
    return "none";
  }

  return getRegistrableDomain(seedName) === domain ? "name-shape" : "corpus";
}

function buildProofRows({
  afterFallback,
  researchInput,
}: {
  afterFallback: readonly { advertiser: string; domain?: string }[];
  researchInput: ResearchInput;
}): ProofRow[] {
  const seedsByName = new Map(
    (researchInput.competitorSeeds ?? []).map((seed) => [
      seed.name.toLowerCase(),
      seed,
    ]),
  );

  return afterFallback.map((advertiserRecord) => {
    const seed = seedsByName.get(advertiserRecord.advertiser.toLowerCase());
    const layerOneDomain = seed?.domain;
    const resolvedBy =
      advertiserRecord.domain === undefined
        ? "none"
        : advertiserRecord.domain === layerOneDomain
          ? layerOneResolvedBy({
              domain: layerOneDomain,
              seedName: seed?.name ?? advertiserRecord.advertiser,
            })
          : "search";

    return {
      advertiser: advertiserRecord.advertiser,
      ...(advertiserRecord.domain === undefined
        ? {}
        : { domain: advertiserRecord.domain }),
      resolvedBy,
    };
  });
}

async function main(): Promise<void> {
  const { corpusToResearchInput } = await import(
    "@/lib/research-v2/corpus-to-research-input"
  );
  const { getCompetitorAdProbeAdvertisers } = await import(
    "@/lib/lab-engine/agents/run-section"
  );

  const researchInput = corpusToResearchInput(buildFixture());
  const advertisers = await getCompetitorAdProbeAdvertisers(researchInput);
  const rows = buildProofRows({ afterFallback: advertisers, researchInput });

  for (const row of rows) {
    console.log(JSON.stringify(row));
  }

  if (rows.every((row) => row.resolvedBy === "none")) {
    console.error("FAIL: every advertiser is domainless");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
