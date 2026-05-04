import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { generateGtmSkillObject } from "@/lib/gtm/skill-object";
import {
  ingestIdentityOutputSchema,
  type IngestIdentityOutput,
  type SourceGap,
} from "@/lib/gtm/types";

export interface IngestIdentitySkillInput {
  input_url: string;
  run_id: string;
  prior_stages: Record<string, unknown>;
}

export interface IngestIdentitySkillResult {
  output: IngestIdentityOutput;
  source_gaps: SourceGap[];
}

export class IngestIdentityOutputValidationError extends Error {
  readonly issues: string[];

  constructor(runId: string, error: z.ZodError<IngestIdentityOutput>) {
    const issues = error.issues.map((issue) => {
      const pathLabel = issue.path.length > 0 ? issue.path.join(".") : "root";
      return `${pathLabel}: ${issue.message}`;
    });

    super(
      `ingest-identity output failed schema validation for run ${runId}: ${issues.join("; ")}`
    );
    this.name = "IngestIdentityOutputValidationError";
    this.issues = issues;
  }
}

const SKILL_PROMPT_PATH = path.join(
  process.cwd(),
  "skills",
  "ingest-identity",
  "SKILL.md"
);

const FALLBACK_SYSTEM_PROMPT =
  "You are AIGOS's ingest-identity stage in the lighthouse Pre-Pitch Positioning Audit. Given the run context (input_url, prior stages output), produce IngestIdentityOutput JSON. Use only what you can defensibly source from public information. Emit a SourceGap with severity 'blocker' for any field requiring real-time content you cannot access. Never fabricate pricing, customer counts, or quotes.";

export async function dispatchIngestIdentity(
  input: IngestIdentitySkillInput
): Promise<IngestIdentitySkillResult> {
  const system = await readIngestIdentitySystemPrompt();
  const generatedAt = new Date().toISOString();
  const prompt = `Input URL: ${input.input_url}
Run ID: ${input.run_id}
Stage: ingest-identity
Generated at: ${generatedAt}

Prior stages:
${JSON.stringify(input.prior_stages)}

Resolve the canonical company identity and produce strict IngestIdentityOutput JSON. Stamp run_id="${input.run_id}", stage="ingest-identity", and generated_at="${generatedAt}".`;

  const object = await generateGtmSkillObject({
    schema: ingestIdentityOutputSchema,
    schemaName: "IngestIdentityOutput",
    system,
    prompt,
    maxOutputTokens: 8192,
  });

  const parsed = ingestIdentityOutputSchema.safeParse(object);

  if (!parsed.success) {
    throw new IngestIdentityOutputValidationError(input.run_id, parsed.error);
  }

  return {
    output: parsed.data,
    source_gaps: parsed.data.source_gaps,
  };
}

async function readIngestIdentitySystemPrompt(): Promise<string> {
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
      `Failed to read ingest-identity system prompt at ${SKILL_PROMPT_PATH}: ${getErrorMessage(error)}`
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
