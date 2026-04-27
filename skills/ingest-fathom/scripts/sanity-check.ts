/**
 * Deterministic integrity checks for ingest-fathom outputs.
 *
 * Usage:
 *   npx tsx scripts/sanity-check.ts <output.json>
 */
import * as fs from "fs";
import * as path from "path";
import {
  ingestFathomOutputSchema,
  type IngestFathomOutput,
} from "../schemas/output.ts";

type CheckLevel = "fail" | "ok";
type CheckResult = {
  level: CheckLevel;
  name: string;
  message: string;
  hint?: string;
};

type QuoteRequirement = {
  path: string;
  evidence?: {
    value: string;
    speaker: string;
    source_url: string;
    retrieved_at: string;
  };
};

const PLACEHOLDER_PATTERNS: RegExp[] = [
  /^\s*$/i,
  /^unknown$/i,
  /^tbd$/i,
  /^n\/a$/i,
  /^na$/i,
  /^not found$/i,
  /^scaffold$/i,
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
  /^skills\/(?!ingest-fathom(?:\/|$))/,
];

const FORBIDDEN_WRITE_MARKERS: string[] = [
  ["business", "profile", "documents"].join("_"),
  ["journey", "sessions"].join("_"),
  ["create", "Admin", "Client"].join(""),
  ["get", "Client"].join(""),
  ["service", "role"].join("_"),
  ["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_"),
];

function schemaValid(outputPath: string): { output?: IngestFathomOutput; result: CheckResult } {
  const raw = JSON.parse(fs.readFileSync(outputPath, "utf-8")) as unknown;
  const parsed = ingestFathomOutputSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 8)
      .map((issue) => `${issue.path.join(":")} - ${issue.message}`)
      .join("; ");
    return {
      result: {
        level: "fail",
        name: "schema-valid",
        message: `Output does not match ingestFathomOutputSchema: ${issues}`,
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
      hint: "ingest-fathom must stay self-contained; duplicate primitives locally.",
    };
  }
  return { level: "ok", name: "no-outside-imports", message: "" };
}

function noPersistenceWrites(skillRoot: string): CheckResult {
  const offenders: string[] = [];
  const scriptDir = path.join(skillRoot, "scripts");

  if (!fs.existsSync(scriptDir)) {
    return { level: "ok", name: "no-supabase-write", message: "" };
  }

  for (const filePath of listTypeScriptFiles(scriptDir)) {
    const content = fs.readFileSync(filePath, "utf-8");
    const marker = FORBIDDEN_WRITE_MARKERS.find((pattern) => content.includes(pattern));
    if (marker) {
      offenders.push(`${path.relative(skillRoot, filePath)} matched ${marker}`);
    }
  }

  if (offenders.length > 0) {
    return {
      level: "fail",
      name: "no-supabase-write",
      message: `Forbidden write markers found: ${offenders.join(", ")}`,
    };
  }
  return { level: "ok", name: "no-supabase-write", message: "" };
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

function collectQuoteRequirements(output: IngestFathomOutput): QuoteRequirement[] {
  return [
    ...output.pain_points.map((item, index) => ({
      path: `pain_points:${index}:evidence`,
      evidence: item.evidence,
    })),
    ...output.competitor_mentions.map((item, index) => ({
      path: `competitor_mentions:${index}:evidence`,
      evidence: item.evidence,
    })),
    ...output.buying_triggers.map((item, index) => ({
      path: `buying_triggers:${index}:evidence`,
      evidence: item.evidence,
    })),
    ...output.objections.map((item, index) => ({
      path: `objections:${index}:evidence`,
      evidence: item.evidence,
    })),
    ...output.goals_and_outcomes.evidence.map((item, index) => ({
      path: `goals_and_outcomes:evidence:${index}`,
      evidence: item,
    })),
    ...output.action_items.map((item, index) => ({
      path: `action_items:${index}:evidence`,
      evidence: item.evidence,
    })),
    ...output.decisions.map((item, index) => ({
      path: `decisions:${index}:evidence`,
      evidence: item.evidence,
    })),
  ];
}

function quoteRequirements(output: IngestFathomOutput): CheckResult[] {
  const failures = collectQuoteRequirements(output).filter((requirement) => {
    const evidence = requirement.evidence;
    return (
      !evidence ||
      !evidence.value ||
      !evidence.speaker ||
      !evidence.source_url ||
      !evidence.retrieved_at
    );
  });

  if (failures.length > 0) {
    return failures.map((failure) => ({
      level: "fail",
      name: "quote-required",
      message: `${failure.path} is missing a speaker-attributed transcript quote.`,
    }));
  }
  return [{ level: "ok", name: "quote-required", message: "" }];
}

function noInferredBudget(output: IngestFathomOutput): CheckResult {
  const offenders = output.budget_signals
    .map((signal, index) => ({ signal, index }))
    .filter(({ signal }) => !signal.evidence.value || !signal.evidence.speaker);

  if (offenders.length > 0) {
    return {
      level: "fail",
      name: "no-inferred-budget",
      message: `budget_signals require exact speaker-attributed quote evidence: ${offenders
        .map(({ index }) => index)
        .join(", ")}`,
    };
  }
  return { level: "ok", name: "no-inferred-budget", message: "" };
}

function sourceUrlMatchesRecording(output: IngestFathomOutput): CheckResult[] {
  const mismatches: string[] = [];

  function visit(value: unknown, currentPath: string[] = []): void {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, [...currentPath, String(index)]));
      return;
    }
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      if (
        typeof record.source_url === "string" &&
        record.source_url !== output.recording_url
      ) {
        mismatches.push(`${currentPath.join(":")} source_url=${record.source_url}`);
      }
      Object.entries(record).forEach(([key, nestedValue]) =>
        visit(nestedValue, [...currentPath, key]),
      );
    }
  }

  visit(output);

  if (mismatches.length > 0) {
    return mismatches.map((message) => ({
      level: "fail",
      name: "recording-source-url",
      message,
    }));
  }
  return [{ level: "ok", name: "recording-source-url", message: "" }];
}

function main(): void {
  const outputPath = process.argv[2];
  if (!outputPath) {
    process.stderr.write("Usage: sanity-check.ts <output.json>\n");
    process.exit(2);
  }

  const skillRoot = process.cwd();
  const schema = schemaValid(outputPath);
  const results: CheckResult[] = [
    schema.result,
    noOutsideImports(skillRoot),
    noPersistenceWrites(skillRoot),
  ];

  if (schema.output) {
    results.push(
      ...scanPlaceholders(schema.output),
      ...quoteRequirements(schema.output),
      noInferredBudget(schema.output),
      ...sourceUrlMatchesRecording(schema.output),
    );
  }

  const failures = results.filter((result) => result.level === "fail");
  for (const result of failures) {
    process.stderr.write(
      `[sanity-check][FAIL] ${result.name}: ${result.message}\n`,
    );
    if (result.hint) {
      process.stderr.write(`   hint: ${result.hint}\n`);
    }
  }

  if (failures.length > 0) {
    process.stderr.write(`\n[sanity-check] ${failures.length} FAIL - blocking.\n`);
    process.exit(1);
  }

  process.stdout.write("[sanity-check] 0 fail\n");
}

main();
