// skills/landing-page-studio/scripts/generate-html.ts
// Per-direction HTML generator — calls Anthropic Sonnet to produce a complete HTML landing page.
// Output: output/<run-id>/html/direction-<id>.html
//
// Usage:
//   npx tsx scripts/generate-html.ts --run <run-id> --direction <A|B|C>
//
// PORTABILITY-EXCEPTION(v1): imports from src/ — to be extracted to skill-local copy in PRD #003
// TODO(skill-on-ollama): re-evaluate after Ollama-side fix
// Failure mode: Ollama (deepseek-v4-flash) produces malformed HTML with broken tag nesting
// and ignores OKLCH color constraints. Anthropic Sonnet is required for reliable full-page
// HTML generation until Ollama instruction-following on long structured outputs improves.

import { generateText } from "ai";
import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";

// PORTABILITY-EXCEPTION(v1): imports from src/ — to be extracted to skill-local copy in PRD #003
import { anthropic, MODELS } from "../../../src/lib/ai/providers.js";

import { parseBrandSpec, type BrandSpec } from "../contracts/brand-spec.js";
import { DirectionPlanSchema, type DirectionSpec } from "../schemas/directions.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(SKILL_ROOT, "../../..");

// ---------------------------------------------------------------------------
// CLI arg parsing
// ---------------------------------------------------------------------------

function parseArgs(args: string[]): { runId: string; directionId: "A" | "B" | "C" } {
  const runIdx = args.indexOf("--run");
  const dirIdx = args.indexOf("--direction");

  if (runIdx === -1 || runIdx + 1 >= args.length) {
    console.error("Error: --run <run-id> is required");
    process.exit(1);
  }
  if (dirIdx === -1 || dirIdx + 1 >= args.length) {
    console.error("Error: --direction <A|B|C> is required");
    process.exit(1);
  }

  const directionId = args[dirIdx + 1].toUpperCase();
  if (!["A", "B", "C"].includes(directionId)) {
    console.error(`Error: --direction must be A, B, or C. Got: ${directionId}`);
    process.exit(1);
  }

  return {
    runId: args[runIdx + 1],
    directionId: directionId as "A" | "B" | "C",
  };
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

async function buildSystemPrompt(): Promise<string> {
  const promptPath = path.join(SKILL_ROOT, "prompts", "html-generator.md");
  return fs.readFile(promptPath, "utf-8");
}

function buildUserPrompt(brandSpec: BrandSpec, direction: DirectionSpec): string {
  return `Generate a complete, self-contained HTML landing page for the following brand and design direction.

## BrandSpec
${JSON.stringify(brandSpec, null, 2)}

## Design Direction
${JSON.stringify(direction, null, 2)}

## Requirements
- Output ONLY the HTML document — no explanation, no markdown, no code fences
- Start with <!DOCTYPE html>
- Every color must use oklch() syntax
- Every major section needs a data-section attribute
- Lucide icons must be inline SVGs — no CDN script tags for Lucide
- Include the CSP meta tag in <head>
- Include <header>, <nav>, <main>, <footer> semantic elements
- Make the page specific to this brand — not generic SaaS

The page should express the ${direction.label} direction faithfully and completely.`;
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

async function generateHtml(
  brandSpec: BrandSpec,
  direction: DirectionSpec
): Promise<string> {
  const systemPrompt = await buildSystemPrompt();
  const userPrompt = buildUserPrompt(brandSpec, direction);

  console.log(`Generating HTML for direction ${direction.id}: ${direction.label}...`);
  console.log(`Model: ${MODELS.CLAUDE_SONNET}`);

  const startMs = Date.now();
  const result = await generateText({
    model: anthropic(MODELS.CLAUDE_SONNET),
    system: systemPrompt,
    prompt: userPrompt,
    maxOutputTokens: 8000,
  });
  const elapsedMs = Date.now() - startMs;

  const html = result.text.trim();

  // Validate output starts with HTML
  if (!html.startsWith("<!DOCTYPE html") && !html.toLowerCase().startsWith("<html")) {
    console.warn("Warning: Generated output does not start with <!DOCTYPE html — writing anyway (QA gates will catch issues)");
  }

  // Log generation stats
  console.log(`Generated ${html.length} chars in ${elapsedMs}ms`);
  if (result.usage) {
    console.log(`Tokens: ${result.usage.inputTokens} in / ${result.usage.outputTokens} out`);
  }

  return html;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const { runId, directionId } = parseArgs(args);

  const outputDir = path.join(REPO_ROOT, "output", runId);
  const directionsPath = path.join(outputDir, "directions.json");

  // Read directions.json
  let plan: ReturnType<typeof DirectionPlanSchema.parse>;
  try {
    const raw = await fs.readFile(directionsPath, "utf-8");
    plan = DirectionPlanSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      console.error(`Error: directions.json not found at ${directionsPath}`);
      console.error("Run plan-directions.ts first to generate directions.");
    } else {
      console.error(`Error reading directions.json: ${err instanceof Error ? err.message : err}`);
    }
    process.exit(1);
  }

  // Find the requested direction
  const direction = plan.directions.find((d) => d.id === directionId);
  if (!direction) {
    console.error(`Error: Direction ${directionId} not found in directions.json`);
    process.exit(1);
  }

  // Read BrandSpec from output dir (written by orchestrator) or look for brand-spec.json
  let brandSpec: BrandSpec;
  const brandSpecPath = path.join(outputDir, "brand-spec.json");
  try {
    const raw = await fs.readFile(brandSpecPath, "utf-8");
    brandSpec = parseBrandSpec(JSON.parse(raw));
  } catch (err) {
    console.error(`Error: brand-spec.json not found at ${brandSpecPath}`);
    console.error("The orchestrator (generate.ts) writes brand-spec.json to the run directory.");
    console.error("If running generate-html.ts standalone, copy your BrandSpec JSON to that path.");
    process.exit(1);
  }

  // Generate HTML
  let html: string;
  try {
    html = await generateHtml(brandSpec, direction);
  } catch (err) {
    console.error(`Error: HTML generation failed for direction ${directionId}`);
    console.error(err instanceof Error ? err.message : err);
    process.exit(3); // exit 3 = model API error
  }

  // Write output
  const htmlDir = path.join(outputDir, "html");
  await fs.mkdir(htmlDir, { recursive: true });
  const htmlPath = path.join(htmlDir, `direction-${directionId}.html`);
  await fs.writeFile(htmlPath, html, "utf-8");

  // Write generation log
  const logPath = path.join(htmlDir, `direction-${directionId}.gen.json`);
  await fs.writeFile(
    logPath,
    JSON.stringify(
      {
        direction_id: directionId,
        direction_label: direction.label,
        model: MODELS.CLAUDE_SONNET,
        output_chars: html.length,
        generated_at: new Date().toISOString(),
      },
      null,
      2
    ),
    "utf-8"
  );

  console.log(`\nHTML written to: ${htmlPath}`);
  console.log(`Generation log: ${logPath}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
