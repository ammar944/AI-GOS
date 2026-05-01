// skills/landing-page-studio/scripts/plan-directions.ts
// Direction Planner — reads a BrandSpec and calls Ollama to pick 3 disjoint design directions.
// Output: output/<run-id>/directions.json
//
// Usage:
//   npx tsx scripts/plan-directions.ts --run <run-id> --brand <path-to-brand-spec.json>
//
// PORTABILITY-EXCEPTION(v1): imports from src/ — to be extracted to skill-local copy in PRD #003

import { generateObject } from "ai";
import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";

// PORTABILITY-EXCEPTION(v1): imports from src/ — to be extracted to skill-local copy in PRD #003
import { getGtmSkillLanguageModel } from "../../../src/lib/gtm/skill-model.js";

import { parseBrandSpec, type BrandSpec } from "../contracts/brand-spec.js";
import { DirectionPlanSchema, type DirectionPlan } from "../schemas/directions.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(SKILL_ROOT, "../../..");

// ---------------------------------------------------------------------------
// CLI arg parsing
// ---------------------------------------------------------------------------

function parseArgs(args: string[]): { runId: string; brandPath: string } {
  const runIdx = args.indexOf("--run");
  const brandIdx = args.indexOf("--brand");

  if (runIdx === -1 || runIdx + 1 >= args.length) {
    console.error("Error: --run <run-id> is required");
    process.exit(1);
  }
  if (brandIdx === -1 || brandIdx + 1 >= args.length) {
    console.error("Error: --brand <path-to-brand-spec.json> is required");
    process.exit(1);
  }

  return {
    runId: args[runIdx + 1],
    brandPath: args[brandIdx + 1],
  };
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildPrompt(brandSpec: BrandSpec): string {
  return `You are a visual direction planner for landing pages. Given a BrandSpec, produce exactly 3 landing page directions that are maximally distinct.

Rules:
- No two directions may use the same layout_paradigm AND color_temperature combination
- No two directions may use primary colors from the same hue family (within 60 degrees on the color wheel)
- All colors MUST be expressed as OKLCH strings in the format: oklch(L C H) where L is 0-1, C is 0-0.4, H is 0-360
- Each direction must feel like a different design studio made it
- Direction A should feel editorial or minimal
- Direction B should feel bold, data-driven, or hero-forward
- Direction C should feel modern, grid-based, or card-structured
- The rationale must explain in one sentence how this direction is visually distinct from the other two

BrandSpec:
${JSON.stringify(brandSpec, null, 2)}

Respond with a JSON object matching the DirectionPlan schema with exactly 3 directions (ids: "A", "B", "C").`;
}

// ---------------------------------------------------------------------------
// Planner with retry
// ---------------------------------------------------------------------------

async function planWithRetry(
  brandSpec: BrandSpec,
  maxAttempts = 2
): Promise<DirectionPlan> {
  const model = getGtmSkillLanguageModel();

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`Planning directions (attempt ${attempt}/${maxAttempts})...`);
      const { object } = await generateObject({
        model,
        schema: DirectionPlanSchema,
        prompt: buildPrompt(brandSpec),
      });
      return object;
    } catch (err) {
      if (attempt === maxAttempts) {
        throw err;
      }
      console.error(`Attempt ${attempt} failed, retrying...`, err instanceof Error ? err.message : err);
    }
  }

  // Unreachable but satisfies TS
  throw new Error("planWithRetry exhausted");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const { runId, brandPath } = parseArgs(args);

  // Resolve brand path (relative to cwd or absolute)
  const resolvedBrandPath = path.isAbsolute(brandPath)
    ? brandPath
    : path.resolve(process.cwd(), brandPath);

  // Read and validate BrandSpec
  let brandSpec: BrandSpec;
  try {
    const raw = await fs.readFile(resolvedBrandPath, "utf-8");
    brandSpec = parseBrandSpec(JSON.parse(raw));
    console.log(`BrandSpec loaded: ${brandSpec.brandName}`);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      console.error(`Error: Brand spec not found: ${resolvedBrandPath}`);
    } else {
      console.error(`Error: Failed to parse brand spec: ${err instanceof Error ? err.message : err}`);
    }
    process.exit(1);
  }

  // Run planner
  let plan: DirectionPlan;
  try {
    plan = await planWithRetry(brandSpec);
  } catch (err) {
    console.error(`Error: Direction planning failed after all attempts.`);
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

  // Write output
  const outputDir = path.join(REPO_ROOT, "output", runId);
  await fs.mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, "directions.json");
  await fs.writeFile(outputPath, JSON.stringify(plan, null, 2), "utf-8");

  console.log(`\nDirections written to: ${outputPath}`);
  console.log(`Directions:`);
  for (const d of plan.directions) {
    console.log(`  ${d.id}: ${d.label} (${d.layout_paradigm} / ${d.color_temperature} / ${d.typographic_register})`);
    console.log(`     ${d.rationale}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
