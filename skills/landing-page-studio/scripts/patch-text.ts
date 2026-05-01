// skills/landing-page-studio/scripts/patch-text.ts
// Text-only tweak script — rewrites copy in a named section using Ollama (free).
// HTML structure, CSS classes, OKLCH colors, and data-section attributes are preserved.
//
// Usage:
//   npx tsx scripts/patch-text.ts --run <run-id> --direction <A|B|C> \
//     --section <section-name> --instruction "<tweak instruction>"
//

import { generateText } from "ai";
import { parse as parseHtml, HTMLElement } from "node-html-parser";
import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";

import { getGtmSkillLanguageModel } from "../lib/skill-model";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(SKILL_ROOT, "../..");

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const PATCH_TEXT_SYSTEM_PROMPT = `You are a copywriting editor for landing pages.
You receive an HTML section and a rewrite instruction.
Your job: rewrite ONLY the text content — headlines, paragraphs, button labels, list items.

STRICT RULES:
- Return ONLY the HTML of the section, nothing else. No preamble, no explanation.
- Do not alter any HTML tags, CSS classes, Tailwind classes, or inline style attributes.
- Do not alter OKLCH color values (oklch(...) strings must remain unchanged).
- Do not remove or alter any data-section attribute.
- Do not wrap your response in markdown code fences or backticks.
- The first character of your response must be the opening tag of the section element.
- Do not introduce hex colors (#xxxxxx) into any style attribute.`;

// ---------------------------------------------------------------------------
// CLI arg parsing
// ---------------------------------------------------------------------------

interface PatchArgs {
  runId: string;
  directionId: "A" | "B" | "C";
  sectionName: string;
  instruction: string;
}

function parseArgs(args: string[]): PatchArgs {
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
  if (!instruction) { console.error("Error: --instruction <text> is required"); process.exit(1); }
  if (instruction.trim().length === 0) { console.error("Error: Instruction cannot be empty."); process.exit(1); }

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

function validateFragment(fragment: string, sectionName: string): void {
  if (fragment.includes("<!DOCTYPE") || fragment.toLowerCase().includes("<html")) {
    throw new Error(
      "Model returned full HTML page instead of section fragment. Aborting patch."
    );
  }
  if (!fragment.includes(`data-section="${sectionName}"`)) {
    throw new Error(
      `Model stripped data-section="${sectionName}" attribute. Aborting patch.`
    );
  }
  if (/style="[^"]*#[0-9a-fA-F]{3,8}/i.test(fragment)) {
    throw new Error(
      "Model introduced hex colors in style attributes. Aborting patch."
    );
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const { runId, directionId, sectionName, instruction } = parseArgs(args);

  const htmlPath = path.join(REPO_ROOT, "output", runId, "html", `direction-${directionId}.html`);

  // Read HTML file
  let html: string;
  try {
    html = await fs.readFile(htmlPath, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      console.error(`Error: Run ${runId} direction ${directionId} not found. Run T5 first.`);
    } else {
      console.error(`Error reading HTML file: ${err instanceof Error ? err.message : err}`);
    }
    process.exit(1);
  }

  // Extract target section
  const sectionHtml = extractSection(html, sectionName);
  if (!sectionHtml) {
    const available = listSections(html).join(", ");
    console.error(`Error: Section "${sectionName}" not found in direction-${directionId}.html`);
    console.error(`Available sections: ${available}`);
    process.exit(1);
  }

  // Call Ollama
  const model = getGtmSkillLanguageModel();

  console.log(`Patching section "${sectionName}" in direction-${directionId}.html...`);
  console.log(`Instruction: ${instruction}`);

  let rewrittenFragment: string;
  try {
    const { text } = await generateText({
      model,
      system: PATCH_TEXT_SYSTEM_PROMPT,
      prompt: `## Section HTML to rewrite\n${sectionHtml}\n\n## Instruction\n${instruction}\n\nReturn only the rewritten section HTML:`,
      maxOutputTokens: 2000,
    });
    rewrittenFragment = text.trim();
  } catch (err) {
    console.error(`Error: Ollama model call failed.`);
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

  // Validate
  try {
    validateFragment(rewrittenFragment, sectionName);
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  // Replace section in full HTML
  let updatedHtml: string;
  try {
    updatedHtml = replaceSection(html, sectionName, rewrittenFragment);
  } catch (err) {
    console.error(`Error replacing section: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  // Write back
  await fs.writeFile(htmlPath, updatedHtml, "utf-8");

  console.log(`Patched section "${sectionName}" in direction-${directionId}.html`);
  console.log(
    `\nPatch complete. Re-run QA to verify:\n  npx tsx skills/landing-page-studio/scripts/qa-runner.ts --run ${runId} --direction ${directionId}`
  );

  process.exit(0);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
