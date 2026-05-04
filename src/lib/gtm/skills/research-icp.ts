import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { generateGtmSkillObject } from "@/lib/gtm/skill-object";
import {
  researchIcpOutputSchema,
  type ResearchIcpOutput,
  type SourceGap,
} from "@/lib/gtm/types";

export interface ResearchIcpSkillInput {
  input_url: string;
  run_id: string;
  prior_stages: Record<string, unknown>;
}

export interface ResearchIcpSkillResult {
  output: ResearchIcpOutput;
  source_gaps: SourceGap[];
}

export class ResearchIcpOutputValidationError extends Error {
  readonly issues: string[];

  constructor(runId: string, error: z.ZodError<ResearchIcpOutput>) {
    const issues = error.issues.map((issue) => {
      const pathLabel = issue.path.length > 0 ? issue.path.join(".") : "root";
      return `${pathLabel}: ${issue.message}`;
    });

    super(
      `research-icp output failed schema validation for run ${runId}: ${issues.join("; ")}`
    );
    this.name = "ResearchIcpOutputValidationError";
    this.issues = issues;
  }
}

const SKILL_PROMPT_PATH = path.join(
  process.cwd(),
  "skills",
  "research-icp",
  "SKILL.md"
);

const FALLBACK_SYSTEM_PROMPT =
  "You are AIGOS's research-icp stage in the lighthouse Pre-Pitch Positioning Audit. Given the run context (input_url, prior stages output), produce ResearchIcpOutput JSON. Use only what you can defensibly source from public information. Emit a SourceGap with severity 'blocker' for any field requiring real-time content you cannot access. Never fabricate pricing, customer counts, or quotes.";

export async function dispatchResearchIcp(
  input: ResearchIcpSkillInput
): Promise<ResearchIcpSkillResult> {
  const system = await readResearchIcpSystemPrompt();
  const generatedAt = new Date().toISOString();
  const prompt = `Input URL: ${input.input_url}
Run ID: ${input.run_id}
Stage: research-icp
Generated at: ${generatedAt}

Prior stages:
${JSON.stringify(input.prior_stages)}

Produce sourced buyer and ICP research as strict ResearchIcpOutput JSON. Stamp run_id="${input.run_id}", stage="research-icp", and generated_at="${generatedAt}". Keep source_gaps in the shared SourceGap object format.`;

  const object = await generateGtmSkillObject({
    schema: researchIcpOutputSchema,
    schemaName: "ResearchIcpOutput",
    system,
    prompt,
    maxOutputTokens: 12288,
  });

  const parsed = researchIcpOutputSchema.safeParse(object);

  if (!parsed.success) {
    throw new ResearchIcpOutputValidationError(input.run_id, parsed.error);
  }

  return {
    output: parsed.data,
    source_gaps: parsed.data.source_gaps,
  };
}

async function readResearchIcpSystemPrompt(): Promise<string> {
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
      `Failed to read research-icp system prompt at ${SKILL_PROMPT_PATH}: ${getErrorMessage(error)}`
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
