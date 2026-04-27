/**
 * Schema validation gate.
 * Reads example/output.json (or argv[2]) and validates against output schema.
 * With no argv[2], also validates example/input.json against the input schema.
 *
 * Usage: node --import tsx/esm scripts/validate.ts [output.json]
 */
import * as fs from "fs";
import { synthesizePositioningInputSchema } from "../schemas/input.ts";
import { synthesizePositioningOutputSchema } from "../schemas/output.ts";

function formatIssues(issues: Array<{ path: PropertyKey[]; message: string }>): string {
  return issues
    .slice(0, 12)
    .map((issue) => `  ${issue.path.map(String).join(":")} - ${issue.message}`)
    .join("\n");
}

function readJson(path: string): unknown {
  return JSON.parse(fs.readFileSync(path, "utf-8"));
}

function validateOutput(path: string): void {
  const raw = readJson(path);
  const result = synthesizePositioningOutputSchema.safeParse(raw);
  if (!result.success) {
    process.stderr.write(
      `Output schema validation FAILED (${result.error.issues.length} issues):\n${formatIssues(result.error.issues)}\n`,
    );
    process.exit(1);
  }
  process.stdout.write(`Output schema validates: ${path}\n`);
}

function validateInput(path: string): void {
  const raw = readJson(path);
  const result = synthesizePositioningInputSchema.safeParse(raw);
  if (!result.success) {
    process.stderr.write(
      `Input schema validation FAILED (${result.error.issues.length} issues):\n${formatIssues(result.error.issues)}\n`,
    );
    process.exit(1);
  }
  process.stdout.write(`Input schema validates: ${path}\n`);
}

const outputPath = process.argv[2] ?? "./example/output.json";

if (!process.argv[2]) {
  validateInput("./example/input.json");
}
validateOutput(outputPath);
