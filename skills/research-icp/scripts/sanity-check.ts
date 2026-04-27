/**
 * Deterministic integrity checks for research-icp outputs.
 *
 * Exits non-zero on FAIL unless --allow-suspect or ALLOW_SUSPECT=1 is set.
 *
 * Usage:
 *   npx tsx scripts/sanity-check.ts <output.json> [--allow-suspect]
 */
import * as fs from "fs";
import * as path from "path";
import { researchIcpOutputSchema, type ResearchIcpOutput } from "../schemas/output.ts";

type Level = "fail" | "warn" | "ok";
type CheckResult = {
  level: Level;
  name: string;
  message: string;
  hint?: string;
};

const PLACEHOLDER_PATTERNS: RegExp[] = [
  /^\s*$/i,
  /^unknown$/i,
  /^tbd$/i,
  /^n\/a$/i,
  /^na$/i,
  /^none$/i,
  /^to be determined$/i,
  /\bplaceholder\b/i,
  /\bscaffold\b/i,
  /\btodo\b/i,
  /\blorem ipsum\b/i,
];

const FORBIDDEN_IMPORT_PATTERNS: RegExp[] = [
  /^\.\.\/\.\./,
  /^@\//,
  /^src\//,
  /^research-worker\//,
  /^skills\//,
  /^\.\.\/(?:research-|ingest-|synthesize-|present-|chat-)/,
];

function schemaValid(outputPath: string): { output?: ResearchIcpOutput; result: CheckResult } {
  const raw = JSON.parse(fs.readFileSync(outputPath, "utf-8")) as unknown;
  const parsed = researchIcpOutputSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 8)
      .map((issue) => `${issue.path.join(":")} - ${issue.message}`)
      .join("; ");
    return {
      result: {
        level: "fail",
        name: "schema-valid",
        message: `Output does not match researchIcpOutputSchema: ${issues}`,
        hint: "Run npm run validate for the full Zod issue list.",
      },
    };
  }
  return {
    output: parsed.data,
    result: { level: "ok", name: "schema-valid", message: "" },
  };
}

function personaAnchorFloor(output: ResearchIcpOutput): CheckResult {
  if (output.persona_anchors.length < 1) {
    return {
      level: "fail",
      name: "persona-anchor-floor",
      message: "persona_anchors must contain at least one sourced persona anchor.",
    };
  }
  return { level: "ok", name: "persona-anchor-floor", message: "" };
}

function jobTitleFloor(output: ResearchIcpOutput): CheckResult {
  if (output.job_titles.length < 1) {
    return {
      level: "fail",
      name: "job-title-floor",
      message: "job_titles must contain at least one sourced job title.",
    };
  }
  return { level: "ok", name: "job-title-floor", message: "" };
}

function sourceCoverage(output: ResearchIcpOutput): CheckResult[] {
  const results: CheckResult[] = [];
  output.persona_anchors.forEach((persona, personaIndex) => {
    persona.pains.forEach((pain, painIndex) => {
      if (!pain.source_url) {
        results.push({
          level: "fail",
          name: "missing-source-url",
          message: `persona_anchors:${personaIndex}:pains:${painIndex} is missing source_url.`,
        });
      }
      if (!pain.retrieved_at) {
        results.push({
          level: "fail",
          name: "missing-retrieved-at",
          message: `persona_anchors:${personaIndex}:pains:${painIndex} is missing retrieved_at.`,
        });
      }
    });
  });
  output.job_titles.forEach((jobTitle, jobTitleIndex) => {
    if (!jobTitle.source_url) {
      results.push({
        level: "fail",
        name: "missing-source-url",
        message: `job_titles:${jobTitleIndex} is missing source_url.`,
      });
    }
    if (!jobTitle.retrieved_at) {
      results.push({
        level: "fail",
        name: "missing-retrieved-at",
        message: `job_titles:${jobTitleIndex} is missing retrieved_at.`,
      });
    }
  });
  return results.length > 0
    ? results
    : [{ level: "ok", name: "source-coverage", message: "" }];
}

function scanPlaceholders(value: unknown, currentPath: string[] = []): CheckResult[] {
  if (typeof value === "string") {
    const matched = PLACEHOLDER_PATTERNS.find((pattern) => pattern.test(value));
    if (matched) {
      return [
        {
          level: "fail",
          name: "placeholder-rejection",
          message: `${currentPath.join(":")} contains placeholder text "${value}".`,
        },
      ];
    }
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      scanPlaceholders(item, [...currentPath, String(index)]),
    );
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, nestedValue]) =>
      scanPlaceholders(nestedValue, [...currentPath, key]),
    );
  }
  return [];
}

function listTypeScriptFiles(rootDir: string): string[] {
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const entryPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") {
        return [];
      }
      return listTypeScriptFiles(entryPath);
    }
    return entry.isFile() && entry.name.endsWith(".ts") ? [entryPath] : [];
  });
}

function noOutsideImports(skillRoot: string): CheckResult {
  const offenders: string[] = [];
  const importPattern =
    /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?["']([^"']+)["']/g;

  for (const filePath of listTypeScriptFiles(skillRoot)) {
    const content = fs.readFileSync(filePath, "utf-8");
    for (const match of content.matchAll(importPattern)) {
      const importPath = match[1] ?? "";
      if (FORBIDDEN_IMPORT_PATTERNS.some((pattern) => pattern.test(importPath))) {
        offenders.push(`${path.relative(skillRoot, filePath)} -> ${importPath}`);
      }
    }
  }

  if (offenders.length > 0) {
    return {
      level: "fail",
      name: "no-outside-imports",
      message: `Forbidden imports found: ${offenders.join(", ")}`,
      hint: "research-icp must stay self-contained; duplicate primitives locally.",
    };
  }
  return { level: "ok", name: "no-outside-imports", message: "" };
}

function main(): void {
  const outputPath = process.argv[2];
  const allowSuspect =
    process.argv.includes("--allow-suspect") ||
    process.env.ALLOW_SUSPECT === "1";

  if (!outputPath) {
    process.stderr.write(
      "Usage: sanity-check.ts <output.json> [--allow-suspect]\n",
    );
    process.exit(2);
  }

  const skillRoot = path.resolve(process.cwd());
  const schema = schemaValid(outputPath);
  const results: CheckResult[] = [schema.result, noOutsideImports(skillRoot)];

  if (schema.output) {
    results.push(
      personaAnchorFloor(schema.output),
      jobTitleFloor(schema.output),
      ...sourceCoverage(schema.output),
      ...scanPlaceholders(schema.output),
    );
  }

  const activeResults = results.filter((result) => result.level !== "ok");
  const fails = activeResults.filter((result) => result.level === "fail");
  const warns = activeResults.filter((result) => result.level === "warn");

  for (const result of activeResults) {
    process.stderr.write(
      `[sanity-check][${result.level.toUpperCase()}] ${result.name}: ${result.message}\n`,
    );
    if (result.hint) {
      process.stderr.write(`   hint: ${result.hint}\n`);
    }
  }

  if (fails.length > 0 && !allowSuspect) {
    process.stderr.write(
      `\n[sanity-check] ${fails.length} FAIL - blocking. ALLOW_SUSPECT=1 to override.\n`,
    );
    process.exit(1);
  }

  process.stdout.write(
    `[sanity-check] ${fails.length} fail (allowed), ${warns.length} warn\n`,
  );
}

main();
