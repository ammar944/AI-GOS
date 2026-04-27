/**
 * Schema validation gate for ingest-docs.
 */
import * as fs from "fs";
import { ingestDocsInputSchema } from "../schemas/input.ts";
import { ingestDocsOutputSchema } from "../schemas/output.ts";

function formatIssues(issues: Array<{ path: PropertyKey[]; message: string }>): string {
  return issues
    .slice(0, 12)
    .map((issue) => `  ${issue.path.map(String).join(":")} - ${issue.message}`)
    .join("\n");
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function validateInput(filePath: string): void {
  const result = ingestDocsInputSchema.safeParse(readJson(filePath));
  if (!result.success) {
    process.stderr.write(
      `Input schema validation FAILED (${result.error.issues.length} issues):\n${formatIssues(result.error.issues)}\n`,
    );
    process.exit(1);
  }
  process.stdout.write(`Input schema validates: ${filePath}\n`);
}

function validateOutput(filePath: string): void {
  const result = ingestDocsOutputSchema.safeParse(readJson(filePath));
  if (!result.success) {
    process.stderr.write(
      `Output schema validation FAILED (${result.error.issues.length} issues):\n${formatIssues(result.error.issues)}\n`,
    );
    process.exit(1);
  }
  process.stdout.write(`Output schema validates: ${filePath}\n`);
}

const inputPath = process.env.INGEST_DOCS_INPUT_PATH ?? "./example/input.json";
const outputPath = process.argv[2] ?? process.env.INGEST_DOCS_OUTPUT_PATH ?? "./example/output.json";

if (!process.argv[2] && !process.env.INGEST_DOCS_OUTPUT_PATH) {
  validateInput(inputPath);
}
validateOutput(outputPath);
