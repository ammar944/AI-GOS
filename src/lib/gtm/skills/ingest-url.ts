import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { generateGtmSkillObject } from "@/lib/gtm/skill-object";
import {
  ingestUrlOutputSchema,
  type IngestUrlOutput,
  type SourceGap,
} from "@/lib/gtm/types";

export interface IngestUrlSkillInput {
  input_url: string;
  run_id: string;
}

export interface IngestUrlSkillResult {
  output: IngestUrlOutput;
  source_gaps: SourceGap[];
}

export class IngestUrlOutputValidationError extends Error {
  readonly issues: string[];

  constructor(runId: string, error: z.ZodError<IngestUrlOutput>) {
    const issues = error.issues.map((issue) => {
      const pathLabel = issue.path.length > 0 ? issue.path.join(".") : "root";
      return `${pathLabel}: ${issue.message}`;
    });

    super(
      `ingest-url output failed schema validation for run ${runId}: ${issues.join("; ")}`
    );
    this.name = "IngestUrlOutputValidationError";
    this.issues = issues;
  }
}

const SKILL_PROMPT_PATH = path.join(
  process.cwd(),
  "skills",
  "ingest-url",
  "SKILL.md"
);

const FALLBACK_SYSTEM_PROMPT =
  "You are AIGOS's ingest-url stage. Given a SaaS company URL, produce a strict IngestUrlOutput JSON. Use only what you can defensibly source. Be honest about what you can't verify — emit a SourceGap with severity 'blocker' for any field that requires real-time content you cannot access. Never fabricate pricing, customer counts, or quotes.";

export async function dispatchIngestUrl(
  input: IngestUrlSkillInput
): Promise<IngestUrlSkillResult> {
  const system = await readIngestUrlSystemPrompt();
  const generatedAt = new Date().toISOString();
  const prompt = `Inspect ${input.input_url} and produce the IngestUrlOutput. Stamp run_id=${input.run_id} and stage="discover-url". Set generated_at to ${generatedAt}.`;

  const object = await generateGtmSkillObject({
    schema: ingestUrlOutputSchema,
    schemaName: "IngestUrlOutput",
    system,
    prompt,
    maxOutputTokens: 8192,
  });

  const parsed = ingestUrlOutputSchema.safeParse(object);

  if (!parsed.success) {
    throw new IngestUrlOutputValidationError(input.run_id, parsed.error);
  }

  return {
    output: parsed.data,
    source_gaps: parsed.data.source_gaps,
  };
}

async function readIngestUrlSystemPrompt(): Promise<string> {
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
      `Failed to read ingest-url system prompt at ${SKILL_PROMPT_PATH}: ${getErrorMessage(error)}`
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
