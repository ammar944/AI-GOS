import * as fs from "fs";
import { ingestUrlInputSchema } from "../schemas/input.ts";
import { ingestUrlOutputSchema } from "../schemas/output.ts";

interface SchemaIssue {
  path: PropertyKey[];
  message: string;
}

function formatIssues(issues: SchemaIssue[]): string {
  return issues
    .slice(0, 16)
    .map((issue) => `  ${issue.path.map(String).join(":")} - ${issue.message}`)
    .join("\n");
}

function readJson(path: string): unknown {
  return JSON.parse(fs.readFileSync(path, "utf-8")) as unknown;
}

function validateInput(path: string): void {
  const result = ingestUrlInputSchema.safeParse(readJson(path));
  if (!result.success) {
    process.stderr.write(
      `Input schema validation FAILED (${result.error.issues.length} issues):\n${formatIssues(result.error.issues)}\n`,
    );
    process.exit(1);
  }
  process.stdout.write(`Input schema validates: ${path}\n`);
}

function validateOutput(path: string): void {
  const result = ingestUrlOutputSchema.safeParse(readJson(path));
  if (!result.success) {
    process.stderr.write(
      `Output schema validation FAILED (${result.error.issues.length} issues):\n${formatIssues(result.error.issues)}\n`,
    );
    process.exit(1);
  }
  process.stdout.write(`Output schema validates: ${path}\n`);
}

const inputPath = process.env.INGEST_URL_INPUT_PATH ?? "./example/input.json";
const outputPath =
  process.argv[2] ?? process.env.INGEST_URL_OUTPUT_PATH ?? "./example/output.json";

if (!process.argv[2] && !process.env.INGEST_URL_OUTPUT_PATH) {
  validateInput(inputPath);
}
validateOutput(outputPath);
