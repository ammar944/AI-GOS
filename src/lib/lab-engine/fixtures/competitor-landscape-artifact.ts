import { artifactEnvelopeSchema } from "../artifacts/artifact-envelope";
import {
  competitorLandscapeBodySchema,
  competitorLandscapeSectionOutputSchema,
  validateCompetitorLandscapeMinimums,
  type CompetitorLandscapeArtifact,
  type CompetitorLandscapeSectionOutput,
} from "../artifacts/schemas/competitor-landscape";

const sources = [
  ["source_signalforge", "SignalForge Fixture", "https://example.com/signalforge"],
  ["source_pipelinepilot", "PipelinePilot Fixture", "https://example.com/pipelinepilot"],
  ["source_revenueos", "RevenueOS Lab Fixture", "https://example.com/revenueos-lab"],
  ["source_growthops", "GrowthOps Studio Fixture", "https://example.com/growthops-studio"],
  ["source_spreadsheet", "DIY Spreadsheet Fixture", "https://example.com/diy-spreadsheet"],
] as const;

export const competitorLandscapeFixtureArtifact = artifactEnvelopeSchema
  .extend({ body: competitorLandscapeBodySchema })
  .parse({
    id: "art_fixture_competitor_saaslaunch",
    runId: "run_saaslaunch_fixture",
    sectionId: "positioningCompetitorLandscape",
    sectionTitle: "Competitor Landscape & Positioning",
    verdict:
      "SaaSLaunch competes against CRM cleanup, AI operator, agency-led operations, and DIY spreadsheet rituals.",
    statusSummary:
      "The fixture landscape shows buyers already see the founder-led GTM operations problem through several substitutes. The strongest opening is not generic automation; it is a source-backed weekly operating loop that makes founder decisions explicit. Competitor ads reinforce CRM hygiene and AI operator angles, leaving room for disciplined workflow ownership.",
    confidence: 0.6,
    sources: sources.map(([id, title, url]) => ({
      id,
      title,
      url,
      publisher: "AI-GOS AI SDK Lab Fixture",
      observedAt: "2026-05-20T15:45:00.000Z",
    })),
    body: {
      strategicInsight: {
        strategicVerdict:
          "SaaSLaunch should attack manual and AI-assistant competitors on decision accountability, not feature breadth.",
        nonObviousRead:
          "The vulnerable competitor pattern is not weak automation; it is that alternatives hide who owns the weekly revenue decision.",
        secondOrderImplication:
          "Competitive copy should concede generic CRM cleanup while proving a more defensible weekly operating loop.",
        keyTension: {
          tension:
            "The market rewards broad automation claims, but founder buyers need a narrower accountable workflow.",
          side:
            "Take the accountable-workflow side and refuse to outclaim AI assistants on autonomous activity volume.",
          costOfPosition:
            "This concedes some automation comparison traffic while sharpening the message against status-quo rituals.",
        },
      },
      whereToAttackVsConcede: {
        attack:
          "Attack spreadsheet rituals and AI assistants where they fail to make weekly pipeline decisions explicit.",
        concede:
          "Concede broad CRM hygiene and generic follow-up automation to incumbents with deeper feature surfaces.",
        rationale:
          "The fixture evidence shows competitors advertising cleanup and AI operator language, leaving accountability as the open flank.",
      },
      incumbentBlindSpot: {
        incumbent: "CRM cleanup tools and AI sales assistants",
        blindSpot:
          "They optimize activity or hygiene while leaving the founder's weekly decision ritual implicit.",
        whyTheyMissIt:
          "Their positioning centers tool output, so they under-message the operating cadence buyers must actually change.",
      },
      competitorSet: {
        prose:
          "The set spans direct GTM workflow tools, indirect CRM cleanup, status-quo agency/operator help, and DIY spreadsheets. SaaSLaunch should position by making the operating rhythm tangible and verifiable.",
        competitors: [
          {
            name: "SignalForge",
            url: "https://example.com/signalforge",
            competitorType: "direct",
            oneLinePositioning:
              "AI account prioritization for small revenue teams.",
            verbatimHeroCopy:
              "Turn scattered GTM signals into account priorities",
            pricingPosition: "not disclosed",
            sourceUrl: "https://example.com/fixtures/ad-library/signalforge-linkedin",
          },
          {
            name: "PipelinePilot",
            url: "https://example.com/pipelinepilot",
            competitorType: "indirect",
            oneLinePositioning:
              "CRM hygiene and stale-deal cleanup before pipeline review.",
            verbatimHeroCopy: "Clean up your CRM before pipeline review",
            pricingPosition: "gated",
            sourceUrl: "https://example.com/fixtures/ad-library/pipelinepilot-google",
          },
          {
            name: "RevenueOS Lab",
            url: "https://example.com/revenueos-lab",
            competitorType: "direct",
            oneLinePositioning:
              "AI operator positioning for founder-led revenue teams.",
            verbatimHeroCopy: "A revenue operator in your browser",
            pricingPosition: "not disclosed",
            sourceUrl: "https://example.com/fixtures/ad-library/revenueos-meta",
          },
          {
            name: "GrowthOps Studio",
            url: "https://example.com/growthops-studio",
            competitorType: "status-quo",
            oneLinePositioning:
              "Services-led operating layer for founder-led sales.",
            verbatimHeroCopy: "Founder-led sales needs an operating layer",
            pricingPosition: "sales-led",
            sourceUrl: "https://example.com/fixtures/ad-library/growthops-linkedin",
          },
          {
            name: "Spreadsheet Pipeline Review",
            url: "https://example.com/diy-spreadsheet",
            competitorType: "diy",
            oneLinePositioning:
              "Manual weekly account review in spreadsheets and notes.",
            verbatimHeroCopy: "Replace spreadsheet rituals",
            pricingPosition: "internal time cost",
            sourceUrl: "https://example.com/diy-spreadsheet",
          },
        ],
      },
      positioningTaxonomy: {
        prose:
          "Competitors split by hygiene versus operating rhythm, and automation promise versus accountable founder workflow. SaaSLaunch should occupy the source-backed operating loop quadrant.",
        axes: [
          {
            axisName: "CRM hygiene versus operating rhythm",
            ourPosition: "Weekly GTM loop with ranked actions.",
            competitorPositions: [
              { competitor: "PipelinePilot", position: "CRM cleanup before review." },
              { competitor: "GrowthOps Studio", position: "Services-led operating cadence." },
            ],
            evidenceUrl: "https://example.com/saaslaunch/positioning-notes",
          },
          {
            axisName: "AI automation versus human-verifiable decisions",
            ourPosition: "Source-backed recommendations a founder approves.",
            competitorPositions: [
              { competitor: "RevenueOS Lab", position: "AI operator automation." },
              { competitor: "SignalForge", position: "AI account prioritization." },
            ],
            evidenceUrl: "https://example.com/fixtures/ad-library/revenueos-meta",
          },
          {
            axisName: "Tooling versus ritual replacement",
            ourPosition: "Replace spreadsheet review with a repeatable loop.",
            competitorPositions: [
              { competitor: "Spreadsheet Pipeline Review", position: "DIY ritual." },
              { competitor: "PipelinePilot", position: "Tooling for stale data." },
            ],
            evidenceUrl: "https://example.com/diy-spreadsheet",
          },
        ],
      },
      pricingReality: {
        prose:
          "Pricing evidence is directional in the fixture: competitors mostly use gated or undisclosed pricing, which makes proof and implementation clarity more important than price comparison.",
        dataPoints: [
          {
            competitor: "SignalForge",
            tierName: "Contact sales",
            monthlyPrice: "not disclosed",
            packagingPattern: "sales-led workflow platform",
            gatedSignals: "Ad sends to a campaign page without public pricing.",
            sourceUrl: "https://example.com/signalforge",
          },
          {
            competitor: "PipelinePilot",
            tierName: "Gated CRM audit",
            monthlyPrice: "gated",
            packagingPattern: "audit-led CRM cleanup",
            gatedSignals: "Fixture ad emphasizes audit workflow, not public tiers.",
            sourceUrl: "https://example.com/pipelinepilot",
          },
          {
            competitor: "RevenueOS Lab",
            tierName: "Operator package",
            monthlyPrice: "not disclosed",
            packagingPattern: "AI operator bundle",
            gatedSignals: "Landing promise names operator value without public price.",
            sourceUrl: "https://example.com/revenueos-lab",
          },
        ],
      },
      shareOfVoice: {
        prose:
          "Visible fixture surfaces are ad-led and pain-led. Competitors own CRM cleanup, AI operator, and founder-led operating-language surfaces separately.",
        slices: [
          {
            surface: "LinkedIn account-priority ads",
            winner: "SignalForge",
            evidence: "SignalForge owns the account-priority language in the fixture.",
            sourceUrl: "https://example.com/fixtures/ad-library/signalforge-linkedin",
          },
          {
            surface: "Google CRM cleanup ads",
            winner: "PipelinePilot",
            evidence: "PipelinePilot anchors the CRM cleanup before review angle.",
            sourceUrl: "https://example.com/fixtures/ad-library/pipelinepilot-google",
          },
          {
            surface: "Meta AI operator ads",
            winner: "RevenueOS Lab",
            evidence: "RevenueOS Lab uses the browser-based revenue operator frame.",
            sourceUrl: "https://example.com/fixtures/ad-library/revenueos-meta",
          },
        ],
      },
      publicWeaknesses: {
        prose:
          "The public weakness pattern is mostly inferred from fixture positioning gaps: generic AI claims, CRM hygiene narrowness, and setup burden in DIY rituals.",
        items: [
          {
            competitor: "PipelinePilot",
            verbatimQuote: "Clean up your CRM before pipeline review",
            source: "Google fixture ad",
            sourceUrl: "https://example.com/fixtures/ad-library/pipelinepilot-google",
            whyItMatters:
              "The message stops at hygiene, leaving the operating rhythm after cleanup open.",
          },
          {
            competitor: "RevenueOS Lab",
            verbatimQuote: "A revenue operator in your browser",
            source: "Meta fixture ad",
            sourceUrl: "https://example.com/fixtures/ad-library/revenueos-meta",
            whyItMatters:
              "The broad operator promise can sound less verifiable than source-backed weekly decisions.",
          },
          {
            competitor: "GrowthOps Studio",
            verbatimQuote: "Founder-led sales needs an operating layer",
            source: "LinkedIn fixture ad",
            sourceUrl: "https://example.com/fixtures/ad-library/growthops-linkedin",
            whyItMatters:
              "Services-led framing may imply slower implementation and less productized repeatability.",
          },
          {
            competitor: "Spreadsheet Pipeline Review",
            verbatimQuote: "Replace spreadsheet rituals",
            source: "DIY fixture",
            sourceUrl: "https://example.com/diy-spreadsheet",
            whyItMatters:
              "DIY rituals create setup burden and inconsistent follow-through.",
          },
        ],
      },
      narrativeArcs: {
        prose:
          "The leading narratives make old CRM hygiene, scattered signals, and manual operating rituals the villain. SaaSLaunch can make the weekly decision loop the hero.",
        arcs: [
          {
            competitor: "SignalForge",
            villain: "Scattered GTM signals",
            hero: "Ranked account priorities",
            transformationClaim:
              "Revenue teams know which account to work next.",
            sourceUrl: "https://example.com/fixtures/ad-library/signalforge-linkedin",
          },
          {
            competitor: "PipelinePilot",
            villain: "Stale CRM data",
            hero: "CRM cleanup audit",
            transformationClaim:
              "Pipeline review starts with clean next steps.",
            sourceUrl: "https://example.com/fixtures/ad-library/pipelinepilot-google",
          },
          {
            competitor: "RevenueOS Lab",
            villain: "Manual follow-up and deal risk",
            hero: "AI revenue operator",
            transformationClaim:
              "Founders focus on accounts that can close this month.",
            sourceUrl: "https://example.com/fixtures/ad-library/revenueos-meta",
          },
        ],
      },
      adPresence: {
        prose:
          "Fixture ad-presence signals show three competitors actively testing platform-specific GTM messages, with spend left as an explicit evidence-bounded estimate rather than a fabricated budget.",
        signals: [
          {
            competitor: "SignalForge",
            platforms: ["linkedin"],
            estSpend: "unknown; one displayable LinkedIn creative observed",
            evidence:
              "LinkedIn ad copy centers on account-priority language for revenue teams.",
            sourceUrl: "https://example.com/fixtures/ad-library/signalforge-linkedin",
          },
          {
            competitor: "PipelinePilot",
            platforms: ["google"],
            estSpend: "unknown; one displayable Google search creative observed",
            evidence:
              "Google ad copy owns the CRM cleanup before pipeline review angle.",
            sourceUrl: "https://example.com/fixtures/ad-library/pipelinepilot-google",
          },
          {
            competitor: "RevenueOS Lab",
            platforms: ["meta"],
            estSpend: "unknown; one displayable Meta creative observed",
            evidence:
              "Meta creative frames the product as a browser-based revenue operator.",
            sourceUrl: "https://example.com/fixtures/ad-library/revenueos-meta",
          },
        ],
      },
      adEvidence: {
        prose:
          "Fixture ad evidence is artifact-owned and grouped by advertiser so the preview can show counts, source links, and bounded creatives without reading ResearchInput.competitorAds.",
        advertiserGroups: [
          {
            advertiserName: "SignalForge",
            domain: null,
            platforms: ["linkedin"],
            rawCounts: { google: 0, meta: 0, linkedin: 1 },
            displayableCounts: { google: 0, meta: 0, linkedin: 1 },
            displayableTotal: 1,
            returnedCreativeCount: 1,
            creatives: [
              {
                id: "ad_linkedin_signalforge_0",
                platform: "linkedin",
                advertiserName: "SignalForge",
                headline: "Turn scattered GTM signals into account priorities",
                body: "Give operators a daily ranked account list with explainable triggers, CRM context, and recommended next actions.",
                landingUrl: "https://example.com/signalforge/pipeline-priority",
                creativeUrl: null,
                imageUrl: null,
                videoUrl: null,
                detailsUrl: null,
                sourceUrl: "https://example.com/fixtures/ad-library/signalforge-linkedin",
                firstSeen: "2026-04-08",
                lastSeen: "2026-05-18",
                format: "text",
                isActive: true,
                source: null,
                transcript: null,
                cta: null,
              },
            ],
            libraryLinks: {
              linkedin:
                "https://www.linkedin.com/ad-library/search?company=SignalForge",
            },
            rawSourceSamples: [
              {
                id: "raw_linkedin_signalforge_0",
                platform: "linkedin",
                advertiserName: "SignalForge",
                headline: "Turn scattered GTM signals into account priorities",
                body: "Give operators a daily ranked account list with explainable triggers, CRM context, and recommended next actions.",
                imageUrl: null,
                videoUrl: null,
                detailsUrl: null,
                sourceUrl: "https://example.com/fixtures/ad-library/signalforge-linkedin",
                format: "text",
                dataGap: null,
                source: null,
                transcript: null,
                cta: null,
              },
            ],
            dataGaps: [],
            sourceErrors: [],
            observedAt: "2026-05-20T15:45:00.000Z",
          },
          {
            advertiserName: "PipelinePilot",
            domain: null,
            platforms: ["google"],
            rawCounts: { google: 1, meta: 0, linkedin: 0 },
            displayableCounts: { google: 1, meta: 0, linkedin: 0 },
            displayableTotal: 1,
            returnedCreativeCount: 1,
            creatives: [
              {
                id: "ad_google_pipelinepilot_0",
                platform: "google",
                advertiserName: "PipelinePilot",
                headline: "Clean up your CRM before pipeline review",
                body: "PipelinePilot audits stale deals, missing next steps, and handoff gaps before your weekly revenue meeting starts.",
                landingUrl: "https://example.com/pipelinepilot/crm-cleanup",
                creativeUrl: null,
                imageUrl: null,
                videoUrl: null,
                detailsUrl: null,
                sourceUrl: "https://example.com/fixtures/ad-library/pipelinepilot-google",
                firstSeen: "2026-03-22",
                lastSeen: "2026-05-16",
                format: "text",
                isActive: true,
                source: null,
                transcript: null,
                cta: null,
              },
            ],
            libraryLinks: {
              google:
                "https://adstransparency.google.com/?region=US&query=PipelinePilot",
            },
            rawSourceSamples: [
              {
                id: "raw_google_pipelinepilot_0",
                platform: "google",
                advertiserName: "PipelinePilot",
                headline: "Clean up your CRM before pipeline review",
                body: "PipelinePilot audits stale deals, missing next steps, and handoff gaps before your weekly revenue meeting starts.",
                imageUrl: null,
                videoUrl: null,
                detailsUrl: null,
                sourceUrl: "https://example.com/fixtures/ad-library/pipelinepilot-google",
                format: "text",
                dataGap: null,
                source: null,
                transcript: null,
                cta: null,
              },
            ],
            dataGaps: [],
            sourceErrors: [],
            observedAt: "2026-05-20T15:45:00.000Z",
          },
          {
            advertiserName: "RevenueOS Lab",
            domain: null,
            platforms: ["meta"],
            rawCounts: { google: 0, meta: 1, linkedin: 0 },
            displayableCounts: { google: 0, meta: 1, linkedin: 0 },
            displayableTotal: 1,
            returnedCreativeCount: 1,
            creatives: [
              {
                id: "ad_meta_revenueos-lab_0",
                platform: "meta",
                advertiserName: "RevenueOS Lab",
                headline: "A revenue operator in your browser",
                body: "Automate follow-up, summarize deal risk, and keep founders focused on the accounts that can close this month.",
                landingUrl: "https://example.com/revenueos-lab/operator",
                creativeUrl: "https://example.com/fixtures/creative/revenueos-operator.png",
                imageUrl: "https://example.com/fixtures/creative/revenueos-operator.png",
                videoUrl: null,
                detailsUrl: "https://example.com/fixtures/ad-library/revenueos-meta",
                sourceUrl: "https://example.com/fixtures/ad-library/revenueos-meta",
                firstSeen: "2026-04-14",
                lastSeen: "2026-05-19",
                format: "image",
                isActive: true,
                source: null,
                transcript: null,
                cta: null,
              },
            ],
            libraryLinks: {
              meta:
                "https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&q=RevenueOS%20Lab",
            },
            rawSourceSamples: [
              {
                id: "raw_meta_revenueos-lab_0",
                platform: "meta",
                advertiserName: "RevenueOS Lab",
                headline: "A revenue operator in your browser",
                body: "Automate follow-up, summarize deal risk, and keep founders focused on the accounts that can close this month.",
                imageUrl: "https://example.com/fixtures/creative/revenueos-operator.png",
                videoUrl: null,
                detailsUrl: "https://example.com/fixtures/ad-library/revenueos-meta",
                sourceUrl: "https://example.com/fixtures/ad-library/revenueos-meta",
                format: "image",
                dataGap: null,
                source: null,
                transcript: null,
                cta: null,
              },
            ],
            dataGaps: [],
            sourceErrors: [],
            observedAt: "2026-05-20T15:45:00.000Z",
          },
        ],
      },
    },
    createdAt: "2026-05-20T15:45:00.000Z",
  }) as CompetitorLandscapeArtifact;

export const competitorLandscapeFixtureSectionOutput =
  competitorLandscapeSectionOutputSchema.parse({
    sectionTitle: competitorLandscapeFixtureArtifact.sectionTitle,
    verdict: competitorLandscapeFixtureArtifact.verdict,
    statusSummary: competitorLandscapeFixtureArtifact.statusSummary,
    confidence: competitorLandscapeFixtureArtifact.confidence,
    sources: competitorLandscapeFixtureArtifact.sources.map(
      ({ title, url, publisher }) => ({ title, url, publisher }),
    ),
    body: competitorLandscapeFixtureArtifact.body,
  }) satisfies CompetitorLandscapeSectionOutput;

const competitorLandscapeFixtureMinimums = validateCompetitorLandscapeMinimums(
  competitorLandscapeFixtureArtifact,
);

if (!competitorLandscapeFixtureMinimums.ok) {
  throw new Error(
    `competitorLandscapeFixtureArtifact failed minimums: ${competitorLandscapeFixtureMinimums.errors.join("; ")}`,
  );
}
