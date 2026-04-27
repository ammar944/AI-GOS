/**
 * Deterministic integrity checks for research-cross outputs.
 *
 * Exits non-zero on FAIL unless --allow-suspect or ALLOW_SUSPECT=1 is set.
 *
 * Usage:
 *   node --import tsx/esm scripts/sanity-check.ts <output.json> [--allow-suspect]
 */
import * as fs from "fs";
import * as path from "path";
import {
  researchCrossOutputSchema,
  type ResearchCrossOutput,
} from "../schemas/output.ts";

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
  /^not verified$/i,
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
  /^skills\/(?!research-cross(?:\/|$))/,
  /^\.\.\/(?:research-|ingest-|synthesize-|present-|chat-)/,
];

const FORBIDDEN_PROVIDER_KEYS = new Set([
  "provider",
  "provider_status",
  "tool_calls_used",
  "tool_logs",
  "query_log",
  "external_query_log",
  "search_log",
  "raw_tool_response",
]);

const FORBIDDEN_NUMERIC_KEYS = [
  /(?:^|_)score(?:_|$)/i,
  /^overallScore$/i,
  /^readinessScore$/i,
  /^priority$/i,
  /^confidence$/i,
];

function schemaValid(outputPath: string): {
  output?: ResearchCrossOutput;
  result: CheckResult;
} {
  const raw = JSON.parse(fs.readFileSync(outputPath, "utf-8")) as unknown;
  const parsed = researchCrossOutputSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 10)
      .map((issue) => `${issue.path.join(":")} - ${issue.message}`)
      .join("; ");
    return {
      result: {
        level: "fail",
        name: "schema-valid",
        message: `Output does not match researchCrossOutputSchema: ${issues}`,
        hint: "Run npm run validate for the full Zod issue list.",
      },
    };
  }
  return {
    output: parsed.data,
    result: { level: "ok", name: "schema-valid", message: "" },
  };
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
      hint: "research-cross must stay self-contained; duplicate primitives locally.",
    };
  }
  return { level: "ok", name: "no-outside-imports", message: "" };
}

function singleSourceFindings(output: ResearchCrossOutput): CheckResult[] {
  const results: CheckResult[] = [];
  [...output.cross_findings, ...output.high_confidence_themes].forEach(
    (finding, index) => {
      const skillCount = new Set(finding.derived_from.map((item) => item.skill)).size;
      if (skillCount < 2) {
        results.push({
          level: "fail",
          name: "single-source-finding",
          message: `finding:${index} derives from fewer than two distinct upstream skills.`,
        });
      }
    },
  );
  return results.length > 0
    ? results
    : [{ level: "ok", name: "single-source-finding", message: "" }];
}

function sourceCoverage(value: unknown, currentPath: string[] = []): CheckResult[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      sourceCoverage(item, [...currentPath, String(index)]),
    );
  }
  if (!value || typeof value !== "object") {
    return [];
  }

  const objectValue = value as Record<string, unknown>;
  const hasSourceUrl = "source_url" in objectValue;
  const hasRetrievedAt = "retrieved_at" in objectValue;
  const results: CheckResult[] = [];

  if (hasSourceUrl !== hasRetrievedAt) {
    results.push({
      level: "fail",
      name: "incomplete-source-object",
      message: `${currentPath.join(":")} must include both source_url and retrieved_at.`,
    });
  }

  return [
    ...results,
    ...Object.entries(objectValue).flatMap(([key, nestedValue]) =>
      sourceCoverage(nestedValue, [...currentPath, key]),
    ),
  ];
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

function scanForbiddenFields(value: unknown, currentPath: string[] = []): CheckResult[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      scanForbiddenFields(item, [...currentPath, String(index)]),
    );
  }
  if (!value || typeof value !== "object") {
    return [];
  }

  const results: CheckResult[] = [];
  for (const [key, nestedValue] of Object.entries(value)) {
    if (FORBIDDEN_PROVIDER_KEYS.has(key)) {
      results.push({
        level: "fail",
        name: "provider-tool-log-rejection",
        message: `${[...currentPath, key].join(":")} is a provider/tool log field.`,
      });
    }
    if (
      typeof nestedValue === "number" &&
      FORBIDDEN_NUMERIC_KEYS.some((pattern) => pattern.test(key))
    ) {
      results.push({
        level: "fail",
        name: "readiness-score-rejection",
        message: `${[...currentPath, key].join(":")} is a forbidden numeric score, priority, or confidence field.`,
      });
    }
    results.push(...scanForbiddenFields(nestedValue, [...currentPath, key]));
  }
  return results;
}

function main(): void {
  const outputPath = process.argv[2];
  const allowSuspect =
    process.argv.includes("--allow-suspect") || process.env.ALLOW_SUSPECT === "1";

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
      ...singleSourceFindings(schema.output),
      ...sourceCoverage(schema.output),
      ...scanPlaceholders(schema.output),
      ...scanForbiddenFields(schema.output),
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
