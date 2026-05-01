#!/usr/bin/env npx tsx
// skills/landing-page-studio/scripts/generate.ts
// Top-level CLI orchestrator for landing-page-studio.
// Subcommands: plan, generate, full, tweak-text, tweak-regen
//
// Usage:
//   npx tsx scripts/generate.ts --help
//   npx tsx scripts/generate.ts full --brand <path> --run <run-id>
//   npx tsx scripts/generate.ts plan --brand <path> --run <run-id>
//   npx tsx scripts/generate.ts generate --run <run-id> --direction <A|B|C>
//   npx tsx scripts/generate.ts tweak-text --run <run-id> --direction <A|B|C> --section <name> --instruction "<text>"
//   npx tsx scripts/generate.ts tweak-regen --run <run-id> --direction <A|B|C> --section <name> [--instruction "<text>"]

import { spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

// ---------------------------------------------------------------------------
// Arg parsing helpers
// ---------------------------------------------------------------------------

function parseArgs(args: string[]): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      result["help"] = true;
      i++;
    } else if (arg.startsWith("--")) {
      const key = arg.slice(2);
      if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
        result[key] = args[i + 1];
        i += 2;
      } else {
        result[key] = true;
        i++;
      }
    } else {
      i++;
    }
  }
  return result;
}

function requireArg(args: Record<string, string | boolean>, key: string, usage: string): string {
  const val = args[key];
  if (!val || val === true) {
    console.error(`Error: --${key} is required\n\n${usage}`);
    process.exit(1);
  }
  return val as string;
}

function checkEnvVars(vars: string[]): void {
  const missing = vars.filter((v) => !process.env[v] || process.env[v]!.trim() === "");
  if (missing.length > 0) {
    console.error(`Error: Missing environment variable(s): ${missing.join(", ")}`);
    console.error("Set these before running:");
    missing.forEach((v) => console.error(`  export ${v}=<your-key>`));
    process.exit(3);
  }
}

/**
 * Ollama is reachable in two modes:
 *  - Cloud: OLLAMA_API_KEY set (calls https://ollama.com/v1)
 *  - Local: OLLAMA_BASE_URL or OLLAMA_HOST set (or default localhost:11434 if a daemon is running)
 *
 * The skill-model resolver throws a clear cloud-needs-key error when the cloud path
 * is taken without a key, so we only need to ensure SOME path is configured here.
 */
function checkOllamaEnv(): void {
  const hasCloudKey = Boolean(process.env.OLLAMA_API_KEY?.trim());
  const hasLocalUrl =
    Boolean(process.env.OLLAMA_BASE_URL?.trim()) ||
    Boolean(process.env.OLLAMA_HOST?.trim());

  if (hasCloudKey || hasLocalUrl) return;

  // Default localhost — best-effort. Surface a one-line note so the user knows.
  console.warn(
    "Note: OLLAMA_API_KEY not set and no OLLAMA_BASE_URL/OLLAMA_HOST configured — defaulting to local Ollama at http://localhost:11434. Set OLLAMA_API_KEY for cloud, or start a local Ollama daemon."
  );
}

// ---------------------------------------------------------------------------
// Subprocess runner
// ---------------------------------------------------------------------------

function runScript(scriptName: string, scriptArgs: string[]): number {
  const scriptPath = path.join(__dirname, scriptName);
  const result = spawnSync(
    "npx",
    ["tsx", scriptPath, ...scriptArgs],
    {
      cwd: REPO_ROOT,
      stdio: "inherit",
      env: process.env,
    }
  );
  if (result.error) {
    console.error(`Failed to run ${scriptName}: ${result.error.message}`);
    return 2;
  }
  return result.status ?? 2;
}

// ---------------------------------------------------------------------------
// Help text
// ---------------------------------------------------------------------------

const TOP_HELP = `
landing-page-studio — generates on-brand landing pages from a BrandSpec

USAGE
  npx tsx scripts/generate.ts <subcommand> [options]

SUBCOMMANDS
  plan          Pick 3 disjoint design directions (no HTML generation)
  generate      Render HTML for one direction from an existing plan
  full          End-to-end: plan + generate all 3 HTML variants
  tweak-text    Edit copy in a section without regenerating layout (Ollama)
  tweak-regen   Regenerate one section with Anthropic Sonnet

  Run any subcommand with --help for detailed usage.

ENVIRONMENT VARIABLES
  ANTHROPIC_API_KEY   Required for: generate, full, tweak-regen
  OLLAMA_API_KEY      Required for: plan, full, tweak-text (Ollama cloud)

EXAMPLES
  npx tsx scripts/generate.ts full --brand example/brief.json --run my-run-001
  npx tsx scripts/generate.ts plan --brand example/brief.json --run my-run-001
  npx tsx scripts/generate.ts generate --run my-run-001 --direction A
  npx tsx scripts/generate.ts tweak-text --run my-run-001 --direction A --section hero --instruction "More urgent"
  npx tsx scripts/generate.ts tweak-regen --run my-run-001 --direction A --section hero
`.trim();

const PLAN_HELP = `
plan — pick 3 disjoint design directions from the taxonomy

USAGE
  npx tsx scripts/generate.ts plan --brand <path> --run <run-id>

OPTIONS
  --brand <path>   Path to BrandSpec JSON file (required)
  --run <run-id>   Run identifier (output goes to output/<run-id>/)

OUTPUT
  output/<run-id>/directions.json   3 selected directions with rationale
  output/<run-id>/brand-spec.json   Copy of the BrandSpec

REQUIRES
  OLLAMA_API_KEY
`.trim();

const GENERATE_HELP = `
generate — render HTML for one direction from an existing plan

USAGE
  npx tsx scripts/generate.ts generate --run <run-id> --direction <A|B|C>

OPTIONS
  --run <run-id>         Run identifier (reads from output/<run-id>/)
  --direction <A|B|C>   Which direction to generate (required)

REQUIRES
  ANTHROPIC_API_KEY
  output/<run-id>/directions.json (from 'plan' subcommand)
  output/<run-id>/brand-spec.json (from 'plan' subcommand)
`.trim();

const FULL_HELP = `
full — end-to-end run: plan 3 directions + generate all 3 HTML variants

USAGE
  npx tsx scripts/generate.ts full --brand <path> --run <run-id>

OPTIONS
  --brand <path>   Path to BrandSpec JSON file (required)
  --run <run-id>   Run identifier (output goes to output/<run-id>/)

IDEMPOTENT
  If output/<run-id>/directions.json already exists, skips planning and
  goes straight to HTML generation (re-render from existing plan).

OUTPUT
  output/<run-id>/directions.json
  output/<run-id>/brand-spec.json
  output/<run-id>/html/direction-A.html
  output/<run-id>/html/direction-B.html
  output/<run-id>/html/direction-C.html
  output/<run-id>/html/direction-*.gen.json   (generation logs)

REQUIRES
  ANTHROPIC_API_KEY
  OLLAMA_API_KEY
`.trim();

const TWEAK_TEXT_HELP = `
tweak-text — edit copy in a section without regenerating layout (Ollama, free)

USAGE
  npx tsx scripts/generate.ts tweak-text --run <run-id> --direction <A|B|C> --section <name> --instruction "<text>"

OPTIONS
  --run <run-id>          Run identifier
  --direction <A|B|C>     Which direction HTML to patch
  --section <name>        data-section attribute value (e.g. hero, features, cta)
  --instruction <text>    Natural-language instruction for the copy rewrite

REQUIRES
  OLLAMA_API_KEY
`.trim();

const TWEAK_REGEN_HELP = `
tweak-regen — fully regenerate one section using Anthropic Sonnet

USAGE
  npx tsx scripts/generate.ts tweak-regen --run <run-id> --direction <A|B|C> --section <name> [--instruction "<text>"]

OPTIONS
  --run <run-id>           Run identifier
  --direction <A|B|C>      Which direction HTML to regenerate a section of
  --section <name>         data-section attribute value (e.g. hero, features, cta)
  --instruction <text>     Optional: regeneration instruction (default: improve with same direction)

REQUIRES
  ANTHROPIC_API_KEY
`.trim();

// ---------------------------------------------------------------------------
// Subcommand: plan
// ---------------------------------------------------------------------------

async function runPlan(args: Record<string, string | boolean>): Promise<void> {
  if (args["help"]) { console.log(PLAN_HELP); process.exit(0); }

  checkOllamaEnv();

  const brand = requireArg(args, "brand", PLAN_HELP);
  const run = requireArg(args, "run", PLAN_HELP);

  // Resolve brand path
  const brandPath = path.isAbsolute(brand as string)
    ? brand as string
    : path.resolve(process.cwd(), brand as string);

  if (!fs.existsSync(brandPath)) {
    console.error(`Error: Brand spec not found: ${brandPath}`);
    process.exit(1);
  }

  // Copy brand-spec.json to output dir
  const outputDir = path.join(REPO_ROOT, "output", run as string);
  fs.mkdirSync(outputDir, { recursive: true });
  const brandSpecDest = path.join(outputDir, "brand-spec.json");
  fs.copyFileSync(brandPath, brandSpecDest);
  console.log(`BrandSpec copied to: ${brandSpecDest}`);

  // Run direction planner
  console.log("\n[1/1] Planning directions...");
  const code = runScript("plan-directions.ts", ["--run", run as string, "--brand", brandPath]);
  if (code !== 0) {
    console.error(`Error: plan-directions.ts exited with code ${code}`);
    process.exit(2);
  }

  console.log(`\nPlan complete. Output: output/${run}/directions.json`);
}

// ---------------------------------------------------------------------------
// Subcommand: generate
// ---------------------------------------------------------------------------

async function runGenerate(args: Record<string, string | boolean>): Promise<void> {
  if (args["help"]) { console.log(GENERATE_HELP); process.exit(0); }

  checkEnvVars(["ANTHROPIC_API_KEY"]);

  const run = requireArg(args, "run", GENERATE_HELP);
  const direction = requireArg(args, "direction", GENERATE_HELP);

  if (!["A", "B", "C"].includes(direction.toUpperCase())) {
    console.error(`Error: --direction must be A, B, or C. Got: ${direction}`);
    process.exit(1);
  }

  // Verify plan exists
  const directionsPath = path.join(REPO_ROOT, "output", run as string, "directions.json");
  if (!fs.existsSync(directionsPath)) {
    console.error(`Error: directions.json not found at ${directionsPath}`);
    console.error("Run 'plan' subcommand first.");
    process.exit(1);
  }

  const dirId = direction.toUpperCase();

  // Generate HTML
  console.log(`\n[1/2] Generating HTML for direction ${dirId}...`);
  let code = runScript("generate-html.ts", ["--run", run as string, "--direction", dirId]);
  if (code !== 0) {
    console.error(`Error: generate-html.ts exited with code ${code}`);
    process.exit(2);
  }

  // Post-process
  console.log("\n[2/2] Post-processing (CSP, OKLCH, Lucide)...");
  code = runScript("post-process.ts", ["--run", run as string]);
  if (code !== 0) {
    console.error(`Warning: post-process.ts exited with code ${code} (non-blocking)`);
  }

  console.log(`\nGenerate complete. Output: output/${run}/html/direction-${dirId}.html`);
}

// ---------------------------------------------------------------------------
// Subcommand: full
// ---------------------------------------------------------------------------

async function runFull(args: Record<string, string | boolean>): Promise<void> {
  if (args["help"]) { console.log(FULL_HELP); process.exit(0); }

  checkEnvVars(["ANTHROPIC_API_KEY"]);
  checkOllamaEnv();

  const brand = requireArg(args, "brand", FULL_HELP);
  const run = requireArg(args, "run", FULL_HELP);

  const brandPath = path.isAbsolute(brand as string)
    ? brand as string
    : path.resolve(process.cwd(), brand as string);

  if (!fs.existsSync(brandPath)) {
    console.error(`Error: Brand spec not found: ${brandPath}`);
    process.exit(1);
  }

  const outputDir = path.join(REPO_ROOT, "output", run as string);
  const directionsPath = path.join(outputDir, "directions.json");

  // Step 1: Plan (idempotent — skip if already done)
  if (fs.existsSync(directionsPath)) {
    console.log(`[1/5] Planning skipped — directions.json already exists (idempotent)`);
  } else {
    // Copy brand spec
    fs.mkdirSync(outputDir, { recursive: true });
    const brandSpecDest = path.join(outputDir, "brand-spec.json");
    fs.copyFileSync(brandPath, brandSpecDest);

    console.log("[1/5] Planning directions...");
    const code = runScript("plan-directions.ts", ["--run", run as string, "--brand", brandPath]);
    if (code !== 0) {
      console.error(`Error: plan-directions.ts exited with code ${code}`);
      process.exit(2);
    }
  }

  // Steps 2-4: Generate HTML for each direction
  for (const dirId of ["A", "B", "C"] as const) {
    const step = dirId === "A" ? 2 : dirId === "B" ? 3 : 4;
    const htmlPath = path.join(outputDir, "html", `direction-${dirId}.html`);

    if (fs.existsSync(htmlPath)) {
      console.log(`[${step}/5] HTML direction ${dirId} skipped — already exists (idempotent)`);
      continue;
    }

    console.log(`\n[${step}/5] Generating HTML for direction ${dirId}...`);
    const code = runScript("generate-html.ts", ["--run", run as string, "--direction", dirId]);
    if (code !== 0) {
      console.error(`Error: generate-html.ts direction ${dirId} exited with code ${code}`);
      process.exit(2);
    }
  }

  // Step 5: Post-process all 3 files
  console.log("\n[5/5] Post-processing all directions (CSP, OKLCH, Lucide)...");
  const ppCode = runScript("post-process.ts", ["--run", run as string]);
  if (ppCode !== 0) {
    console.error(`Warning: post-process.ts exited with code ${ppCode} (non-blocking)`);
  }

  // Summary
  console.log("\n=== Full run complete ===");
  console.log(`Run ID: ${run}`);
  console.log(`Output directory: output/${run}/`);
  console.log("Files produced:");
  for (const dirId of ["A", "B", "C"]) {
    const htmlPath = path.join(outputDir, "html", `direction-${dirId}.html`);
    const exists = fs.existsSync(htmlPath);
    console.log(`  direction-${dirId}.html  ${exists ? "OK" : "MISSING"}`);
  }
}

// ---------------------------------------------------------------------------
// Subcommand: tweak-text
// ---------------------------------------------------------------------------

async function runTweakText(args: Record<string, string | boolean>): Promise<void> {
  if (args["help"]) { console.log(TWEAK_TEXT_HELP); process.exit(0); }

  checkOllamaEnv();

  const run = requireArg(args, "run", TWEAK_TEXT_HELP);
  const direction = requireArg(args, "direction", TWEAK_TEXT_HELP);
  const section = requireArg(args, "section", TWEAK_TEXT_HELP);
  const instruction = requireArg(args, "instruction", TWEAK_TEXT_HELP);

  const code = runScript("patch-text.ts", [
    "--run", run as string,
    "--direction", direction as string,
    "--section", section as string,
    "--instruction", instruction as string,
  ]);

  if (code !== 0) {
    console.error(`Error: patch-text.ts exited with code ${code}`);
    process.exit(code === 1 ? 1 : 2);
  }
}

// ---------------------------------------------------------------------------
// Subcommand: tweak-regen
// ---------------------------------------------------------------------------

async function runTweakRegen(args: Record<string, string | boolean>): Promise<void> {
  if (args["help"]) { console.log(TWEAK_REGEN_HELP); process.exit(0); }

  checkEnvVars(["ANTHROPIC_API_KEY"]);

  const run = requireArg(args, "run", TWEAK_REGEN_HELP);
  const direction = requireArg(args, "direction", TWEAK_REGEN_HELP);
  const section = requireArg(args, "section", TWEAK_REGEN_HELP);

  const scriptArgs = [
    "--run", run as string,
    "--direction", direction as string,
    "--section", section as string,
  ];

  // --instruction is optional for tweak-regen
  const instruction = args["instruction"];
  if (instruction && instruction !== true) {
    scriptArgs.push("--instruction", instruction as string);
  }

  const code = runScript("regen-section.ts", scriptArgs);

  if (code !== 0) {
    console.error(`Error: regen-section.ts exited with code ${code}`);
    process.exit(code === 1 ? 1 : code === 3 ? 3 : 2);
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const [,, subcommand, ...rest] = process.argv;
const args = parseArgs(rest);

switch (subcommand) {
  case "plan":
    await runPlan(args);
    break;
  case "generate":
    await runGenerate(args);
    break;
  case "full":
    await runFull(args);
    break;
  case "tweak-text":
    await runTweakText(args);
    break;
  case "tweak-regen":
    await runTweakRegen(args);
    break;
  case "--help":
  case "-h":
  case "help":
    console.log(TOP_HELP);
    process.exit(0);
    break;
  case undefined:
    console.error("Error: subcommand required\n");
    console.log(TOP_HELP);
    process.exit(1);
    break;
  default:
    console.error(`Error: unknown subcommand: ${subcommand}\n`);
    console.log(TOP_HELP);
    process.exit(1);
}
