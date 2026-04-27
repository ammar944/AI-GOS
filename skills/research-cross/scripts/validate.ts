/**
 * Schema validation gate.
 * Reads example/output.json (or argv[2]) and validates against output schema.
 * With no argv[2], also validates example/input.json against the input schema first.
 * Set RESEARCH_CROSS_INPUT_PATH to probe alternate input fixtures.
 *
 * Usage: node --import tsx/esm scripts/validate.ts [output.json]
 */
import * as fs from "fs";
import { researchCrossInputSchema } from "../schemas/input.ts";
import { researchCrossOutputSchema } from "../schemas/output.ts";

type IssueLike = {
  path: PropertyKey[];
  message: string;
};

function formatIssues(issues: IssueLike[]): string {
  return issues
    .slice(0, 16)
    .map((issue) => `  ${issue.path.map(String).join(":")} - ${issue.message}`)
    .join("\n");
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function validateInput(filePath: string): void {
  const raw = readJson(filePath);
  const result = researchCrossInputSchema.safeParse(raw);
  if (!result.success) {
    process.stderr.write(
      `Input schema validation FAILED (${result.error.issues.length} issues):\n${formatIssues(result.error.issues)}\n`,
    );
    process.exit(1);
  }
  process.stdout.write(`Input schema validates: ${filePath}\n`);
}

function validateOutput(filePath: string): void {
  const raw = readJson(filePath);
  const result = researchCrossOutputSchema.safeParse(raw);
  if (!result.success) {
    process.stderr.write(
      `Output schema validation FAILED (${result.error.issues.length} issues):\n${formatIssues(result.error.issues)}\n`,
    );
    process.exit(1);
  }
  process.stdout.write(`Output schema validates: ${filePath}\n`);
}

const outputPath = process.argv[2] ?? "./example/output.json";

if (!process.argv[2]) {
  validateInput(process.env.RESEARCH_CROSS_INPUT_PATH ?? "./example/input.json");
}

validateOutput(outputPath);
