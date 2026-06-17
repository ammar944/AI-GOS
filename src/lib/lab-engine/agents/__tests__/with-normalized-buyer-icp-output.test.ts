import { describe, expect, it } from "vitest";

import { withNormalizedBuyerICPOutput } from "../run-section";
import {
  modelEstimateLabel,
  validateBuyerICPMinimums,
} from "../../artifacts/schemas/buyer-icp";

function buyerOutput(personas: Record<string, unknown>[]): Record<string, unknown> {
  return {
    sectionTitle: "Buyer ICP",
    verdict: "verdict",
    statusSummary: "status",
    confidence: 0.5,
    sources: [{ title: "Source", url: "https://g2.com/x" }],
    body: {
      personaReality: { prose: "p", personas },
    },
  };
}

function personasOf(output: unknown): Record<string, unknown>[] {
  const body = (output as { body: Record<string, unknown> }).body;
  const personaReality = body.personaReality as Record<string, unknown>;
  return personaReality.personas as Record<string, unknown>[];
}

const subjectWebsiteUrl = "https://anura.io";

describe("withNormalizedBuyerICPOutput vendorSourced derivation", (): void => {
  it("labels subject-domain personas vendorSourced=true (www/subdomain collapse)", (): void => {
    const personas = personasOf(
      withNormalizedBuyerICPOutput(
        buyerOutput([
          { name: "A", sourceUrl: "https://anura.io/case-studies/x" },
          { name: "B", sourceUrl: "https://www.anura.io/customers" },
          { name: "C", sourceUrl: "https://blog.anura.io/story" },
        ]),
        { subjectWebsiteUrl },
      ),
    );

    expect(personas.map((persona) => persona.vendorSourced)).toEqual([
      true,
      true,
      true,
    ]);
  });

  it("labels independent-domain personas vendorSourced=false", (): void => {
    const personas = personasOf(
      withNormalizedBuyerICPOutput(
        buyerOutput([
          { name: "A", sourceUrl: "https://g2.com/products/anura/reviews" },
        ]),
        { subjectWebsiteUrl },
      ),
    );

    expect(personas[0]?.vendorSourced).toBe(false);
  });

  it("overwrites a model-authored vendorSourced value (derive-don't-ask)", (): void => {
    const personas = personasOf(
      withNormalizedBuyerICPOutput(
        buyerOutput([
          {
            name: "A",
            sourceUrl: "https://anura.io/case-studies/x",
            vendorSourced: false,
          },
        ]),
        { subjectWebsiteUrl },
      ),
    );

    expect(personas[0]?.vendorSourced).toBe(true);
  });

  it("leaves personas untouched when no subject URL is supplied", (): void => {
    const personas = personasOf(
      withNormalizedBuyerICPOutput(
        buyerOutput([{ name: "A", sourceUrl: "https://g2.com/x" }]),
        {},
      ),
    );

    expect(personas[0]?.vendorSourced).toBeUndefined();
  });

  it("drops subject-company employees posing as buyer personas", (): void => {
    const personas = personasOf(
      withNormalizedBuyerICPOutput(
        buyerOutput([
          {
            name: "Rich Kahn",
            title: "CEO and Co-Founder",
            company: "Anura.io",
            sourceUrl: "https://emarketingassociation.com/rich-kahn",
          },
          {
            name: "Maya Chen",
            title: "VP Marketing",
            company: "Brightpath Labs",
            sourceUrl: "https://g2.com/products/anura/reviews",
          },
        ]),
        { subjectWebsiteUrl, subjectCompanyName: "Anura" },
      ),
    );

    expect(personas).toHaveLength(1);
    expect(personas[0]?.name).toBe("Maya Chen");
  });
});

describe("withNormalizedBuyerICPOutput unnecessary-gap strip", (): void => {
  const threeValidPersonas = [
    {
      name: "Maya Chen",
      title: "VP Marketing",
      company: "Brightpath Labs",
      role: "buyer",
      seniority: "VP",
      evidence: "Quoted in the case study about fraud-filter rollout.",
      sourceUrl: "https://anura.io/case-studies/brightpath",
    },
    {
      name: "Jordan Velez",
      title: "Head of Paid Media",
      company: "Crateful",
      role: "champion",
      seniority: "Head",
      evidence: "Named speaker on the ad-fraud webinar.",
      sourceUrl: "https://anura.io/webinars/crateful",
    },
    {
      name: "Sasha Bloom",
      title: "Director of Growth",
      company: "Nimbus Metrics",
      role: "buyer",
      seniority: "Director",
      evidence: "Named reviewer on G2 with title and company.",
      sourceUrl: "https://g2.com/products/anura/reviews/sasha",
    },
  ];

  function gappedOutput(personas: Record<string, unknown>[]): Record<string, unknown> {
    const output = buyerOutput(personas);
    const body = output.body as Record<string, unknown>;
    body.evidenceGap = true;
    body.evidenceGapReport = {
      reason: "insufficient_named_buyer_personas",
      summary: "Model filed a gap anyway.",
      foundNamedPersonaCount: personas.length,
      requiredNamedPersonaCount: 5,
      rejectedPersonaLabels: [],
      sourcingPlan: ["More mining."],
    };
    return output;
  }

  it("strips a model-authored gap when >=3 validator-grade personas remain", (): void => {
    const output = withNormalizedBuyerICPOutput(gappedOutput(threeValidPersonas), {
      subjectWebsiteUrl,
      subjectCompanyName: "Anura",
    }) as { body: Record<string, unknown> };

    expect(output.body.evidenceGap).toBeUndefined();
    expect(output.body.evidenceGapReport).toBeUndefined();
  });

  it("keeps the gap when fewer than 3 validator-grade personas remain", (): void => {
    const output = withNormalizedBuyerICPOutput(
      gappedOutput(threeValidPersonas.slice(0, 2)),
      { subjectWebsiteUrl, subjectCompanyName: "Anura" },
    ) as { body: Record<string, unknown> };

    expect(output.body.evidenceGap).toBe(true);
    expect(output.body.evidenceGapReport).toBeDefined();
  });
});

describe("withNormalizedBuyerICPOutput tolerant-out persona gap injection", (): void => {
  const twoValidPersonas = [
    {
      name: "Maya Chen",
      title: "VP Marketing",
      company: "Brightpath Labs",
      role: "buyer",
      seniority: "VP",
      evidence: "Named reviewer with title and company.",
      sourceUrl: "https://g2.com/products/anura/reviews/maya",
    },
    {
      name: "Jordan Velez",
      title: "Head of Paid Media",
      company: "Crateful",
      role: "champion",
      seniority: "Head",
      evidence: "Named speaker on the webinar.",
      sourceUrl: "https://capterra.com/p/anura/jordan",
    },
  ];

  it("injects an honest persona gap when <3 validator-grade personas and no gap declared (was a HARD ERROR that blocked the run)", (): void => {
    const output = withNormalizedBuyerICPOutput(buyerOutput(twoValidPersonas), {
      subjectWebsiteUrl,
      subjectCompanyName: "Anura",
    }) as { body: Record<string, unknown> };

    expect(output.body.evidenceGap).toBe(true);
    const report = output.body.evidenceGapReport as Record<string, unknown>;
    expect(report.reason).toBe("insufficient_named_buyer_personas");
    expect(report.foundNamedPersonaCount).toBe(2);
    expect(report.requiredNamedPersonaCount).toBe(3);
    expect(Array.isArray(report.sourcingPlan)).toBe(true);
    expect((report.sourcingPlan as string[]).length).toBeGreaterThanOrEqual(1);
    // the two real personas are still carried (directional, not erased)
    expect(personasOf(output)).toHaveLength(2);
  });

  it("does NOT inject when >=3 validator-grade personas exist", (): void => {
    const output = withNormalizedBuyerICPOutput(
      buyerOutput([
        ...twoValidPersonas,
        {
          name: "Sasha Bloom",
          title: "Director of Growth",
          company: "Nimbus Metrics",
          role: "buyer",
          seniority: "Director",
          evidence: "Named reviewer on G2.",
          sourceUrl: "https://trustradius.com/anura/sasha",
        },
      ]),
      { subjectWebsiteUrl, subjectCompanyName: "Anura" },
    ) as { body: Record<string, unknown> };

    expect(output.body.evidenceGap).toBeUndefined();
    expect(output.body.evidenceGapReport).toBeUndefined();
  });

  it("does NOT override a persona gap the model already declared", (): void => {
    const out = buyerOutput(twoValidPersonas);
    const body = out.body as Record<string, unknown>;
    body.evidenceGap = true;
    body.evidenceGapReport = {
      reason: "insufficient_named_buyer_personas",
      summary: "Model's own gap.",
      foundNamedPersonaCount: 2,
      requiredNamedPersonaCount: 3,
      rejectedPersonaLabels: ["analyst (role)"],
      sourcingPlan: ["Model's own plan."],
    };
    const output = withNormalizedBuyerICPOutput(out, {
      subjectWebsiteUrl,
      subjectCompanyName: "Anura",
    }) as { body: Record<string, unknown> };
    const report = output.body.evidenceGapReport as Record<string, unknown>;
    expect(report.summary).toBe("Model's own gap.");
  });
});

// Tolerant-out (R1) backstop: the OTHER buyer-ICP floors (beyond the persona
// floor) must commit DEGRADED via their honest escapes instead of hard-erroring
// the run and blocking the downstream paid-media dispatch.
function completeBuyerICPOutput(): Record<string, unknown> {
  return {
    sectionTitle: "Buyer ICP",
    verdict: "RevOps leaders at mid-market firms are the reachable wedge buyer.",
    statusSummary: "Grounded across independent reviewer and case-study evidence.",
    confidence: 0.6,
    sources: [{ title: "G2", url: "https://www.g2.com/products/x/reviews" }],
    body: {
      strategicInsight: {
        strategicVerdict:
          "Adopt this to retire manual CSV reconciliation before the renewal crunch hits finance.",
        keyTension: {
          tension:
            "Buyers want a single source of truth yet refuse to abandon the spreadsheets they trust.",
          side:
            "Win by making spreadsheet-native onboarding the wedge rather than forcing migration first.",
          costOfPosition:
            "Going spreadsheet-native delays enterprise governance features by roughly two quarters.",
        },
      },
      icpExistenceCheck: {
        prose: "Three firmographic cuts ground the ICP.",
        firmographicCuts: [
          {
            cutType: "industry",
            value: "B2B SaaS",
            source: "G2",
            sourceUrl: "https://www.g2.com/categories/x",
            dateObserved: "2026-01",
          },
          {
            cutType: "employeeBands",
            value: "50-1,000 employees",
            source: "Crunchbase",
            sourceUrl: "https://www.crunchbase.com/org/x",
            dateObserved: "2026-01",
          },
          {
            cutType: "revenueBands",
            value: "$10M-$100M ARR",
            source: "PitchBook",
            sourceUrl: "https://pitchbook.com/profiles/x",
            dateObserved: "2026-01",
          },
        ],
      },
      personaReality: {
        prose: "Three named buyers ground the persona picture.",
        personas: [
          {
            name: "Sarah Chen",
            title: "VP RevOps",
            company: "Acme",
            sourceUrl: "https://www.g2.com/users/sarah-chen",
            role: "economic-buyer",
            seniority: "VP",
            evidence: "Reviewer on G2 discussing reconciliation pain.",
          },
          {
            name: "Marcus Webb",
            title: "RevOps Manager",
            company: "Globex",
            sourceUrl: "https://www.g2.com/users/marcus-webb",
            role: "champion",
            seniority: "Manager",
            evidence: "Case-study buyer quoted on vendor site.",
          },
          {
            name: "Priya Nair",
            title: "Sales Ops Lead",
            company: "Initech",
            sourceUrl: "https://www.capterra.com/reviewers/priya-nair",
            role: "end-user",
            seniority: "Lead",
            evidence: "Capterra reviewer describing workflow.",
          },
        ],
      },
      awarenessDistribution: {
        prose: "Awareness skews problem-aware.",
        levels: [
          {
            level: "problem-aware",
            share: "55%",
            evidence: "G2 review themes",
            sampleQuery: "how to reconcile csv at renewal",
          },
          {
            level: "solution-aware",
            share: "30%",
            evidence: "Comparison searches",
            sampleQuery: "x vs y reconciliation tool",
          },
        ],
      },
      buyingContext: {
        prose: "Three triggers drive evaluation.",
        triggers: [
          {
            name: "Renewal season",
            detectionSignal: "Spike in finance hiring",
            window: "quarters",
            evidence: "G2 seasonal review volume",
          },
          {
            name: "Failed audit",
            detectionSignal: "SOC2 prep",
            window: "weeks",
            evidence: "Forum threads on audit prep",
          },
          {
            name: "New RevOps hire",
            detectionSignal: "Job postings",
            window: "immediate",
            evidence: "LinkedIn job posting trend",
          },
        ],
      },
      clusters: {
        prose: "Buyers cluster in RevOps communities.",
        venues: [
          {
            bucketType: "community",
            name: "RevOps Co-op",
            sourceUrl: "https://www.revopscoop.com",
            whyItMatters: "Where mid-market RevOps leaders ask tool questions.",
          },
        ],
      },
    },
  };
}

function bodyOf(output: unknown): Record<string, unknown> {
  return (output as { body: Record<string, unknown> }).body;
}

function asBuyerICPArtifact(output: unknown): Record<string, unknown> {
  const record = output as Record<string, unknown>;
  return {
    id: "t",
    runId: "t",
    sectionId: "positioningBuyerICP",
    sectionTitle: "Buyer ICP",
    verdict: record.verdict,
    statusSummary: record.statusSummary,
    confidence: typeof record.confidence === "number" ? record.confidence : 0.5,
    sources: [
      {
        id: "s",
        title: "S",
        url: "https://example.com",
        observedAt: "2020-01-01T00:00:00.000Z",
      },
    ],
    body: record.body,
    createdAt: "2020-01-01T00:00:00.000Z",
  };
}

describe("withNormalizedBuyerICPOutput escapable-floor tolerant-out", (): void => {
  it("commits a valid body unchanged (no spurious labels or gaps)", (): void => {
    const result = withNormalizedBuyerICPOutput(completeBuyerICPOutput());
    const body = bodyOf(result);
    const awareness = body.awarenessDistribution as {
      levels: Record<string, unknown>[];
    };
    expect(
      awareness.levels.every(
        (level) => !String(level.share).includes(modelEstimateLabel),
      ),
    ).toBe(true);
    expect((body.icpExistenceCheck as Record<string, unknown>).blockGap).toBeUndefined();
    expect(validateBuyerICPMinimums(asBuyerICPArtifact(result) as never).ok).toBe(
      true,
    );
  });

  it("labels an unbased awareness share as a model estimate instead of hard-erroring", (): void => {
    const input = completeBuyerICPOutput();
    (bodyOf(input).awarenessDistribution as Record<string, unknown>).levels = [
      { level: "problem-aware", share: "55%", evidence: "Common among teams" },
      {
        level: "solution-aware",
        share: "30%",
        evidence: "Comparison searches",
        sampleQuery: "x vs y reconciliation tool",
      },
    ];
    const result = withNormalizedBuyerICPOutput(input);
    const levels = (bodyOf(result).awarenessDistribution as {
      levels: Record<string, unknown>[];
    }).levels;
    expect(String(levels[0].share)).toContain(modelEstimateLabel);
    expect(validateBuyerICPMinimums(asBuyerICPArtifact(result) as never).ok).toBe(
      true,
    );
  });

  it("converts a restatement keyTension.side into an honest evidence gap", (): void => {
    const input = completeBuyerICPOutput();
    (
      (bodyOf(input).strategicInsight as Record<string, unknown>)
        .keyTension as Record<string, unknown>
    ).side = "Too vague.";
    const result = withNormalizedBuyerICPOutput(input);
    const side = (
      (bodyOf(result).strategicInsight as Record<string, unknown>)
        .keyTension as Record<string, unknown>
    ).side as string;
    expect(side.startsWith("evidence gap:")).toBe(true);
    expect(validateBuyerICPMinimums(asBuyerICPArtifact(result) as never).ok).toBe(
      true,
    );
  });

  it("injects an honest blockGap when firmographic cuts fall below the floor", (): void => {
    const input = completeBuyerICPOutput();
    const icp = bodyOf(input).icpExistenceCheck as Record<string, unknown>;
    icp.firmographicCuts = (icp.firmographicCuts as unknown[]).slice(0, 2);
    const result = withNormalizedBuyerICPOutput(input);
    expect(
      (bodyOf(result).icpExistenceCheck as Record<string, unknown>).blockGap,
    ).toBeDefined();
    expect(validateBuyerICPMinimums(asBuyerICPArtifact(result) as never).ok).toBe(
      true,
    );
  });

  it("drops a firmographic cut with a non-http sourceUrl and commits degraded via blockGap (Fix 5: per-row bad-URL drop)", (): void => {
    const input = completeBuyerICPOutput();
    const icp = bodyOf(input).icpExistenceCheck as Record<string, unknown>;
    const cuts = icp.firmographicCuts as Record<string, unknown>[];
    // Corrupt one cut's sourceUrl — the per-row floor has no blockGap escape and
    // would hard-error the section; the row must be dropped honestly instead.
    cuts[0].sourceUrl = "not-a-url";
    const result = withNormalizedBuyerICPOutput(input);
    const resultCuts = (bodyOf(result).icpExistenceCheck as Record<string, unknown>)
      .firmographicCuts as Record<string, unknown>[];
    expect(resultCuts).toHaveLength(2);
    expect(
      resultCuts.every((cut) =>
        /^https?:\/\//i.test(cut.sourceUrl as string),
      ),
    ).toBe(true);
    expect(
      (bodyOf(result).icpExistenceCheck as Record<string, unknown>).blockGap,
    ).toBeDefined();
    expect(validateBuyerICPMinimums(asBuyerICPArtifact(result) as never).ok).toBe(
      true,
    );
  });

  it("drops a persona with a non-http sourceUrl and commits degraded (Fix 5)", (): void => {
    const input = completeBuyerICPOutput();
    const personaReality = bodyOf(input).personaReality as Record<string, unknown>;
    const personas = personaReality.personas as Record<string, unknown>[];
    personas[0].sourceUrl = "ftp://bad/path";
    const result = withNormalizedBuyerICPOutput(input, {
      subjectWebsiteUrl: "https://subject.example",
    });
    const resultPersonas = (
      bodyOf(result).personaReality as Record<string, unknown>
    ).personas as Record<string, unknown>[];
    expect(resultPersonas).toHaveLength(2);
    expect(
      resultPersonas.every((persona) =>
        /^https?:\/\//i.test(persona.sourceUrl as string),
      ),
    ).toBe(true);
    expect(validateBuyerICPMinimums(asBuyerICPArtifact(result) as never).ok).toBe(
      true,
    );
  });

  it("commits degraded when sparse live output has several simultaneous floor gaps", (): void => {
    const input = completeBuyerICPOutput();
    const body = bodyOf(input);
    const icpExistenceCheck = body.icpExistenceCheck as Record<string, unknown>;
    const personaReality = body.personaReality as Record<string, unknown>;
    const buyingContext = body.buyingContext as Record<string, unknown>;

    icpExistenceCheck.firmographicCuts = (
      icpExistenceCheck.firmographicCuts as Record<string, unknown>[]
    ).slice(0, 2);
    personaReality.personas = (
      personaReality.personas as Record<string, unknown>[]
    ).slice(0, 2);
    buyingContext.triggers = (
      buyingContext.triggers as Record<string, unknown>[]
    ).slice(0, 1);

    const result = withNormalizedBuyerICPOutput(input, {
      subjectWebsiteUrl: "https://airtable.com",
    });
    const resultBody = bodyOf(result);

    expect(resultBody.evidenceGap).toBe(true);
    expect(
      (resultBody.icpExistenceCheck as Record<string, unknown>).blockGap,
    ).toBeDefined();
    expect((resultBody.personaReality as Record<string, unknown>).blockGap).toBeUndefined();
    expect((resultBody.buyingContext as Record<string, unknown>).blockGap).toBeDefined();
    expect(validateBuyerICPMinimums(asBuyerICPArtifact(result) as never)).toMatchObject({
      ok: true,
      errors: [],
    });
  });

  it("drops a cluster venue with a non-http sourceUrl and commits degraded via blockGap (Fix 5)", (): void => {
    const input = completeBuyerICPOutput();
    const clusters = bodyOf(input).clusters as Record<string, unknown>;
    const venues = clusters.venues as Record<string, unknown>[];
    venues[0].sourceUrl = "javascript:void(0)";
    const result = withNormalizedBuyerICPOutput(input);
    const resultVenues = (bodyOf(result).clusters as Record<string, unknown>)
      .venues as Record<string, unknown>[];
    expect(resultVenues).toHaveLength(0);
    expect(
      (bodyOf(result).clusters as Record<string, unknown>).blockGap,
    ).toBeDefined();
    expect(validateBuyerICPMinimums(asBuyerICPArtifact(result) as never).ok).toBe(
      true,
    );
  });
});
