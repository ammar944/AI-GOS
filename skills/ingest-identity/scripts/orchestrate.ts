/**
 * ingest-identity — orchestrator (SCAFFOLD)
 *
 * Minimal entry so the skill is loadable by research-worker/src/runtime/skill-loader.
 * Writes a placeholder output.json and runs scripts/validate.ts over it.
 *
 * Slice 1 Lane D will replace the placeholder with real identity resolution.
 *
 * Usage:
 *   npx tsx scripts/orchestrate.ts <run_dir>
 */
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

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

  const outputPath = path.join(runDir, "output.json");
  const placeholder = {
    run_id: "scaffold",
    company_name: "TODO",
    domain: "todo.example.com",
    generated_at: new Date().toISOString(),
  };
  fs.writeFileSync(outputPath, JSON.stringify(placeholder, null, 2));
  process.stdout.write(`[orchestrate] wrote ${outputPath}\n`);

  const validate = spawnSync(
    "npx",
    ["tsx", "scripts/validate.ts", outputPath],
    {
      stdio: "inherit",
      env: process.env,
      cwd: path.dirname(path.dirname(new URL(import.meta.url).pathname)),
    },
  );
  if (validate.status !== 0) {
    process.stderr.write(
      `[orchestrate] validate failed (exit ${validate.status})\n`,
    );
    process.exit(validate.status ?? 1);
  }
}

main();
