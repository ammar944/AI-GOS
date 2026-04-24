/**
 * Deterministic end-of-pipeline orchestrator for the research-competitor skill.
 *
 * Assumes the LLM-driven collection phase is already done:
 *   - A main agent has written `<run_dir>/output.json` with run_id,
 *     source_company_name, competitor_set, generated_at, tool_calls_used.
 *   - N sub-agents have each written `<run_dir>/fragments/<slug>.json`
 *     (positioning / pricing / reviews / narrative_arc per competitor).
 *   - A competitors batch file exists at `<run_dir>/competitors.json`
 *     (array of { name, domain }) for the ads fetcher.
 *
 * This script then runs the deterministic tail:
 *   1. merge-fragments  — assemble LLM fragments into output.json
 *   2. fetch-ads        — SearchAPI pull for Meta Ad Library per competitor
 *   3. merge-ads        — splice ad data into output.json
 *   4. validate         — Zod schema gate
 *   5. generate-report  — render HTML
 *
 * Usage:
 *   SEARCHAPI_KEY=... npx tsx scripts/orchestrate.ts <run_dir>
 *
 * Any step failure halts the pipeline and surfaces the error.
 */
import { spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

function runStep(label: string, args: string[]): void {
  process.stdout.write(`\n━━ ${label} ━━\n`);
  const script = args[0];
  const result = spawnSync("npx", ["tsx", ...args], {
    stdio: "inherit",
    env: process.env,
    cwd: path.dirname(path.dirname(new URL(import.meta.url).pathname)),
  });
  if (result.status !== 0) {
    process.stderr.write(`[orchestrate] ${label} failed (exit ${result.status}) running ${script}\n`);
    process.exit(result.status ?? 1);
  }
}

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
  const outputJson = path.join(runDir, "output.json");
  const fragmentsDir = path.join(runDir, "fragments");
  const competitorsJson = path.join(runDir, "competitors.json");
  const adsJson = path.join(runDir, "ads.json");
  const reportHtml = path.join(runDir, "report.html");

  if (!fs.existsSync(outputJson)) {
    process.stderr.write(
      `[orchestrate] missing ${outputJson} — main agent must write initial output.json first\n`,
    );
    process.exit(1);
  }

  // Step 1: merge LLM fragments (optional — only if fragments dir exists)
  if (fs.existsSync(fragmentsDir)) {
    runStep("merge fragments", [
      "scripts/merge-fragments.ts",
      outputJson,
      fragmentsDir,
    ]);
  } else {
    process.stdout.write(
      `[orchestrate] skipping fragment merge (no ${fragmentsDir})\n`,
    );
  }

  // Step 2: fetch ads (if competitors.json present)
  if (fs.existsSync(competitorsJson)) {
    process.stdout.write("\n━━ fetch ads (SearchAPI → Meta Ad Library) ━━\n");
    const proc = spawnSync(
      "npx",
      ["tsx", "scripts/fetch-ads.ts", "--batch", competitorsJson],
      { env: process.env, encoding: "utf-8" },
    );
    if (proc.status !== 0) {
      process.stderr.write(`[orchestrate] fetch-ads failed: ${proc.stderr}\n`);
      process.exit(proc.status ?? 1);
    }
    fs.writeFileSync(adsJson, proc.stdout);
    if (proc.stderr) process.stderr.write(proc.stderr);
    process.stdout.write(`[orchestrate] wrote ${adsJson}\n`);
    runStep("merge ads", ["scripts/merge-ads.ts", outputJson, adsJson]);
  } else {
    process.stdout.write(
      `[orchestrate] skipping ad fetch (no ${competitorsJson})\n`,
    );
  }

  // Step 2.5: merge share-of-voice fragment (optional — only if sov sub-agent ran)
  const sovJson = path.join(runDir, "share_of_voice.json");
  if (fs.existsSync(sovJson)) {
    runStep("merge share-of-voice", ["scripts/merge-sov.ts", outputJson, sovJson]);
  } else {
    process.stdout.write(
      `[orchestrate] skipping SoV merge (no ${sovJson})\n`,
    );
  }

  // Step 2.75: sanity-check — integration + completeness heuristics.
  // Fails on subject-missing and all-zero-ads unless ALLOW_SUSPECT=1.
  runStep("sanity check", [
    "scripts/sanity-check.ts",
    outputJson,
    ...(process.env.ALLOW_SUSPECT === "1" ? ["--allow-suspect"] : []),
  ]);

  // Step 3: validate
  runStep("validate", ["scripts/validate.ts", outputJson]);

  // Step 4: report
  runStep("generate report", [
    "scripts/generate-report.ts",
    outputJson,
    reportHtml,
  ]);

  // Step 5: screenshot (optional — soft-fails if no headless browser available)
  const reportPng = path.join(runDir, "report.png");
  process.stdout.write("\n━━ screenshot (optional) ━━\n");
  const shot = spawnSync(
    "npx",
    ["tsx", "scripts/screenshot.ts", reportHtml, reportPng],
    {
      stdio: "inherit",
      env: process.env,
      cwd: path.dirname(path.dirname(new URL(import.meta.url).pathname)),
    },
  );
  const haveScreenshot = shot.status === 0 && fs.existsSync(reportPng);

  process.stdout.write(
    `\n✓ pipeline complete\n` +
      `  output: ${outputJson}\n` +
      `  report: file://${reportHtml}\n` +
      (haveScreenshot ? `  preview: file://${reportPng}\n` : ""),
  );
}

main();
