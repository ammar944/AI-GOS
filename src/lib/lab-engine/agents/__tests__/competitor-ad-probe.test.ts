import type { Tool, ToolExecutionOptions } from 'ai';
import { describe, expect, it } from 'vitest';

import { saaslaunchResearchInput } from '@/lib/lab-engine/fixtures/saaslaunch';

import { SectionToolBudget } from '../budget';
import { runCompetitorAdProbeSteps } from '../run-section';

interface AdRow {
  type: 'ad';
  advertiser: string;
  toolName: string;
}

interface GapRow {
  type: 'gap';
  reason: string;
  message: string;
}

// Mirror tool-registry's wrapWithBudget: draw from the shared budget, return the
// same gap-row shape on exhaustion, otherwise emit a real ad row.
function budgetWrappedAdTool(
  toolName: string,
  budget: SectionToolBudget,
  observe: { concurrent: number; maxConcurrent: number },
): Tool {
  return {
    execute: async (
      input: unknown,
      _context: ToolExecutionOptions,
    ): Promise<AdRow | GapRow> => {
      if (!budget.consume(toolName)) {
        return {
          type: 'gap',
          reason: 'rate_limited',
          message: `section budget exhausted after ${budget.max} lookups`,
        };
      }
      observe.concurrent += 1;
      observe.maxConcurrent = Math.max(observe.maxConcurrent, observe.concurrent);
      // Yield so a sibling tool call can overlap (proves google + meta run in
      // parallel within one advertiser).
      await new Promise((resolve) => setTimeout(resolve, 5));
      observe.concurrent -= 1;
      const advertiser = (input as { advertiser: string }).advertiser;
      return { type: 'ad', advertiser, toolName };
    },
  } as unknown as Tool;
}

function isAdRow(value: unknown): value is AdRow {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === 'ad'
  );
}

describe('runCompetitorAdProbeSteps with a reserved ad budget', (): void => {
  it('lands the top advertiser google + meta from the reserve when generic is exhausted', async (): Promise<void> => {
    // genericMax=6 all consumed up front; reserve=2 (one advertiser worth).
    const budget = new SectionToolBudget(6, 2);
    for (let i = 0; i < 6; i += 1) {
      expect(budget.consume('web_search')).toBe(true);
    }

    const observe = { concurrent: 0, maxConcurrent: 0 };
    const researchTools: Record<string, unknown> = {
      google_ads: budgetWrappedAdTool('google_ads', budget, observe),
      meta_ads: budgetWrappedAdTool('meta_ads', budget, observe),
    };

    const steps = await runCompetitorAdProbeSteps({
      maxAdvertisers: 1,
      researchInput: saaslaunchResearchInput,
      researchTools,
    });

    // Bounded to exactly one advertiser.
    expect(steps).toHaveLength(1);

    const [step] = steps;
    const outputs = step.toolResults.map((result) => result.output);
    expect(outputs).toHaveLength(2);
    // BOTH ad tools produced real rows (drawn from the reserve), not gap rows.
    expect(outputs.every(isAdRow)).toBe(true);
    expect(
      outputs.some(
        (output) => !isAdRow(output) && (output as GapRow).reason === 'rate_limited',
      ),
    ).toBe(false);

    // google_ads + meta_ads overlapped (parallel within the advertiser).
    expect(observe.maxConcurrent).toBe(2);
  });

  it('returns gap rows (no fabrication) once the reserve is also exhausted', async (): Promise<void> => {
    // No reserve and generic pre-exhausted: the probe must NOT fabricate ad rows.
    const budget = new SectionToolBudget(1, 0);
    expect(budget.consume('web_search')).toBe(true);

    const observe = { concurrent: 0, maxConcurrent: 0 };
    const researchTools: Record<string, unknown> = {
      google_ads: budgetWrappedAdTool('google_ads', budget, observe),
      meta_ads: budgetWrappedAdTool('meta_ads', budget, observe),
    };

    const steps = await runCompetitorAdProbeSteps({
      maxAdvertisers: 1,
      researchInput: saaslaunchResearchInput,
      researchTools,
    });

    const outputs = steps[0]?.toolResults.map((result) => result.output) ?? [];
    expect(outputs).toHaveLength(2);
    // Both are gap rows: the verifier accepts these as adEvidence_or_gap.
    expect(outputs.every((output) => !isAdRow(output))).toBe(true);
    expect(
      outputs.every((output) => (output as GapRow).reason === 'rate_limited'),
    ).toBe(true);
  });

  it('fires exactly two ad tool calls per advertiser (google_ads + meta_ads) and zero linkedin calls', async (): Promise<void> => {
    // Locks Hypothesis A: LinkedIn is a phantom channel. The probe must only
    // call google_ads and meta_ads — never a linkedin tool — so reporting
    // linkedin as a probed-but-empty channel would be dishonest.
    const budget = new SectionToolBudget(6, 4);
    const observe = { concurrent: 0, maxConcurrent: 0 };
    const researchTools: Record<string, unknown> = {
      google_ads: budgetWrappedAdTool('google_ads', budget, observe),
      meta_ads: budgetWrappedAdTool('meta_ads', budget, observe),
    };

    const steps = await runCompetitorAdProbeSteps({
      maxAdvertisers: 2,
      researchInput: {
        ...saaslaunchResearchInput,
        competitorAds: [],
        competitorSeeds: [
          { name: 'FirstRival', domain: 'firstrival.com' },
          { name: 'SecondRival', domain: 'secondrival.com' },
        ],
      },
      researchTools,
    });

    expect(steps).toHaveLength(2);

    for (const step of steps) {
      const calledToolNames = step.toolCalls.map((call) => call.toolName);
      expect(calledToolNames).toEqual(['google_ads', 'meta_ads']);
      expect(calledToolNames).not.toContain('linkedin');
      expect(calledToolNames).not.toContain('linkedin_ads');
      expect(
        calledToolNames.some((name) => name.includes('linkedin')),
      ).toBe(false);

      const resultToolNames = step.toolResults.map((result) => result.toolName);
      expect(resultToolNames).toEqual(['google_ads', 'meta_ads']);
      expect(
        resultToolNames.some((name) => name.includes('linkedin')),
      ).toBe(false);
    }
  });

  it('seeds the probe advertiser list from competitorSeeds when competitorAds is empty', async (): Promise<void> => {
    // Production condition: corpus builder leaves competitorAds empty and feeds
    // competitorSeeds (parsed from the onboarding topCompetitors brief field).
    const budget = new SectionToolBudget(6, 2);
    const observe = { concurrent: 0, maxConcurrent: 0 };
    const researchTools: Record<string, unknown> = {
      google_ads: budgetWrappedAdTool('google_ads', budget, observe),
      meta_ads: budgetWrappedAdTool('meta_ads', budget, observe),
    };

    const steps = await runCompetitorAdProbeSteps({
      maxAdvertisers: 1,
      researchInput: {
        ...saaslaunchResearchInput,
        competitorAds: [],
        competitorSeeds: [
          { name: 'SeededRival', domain: 'seededrival.com' },
          { name: 'SecondRival' },
        ],
      },
      researchTools,
    });

    expect(steps).toHaveLength(1);
    const outputs = steps[0]?.toolResults.map((result) => result.output) ?? [];
    expect(outputs).toHaveLength(2);
    // Both ad tools fetched real rows for the FIRST seed (seeds win the slice).
    expect(outputs.every(isAdRow)).toBe(true);
    expect(
      (outputs as AdRow[]).every((row) => row.advertiser === 'SeededRival'),
    ).toBe(true);
  });
});
