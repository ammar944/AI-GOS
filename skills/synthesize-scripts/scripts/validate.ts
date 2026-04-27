import * as fs from "fs";
import { synthesizeScriptsInputSchema } from "../schemas/input.ts";
import { synthesizeScriptsOutputSchema } from "../schemas/output.ts";

function formatIssues(issues: Array<{ path: PropertyKey[]; message: string }>): string {
  return issues
    .slice(0, 12)
    .map((issue) => `  ${issue.path.map(String).join(":")} - ${issue.message}`)
    .join("\n");
}

function readJson(pathname: string): unknown {
  return JSON.parse(fs.readFileSync(pathname, "utf-8"));
}

function validateInput(pathname: string): void {
  const parsed = synthesizeScriptsInputSchema.safeParse(readJson(pathname));
  if (!parsed.success) {
    process.stderr.write(
      `Input schema validation FAILED (${parsed.error.issues.length} issues):\n${formatIssues(parsed.error.issues)}\n`,
    );
    process.exit(1);
  }
  process.stdout.write(`Input schema validates: ${pathname}\n`);
}

function validateOutput(pathname: string): void {
  const parsed = synthesizeScriptsOutputSchema.safeParse(readJson(pathname));
  if (!parsed.success) {
    process.stderr.write(
      `Output schema validation FAILED (${parsed.error.issues.length} issues):\n${formatIssues(parsed.error.issues)}\n`,
    );
    process.exit(1);
  }
  process.stdout.write(`Output schema validates: ${pathname}\n`);
}

const outputPath = process.argv[2] ?? "./example/output.json";

if (!process.argv[2]) {
  validateInput("./example/input.json");
}
validateOutput(outputPath);
