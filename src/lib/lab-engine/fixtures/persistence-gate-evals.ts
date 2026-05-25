import type { ArtifactEnvelope } from "../artifacts/artifact-envelope";
import type { CompetitorLandscapeArtifact } from "../artifacts/schemas/competitor-landscape";
import type { VoiceOfCustomerArtifact } from "../artifacts/schemas/voice-of-customer";
import type { SectionId } from "../events/activity-event";
import { competitorLandscapeFixtureArtifact } from "./competitor-landscape-artifact";
import { voiceOfCustomerFixtureArtifact } from "./voice-of-customer-artifact";

export interface PersistenceGateEvalCase {
  readonly artifact: ArtifactEnvelope;
  readonly expectedError: RegExp;
  readonly name: string;
  readonly sectionId: SectionId;
}

const shortVoiceOfCustomerArtifact = {
  ...voiceOfCustomerFixtureArtifact,
  id: `${voiceOfCustomerFixtureArtifact.id}_short_pain_quotes`,
  body: {
    ...voiceOfCustomerFixtureArtifact.body,
    painLanguage: {
      ...voiceOfCustomerFixtureArtifact.body.painLanguage,
      quotes: voiceOfCustomerFixtureArtifact.body.painLanguage.quotes.slice(
        0,
        2,
      ),
    },
  },
} satisfies VoiceOfCustomerArtifact;

const shortCompetitorLandscapeArtifact = {
  ...competitorLandscapeFixtureArtifact,
  id: `${competitorLandscapeFixtureArtifact.id}_short_competitor_set`,
  body: {
    ...competitorLandscapeFixtureArtifact.body,
    competitorSet: {
      ...competitorLandscapeFixtureArtifact.body.competitorSet,
      competitors:
        competitorLandscapeFixtureArtifact.body.competitorSet.competitors.slice(
          0,
          2,
        ),
    },
  },
} satisfies CompetitorLandscapeArtifact;

export const persistenceGateEvalCases = [
  {
    artifact: shortVoiceOfCustomerArtifact,
    expectedError: /body\.painLanguage\.quotes/u,
    name: "rejects a short Voice of Customer pain-language sample",
    sectionId: "positioningVoiceOfCustomer",
  },
  {
    artifact: shortCompetitorLandscapeArtifact,
    expectedError: /body\.competitorSet\.competitors/u,
    name: "rejects a short Competitor Landscape competitor set",
    sectionId: "positioningCompetitorLandscape",
  },
] satisfies readonly PersistenceGateEvalCase[];
