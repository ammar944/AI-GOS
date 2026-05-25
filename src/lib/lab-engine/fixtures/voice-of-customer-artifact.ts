import { artifactEnvelopeSchema } from "../artifacts/artifact-envelope";
import {
  validateVoiceOfCustomerMinimums,
  voiceOfCustomerBodySchema,
  voiceOfCustomerSectionOutputSchema,
  type VoiceOfCustomerArtifact,
  type VoiceOfCustomerSectionOutput,
} from "../artifacts/schemas/voice-of-customer";

const observedAt = "2026-05-20T16:20:00.000Z";
const sources = Array.from({ length: 5 }, (_, index) => ({
  id: `source_voc_${index + 1}`,
  title: `VOC Fixture Source ${index + 1}`,
  url: `https://example.com/voc/source-${index + 1}`,
  publisher: "AI-GOS AI SDK Lab Fixture",
  observedAt,
}));

export const voiceOfCustomerFixtureArtifact = artifactEnvelopeSchema
  .extend({ body: voiceOfCustomerBodySchema })
  .parse({
    id: "art_fixture_voc_saaslaunch",
    runId: "run_saaslaunch_fixture",
    sectionId: "positioningVoiceOfCustomer",
    sectionTitle: "Voice of Customer & Objection Evidence",
    verdict: "Buyers describe the pain as follow-up chaos, not a need for another CRM.",
    statusSummary:
      "The fixture language clusters around stale account context, founder bandwidth, and distrust of black-box automation. Objections can be defused by source-backed recommendations and a clear weekly operating loop.",
    confidence: 0.6,
    sources,
    body: {
      painLanguage: {
        prose:
          "Pain language is concrete and operational: teams lose momentum because next actions are not explicit.",
        quotes: Array.from({ length: 10 }, (_, index) => ({
          verbatimText: `We keep losing track of the next best account action ${index + 1}.`,
          source: index % 3 === 0 ? "g2" : index % 3 === 1 ? "reddit" : "other",
          sourceUrl: `https://voc-source-${(index % 3) + 1}.example.com/pain/${index + 1}`,
          painTheme: index % 2 === 0 ? "follow-up chaos" : "account context loss",
          painIntensity: index % 2 === 0 ? "high" : "medium",
        })),
      },
      objections: {
        prose:
          "Objections focus on trust, switching cost, price, stakeholder adoption, and missing features.",
        items: [
          ["price", "We cannot pay for another GTM tool."],
          ["trust", "I do not trust a black-box recommendation."],
          ["switching-cost", "Moving workflows out of sheets will slow us down."],
          ["feature", "It needs to work with our CRM notes."],
          ["stakeholder", "The founder will not change the review ritual."],
        ].map(([category, objectionText], index) => ({
          objectionText,
          category,
          frequency: index < 3 ? "recurring" : "occasional",
          howToHandle: "Anchor the response in source-backed evidence and a reversible pilot.",
          sourceUrl: `https://example.com/voc/objection-${index + 1}`,
        })),
      },
      switchingStories: {
        prose:
          "Switching stories start from spreadsheets and generic CRM cleanup, then move toward an operating loop.",
        stories: [
          ["spreadsheet", "Manual review broke as account volume grew."],
          ["crm cleanup", "Stale fields did not answer what to do next."],
          ["spreadsheet", "Founder wanted one weekly source-backed focus list."],
        ].map(([priorSolution, reasonToLeave], index) => ({
          priorSolution,
          reasonToLeave,
          decisionPath: "Buyer tested a weekly review workflow before committing.",
          exampleCompany: `Fixture Company ${index + 1}`,
          sourceUrl: `https://example.com/voc/switching-${index + 1}`,
        })),
      },
      decisionCriteria: {
        prose:
          "Decision criteria reward explainability, low workflow disruption, CRM fit, speed to first value, and founder trust.",
        criteria: [
          "Explainable recommendations",
          "Low switching cost",
          "CRM compatibility",
          "Fast first value",
          "Founder-level trust",
        ].map((criterion, index) => ({
          criterion,
          statedBy: index === 0 ? "buyer" : index === 1 ? "champion" : "influencer",
          evidenceQuote: `${criterion} matters before the team changes its weekly rhythm.`,
          sourceUrl: `https://example.com/voc/criterion-${index + 1}`,
        })),
      },
      successLanguage: {
        prose:
          "Success language describes calm weekly focus and fewer dropped account actions.",
        quotes: Array.from({ length: 5 }, (_, index) => ({
          verbatimText: `We finally know which account action matters this week ${index + 1}.`,
          source: index % 2 === 0 ? "g2" : "other",
          sourceUrl: `https://example.com/voc/success-${index + 1}`,
          afterStatePattern: "weekly focus restored",
        })),
      },
    },
    createdAt: observedAt,
  }) as VoiceOfCustomerArtifact;

export const voiceOfCustomerFixtureSectionOutput =
  voiceOfCustomerSectionOutputSchema.parse({
    sectionTitle: voiceOfCustomerFixtureArtifact.sectionTitle,
    verdict: voiceOfCustomerFixtureArtifact.verdict,
    statusSummary: voiceOfCustomerFixtureArtifact.statusSummary,
    confidence: voiceOfCustomerFixtureArtifact.confidence,
    sources: voiceOfCustomerFixtureArtifact.sources.map(
      ({ title, url, publisher }) => ({ title, url, publisher }),
    ),
    body: voiceOfCustomerFixtureArtifact.body,
  }) satisfies VoiceOfCustomerSectionOutput;

const voiceOfCustomerFixtureMinimums = validateVoiceOfCustomerMinimums(
  voiceOfCustomerFixtureArtifact,
);

if (!voiceOfCustomerFixtureMinimums.ok) {
  throw new Error(
    `voiceOfCustomerFixtureArtifact failed minimums: ${voiceOfCustomerFixtureMinimums.errors.join("; ")}`,
  );
}
