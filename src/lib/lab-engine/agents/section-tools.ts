import { z } from "zod";

import type { RunStore } from "../runs/run-store";

const readResearchInputSchema = z.object({ runId: z.string().min(1) }).strict();
const getCompetitorAdsSchema = z.object({ runId: z.string().min(1) }).strict();

type ReadResearchInput = z.infer<typeof readResearchInputSchema>;
type GetCompetitorAdsInput = z.infer<typeof getCompetitorAdsSchema>;

export interface ToolDeps {
  store: RunStore;
  expectedRunId: string;
}

export interface FixtureToolDefinition<TInput, TOutput> {
  description: string;
  inputSchema: z.ZodType<TInput>;
  execute: (input: TInput) => Promise<TOutput>;
}

export interface FixtureToolSet {
  readResearchInput: FixtureToolDefinition<
    ReadResearchInput,
    Awaited<ReturnType<RunStore["readRun"]>>["input"]
  >;
  getCompetitorAds: FixtureToolDefinition<
    GetCompetitorAdsInput,
    {
      ads: Awaited<ReturnType<RunStore["readRun"]>>["input"]["competitorAds"];
    }
  >;
}

function assertExpectedRunId({
  expectedRunId,
  toolRunId,
}: {
  expectedRunId: string;
  toolRunId: string;
}): void {
  if (toolRunId !== expectedRunId) {
    throw new Error(
      `tool runId ${toolRunId} does not match expected ${expectedRunId}`,
    );
  }
}

export function createFixtureTools(deps: ToolDeps): FixtureToolSet {
  return {
    readResearchInput: {
      description: "Read the ResearchInput for this run from the store.",
      inputSchema: readResearchInputSchema,
      execute: async ({ runId }: ReadResearchInput) => {
        assertExpectedRunId({
          expectedRunId: deps.expectedRunId,
          toolRunId: runId,
        });
        const record = await deps.store.readRun(runId);

        return record.input;
      },
    },
    getCompetitorAds: {
      description: "Get fixture competitor ads for this run.",
      inputSchema: getCompetitorAdsSchema,
      execute: async ({ runId }: GetCompetitorAdsInput) => {
        assertExpectedRunId({
          expectedRunId: deps.expectedRunId,
          toolRunId: runId,
        });
        const record = await deps.store.readRun(runId);

        return { ads: record.input.competitorAds };
      },
    },
  };
}
