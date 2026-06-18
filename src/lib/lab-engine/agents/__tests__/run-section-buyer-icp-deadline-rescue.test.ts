import { describe, expect, it } from "vitest";

import { isLikelyNamedBuyerIdentity } from "../../artifacts/schemas/buyer-icp";
import type { BuyerPersonaCandidate } from "../buyer-persona-acquisition";
import {
  buildDeadlineExhaustionHonestGapBody,
  promoteDeadlineBuyerICPPersonas,
} from "../run-section";

// Regression for run b0d12b45: BuyerICP acquired real named customer champions
// from public case studies, then the deadline-exhaustion gap body hardcoded
// personas:[] and discarded them, committing an empty "evidence gap" while the
// Paid Media capstone synthesized a plan with zero buyers. The rescue promotes
// the grounded candidates we already hold — without fabricating anything.
const groundedCandidates: BuyerPersonaCandidate[] = [
  {
    name: "Jane Doe",
    title: "CFO",
    company: "Acme Robotics",
    url: "https://vendor.example/customers/acme-robotics",
    venue: "case_study_champions",
  },
  {
    name: "John Smith",
    title: "VP of Finance",
    company: "Beta Logistics",
    url: "https://vendor.example/customers/beta-logistics",
    venue: "case_study_champions",
  },
  {
    name: "Maria Garcia",
    title: "Controller",
    company: "Gamma Health",
    url: "https://vendor.example/customers/gamma-health",
    venue: "case_study_champions",
  },
  {
    name: "Sam Lee",
    title: "Head of Finance",
    company: "Delta Studios",
    url: "https://vendor.example/customers/delta-studios",
    venue: "event_speakers",
  },
];

const noiseCandidates: BuyerPersonaCandidate[] = [
  // Generic department label — not a named human; the identity gate must reject.
  {
    name: "Finance Team",
    title: "Department",
    company: "Acme Robotics",
    url: "https://vendor.example/customers/acme-robotics-2",
    venue: "case_study_champions",
  },
  // Real-looking name but non-http url — the url gate must reject.
  {
    name: "Quinn Rivera",
    title: "CFO",
    company: "Epsilon Foods",
    url: "not-a-real-url",
    venue: "case_study_champions",
  },
  // Off-target venue — must be ignored entirely.
  {
    name: "Riley Ng",
    title: "Reviewer",
    company: "Zeta Corp",
    url: "https://g2.com/products/zeta/reviews",
    venue: "g2" as BuyerPersonaCandidate["venue"],
  },
];

describe("BuyerICP deadline-exhaustion persona rescue (run b0d12b45 regression)", () => {
  it("promotes grounded named champions and rejects generic / bad-url / off-venue candidates", () => {
    const personas = promoteDeadlineBuyerICPPersonas([
      ...groundedCandidates,
      ...noiseCandidates,
    ]);

    expect(personas.length).toBeGreaterThanOrEqual(3);

    for (const persona of personas) {
      expect(typeof persona.name).toBe("string");
      expect(
        isLikelyNamedBuyerIdentity(persona.name as string, {
          company: persona.company as string,
          title: persona.title as string,
        }),
      ).toBe(true);
      expect(persona.sourceUrl as string).toMatch(/^https?:\/\//);
    }

    const names = personas.map((persona) => persona.name);
    expect(names).not.toContain("Finance Team");
    expect(names).not.toContain("Quinn Rivera");
    expect(names).not.toContain("Riley Ng");
  });

  it("commits the rescued personas in the deadline gap body instead of discarding them", () => {
    const body = buildDeadlineExhaustionHonestGapBody(
      "positioningBuyerICP",
      groundedCandidates,
    ) as {
      personaReality: { personas: Array<Record<string, unknown>> };
    };

    // Pre-fix this was [] — the marquee b0d12b45 failure.
    expect(body.personaReality.personas.length).toBeGreaterThanOrEqual(3);

    for (const persona of body.personaReality.personas) {
      expect(
        isLikelyNamedBuyerIdentity(persona.name as string, {
          company: persona.company as string,
          title: persona.title as string,
        }),
      ).toBe(true);
      expect(persona.sourceUrl as string).toMatch(/^https?:\/\//);
    }
  });
});
