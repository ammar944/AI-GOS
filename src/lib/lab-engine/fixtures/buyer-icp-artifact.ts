import { artifactEnvelopeSchema } from "../artifacts/artifact-envelope";
import {
  buyerICPBodySchema,
  buyerICPSectionOutputSchema,
  validateBuyerICPMinimums,
  type BuyerICPArtifact,
  type BuyerICPSectionOutput,
} from "../artifacts/schemas/buyer-icp";

const observedAt = "2026-05-20T16:10:00.000Z";
const sourceTuples = [
  ["source_buyer_1", "Founder Community Signal", "https://example.com/buyer/community"],
  ["source_buyer_2", "Operator Newsletter Signal", "https://example.com/buyer/newsletter"],
  ["source_buyer_3", "ICP Persona Signal", "https://example.com/buyer/persona"],
  ["source_buyer_4", "Trigger Signal", "https://example.com/buyer/trigger"],
  ["source_buyer_5", "Awareness Signal", "https://example.com/buyer/awareness"],
] as const;

const awarenessLevels = [
  "unaware",
  "problem-aware",
  "solution-aware",
  "product-aware",
  "most-aware",
] as const;

export const buyerICPFixtureArtifact = artifactEnvelopeSchema
  .extend({ body: buyerICPBodySchema })
  .parse({
    id: "art_fixture_buyer_icp_saaslaunch",
    runId: "run_saaslaunch_fixture",
    sectionId: "positioningBuyerICP",
    sectionTitle: "Buyer & ICP Validation",
    verdict: "The strongest ICP is founder-led B2B SaaS teams with visible sales-operation strain.",
    statusSummary:
      "The fixture points to reachable companies, named operator personas, and observable buying triggers. Communities and newsletters provide enough surface area for early paid-media research and founder-led distribution.",
    confidence: 0.6,
    sources: sourceTuples.map(([id, title, url]) => ({
      id,
      title,
      url,
      publisher: "AI-GOS AI SDK Lab Fixture",
      observedAt,
    })),
    body: {
      icpExistenceCheck: {
        prose:
          "The ICP exists as a reachable account pool: early B2B SaaS teams with founder-led sales, small revenue teams, and CRM/process debt.",
        firmographicCuts: [
          {
            cutType: "industry",
            value: "B2B SaaS",
            accountCount: "not disclosed",
            source: "Founder Community Signal",
            sourceUrl: "https://example.com/buyer/community",
            dateObserved: "2026-05-20",
          },
          {
            cutType: "employeeBands",
            value: "5-50 employees",
            accountCount: "not disclosed",
            source: "ICP Persona Signal",
            sourceUrl: "https://example.com/buyer/persona",
            dateObserved: "2026-05-20",
          },
          {
            cutType: "techStack",
            value: "CRM plus outbound tooling",
            accountCount: "not disclosed",
            source: "Trigger Signal",
            sourceUrl: "https://example.com/buyer/trigger",
            dateObserved: "2026-05-20",
          },
        ],
      },
      personaReality: {
        prose:
          "Named founder and revenue-operator personas are plausible buying-circle members for this wedge.",
        personas: [
          "Ava Chen",
          "Maya Singh",
          "Leo Grant",
          "Nora Patel",
          "Omar Reed",
        ].map((name, index) => ({
          name,
          title:
            index === 0
              ? "Founder"
              : index === 1
                ? "Head of Revenue"
                : "Revenue Operator",
          company: `Fixture SaaS ${index + 1}`,
          sourceUrl: `https://example.com/buyer/persona-${index + 1}`,
          role:
            index === 0
              ? "economic-buyer"
              : index === 1
                ? "champion"
                : index === 2
                  ? "decision-maker"
                  : index === 3
                    ? "influencer"
                    : "end-user",
          seniority: index < 2 ? "Executive" : "Manager",
          teamSize: "small revenue team",
          evidence: "Public profile and fixture operating note match the founder-led sales ICP.",
        })),
      },
      awarenessDistribution: {
        prose:
          "The ICP spans all awareness levels, with most evidence concentrated around problem-aware and solution-aware language.",
        levels: awarenessLevels.map((level, index) => ({
          level,
          share: `${10 + index * 10}% directional`,
          evidence: `Fixture evidence for ${level} language.`,
          sampleQuery: `${level} sales workflow problem`,
        })),
      },
      buyingContext: {
        prose:
          "Buying context becomes active when pipeline reviews, CRM cleanup, or founder bandwidth constraints become visible.",
        triggers: [
          {
            name: "Weekly pipeline review breaks",
            detectionSignal: "Founder posts about stale deals before revenue meeting.",
            window: "immediate",
            evidence: "Fixture sales workflow brief names weekly pipeline review pain.",
            sourceUrl: "https://example.com/buyer/trigger-1",
          },
          {
            name: "First revenue hire joins",
            detectionSignal: "New head of revenue announcement.",
            window: "weeks",
            evidence: "Fixture persona signal shows first revenue hire ownership.",
            sourceUrl: "https://example.com/buyer/trigger-2",
          },
          {
            name: "CRM hygiene project starts",
            detectionSignal: "Public request for CRM cleanup or RevOps support.",
            window: "quarters",
            evidence: "Competitor ad fixture shows CRM cleanup demand.",
            sourceUrl: "https://example.com/buyer/trigger-3",
          },
        ],
      },
      clusters: {
        prose:
          "Founder communities and operator newsletters are the clearest distribution research surfaces.",
        venues: [
          ["community", "Founder Stack"],
          ["community", "Seed Sales Circle"],
          ["newsletter", "Operator Notes"],
          ["newsletter", "Pipeline Weekly"],
          ["event", "Early GTM Summit"],
        ].map(([bucketType, name], index) => ({
          bucketType,
          name,
          audienceSize: "not disclosed",
          sourceUrl: `https://example.com/buyer/venue-${index + 1}`,
          whyItMatters: "Matches where founder-led SaaS teams discuss GTM operating problems.",
        })),
      },
    },
    createdAt: observedAt,
  }) as BuyerICPArtifact;

export const buyerICPFixtureSectionOutput = buyerICPSectionOutputSchema.parse({
  sectionTitle: buyerICPFixtureArtifact.sectionTitle,
  verdict: buyerICPFixtureArtifact.verdict,
  statusSummary: buyerICPFixtureArtifact.statusSummary,
  confidence: buyerICPFixtureArtifact.confidence,
  sources: buyerICPFixtureArtifact.sources.map(({ title, url, publisher }) => ({
    title,
    url,
    publisher,
  })),
  body: buyerICPFixtureArtifact.body,
}) satisfies BuyerICPSectionOutput;

const buyerICPFixtureMinimums =
  validateBuyerICPMinimums(buyerICPFixtureArtifact);

if (!buyerICPFixtureMinimums.ok) {
  throw new Error(
    `buyerICPFixtureArtifact failed minimums: ${buyerICPFixtureMinimums.errors.join("; ")}`,
  );
}
