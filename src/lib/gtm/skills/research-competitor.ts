import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { generateGtmSkillObject } from "@/lib/gtm/skill-object";
import {
  researchCompetitorOutputSchema,
  type ResearchCompetitorOutput,
  type SourceGap,
} from "@/lib/gtm/types";

export interface ResearchCompetitorSkillInput {
  input_url: string;
  run_id: string;
  prior_stages: Record<string, unknown>;
}

export interface ResearchCompetitorSkillResult {
  output: ResearchCompetitorOutput;
  source_gaps: SourceGap[];
}

export class ResearchCompetitorOutputValidationError extends Error {
  readonly issues: string[];

  constructor(runId: string, error: z.ZodError<ResearchCompetitorOutput>) {
    const issues = error.issues.map((issue) => {
      const pathLabel = issue.path.length > 0 ? issue.path.join(".") : "root";
      return `${pathLabel}: ${issue.message}`;
    });

    super(
      `research-competitor output failed schema validation for run ${runId}: ${issues.join("; ")}`
    );
    this.name = "ResearchCompetitorOutputValidationError";
    this.issues = issues;
  }
}

const SKILL_PROMPT_PATH = path.join(
  process.cwd(),
  "skills",
  "research-competitor",
  "SKILL.md"
);

const FALLBACK_SYSTEM_PROMPT =
  "You are AIGOS's research-competitor stage in the lighthouse Pre-Pitch Positioning Audit. Given the run context (input_url, prior stages output), produce ResearchCompetitorOutput JSON. Use only what you can defensibly source from public information. Emit a SourceGap with severity 'blocker' for any field requiring real-time content you cannot access. Never fabricate pricing, customer counts, or quotes.";

export async function dispatchResearchCompetitor(
  input: ResearchCompetitorSkillInput
): Promise<ResearchCompetitorSkillResult> {
  const system = await readResearchCompetitorSystemPrompt();
  const generatedAt = new Date().toISOString();
  const prompt = `Input URL: ${input.input_url}
Run ID: ${input.run_id}
Stage: research-competitor
Generated at: ${generatedAt}

Prior stages:
${JSON.stringify(input.prior_stages)}

Produce sourced competitor landscape research as strict ResearchCompetitorOutput JSON. Stamp run_id="${input.run_id}", stage="research-competitor", and generated_at="${generatedAt}". Keep source_gaps in the shared SourceGap object format.`;

  const object = await generateGtmSkillObject({
    schema: researchCompetitorOutputSchema,
    schemaName: "ResearchCompetitorOutput",
    system,
    prompt,
    maxOutputTokens: 16384,
  });

  const parsed = researchCompetitorOutputSchema.safeParse(object);

  if (!parsed.success) {
    throw new ResearchCompetitorOutputValidationError(
      input.run_id,
      parsed.error
    );
  }

  return {
    output: parsed.data,
    source_gaps: parsed.data.source_gaps,
  };
}

async function readResearchCompetitorSystemPrompt(): Promise<string> {
  try {
    const content = await readFile(SKILL_PROMPT_PATH, "utf8");

    if (content.trim().length > 0) {
      return content;
    }

    return FALLBACK_SYSTEM_PROMPT;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return FALLBACK_SYSTEM_PROMPT;
    }

    throw new Error(
      `Failed to read research-competitor system prompt at ${SKILL_PROMPT_PATH}: ${getErrorMessage(error)}`
    );
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
