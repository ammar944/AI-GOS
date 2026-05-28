/// <reference types="vite/client" />

import { describe, expect, it } from "vitest";

import { checkRequiredEvidenceClasses } from "../../../sections/required-evidence";
import { structuralVerifier } from "../structural-verifier";
import type { RequiredEvidenceClass } from "../../../sections/required-evidence";
import type { SectionId } from "../../../events/activity-event";

interface VerifierFixture {
  name: string;
  sectionId: SectionId;
  requiredEvidenceClasses: RequiredEvidenceClass[];
  body: Record<string, unknown>;
  toolResults: Array<{
    toolName: string;
    input?: unknown;
    output: unknown;
  }>;
  corpusExcerpts: Array<{
    text: string;
    sourceUrl: string;
  }>;
  expected_verdict: {
    verifiedCount: number;
    unsupportedCount: number;
    requiredClassesSatisfied: boolean;
  };
}

const fixtureModules = import.meta.glob<VerifierFixture>("./fixtures/*.json", {
  eager: true,
  import: "default",
});

const fixtures: VerifierFixture[] = Object.values(fixtureModules);

describe("structural verifier fixture eval gate", (): void => {
  it("loads the deterministic fixture set", (): void => {
    expect(fixtures).toHaveLength(15);
  });

  it.each(fixtures)("$name", (fixture): void => {
    const report = structuralVerifier({
      body: fixture.body,
      toolResults: fixture.toolResults,
      corpusExcerpts: fixture.corpusExcerpts,
    });
    const missingClass = checkRequiredEvidenceClasses({
      body: fixture.body,
      requiredEvidenceClasses: fixture.requiredEvidenceClasses,
      sectionId: fixture.sectionId,
    });

    expect(report.verifiedCount).toBe(fixture.expected_verdict.verifiedCount);
    expect(report.unsupportedCount).toBe(
      fixture.expected_verdict.unsupportedCount,
    );
    expect(missingClass === null).toBe(
      fixture.expected_verdict.requiredClassesSatisfied,
    );
  });
});
