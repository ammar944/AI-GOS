import { describe, expect, it } from "vitest";

import { isValidGroundedBuyerUnit } from "../grounded-buyer-unit";

const liveText =
  "Mid-market SaaS finance teams of 200-1000 employees rely on Ramp. " +
  "Their VP of Finance owns the spend decision.";

describe("isValidGroundedBuyerUnit", (): void => {
  it("TEST 1: keeps a role/segment unit with NO name when its segment label is contained on the live page", (): void => {
    const unit = {
      // No human name — the grounding is the role + segment.
      name: "VP of Finance",
      title: "VP of Finance",
      role: "economic-buyer",
      seniority: "vp",
      company: "Acme",
      segmentLabel: "Mid-market SaaS finance teams of 200-1000 employees",
      sourceUrl: "https://example.com/customers/acme",
      confidence: 0.6,
    };

    expect(
      isValidGroundedBuyerUnit(unit, { sourceText: liveText }),
    ).toBe(true);
  });

  it("TEST 3: rejects a unit whose segmentLabel is NOT contained on the live page", (): void => {
    const unit = {
      name: "VP of Finance",
      title: "VP of Finance",
      role: "economic-buyer",
      seniority: "vp",
      company: "Acme",
      // Fabricated segment — never appears on the page.
      segmentLabel: "Quantum logistics directors at deep-sea mining startups",
      sourceUrl: "https://example.com/customers/acme",
      confidence: 0.6,
    };

    expect(
      isValidGroundedBuyerUnit(unit, { sourceText: liveText }),
    ).toBe(false);
  });

  it("rejects a unit with zero confidence even when grounded", (): void => {
    const unit = {
      name: "VP of Finance",
      role: "economic-buyer",
      seniority: "vp",
      company: "Acme",
      segmentLabel: "Mid-market SaaS finance teams of 200-1000 employees",
      sourceUrl: "https://example.com/customers/acme",
      confidence: 0,
    };

    expect(
      isValidGroundedBuyerUnit(unit, { sourceText: liveText }),
    ).toBe(false);
  });

  it("rejects a unit with no live HTTP source URL", (): void => {
    const unit = {
      name: "VP of Finance",
      role: "economic-buyer",
      segmentLabel: "Mid-market SaaS finance teams of 200-1000 employees",
      sourceUrl: "not-a-url",
      confidence: 0.6,
    };

    expect(
      isValidGroundedBuyerUnit(unit, { sourceText: liveText }),
    ).toBe(false);
  });

  it("TEST 4: keeps a named human unit (named-champion path) even with no segment label", (): void => {
    const unit = {
      name: "Bill Cox",
      title: "VP of Finance",
      role: "champion",
      seniority: "vp",
      company: "WizeHire",
      sourceUrl: "https://ramp.com/customers/wizehire",
      confidence: 0.7,
    };

    expect(isValidGroundedBuyerUnit(unit)).toBe(true);
  });

  it("TEST 4: rejects a unit that is neither a named human NOR a grounded segment", (): void => {
    // Junk name, no segmentLabel, live URL: the role enum alone is NOT grounding.
    const unit = {
      name: "Economic buyer",
      role: "economic-buyer",
      seniority: "vp",
      title: "Revenue Operator",
      company: "Acme",
      sourceUrl: "https://example.com/customers/acme",
      confidence: 0.6,
    };

    expect(isValidGroundedBuyerUnit(unit)).toBe(false);
  });

  it("without sourceText, a grounded segment label still counts (gate-site path)", (): void => {
    // At the downstream gate sites, source-liveness has ALREADY strict-contained
    // the segmentLabel and dropped non-contained rows; the validator only checks
    // the unit shape (live URL + grounded claim).
    const unit = {
      name: "VP of Finance",
      role: "economic-buyer",
      seniority: "vp",
      company: "Acme",
      segmentLabel: "Mid-market SaaS finance teams of 200-1000 employees",
      sourceUrl: "https://example.com/customers/acme",
      confidence: 0.6,
    };

    expect(isValidGroundedBuyerUnit(unit)).toBe(true);
  });
});
