import { describe, expect, it } from "vitest";

import {
  buildOutputFromStructuredBody,
  getRuntimeSectionDefinition,
  withBuyerICPCommitFloorRepair,
  withNormalizedBuyerICPOutput,
} from "../run-section";
import {
  modelEstimateLabel,
  validateBuyerICPMinimums,
} from "../../artifacts/schemas/buyer-icp";
import { buyerICPFixtureArtifact } from "../../fixtures/buyer-icp-artifact";

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

describe("withNormalizedBuyerICPOutput shared-listing-url laundering gate", (): void => {
  function namedPersona(
    name: string,
    company: string,
    sourceUrl: string,
  ): Record<string, unknown> {
    return {
      name,
      company,
      role: "champion",
      seniority: "vp",
      title: "VP of Finance",
      sourceUrl,
    };
  }

  it("suppresses personas that share one aggregate review-listing URL (laundering)", (): void => {
    const launderedUrl = "https://g2.com/products/anura/reviews";
    const output = withNormalizedBuyerICPOutput(
      buyerOutput([
        namedPersona("Brian Robbins", "Customer.io", launderedUrl),
        namedPersona("Jeff Fowle", "Luma", launderedUrl),
        namedPersona("Dana Lee", "Acme Corp", launderedUrl),
      ]),
      { subjectWebsiteUrl, subjectCompanyName: "Anura" },
    );

    // All three cite ONE non-permalink aggregate listing URL → none is
    // individually grounded → all suppressed (the <3 floor then injects a gap).
    expect(personasOf(output)).toHaveLength(0);
  });

  it("keeps personas that each cite a distinct (unshared) review URL", (): void => {
    const output = withNormalizedBuyerICPOutput(
      buyerOutput([
        namedPersona("Maya Lin", "Customer.io", "https://g2.com/products/anura/reviews/maya"),
        namedPersona("Jordan Pike", "Luma", "https://capterra.com/p/anura/jordan"),
        namedPersona("Sasha Ito", "Acme Corp", "https://trustradius.com/anura/sasha"),
      ]),
      { subjectWebsiteUrl, subjectCompanyName: "Anura" },
    );

    expect(personasOf(output)).toHaveLength(3);
  });

  it("keeps case-study champions that share a customer-story page they were mined from", (): void => {
    const storyUrl = "https://anura.io/customers/brightpath";
    const output = withNormalizedBuyerICPOutput(
      buyerOutput([
        namedPersona("Bill Cox", "New Way Landscape", storyUrl),
        namedPersona("Lauren Feeney", "Perplexity", storyUrl),
      ]),
      {
        subjectWebsiteUrl,
        subjectCompanyName: "Anura",
        caseStudyCandidates: [
          {
            name: "Bill Cox",
            company: "New Way Landscape",
            title: "VP of Finance",
            url: storyUrl,
            venue: "case_study_champions",
          },
          {
            name: "Lauren Feeney",
            company: "Perplexity",
            title: "Controller",
            url: storyUrl,
            venue: "case_study_champions",
          },
        ],
      },
    );

    // Both names were mined from that exact page → individually grounded → kept.
    expect(personasOf(output)).toHaveLength(2);
  });
});

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

describe("withNormalizedBuyerICPOutput role/segment-grounded personas (Option B)", (): void => {
  // Three distinct buyer units with NO human name — each grounded by a sourced
  // ROLE + segmentLabel on a distinct live source URL. Today these are dropped
  // (countValidatorGradePersonas demands a named human), shipping an empty
  // section. Under Option B they are valid grounded buyer units and must survive
  // to the committed output with no injected evidence gap.
  const threeRoleSegmentPersonas = [
    {
      name: "VP of Finance",
      title: "VP of Finance",
      company: "WizeHire",
      role: "economic-buyer",
      seniority: "vp",
      segmentLabel: "Finance leaders at mid-market SaaS, 200-1000 employees",
      evidence: "Customer story names the finance buyer and segment.",
      sourceUrl: "https://ramp.com/customers/wizehire",
    },
    {
      name: "Controller",
      title: "Controller",
      company: "Quora",
      role: "decision-maker",
      seniority: "director",
      segmentLabel: "Controllers at 500-1000 employee technology companies",
      evidence: "Case study names the controller role and segment.",
      sourceUrl: "https://ramp.com/customers/quora",
    },
    {
      name: "Head of Accounting",
      title: "Head of Accounting",
      company: "Glossier",
      role: "champion",
      seniority: "head",
      segmentLabel: "Accounting leaders at high-growth consumer brands",
      evidence: "Customer page names the accounting champion and segment.",
      sourceUrl: "https://ramp.com/customers/glossier",
    },
  ];

  it("TEST 2: keeps >=3 role/segment-grounded units and injects no gap", (): void => {
    const output = withNormalizedBuyerICPOutput(
      buyerOutput(threeRoleSegmentPersonas),
      { subjectWebsiteUrl: "https://ramp.com", subjectCompanyName: "Ramp" },
    ) as { body: Record<string, unknown> };

    expect(personasOf(output)).toHaveLength(3);
    expect(output.body.evidenceGap).toBeUndefined();
    expect(output.body.evidenceGapReport).toBeUndefined();
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

describe("withNormalizedBuyerICPOutput case-study sourceUrl backfill", (): void => {
  const caseStudyCandidates = [
    {
      name: "Lauren Feeney",
      title: "Controller",
      company: "Perplexity",
      url: "https://next.ramp.com/customers/perplexity",
      venue: "case_study_champions" as const,
    },
    {
      name: "Bill Cox",
      title: "VP of Finance",
      company: "New Way Landscape",
      url: "https://ramp.com/customers/new-way-landscape",
      venue: "case_study_champions" as const,
    },
  ];
  const opts = {
    subjectWebsiteUrl: "https://ramp.com",
    subjectCompanyName: "Ramp",
    caseStudyCandidates,
  };

  it("overrides a persona's non-containing URL with the mined case-study page that names them", (): void => {
    const personas = personasOf(
      withNormalizedBuyerICPOutput(
        buyerOutput([
          {
            name: "Lauren Feeney",
            company: "Perplexity",
            // The model cited a JS-rendered profile the containment gate strips;
            // the mined page is where the name+employer were actually scraped.
            sourceUrl: "https://www.linkedin.com/in/lauren-feeney",
          },
        ]),
        opts,
      ),
    );
    // The authored persona's bad URL is relocated to her mined case-study page.
    const lauren = personas.find((p) => p.name === "Lauren Feeney");
    expect(lauren?.sourceUrl).toBe("https://next.ramp.com/customers/perplexity");
    // The other mined champion the model omitted is also backfilled.
    expect(personas.some((p) => p.name === "Bill Cox")).toBe(true);
  });

  it("rescues a matching persona the model left without a sourceUrl (would otherwise be dropped)", (): void => {
    const personas = personasOf(
      withNormalizedBuyerICPOutput(
        buyerOutput([
          { name: "Bill Cox", company: "New Way Landscape", sourceUrl: "" },
        ]),
        opts,
      ),
    );
    // The authored persona's empty URL is rescued to his mined case-study page.
    const billCox = personas.find((p) => p.name === "Bill Cox");
    expect(billCox?.sourceUrl).toBe(
      "https://ramp.com/customers/new-way-landscape",
    );
    // The other mined champion the model omitted is also backfilled.
    expect(personas.some((p) => p.name === "Lauren Feeney")).toBe(true);
  });

  it("never attaches a candidate URL to a persona that does not match a mined lead", (): void => {
    const personas = personasOf(
      withNormalizedBuyerICPOutput(
        buyerOutput([
          {
            name: "Jane Doe",
            company: "Acme Corp",
            sourceUrl: "https://g2.com/products/x/reviews",
          },
        ]),
        opts,
      ),
    );
    expect(personas[0]?.sourceUrl).toBe("https://g2.com/products/x/reviews");
  });

  it("does not cross-attach when the name matches but the company clearly differs", (): void => {
    const personas = personasOf(
      withNormalizedBuyerICPOutput(
        buyerOutput([
          {
            name: "Bill Cox",
            company: "Unrelated Industries",
            sourceUrl: "https://g2.com/products/x/reviews",
          },
        ]),
        opts,
      ),
    );
    expect(personas[0]?.sourceUrl).toBe("https://g2.com/products/x/reviews");
  });
});

describe("withNormalizedBuyerICPOutput mined case-study champion backfill", (): void => {
  // The three real named champions the prepass mined on run jsl0fh. The model
  // committed personaReality.personas:[] (authored an ungrounded persona instead
  // of these), so they were dropped → <3 → evidence gap → empty section. The
  // finalizer must append the mined champions the model omitted, not only
  // relocate URLs for ones it authored.
  const minedChampions = [
    {
      name: "Bill Cox",
      title: "VP of Finance",
      company: "New Way Landscape",
      url: "https://ramp.com/customers/new-way-landscape",
      venue: "case_study_champions" as const,
    },
    {
      name: "Lauren Feeney",
      title: "Controller",
      company: "Perplexity",
      url: "https://next.ramp.com/customers/perplexity",
      venue: "case_study_champions" as const,
    },
    {
      name: "Alicia Coleman",
      title: "Marketing Operations Manager",
      company: "WizeHire",
      url: "https://ramp.com/customers/wizehire",
      venue: "case_study_champions" as const,
    },
  ];
  const opts = {
    subjectWebsiteUrl: "https://ramp.com",
    subjectCompanyName: "Ramp",
    caseStudyCandidates: minedChampions,
  };

  it("appends the mined champions when the model committed an empty persona block", (): void => {
    const output = withNormalizedBuyerICPOutput(buyerOutput([]), opts);
    const personas = personasOf(output);
    const names = personas.map((p) => p.name);
    expect(personas.length).toBeGreaterThanOrEqual(3);
    expect(names).toContain("Bill Cox");
    expect(names).toContain("Lauren Feeney");
    expect(names).toContain("Alicia Coleman");
    // >=3 grounded named champions clear the floor → no persona evidence gap.
    expect((output as { body: Record<string, unknown> }).body.evidenceGap).not.toBe(true);
  });

  it("appends mined champions the model omitted even when it authored an ungrounded persona", (): void => {
    const output = withNormalizedBuyerICPOutput(
      buyerOutput([
        // The model invented "Sarah Bird" with no live source URL — it is dropped
        // by the unsourced-row guard; the 3 mined champions must still be added.
        { name: "Sarah Bird", company: "Acme", sourceUrl: "" },
      ]),
      opts,
    );
    const personas = personasOf(output);
    const names = personas.map((p) => p.name);
    expect(personas.length).toBeGreaterThanOrEqual(3);
    expect(names).toContain("Bill Cox");
    expect(names).toContain("Lauren Feeney");
    expect(names).toContain("Alicia Coleman");
    expect((output as { body: Record<string, unknown> }).body.evidenceGap).not.toBe(true);
  });

  it("does not duplicate a mined champion the model already authored (name-key dedup)", (): void => {
    const output = withNormalizedBuyerICPOutput(
      buyerOutput([
        {
          name: "Bill Cox",
          company: "New Way Landscape",
          role: "champion",
          seniority: "vp",
          title: "VP of Finance",
          sourceUrl: "https://ramp.com/customers/new-way-landscape",
        },
        {
          name: "Lauren Feeney",
          company: "Perplexity",
          role: "champion",
          seniority: "director",
          title: "Controller",
          sourceUrl: "https://next.ramp.com/customers/perplexity",
        },
        {
          name: "Alicia Coleman",
          company: "WizeHire",
          role: "champion",
          seniority: "manager",
          title: "Marketing Operations Manager",
          sourceUrl: "https://ramp.com/customers/wizehire",
        },
      ]),
      opts,
    );
    const personas = personasOf(output);
    const billCoxCount = personas.filter((p) => p.name === "Bill Cox").length;
    expect(billCoxCount).toBe(1);
    expect(personas).toHaveLength(3);
  });
});

describe("withNormalizedBuyerICPOutput in-row sourceUrl backfill", (): void => {
  it("lifts a firmographic cut's URL from its source field when sourceUrl is empty (ground-don't-drop)", (): void => {
    const input = completeBuyerICPOutput();
    const icp = bodyOf(input).icpExistenceCheck as Record<string, unknown>;
    const cuts = icp.firmographicCuts as Record<string, unknown>[];
    cuts[0].sourceUrl = "";
    cuts[0].source =
      "Ramp customer story — see https://ramp.com/customers/new-way-landscape.";

    const result = withNormalizedBuyerICPOutput(input);
    const resultCuts = (
      bodyOf(result).icpExistenceCheck as Record<string, unknown>
    ).firmographicCuts as Record<string, unknown>[];

    expect(resultCuts).toHaveLength(3);
    const industryCut = resultCuts.find((cut) => cut.cutType === "industry");
    expect(industryCut?.sourceUrl).toBe(
      "https://ramp.com/customers/new-way-landscape",
    );
    expect(
      validateBuyerICPMinimums(asBuyerICPArtifact(result) as never).ok,
    ).toBe(true);
  });

  it("still drops a cut with no URL anywhere in its fields (honest gap, never fabrication)", (): void => {
    const input = completeBuyerICPOutput();
    const icp = bodyOf(input).icpExistenceCheck as Record<string, unknown>;
    const cuts = icp.firmographicCuts as Record<string, unknown>[];
    cuts[0].sourceUrl = "";
    cuts[0].source = "internal hypothesis, no public source";

    const result = withNormalizedBuyerICPOutput(input);
    const resultCuts = (
      bodyOf(result).icpExistenceCheck as Record<string, unknown>
    ).firmographicCuts as Record<string, unknown>[];

    expect(resultCuts).toHaveLength(2);
  });
});

describe("withBuyerICPCommitFloorRepair persistence guard", (): void => {
  it("re-injects an honest trigger blockGap when a downstream step thinned the block below floor", (): void => {
    // Reproduces the live failure: after the body builder's floor repair runs,
    // the source-liveness gate drops a URL-bearing trigger (3 -> 2) leaving no
    // blockGap, and persistence hard-fails on the >=3 floor.
    const input = completeBuyerICPOutput();
    const bc = bodyOf(input).buyingContext as Record<string, unknown>;
    bc.triggers = (bc.triggers as unknown[]).slice(0, 2);
    delete bc.blockGap;
    const artifact = asBuyerICPArtifact(input);
    expect(validateBuyerICPMinimums(artifact as never).ok).toBe(false);

    const repaired = withBuyerICPCommitFloorRepair(artifact as never);

    expect(
      (bodyOf(repaired).buyingContext as Record<string, unknown>).blockGap,
    ).toBeDefined();
    expect(validateBuyerICPMinimums(repaired as never).ok).toBe(true);
  });

  it("is a no-op for a body that already satisfies its floors", (): void => {
    const artifact = asBuyerICPArtifact(completeBuyerICPOutput());
    const repaired = withBuyerICPCommitFloorRepair(artifact as never);

    expect(
      (bodyOf(repaired).buyingContext as Record<string, unknown>).blockGap,
    ).toBeUndefined();
    expect(validateBuyerICPMinimums(repaired as never).ok).toBe(true);
  });
});

// FIX-BICP Part A: the DEFAULT streaming commit path decodes section output via
// buildOutputFromStructuredBody. That decoder must forward buyerPersonaCandidates
// into the buyerICP normalizer so case-study champions mined from a shared
// customer-story page clear the shared-listing-url laundering gate (the
// answer-tool fallback already threads them). Without the wire, the exemption
// set is empty and co-champions on one story URL are stripped → personas:[].
describe("buildOutputFromStructuredBody buyerICP case-study persona wire", (): void => {
  const subjectWebsiteUrl = "https://ramp.com";
  const storyUrl = "https://ramp.com/customers/brightpath";

  function bodyWithSharedStoryChampions(): Record<string, unknown> {
    const fixtureBody = buyerICPFixtureArtifact.body as Record<string, unknown>;
    const personaReality = fixtureBody.personaReality as Record<string, unknown>;
    return {
      ...fixtureBody,
      personaReality: {
        ...personaReality,
        personas: [
          {
            name: "Bill Cox",
            title: "VP of Finance",
            company: "New Way Landscape",
            sourceUrl: storyUrl,
            role: "champion",
            seniority: "Executive",
            evidence: "Named in the Ramp customer story for New Way Landscape.",
          },
          {
            name: "Lauren Feeney",
            title: "Controller",
            company: "Perplexity",
            sourceUrl: storyUrl,
            role: "decision-maker",
            seniority: "Executive",
            evidence: "Named in the Ramp customer story for Perplexity.",
          },
        ],
      },
    };
  }

  const caseStudyCandidates = [
    {
      name: "Bill Cox",
      company: "New Way Landscape",
      title: "VP of Finance",
      url: storyUrl,
      venue: "case_study_champions" as const,
    },
    {
      name: "Lauren Feeney",
      company: "Perplexity",
      title: "Controller",
      url: storyUrl,
      venue: "case_study_champions" as const,
    },
  ];

  function decodedPersonas(buyerPersonaCandidates?: typeof caseStudyCandidates) {
    const decoded = buildOutputFromStructuredBody({
      body: { body: bodyWithSharedStoryChampions() },
      definition: getRuntimeSectionDefinition("positioningBuyerICP"),
      input: { runId: "run_test", sectionId: "positioningBuyerICP" },
      subjectCompanyName: "Ramp",
      subjectWebsiteUrl,
      buyerPersonaCandidates,
    });
    const output = decoded.output as { body: Record<string, unknown> };
    const personaReality = output.body.personaReality as Record<string, unknown>;
    return personaReality.personas as Record<string, unknown>[];
  }

  it("KEEPS shared-story-url case-study champions when candidates are threaded", (): void => {
    const personas = decodedPersonas(caseStudyCandidates);
    expect(personas).toHaveLength(2);
    expect(personas.map((persona) => persona.name).sort()).toEqual([
      "Bill Cox",
      "Lauren Feeney",
    ]);
  });

  it("strips shared-story-url champions when no candidates flow through (the bug)", (): void => {
    // Control: with NO candidates the laundering gate has an empty exemption
    // set and suppresses both co-champions. Proves the keep above is caused by
    // the threaded candidates, not an unconditional pass-through.
    expect(decodedPersonas(undefined)).toHaveLength(0);
  });
});
