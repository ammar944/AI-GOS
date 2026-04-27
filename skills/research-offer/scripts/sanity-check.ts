/**
 * Deterministic conformance checks for research-offer output.
 *
 * Usage:
 *   npx tsx scripts/sanity-check.ts <output.json>
 */
import * as fs from "fs";
import * as path from "path";
import { researchOfferOutputSchema, type ResearchOfferOutput } from "../schemas/output.ts";

type Level = "fail" | "ok";

interface CheckResult {
  level: Level;
  name: string;
  message: string;
}

const PLACEHOLDER_PATTERNS = [
  /^unknown$/i,
  /^tbd$/i,
  /^n\/a$/i,
  /^na$/i,
  /^\s*$/,
  /placeholder/i,
  /scaffold/i,
  /\btodo\b/i,
];

const BANNED_IMPORT_PATTERNS = [
  /\bfrom\s+["']\.\.\/\.\./,
  /\bimport\s*\(\s*["']\.\.\/\.\./,
  /\bfrom\s+["']@\//,
  /\bimport\s*\(\s*["']@\//,
  /\bfrom\s+["']src\//,
  /\bimport\s*\(\s*["']src\//,
  /\bfrom\s+["']research-worker\//,
  /\bimport\s*\(\s*["']research-worker\//,
  /\bfrom\s+["'].*skills\//,
  /\bimport\s*\(\s*["'].*skills\//,
];

function readJson(outputPath: string): unknown {
  return JSON.parse(fs.readFileSync(outputPath, "utf-8"));
}

function validateOutput(raw: unknown): ResearchOfferOutput {
  const result = researchOfferOutputSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 20)
      .map((issue) => `  ${issue.path.join(".") || "(root)"} - ${issue.message}`)
      .join("\n");
    throw new Error(`schema validation failed:\n${issues}`);
  }
  return result.data;
}

function pricingGapRequired(output: ResearchOfferOutput): CheckResult {
  const hasPricingGap = output.source_gaps.some((gap) => gap.topic === "pricing");
  if (output.pricing_signals.length === 0 && !hasPricingGap) {
    return {
      level: "fail",
      name: "pricing-gap-required",
      message:
        "pricing_signals is empty, but source_gaps has no topic=\"pricing\" entry.",
    };
  }

  return { level: "ok", name: "pricing-gap-required", message: "" };
}

function assertNoPlaceholders(output: ResearchOfferOutput): CheckResult {
  const failures: string[] = [];

  const scan = (value: unknown, currentPath: string): void => {
    if (typeof value === "string") {
      if (PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value))) {
        failures.push(`${currentPath}="${value}"`);
      }
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => scan(item, `${currentPath}[${index}]`));
      return;
    }

    if (value && typeof value === "object") {
      Object.entries(value).forEach(([key, nested]) => {
        scan(nested, currentPath ? `${currentPath}.${key}` : key);
      });
    }
  };

  scan(output.offer_path, "offer_path");
  scan(output.value_props, "value_props");
  scan(output.proof_assets, "proof_assets");
  scan(output.pricing_signals, "pricing_signals");
  scan(output.packaging_notes, "packaging_notes");
  scan(output.public_objections, "public_objections");
  scan(output.source_gaps, "source_gaps");

  if (failures.length > 0) {
    return {
      level: "fail",
      name: "placeholder-rejection",
      message: `placeholder text found: ${failures.slice(0, 10).join(", ")}`,
    };
  }

  return { level: "ok", name: "placeholder-rejection", message: "" };
}

function listTsFiles(root: string): string[] {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") {
        return [];
      }
      return listTsFiles(fullPath);
    }
    return entry.isFile() && entry.name.endsWith(".ts") ? [fullPath] : [];
  });
}

function noOutsideImports(skillRoot: string): CheckResult {
  const offenders: string[] = [];

  for (const filePath of listTsFiles(skillRoot)) {
    const source = fs.readFileSync(filePath, "utf-8");
    if (BANNED_IMPORT_PATTERNS.some((pattern) => pattern.test(source))) {
      offenders.push(path.relative(skillRoot, filePath));
    }
  }

  if (offenders.length > 0) {
    return {
      level: "fail",
      name: "no-outside-imports",
      message: `forbidden imports found in ${offenders.join(", ")}`,
    };
  }

  return { level: "ok", name: "no-outside-imports", message: "" };
}

function main(): void {
  const outputPath = process.argv[2];
  const allowSuspect = process.env.ALLOW_SUSPECT === "1";

  if (!outputPath) {
    process.stderr.write("Usage: sanity-check.ts <output.json>\n");
    process.exit(2);
  }

  let output: ResearchOfferOutput;
  try {
    output = validateOutput(readJson(outputPath));
  } catch (error) {
    process.stderr.write(
      `[sanity-check][FAIL] schema: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(allowSuspect ? 0 : 1);
  }

  const skillRoot = path.resolve(new URL("..", import.meta.url).pathname, "..");
  const results = [
    pricingGapRequired(output),
    assertNoPlaceholders(output),
    noOutsideImports(skillRoot),
  ].filter((result) => result.level === "fail");

  for (const result of results) {
    process.stderr.write(
      `[sanity-check][FAIL] ${result.name}: ${result.message}\n`,
    );
  }

  if (results.length > 0 && !allowSuspect) {
    process.stderr.write(
      `\n[sanity-check] ${results.length} FAIL - blocking. ALLOW_SUSPECT=1 to override.\n`,
    );
    process.exit(1);
  }

  process.stdout.write(`[sanity-check] ${results.length} fail (allowed), 0 warn\n`);
}

main();
