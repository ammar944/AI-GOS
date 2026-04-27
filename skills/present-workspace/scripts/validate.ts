import * as fs from "fs";
import { presentWorkspaceInputSchema } from "../schemas/input.ts";
import { presentWorkspaceOutputSchema } from "../schemas/output.ts";

type Issue = { path: PropertyKey[]; message: string };

function formatIssues(issues: Issue[]): string {
  return issues
    .slice(0, 16)
    .map((issue) => `  ${issue.path.map(String).join(":")} - ${issue.message}`)
    .join("\n");
}

function readJson(path: string): unknown {
  return JSON.parse(fs.readFileSync(path, "utf-8"));
}

function validateInput(path: string): void {
  const result = presentWorkspaceInputSchema.safeParse(readJson(path));
  if (!result.success) {
    process.stderr.write(
      `Input schema validation FAILED (${result.error.issues.length} issues):\n${formatIssues(result.error.issues)}\n`,
    );
    process.exit(1);
  }
  process.stdout.write(`Input schema validates: ${path}\n`);
}

function validateOutput(path: string): void {
  const result = presentWorkspaceOutputSchema.safeParse(readJson(path));
  if (!result.success) {
    process.stderr.write(
      `Output schema validation FAILED (${result.error.issues.length} issues):\n${formatIssues(result.error.issues)}\n`,
    );
    process.exit(1);
  }
  process.stdout.write(`Output schema validates: ${path}\n`);
}

const outputPath = process.argv[2] ?? "./example/output.json";
const inputPath = "./example/input.json";

if (!process.argv[2]) {
  validateInput(inputPath);
}

validateOutput(outputPath);
