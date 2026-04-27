/**
 * Schema validation gate.
 *
 * Usage:
 *   node --import tsx/esm scripts/validate.ts [output.json]
 */
import * as fs from "fs";
import { synthesizeMediaPlanInputSchema } from "../schemas/input.ts";
import { synthesizeMediaPlanOutputSchema } from "../schemas/output.ts";

type ZodIssueView = {
  path: PropertyKey[];
  message: string;
};

function formatIssues(issues: ZodIssueView[]): string {
  return issues
    .slice(0, 12)
    .map((issue) => `  ${issue.path.map(String).join(":")} - ${issue.message}`)
    .join("\n");
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as unknown;
}

function validateInput(filePath: string): void {
  const result = synthesizeMediaPlanInputSchema.safeParse(readJson(filePath));
  if (!result.success) {
    process.stderr.write(
      `Input schema validation FAILED (${result.error.issues.length} issues):\n${formatIssues(result.error.issues)}\n`,
    );
    process.exit(1);
  }
  process.stdout.write(`Input schema validates: ${filePath}\n`);
}

function validateOutput(filePath: string): void {
  const result = synthesizeMediaPlanOutputSchema.safeParse(readJson(filePath));
  if (!result.success) {
    process.stderr.write(
      `Output schema validation FAILED (${result.error.issues.length} issues):\n${formatIssues(result.error.issues)}\n`,
    );
    process.exit(1);
  }
  process.stdout.write(`Output schema validates: ${filePath}\n`);
}

function main(): void {
  const outputPath = process.argv[2] ?? "./example/output.json";
  if (!process.argv[2]) {
    validateInput("./example/input.json");
  }
  validateOutput(outputPath);
}

main();
