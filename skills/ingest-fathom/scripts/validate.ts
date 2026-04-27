/**
 * Schema validation gate.
 * Reads example/output.json (or argv[2]) and validates against output schema.
 * With no argv[2], also validates example/input.json against the input schema.
 *
 * Usage: npx tsx scripts/validate.ts [output.json]
 */
import * as fs from "fs";
import { ingestFathomInputSchema } from "../schemas/input.ts";
import { ingestFathomOutputSchema } from "../schemas/output.ts";

function formatIssues(issues: Array<{ path: PropertyKey[]; message: string }>): string {
  return issues
    .slice(0, 12)
    .map((issue) => `  ${issue.path.map(String).join(":")} - ${issue.message}`)
    .join("\n");
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function validateOutput(filePath: string): void {
  const raw = readJson(filePath);
  const result = ingestFathomOutputSchema.safeParse(raw);
  if (!result.success) {
    process.stderr.write(
      `Output schema validation FAILED (${result.error.issues.length} issues):\n${formatIssues(result.error.issues)}\n`,
    );
    process.exit(1);
  }
  process.stdout.write(`Output schema validates: ${filePath}\n`);
}

function validateInput(filePath: string): void {
  const raw = readJson(filePath);
  const result = ingestFathomInputSchema.safeParse(raw);
  if (!result.success) {
    process.stderr.write(
      `Input schema validation FAILED (${result.error.issues.length} issues):\n${formatIssues(result.error.issues)}\n`,
    );
    process.exit(1);
  }
  process.stdout.write(`Input schema validates: ${filePath}\n`);
}

const outputPath = process.argv[2] ?? "./example/output.json";

if (!process.argv[2]) {
  validateInput("./example/input.json");
}
validateOutput(outputPath);
