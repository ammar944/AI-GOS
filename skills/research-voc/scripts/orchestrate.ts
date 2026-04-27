/**
 * Local orchestration gate for research-voc fixtures or run directories.
 * Builds exclusions from input, overlays them before output validation, filters leakage, then validates.
 */
import * as fs from "fs";
import * as path from "path";
import { researchVocInputSchema } from "../schemas/input.ts";
import { researchVocOutputSchema, type ResearchVocOutput } from "../schemas/output.ts";
import { buildExclusions } from "./build-exclusions.ts";
import { filterCompetitorLeakage } from "./filter-competitor-leakage.ts";

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function formatIssues(issues: Array<{ path: PropertyKey[]; message: string }>): string {
  return issues
    .slice(0, 12)
    .map((issue) => `${issue.path.map(String).join(":")} - ${issue.message}`)
    .join("\n");
}

function resolveRunDir(arg: string | undefined): string {
  if (!arg || arg === "example") {
    return path.resolve("example");
  }

  return path.resolve(arg);
}

function main(): void {
  const runDir = resolveRunDir(process.argv[2]);
  const inputPath = path.join(runDir, "input.json");
  const outputPath = path.join(runDir, "output.json");

  const inputResult = researchVocInputSchema.safeParse(readJson(inputPath));
  if (!inputResult.success) {
    process.stderr.write(
      `Input schema validation FAILED:\n${formatIssues(inputResult.error.issues)}\n`,
    );
    process.exit(1);
  }

  const rawOutput = readJson(outputPath);
  const preflightResult = researchVocOutputSchema.safeParse(rawOutput);
  if (!preflightResult.success) {
    process.stderr.write(
      `Output schema validation FAILED before orchestration:\n${formatIssues(preflightResult.error.issues)}\n`,
    );
    process.exit(1);
  }

  const exclusionTerms = buildExclusions(inputResult.data);
  const outputWithBuiltExclusions: ResearchVocOutput = {
    ...preflightResult.data,
    exclusion_terms: exclusionTerms,
  };
  const filteredOutput = filterCompetitorLeakage(outputWithBuiltExclusions);
  const finalResult = researchVocOutputSchema.safeParse(filteredOutput);

  if (!finalResult.success) {
    process.stderr.write(
      `Output schema validation FAILED after orchestration:\n${formatIssues(finalResult.error.issues)}\n`,
    );
    process.exit(1);
  }

  const rejectedCount =
    filteredOutput.rejected_competitor_matches.length -
    preflightResult.data.rejected_competitor_matches.length;

  process.stdout.write(
    [
      `Input schema validates: ${inputPath}`,
      `Built exclusion_terms: ${exclusionTerms.length}`,
      `Rejected competitor leakage during orchestration: ${Math.max(0, rejectedCount)}`,
      `Output schema validates after exclusion overlay: ${outputPath}`,
    ].join("\n"),
  );
  process.stdout.write("\n");
}

main();
