import { artifactEnvelopeSchema } from "../artifacts/artifact-envelope";
import {
  demandIntentBodySchema,
  demandIntentSectionOutputSchema,
  validateDemandIntentMinimums,
  type DemandIntentArtifact,
  type DemandIntentSectionOutput,
} from "../artifacts/schemas/demand-intent";

const observedAt = "2026-05-20T16:30:00.000Z";
const questionSurfaces = ["paa", "reddit", "quora", "community"] as const;
const signalTypes = ["job-posting", "funding", "news-trigger"] as const;
const venueTypes = ["community", "newsletter", "event", "podcast"] as const;

export const demandIntentFixtureArtifact = artifactEnvelopeSchema
  .extend({ body: demandIntentBodySchema })
  .parse({
    id: "art_fixture_demand_intent_saaslaunch",
    runId: "run_saaslaunch_fixture",
    sectionId: "positioningDemandIntent",
    sectionTitle: "Demand & Intent Signals",
    verdict: "Demand clusters around founder-led sales workflow, CRM cleanup, and account prioritization.",
    statusSummary:
      "The strongest intent is problem-aware: buyers search and ask about stale pipeline, weekly review rituals, and account focus. Paid-search angles should avoid fake volume claims and cite organic plus ad-presence evidence.",
    confidence: 0.6,
    sources: Array.from({ length: 5 }, (_, index) => ({
      id: `source_demand_${index + 1}`,
      title: `Demand Fixture Source ${index + 1}`,
      url: `https://example.com/demand/source-${index + 1}`,
      publisher: "AI-GOS AI SDK Lab Fixture",
      observedAt,
    })),
    body: {
      strategicInsight: {
        strategicVerdict:
          "Demand should be harvested from problem-aware workflow pain before category-aware AI GTM searches.",
        nonObviousRead:
          "The best paid-search wedge is the weekly review failure, because it captures urgency before buyers name a tool category.",
        secondOrderImplication:
          "Campaigns should sequence from problem proof to category education instead of leading with AI platform claims.",
        keyTension: {
          tension:
            "Problem-aware queries are messier than category terms, but they carry the sharper buying trigger.",
          side:
            "Take the problem-aware side and use content to translate pipeline review pain into the operating-loop category.",
          costOfPosition:
            "This gives up some clean category-search efficiency while building a more defensible early-funnel narrative.",
        },
      },
      orderedMoves: [
        {
          rank: 1,
          move:
            "Launch problem-aware search and content around stale pipeline, missed follow-up, and weekly review chaos.",
          dependsOn: [],
          rationale:
            "The fixture demand clusters show urgency before buyers use category language, so first money should learn from pain terms.",
        },
        {
          rank: 2,
          move:
            "Retarget those visitors with category-education proof that reframes the pain as a founder-led GTM operating loop.",
          dependsOn: [1],
          rationale:
            "The second move converts messy problem intent into the category frame once the buyer has recognized the operating failure.",
        },
      ],
      provesWrongIf: {
        metric: "problem-aware search conversion to qualified demo request",
        threshold:
          "fewer than 3 qualified demo requests per 1000 problem-aware paid-search visits",
        window: "first 30 days after launch",
      },
      keywordDemand: {
        prose:
          "Keyword demand is strongest around workflow, review, CRM cleanup, account focus, and founder-led sales operations.",
        keywords: Array.from({ length: 10 }, (_, index) => ({
          keyword: `founder sales workflow ${index + 1}`,
          monthlyVolume: `${(index + 1) * 320} (SpyFu-estimated)`,
          monthlyVolumeValue: (index + 1) * 320,
          difficulty: 22 + index,
          intentType:
            index % 4 === 0
              ? "informational"
              : index % 4 === 1
                ? "commercial"
                : index % 4 === 2
                  ? "transactional"
                  : "navigational",
          top3RankingDomains: [
            "example.com",
            "operator.example.com",
            "crm.example.com",
          ],
          sourceTitle: `Keyword Source ${index + 1}`,
          sourceUrl: `https://example.com/demand/keyword-${index + 1}`,
          dateObserved: "2026-05-20",
        })),
      },
      questionMining: {
        prose:
          "Questions show buyers are trying to fix process breakdowns before naming a product category.",
        questions: Array.from({ length: 10 }, (_, index) => ({
          question: `How do I keep founder-led sales follow-up from slipping ${index + 1}?`,
          surface: questionSurfaces[index % questionSurfaces.length],
          sourceUrl: `https://example.com/demand/question-${index + 1}`,
          frequency: index % 2 === 0 ? "recurring" : "occasional",
        })),
      },
      contentGaps: {
        prose:
          "Content gaps sit between CRM hygiene advice and actual weekly operating behavior.",
        gaps: Array.from({ length: 3 }, (_, index) => ({
          topic: `Weekly GTM operating loop ${index + 1}`,
          evidenceOfDemand: "Fixture questions and keywords repeat the workflow pain.",
          weakCompetitorAnswerEvidence:
            "Competitor answers stop at generic CRM cleanup guidance.",
          opportunity:
            "Publish source-backed workflow teardown with account-priority examples.",
        })),
      },
      intentSignals: {
        prose:
          "Hiring, funding, and news triggers expose when founders are likely to operationalize sales.",
        items: Array.from({ length: 5 }, (_, index) => ({
          signalType: signalTypes[index % signalTypes.length],
          description: `Observable intent signal ${index + 1} for GTM workflow strain.`,
          sourceUrl: `https://example.com/demand/signal-${index + 1}`,
          exampleCompany: `Fixture Demand Co ${index + 1}`,
        })),
      },
      venueMap: {
        prose:
          "Communities, newsletters, events, and podcasts provide research venues for the buyer language.",
        venues: Array.from({ length: 4 }, (_, index) => ({
          name: `Demand Venue ${index + 1}`,
          venueType: venueTypes[index % venueTypes.length],
          audienceSize: "unverified — no public sizing",
          sourceUrl: `https://example.com/demand/venue-${index + 1}`,
        })),
      },
    },
    createdAt: observedAt,
  }) as DemandIntentArtifact;

export const demandIntentFixtureSectionOutput =
  demandIntentSectionOutputSchema.parse({
    sectionTitle: demandIntentFixtureArtifact.sectionTitle,
    verdict: demandIntentFixtureArtifact.verdict,
    statusSummary: demandIntentFixtureArtifact.statusSummary,
    confidence: demandIntentFixtureArtifact.confidence,
    sources: demandIntentFixtureArtifact.sources.map(
      ({ title, url, publisher }) => ({ title, url, publisher }),
    ),
    body: demandIntentFixtureArtifact.body,
  }) satisfies DemandIntentSectionOutput;

const demandIntentFixtureMinimums =
  validateDemandIntentMinimums(demandIntentFixtureArtifact);

if (!demandIntentFixtureMinimums.ok) {
  throw new Error(
    `demandIntentFixtureArtifact failed minimums: ${demandIntentFixtureMinimums.errors.join("; ")}`,
  );
}
