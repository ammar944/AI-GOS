/**
 * Deterministic integrity checks for research-keywords outputs.
 *
 * Usage:
 *   node --import tsx/esm scripts/sanity-check.ts <output.json>
 */
import * as fs from "fs";
import * as path from "path";
import {
  researchKeywordsOutputSchema,
  type ResearchKeywordsOutput,
} from "../schemas/output.ts";
import { normalizeKeyword } from "./normalize-keywords.ts";
import { formatProviderGateIssues, inspectProviderGates } from "./provider-gates.ts";

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
  /^not verified$/i,
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
  /^skills\/(?!research-keywords(?:\/|$))/,
  /^\.\.\/(?:research-|ingest-|synthesize-|present-|chat-)/,
];

const FORBIDDEN_KEYS = new Set([
  "priorityScore",
  "priority_score",
  "confidence",
  "recommendedMonthlyBudget",
  "recommended_monthly_budget",
  "recommendedBudget",
  "budget",
]);

function schemaValid(outputPath: string): { output?: ResearchKeywordsOutput; result: CheckResult } {
  const raw = JSON.parse(fs.readFileSync(outputPath, "utf-8")) as unknown;
  const parsed = researchKeywordsOutputSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 8)
      .map((issue) => `${issue.path.join(":")} - ${issue.message}`)
      .join("; ");
    return {
      result: {
        level: "fail",
        name: "schema-valid",
        message: `Output does not match researchKeywordsOutputSchema: ${issues}`,
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
      hint: "research-keywords must stay self-contained; duplicate primitives locally.",
    };
  }
  return { level: "ok", name: "no-outside-imports", message: "" };
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

function scanForbiddenKeys(value: unknown, currentPath: string[] = []): CheckResult[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      scanForbiddenKeys(item, [...currentPath, String(index)]),
    );
  }
  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.entries(value).flatMap(([key, nestedValue]) => {
    const keyPath = [...currentPath, key];
    const selfIssue = FORBIDDEN_KEYS.has(key)
      ? [
          {
            level: "fail" as const,
            name: "no-llm-scores",
            message: `${keyPath.join(":")} uses forbidden key "${key}".`,
          },
        ]
      : [];
    return [...selfIssue, ...scanForbiddenKeys(nestedValue, keyPath)];
  });
}

function duplicateNormalizedKeywords(output: ResearchKeywordsOutput): CheckResult {
  const seen = new Map<string, string>();
  const duplicates: string[] = [];
  const metrics = [
    ...output.intent_clusters.flatMap((cluster) => cluster.queries),
    ...output.paid_keyword_opportunities,
  ];

  for (const metric of metrics) {
    const normalized = normalizeKeyword(metric.keyword);
    const first = seen.get(normalized);
    if (first) {
      duplicates.push(`${metric.keyword} duplicates ${first}`);
      continue;
    }
    seen.set(normalized, metric.keyword);
  }

  if (duplicates.length > 0) {
    return {
      level: "fail",
      name: "duplicate-normalized-keyword",
      message: `Duplicate normalized keywords found: ${duplicates.join(", ")}`,
      hint: "Run npm run orchestrate -- example to normalize and dedupe output.",
    };
  }
  return { level: "ok", name: "duplicate-normalized-keyword", message: "" };
}

function providerGateResult(output: ResearchKeywordsOutput): CheckResult {
  const issues = inspectProviderGates(output);
  if (issues.length > 0) {
    return {
      level: "fail",
      name: "provider-gates",
      message: formatProviderGateIssues(issues),
    };
  }
  return { level: "ok", name: "provider-gates", message: "" };
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

  const skillRoot = process.cwd();
  const schema = schemaValid(outputPath);
  const raw = JSON.parse(fs.readFileSync(outputPath, "utf-8")) as unknown;
  const results: CheckResult[] = [
    schema.result,
    noOutsideImports(skillRoot),
    ...scanPlaceholders(raw),
    ...scanForbiddenKeys(raw),
  ];

  if (schema.output) {
    results.push(
      duplicateNormalizedKeywords(schema.output),
      providerGateResult(schema.output),
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
