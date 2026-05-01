// skills/landing-page-studio/scripts/regen-section.ts
// Full section regeneration using Anthropic Sonnet (per-skill exemption).
// Regenerates one named section's HTML (layout + copy + colors) while preserving all others.
//
// Usage:
//   npx tsx scripts/regen-section.ts --run <run-id> --direction <A|B|C> \
//     --section <section-name> [--instruction "<tweak instruction>"]
//
// PORTABILITY-EXCEPTION(v1): imports from src/ — to be extracted to skill-local copy in PRD #003
// TODO(skill-on-ollama): re-evaluate after Ollama-side fix
// Failure mode: Ollama (deepseek-v4-flash) cannot reliably regenerate full HTML sections
// with correct OKLCH color constraints and structural fidelity. Anthropic Sonnet matches
// the quality of the original T5 generation, ensuring the regenerated section is coherent
// with the rest of the page.

import { generateText } from "ai";
import { parse as parseHtml, HTMLElement } from "node-html-parser";
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
// System prompt
// ---------------------------------------------------------------------------

const REGEN_SECTION_SYSTEM_PROMPT = `You are a landing page section designer.
You regenerate a single HTML section of a landing page given:
1. A BrandSpec (company name, tagline, value proposition, tone)
2. A DirectionSpec (layout paradigm, color palette in OKLCH, typographic register)
3. The current section HTML (for context — you are improving or redesigning it)
4. An optional user instruction

STRICT OUTPUT RULES:
- Return ONLY the HTML of the regenerated section. No preamble, no explanation.
- The first character must be the opening tag of the section element.
- Do NOT wrap in <!DOCTYPE>, <html>, <head>, or <body> tags.
- The root element MUST have the data-section attribute with the same value as the input section.
- All colors MUST use OKLCH format: oklch(L C H). No hex, no rgb, no hsl.
- Use the primary_color_oklch and accent_color_oklch from the DirectionSpec.
- Lucide icons: inline SVG paths only. No CDN script tags.
- Tailwind CSS classes are allowed (CDN is loaded in the parent document).
- Do not wrap your response in markdown code fences or backticks.`;

// ---------------------------------------------------------------------------
// CLI arg parsing
// ---------------------------------------------------------------------------

interface RegenArgs {
  runId: string;
  directionId: "A" | "B" | "C";
  sectionName: string;
  instruction: string | undefined;
}

function parseArgs(args: string[]): RegenArgs {
  const get = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
  };

  const runId = get("--run");
  const directionRaw = get("--direction");
  const sectionName = get("--section");
  const instruction = get("--instruction");

  if (!runId) { console.error("Error: --run <run-id> is required"); process.exit(1); }
  if (!directionRaw) { console.error("Error: --direction <A|B|C> is required"); process.exit(1); }
  if (!sectionName) { console.error("Error: --section <section-name> is required"); process.exit(1); }

  const directionId = directionRaw.toUpperCase();
  if (!["A", "B", "C"].includes(directionId)) {
    console.error(`Error: --direction must be A, B, or C. Got: ${directionId}`);
    process.exit(1);
  }

  return { runId, directionId: directionId as "A" | "B" | "C", sectionName, instruction };
}

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------

function extractSection(html: string, sectionName: string): string | null {
  const root = parseHtml(html);
  const el = root.querySelector(`[data-section="${sectionName}"]`);
  return el ? el.outerHTML : null;
}

function listSections(html: string): string[] {
  const root = parseHtml(html);
  return root
    .querySelectorAll("[data-section]")
    .map((el: HTMLElement) => el.getAttribute("data-section") ?? "")
    .filter(Boolean);
}

function replaceSection(html: string, sectionName: string, newHtml: string): string {
  const root = parseHtml(html);
  const el = root.querySelector(`[data-section="${sectionName}"]`);
  if (!el) throw new Error(`Section "${sectionName}" not found`);
  const newNode = parseHtml(newHtml);
  el.replaceWith(newNode.firstChild!);
  return root.toString();
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateRegenFragment(fragment: string, sectionName: string): void {
  if (fragment.includes("<!DOCTYPE") || fragment.toLowerCase().includes("<html")) {
    throw new Error(
      "Model returned full HTML page instead of section fragment. Aborting regen."
    );
  }
  if (!fragment.includes(`data-section="${sectionName}"`)) {
    throw new Error(
      `Model stripped data-section="${sectionName}". Section contract broken. Aborting regen.`
    );
  }
  if (/style="[^"]*#[0-9a-fA-F]{3,8}/i.test(fragment)) {
    throw new Error(
      "Model introduced hex colors in style attributes. Aborting regen."
    );
  }
  if (/src=["'][^"']*lucide/i.test(fragment)) {
    throw new Error(
      "Model included Lucide CDN script. Must use inline SVG. Aborting regen."
    );
  }
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildRegenPrompt(
  brandSpec: BrandSpec,
  directionSpec: DirectionSpec,
  currentSectionHtml: string,
  instruction: string | undefined
): string {
  return `## BrandSpec
${JSON.stringify(brandSpec, null, 2)}

## DirectionSpec
${JSON.stringify(directionSpec, null, 2)}

## Current Section HTML (for context — you are replacing this)
${currentSectionHtml}

## Regeneration Instruction
${instruction ?? "Improve this section while maintaining the direction's design language."}

Regenerate the section now. Return only the section HTML.`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const { runId, directionId, sectionName, instruction } = parseArgs(args);

  const outputDir = path.join(REPO_ROOT, "output", runId);
  const directionsPath = path.join(outputDir, "directions.json");
  const brandSpecPath = path.join(outputDir, "brand-spec.json");
  const htmlPath = path.join(outputDir, "html", `direction-${directionId}.html`);

  // Read directions.json
  let directionSpec: DirectionSpec;
  try {
    const raw = await fs.readFile(directionsPath, "utf-8");
    const plan = DirectionPlanSchema.parse(JSON.parse(raw));
    const found = plan.directions.find((d) => d.id === directionId);
    if (!found) {
      console.error(`Error: Direction ${directionId} not found in directions.json`);
      process.exit(1);
    }
    directionSpec = found;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      console.error(`Error: directions.json not found at ${directionsPath}`);
      console.error("Run plan-directions.ts first.");
    } else {
      console.error(`Error reading directions.json: ${err instanceof Error ? err.message : err}`);
    }
    process.exit(1);
  }

  // Read BrandSpec
  let brandSpec: BrandSpec;
  try {
    const raw = await fs.readFile(brandSpecPath, "utf-8");
    brandSpec = parseBrandSpec(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      console.error(`Error: brand-spec.json not found at ${brandSpecPath}`);
    } else {
      console.error(`Error reading brand-spec.json: ${err instanceof Error ? err.message : err}`);
    }
    process.exit(1);
  }

  // Read HTML file
  let html: string;
  try {
    html = await fs.readFile(htmlPath, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      console.error(`Error: direction-${directionId}.html not found. Run T5 (generate-html.ts) first.`);
    } else {
      console.error(`Error reading HTML: ${err instanceof Error ? err.message : err}`);
    }
    process.exit(1);
  }

  // Extract target section
  const currentSectionHtml = extractSection(html, sectionName);
  if (!currentSectionHtml) {
    const available = listSections(html).join(", ");
    console.error(`Error: Section "${sectionName}" not found in direction-${directionId}.html`);
    console.error(`Available sections: ${available}`);
    process.exit(1);
  }

  // Call Anthropic Sonnet
  console.log(`Regenerating section "${sectionName}" in direction-${directionId}.html...`);
  console.log(`Direction: ${directionSpec.label} (${directionSpec.layout_paradigm})`);
  console.log(`Model: ${MODELS.CLAUDE_SONNET}`);
  if (instruction) console.log(`Instruction: ${instruction}`);

  let regenFragment: string;
  try {
    const { text } = await generateText({
      model: anthropic(MODELS.CLAUDE_SONNET),
      system: REGEN_SECTION_SYSTEM_PROMPT,
      prompt: buildRegenPrompt(brandSpec, directionSpec, currentSectionHtml, instruction),
      maxOutputTokens: 4000,
    });
    regenFragment = text.trim();
  } catch (err) {
    console.error(`Error: Anthropic model call failed.`);
    console.error(err instanceof Error ? err.message : err);
    process.exit(3);
  }

  // Validate
  try {
    validateRegenFragment(regenFragment, sectionName);
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  // Replace section
  let updatedHtml: string;
  try {
    updatedHtml = replaceSection(html, sectionName, regenFragment);
  } catch (err) {
    console.error(`Error replacing section: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  // Write back
  await fs.writeFile(htmlPath, updatedHtml, "utf-8");

  console.log(`\nRegenerated section "${sectionName}" in direction-${directionId}.html`);
  console.log(
    `\nRe-run QA to verify:\n  npx tsx skills/landing-page-studio/scripts/qa-runner.ts --run ${runId} --direction ${directionId}`
  );

  process.exit(0);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
