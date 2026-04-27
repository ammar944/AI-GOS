/**
 * Deterministic end-of-pipeline orchestrator for synthesize-media-plan.
 *
 * Assumes the agent has written `<run_dir>/input.json` and `<run_dir>/output.json`.
 * This script validates both, rewrites a normalized final output, and runs all
 * local gates.
 *
 * Usage:
 *   node --import tsx/esm scripts/orchestrate.ts <run_dir>
 */
import { spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { synthesizeMediaPlanInputSchema } from "../schemas/input.ts";
import { synthesizeMediaPlanOutputSchema } from "../schemas/output.ts";

type Gate = {
  label: string;
  args: string[];
};

function skillRoot(): string {
  const scriptPath = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(scriptPath), "..");
}

function resolveRunDir(rawRunDir: string): string {
  return path.resolve(process.cwd(), rawRunDir);
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as unknown;
}

function runGate(gate: Gate, runId: string): void {
  process.stdout.write(`\n━━ ${gate.label} ━━\n`);
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx/esm", ...gate.args],
    {
      cwd: skillRoot(),
      stdio: "inherit",
      env: process.env,
    },
  );
  if (result.status !== 0) {
    process.stderr.write(
      `[orchestrate] run_id=${runId} gate="${gate.label}" failed with exit ${result.status}\n`,
    );
    process.exit(result.status ?? 1);
  }
}

function normalizeFinalOutput(inputPath: string, outputPath: string): string {
  const input = synthesizeMediaPlanInputSchema.parse(readJson(inputPath));
  const output = synthesizeMediaPlanOutputSchema.parse(readJson(outputPath));
  if (input.run_id !== output.run_id) {
    throw new Error(
      `run_id mismatch: input=${input.run_id} output=${output.run_id}`,
    );
  }
  if (input.brief_snapshot_id !== output.brief_snapshot_id) {
    throw new Error(
      `brief_snapshot_id mismatch: input=${input.brief_snapshot_id} output=${output.brief_snapshot_id}`,
    );
  }
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  return output.run_id;
}

function main(): void {
  const rawRunDir = process.argv[2];
  if (!rawRunDir) {
    process.stderr.write("Usage: orchestrate.ts <run_dir>\n");
    process.exit(2);
  }

  const runDir = resolveRunDir(rawRunDir);
  if (!fs.existsSync(runDir)) {
    process.stderr.write(`[orchestrate] run dir missing: ${runDir}\n`);
    process.exit(1);
  }

  const inputPath = path.join(runDir, "input.json");
  const outputPath = path.join(runDir, "output.json");
  if (!fs.existsSync(inputPath)) {
    process.stderr.write(`[orchestrate] missing ${inputPath}\n`);
    process.exit(1);
  }
  if (!fs.existsSync(outputPath)) {
    process.stderr.write(`[orchestrate] missing ${outputPath}\n`);
    process.exit(1);
  }

  let runId = "unparsed";
  try {
    runId = normalizeFinalOutput(inputPath, outputPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[orchestrate] run_id=${runId} normalize failed: ${message}\n`);
    process.exit(1);
  }

  const gates: Gate[] = [
    { label: "schema validate", args: ["scripts/validate.ts", outputPath] },
    {
      label: "removed-field validate",
      args: ["scripts/validate-removed-fields.ts", outputPath],
    },
    { label: "sanity check", args: ["scripts/sanity-check.ts", outputPath] },
    {
      label: "budget gates",
      args: ["scripts/validate-budget-gates.ts", inputPath, outputPath],
    },
    { label: "snapshot validate", args: ["scripts/validate-snapshot.ts", outputPath] },
  ];

  gates.forEach((gate) => runGate(gate, runId));

  process.stdout.write(
    `\n[orchestrate] pipeline complete\n  run_id: ${runId}\n  output: ${outputPath}\n`,
  );
}

main();
