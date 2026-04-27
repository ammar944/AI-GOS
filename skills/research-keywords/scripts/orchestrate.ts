/**
 * Local orchestrator for research-keywords.
 * Validates input/output, normalizes keyword spellings, dedupes normalized keyword matches,
 * and writes the normalized output back to the run directory.
 *
 * Usage:
 *   node --import tsx/esm scripts/orchestrate.ts example
 */
import * as fs from "fs";
import * as path from "path";
import { researchKeywordsInputSchema } from "../schemas/input.ts";
import { researchKeywordsOutputSchema } from "../schemas/output.ts";
import { normalizeResearchKeywordsOutput } from "./normalize-keywords.ts";
import { formatProviderGateIssues, inspectProviderGates } from "./provider-gates.ts";

function formatIssues(issues: Array<{ path: PropertyKey[]; message: string }>): string {
  return issues
    .slice(0, 12)
    .map((issue) => `  ${issue.path.map(String).join(":")} - ${issue.message}`)
    .join("\n");
}

function resolveRunDir(arg: string | undefined): string {
  return path.resolve(arg ?? "example");
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function writeJson(filePath: string, value: unknown): void {
  fs.writeFileSync(`${filePath}.tmp`, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(`${filePath}.tmp`, filePath);
}

function main(): void {
  const runDir = resolveRunDir(process.argv[2]);
  const inputPath = path.join(runDir, "input.json");
  const outputPath = path.join(runDir, "output.json");

  const input = researchKeywordsInputSchema.safeParse(readJson(inputPath));
  if (!input.success) {
    process.stderr.write(
      `Input schema validation FAILED (${input.error.issues.length} issues):\n${formatIssues(input.error.issues)}\n`,
    );
    process.exit(1);
  }

  const output = researchKeywordsOutputSchema.safeParse(readJson(outputPath));
  if (!output.success) {
    process.stderr.write(
      `Output schema validation FAILED (${output.error.issues.length} issues):\n${formatIssues(output.error.issues)}\n`,
    );
    process.exit(1);
  }

  const normalized = normalizeResearchKeywordsOutput(output.data);
  const normalizedResult = researchKeywordsOutputSchema.safeParse(normalized);
  if (!normalizedResult.success) {
    process.stderr.write(
      `Normalized output validation FAILED (${normalizedResult.error.issues.length} issues):\n${formatIssues(normalizedResult.error.issues)}\n`,
    );
    process.exit(1);
  }

  const providerIssues = inspectProviderGates(normalizedResult.data);
  if (providerIssues.length > 0) {
    process.stderr.write(
      `Provider gate validation FAILED:\n${formatProviderGateIssues(providerIssues)}\n`,
    );
    process.exit(1);
  }

  writeJson(outputPath, normalizedResult.data);
  process.stdout.write(`Normalized research-keywords output: ${outputPath}\n`);
}

main();
