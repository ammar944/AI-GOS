/**
 * Zod validation gate.
 * With no argv path, validates example/input.json and example/output.json.
 * With argv path, validates that file as research-offer output.
 */
import * as fs from "fs";
import { researchOfferInputSchema } from "../schemas/input.ts";
import { researchOfferOutputSchema } from "../schemas/output.ts";

type ValidationTarget = "input" | "output";

interface ValidationJob {
  path: string;
  target: ValidationTarget;
}

function readJson(path: string): unknown {
  return JSON.parse(fs.readFileSync(path, "utf-8"));
}

function formatPath(path: PropertyKey[]): string {
  return path.length > 0 ? path.map(String).join(".") : "(root)";
}

function validateJob(job: ValidationJob): boolean {
  const raw = readJson(job.path);
  const schema =
    job.target === "input" ? researchOfferInputSchema : researchOfferOutputSchema;
  const result = schema.safeParse(raw);

  if (result.success) {
    process.stdout.write(`${job.path} ${job.target} schema validates\n`);
    return true;
  }

  const issues = result.error.issues
    .slice(0, 20)
    .map((issue) => `  ${formatPath(issue.path)} - ${issue.message}`)
    .join("\n");
  process.stderr.write(
    `${job.path} ${job.target} schema validation FAILED (${result.error.issues.length} issues):\n${issues}\n`,
  );
  return false;
}

function getJobs(): ValidationJob[] {
  const path = process.argv[2];
  if (path) {
    return [{ path, target: "output" }];
  }

  return [
    { path: "./example/input.json", target: "input" },
    { path: "./example/output.json", target: "output" },
  ];
}

function main(): void {
  const pass = getJobs().map(validateJob).every(Boolean);
  process.exit(pass ? 0 : 1);
}

main();
