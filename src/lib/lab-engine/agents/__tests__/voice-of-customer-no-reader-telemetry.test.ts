import { describe, expect, it } from "vitest";

import {
  buildVoiceOfCustomerEvidenceGapBody,
  formatVoiceOfCustomerCandidateGapIssue,
  type RunSectionInput,
} from "../run-section";
import type { VoiceOfCustomerGap } from "../voice-of-customer-candidates";

const TELEMETRY = [
  /\b(runId|sectionId|subjectDomain|candidateCount|painQuoteCount|successQuoteCount|promotedContentCount)=/i,
  /\breason=[a-z_]+/i,
  /\w+=[^ ;]+;/,
];

function getRecordField(
  record: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  const value = record[key];

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Expected ${key} to be a record.`);
  }

  return value as Record<string, unknown>;
}

function getStringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  if (typeof value !== "string") {
    throw new Error(`Expected ${key} to be a string.`);
  }

  return value;
}

function collectReaderFields(body: Record<string, unknown>): string[] {
  const painLanguage = getRecordField(body, "painLanguage");
  const painLanguageBlockGap = getRecordField(painLanguage, "blockGap");
  const evidenceGapReport = getRecordField(body, "evidenceGapReport");
  const secondaryBlockNames = [
    "objections",
    "switchingStories",
    "decisionCriteria",
    "successLanguage",
  ];

  return [
    getStringField(body, "retrievalSummary"),
    getStringField(evidenceGapReport, "summary"),
    getStringField(painLanguage, "prose"),
    getStringField(painLanguageBlockGap, "summary"),
    ...secondaryBlockNames.flatMap((blockName) => {
      const block = getRecordField(body, blockName);
      const blockGap = getRecordField(block, "blockGap");

      return [
        getStringField(block, "prose"),
        getStringField(blockGap, "summary"),
      ];
    }),
  ];
}

function expectNoReaderTelemetry(body: Record<string, unknown>): void {
  const readerFields = collectReaderFields(body);

  for (const field of readerFields) {
    expect(field.startsWith("Not enough public evidence:")).toBe(false);

    for (const telemetry of TELEMETRY) {
      expect(field).not.toMatch(telemetry);
    }
  }

  expect(getStringField(body, "retrievalSummary")).toContain("Observed domains");
}

describe("Voice of Customer evidence-gap reader telemetry", (): void => {
  const input: RunSectionInput = {
    runId: "run-voc-reader-telemetry",
    sectionId: "positioningVoiceOfCustomer",
  };
  const gap: VoiceOfCustomerGap = {
    reason: "insufficient_independent_domains",
    message:
      "Only one independent customer-review domain produced usable pain-language evidence.",
    domains: ["g2.com"],
    candidateCount: 2,
  };
  const facts = {
    ok: true,
    foundPainQuoteCount: 2,
    foundDistinctPainSourceCount: 1,
    observedPainSourceDomains: ["g2.com"],
  } satisfies Parameters<typeof buildVoiceOfCustomerEvidenceGapBody>[0]["facts"];

  it("strips internal telemetry from every reader-facing VoC gap field", (): void => {
    const producerIssue = formatVoiceOfCustomerCandidateGapIssue({
      gap,
      input,
      subjectDomain: "acme.com",
    });
    const literalTelemetryIssue = [
      "Only one independent review domain produced usable pain-language evidence.",
      "reason=insufficient_independent_domains;",
      "runId=run-voc-reader-telemetry;",
      "sectionId=positioningVoiceOfCustomer;",
      "subjectDomain=acme.com;",
      "candidateCount=2;",
      "observedDomains=g2.com;",
    ].join(" ");

    for (const issue of [producerIssue, literalTelemetryIssue]) {
      const body = buildVoiceOfCustomerEvidenceGapBody({
        facts,
        issue,
        quoteCandidates: [],
        acquisitionAttempts: undefined,
        acquisitionLedger: undefined,
        subjectDomain: "acme.com",
      });

      expectNoReaderTelemetry(body);
    }
  });
});
