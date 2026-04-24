/**
 * ingest-identity — deterministic orchestrator
 *
 * Pipeline:
 *   1. Read <runDir>/input.json (sealed per-run payload; run_id + url).
 *   2. If <runDir>/fragments/identity.json exists (agent-produced), merge it
 *      into the IdentityCardOutput shape. Otherwise produce a scaffold
 *      fallback so downstream stages can keep running while the agent layer
 *      matures (Lane D2 eliminates the fallback path).
 *   3. Write <runDir>/output.json.
 *   4. Invoke scripts/validate.ts — hard Zod gate.
 *
 * Usage:
 *   npx tsx scripts/orchestrate.ts <run_dir>
 */
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  IdentityCardOutputSchema,
  IdentityFragmentSchema,
  type IdentityCardOutput,
} from "../schemas/output";
import { IdentityResolverInputSchema, type IdentityResolverInput } from "../schemas/input";

function main(): void {
  const runDir = process.argv[2];
  if (!runDir) {
    process.stderr.write("Usage: orchestrate.ts <run_dir>\n");
    process.exit(2);
  }
  if (!fs.existsSync(runDir)) {
    process.stderr.write(`[orchestrate] run dir missing: ${runDir}\n`);
    process.exit(1);
  }

  const input = readInput(runDir);
  const fragment = readFragment(runDir);
  const generatedAt = new Date().toISOString();

  const output: IdentityCardOutput = fragment
    ? mergeFragment(input, fragment, generatedAt)
    : buildScaffoldFallback(input, generatedAt);

  const outputPath = path.join(runDir, "output.json");
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  process.stdout.write(
    `[orchestrate] wrote ${outputPath} ` +
      `(${fragment ? "from agent fragment" : "scaffold fallback — no fragment supplied"})\n`,
  );

  const skillRoot = path.dirname(path.dirname(new URL(import.meta.url).pathname));
  const validate = spawnSync("npx", ["tsx", "scripts/validate.ts", outputPath], {
    stdio: "inherit",
    env: process.env,
    cwd: skillRoot,
  });
  if (validate.status !== 0) {
    process.stderr.write(`[orchestrate] validate failed (exit ${validate.status})\n`);
    process.exit(validate.status ?? 1);
  }
}

function readInput(runDir: string): IdentityResolverInput | null {
  const inputPath = path.join(runDir, "input.json");
  if (!fs.existsSync(inputPath)) return null;
  const raw = JSON.parse(fs.readFileSync(inputPath, "utf-8")) as unknown;
  const parsed = IdentityResolverInputSchema.safeParse(raw);
  if (!parsed.success) {
    process.stderr.write(
      `[orchestrate] input.json present but invalid: ${JSON.stringify(parsed.error.issues)}\n`,
    );
    process.exit(1);
  }
  return parsed.data;
}

function readFragment(runDir: string) {
  const fragmentPath = path.join(runDir, "fragments", "identity.json");
  if (!fs.existsSync(fragmentPath)) return null;
  const raw = JSON.parse(fs.readFileSync(fragmentPath, "utf-8")) as unknown;
  const parsed = IdentityFragmentSchema.safeParse(raw);
  if (!parsed.success) {
    process.stderr.write(
      `[orchestrate] fragments/identity.json invalid: ${JSON.stringify(parsed.error.issues)}\n`,
    );
    process.exit(1);
  }
  return parsed.data;
}

function mergeFragment(
  input: IdentityResolverInput | null,
  fragment: ReturnType<typeof IdentityFragmentSchema.parse>,
  generatedAt: string,
): IdentityCardOutput {
  return IdentityCardOutputSchema.parse({
    run_id: fragment.run_id ?? input?.run_id ?? "unknown",
    company_name: fragment.company_name,
    domain: fragment.domain,
    category: fragment.category,
    core_keywords: fragment.core_keywords ?? [],
    negative_keywords: fragment.negative_keywords ?? [],
    sources: fragment.sources,
    generated_at: fragment.generated_at ?? generatedAt,
  });
}

function buildScaffoldFallback(
  input: IdentityResolverInput | null,
  generatedAt: string,
): IdentityCardOutput {
  const url = input?.url ?? "https://unknown.invalid";
  const domain = extractDomain(url);
  return {
    run_id: input?.run_id ?? "scaffold",
    company_name: domain,
    domain,
    category: "unknown",
    core_keywords: [],
    negative_keywords: [],
    sources: [
      {
        source_url: "internal://scaffold-fallback",
        retrieved_at: generatedAt,
        describes: "scaffold_fallback",
      },
    ],
    generated_at: generatedAt,
  };
}

function extractDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname || "unknown.invalid";
  } catch {
    return "unknown.invalid";
  }
}

main();
