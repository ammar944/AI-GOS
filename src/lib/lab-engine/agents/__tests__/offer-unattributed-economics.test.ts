import { describe, expect, it } from "vitest";

import { collectBriefMoneyDigits } from "@/lib/lab-engine/agents/verification/evidence-support";
import { stripUnattributedOperatorEconomics } from "../run-section";

// R-E: the offer body asserted a fabricated CAC ("$4,200 CAC exceeds the $3,000
// target by 40%") as fact, laundered as "operator-reported / client brief". Only
// $3,000 (the target) is a real operator-brief input; $4,200 and the derived 40%
// overshoot are invented. Only brief-sourced operator economics may appear as a
// stated figure — an unattributed CAC/LTV money figure is relabeled honestly,
// never asserted as a real number.

// The Ramp brief operator economics: a $3,000 CAC target, a $25K/month budget,
// and an $18,000 LTV. No actual CAC was disclosed.
const briefMoneyDigits = collectBriefMoneyDigits({
  targetCac: "$3,000",
  monthlyBudget: "$25,000",
  ltv: "$18,000",
});

describe("stripUnattributedOperatorEconomics", () => {
  it("relabels a fabricated CAC figure not present in the brief economics", () => {
    const body = {
      sectionTitle: "Offer & Performance Diagnostic",
      summary:
        "Absence of transparent pricing inflates CAC to $4,200 against a $3,000 target (client brief) — a 40% overshoot consistent with price-sensitive prospects abandoning.",
      funnelDiagnosis: {
        prose:
          "The binding funnel break occurs between consideration and trial — consistent with the operator-reported 40% CAC overshoot ($4,200 vs. $3,000 target).",
        breaks: [
          {
            stageName: "Consideration → Trial",
            metric: "Conversion rate",
            magnitude:
              "Operator-reported CAC of $4,200 vs. $3,000 target — 40% overshoot consistent with leak at this stage",
            hypothesis: "Opaque pricing forces a demo-gated path",
            sourceUrl: "https://slash.com",
          },
        ],
      },
    };

    const result = stripUnattributedOperatorEconomics({
      body,
      briefMoneyDigits,
    });

    const serialized = JSON.stringify(result.body);

    // The fabricated CAC figure is gone everywhere it was asserted.
    expect(serialized).not.toContain("$4,200");
    // The derived overshoot percent is gone with it (it was computed from the
    // invented figure).
    expect(serialized).not.toContain("40%");
    // The real operator-brief target survives — it is a genuine brief input.
    expect(serialized).toContain("$3,000");
    // At least one fabricated figure was struck.
    expect(result.stripped.length).toBeGreaterThan(0);
  });

  it("leaves the body untouched when every money figure is brief-sourced", () => {
    const body = {
      summary:
        "The $3,000 CAC target on a $25,000 monthly budget is the operator's stated economics.",
    };

    const result = stripUnattributedOperatorEconomics({
      body,
      briefMoneyDigits,
    });

    expect(result.body).toBe(body);
    expect(result.stripped).toHaveLength(0);
    expect(JSON.stringify(result.body)).toContain("$3,000");
    expect(JSON.stringify(result.body)).toContain("$25,000");
  });

  it("does not strip a sourced non-economics money figure (valuation) lacking a CAC/LTV cue", () => {
    const body = {
      offerMarketFit: {
        prose:
          "Ramp has genuine product-market fit: 70,000+ customers and a $13B valuation.",
      },
    };

    const result = stripUnattributedOperatorEconomics({
      body,
      briefMoneyDigits,
    });

    // $13B is not a CAC/LTV claim — it must not be touched by this gate.
    expect(JSON.stringify(result.body)).toContain("$13B");
    expect(result.stripped).toHaveLength(0);
  });
});
