/**
 * Deterministic integrity checks for ingest-docs outputs and skill containment.
 */
import * as fs from "fs";
import * as path from "path";
import { ingestDocsOutputSchema, type IngestDocsOutput } from "../schemas/output.ts";

type Level = "fail" | "warn" | "ok";

interface CheckResult {
  level: Level;
  name: string;
  message: string;
  hint?: string;
}

const PLACEHOLDER_PATTERNS: RegExp[] = [
  /^\s*$/i,
  /^unknown$/i,
  /^tbd$/i,
  /^n\/a$/i,
  /^na$/i,
  /^not found$/i,
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
  /^skills\/(?!ingest-docs\/)/,
  /^\.\.\/(?:research-|ingest-|synthesize-|present-|chat-)/,
];

function schemaValid(outputPath: string): { output?: IngestDocsOutput; result: CheckResult } {
  const raw = JSON.parse(fs.readFileSync(outputPath, "utf-8")) as unknown;
  const parsed = ingestDocsOutputSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 8)
      .map((issue) => `${issue.path.join(":")} - ${issue.message}`)
      .join("; ");
    return {
      result: {
        level: "fail",
        name: "schema-valid",
        message: `Output does not match ingestDocsOutputSchema: ${issues}`,
        hint: "Run npm run validate for the full Zod issue list.",
      },
    };
  }
  return {
    output: parsed.data,
    result: { level: "ok", name: "schema-valid", message: "" },
  };
}

function sourceCoverage(output: IngestDocsOutput): CheckResult[] {
  const results: CheckResult[] = [];
  output.documents.forEach((document, index) => {
    if (!document.source_url) {
      results.push({
        level: "fail",
        name: "missing-source-url",
        message: `documents:${index} is missing source_url.`,
      });
    }
    if (!document.retrieved_at) {
      results.push({
        level: "fail",
        name: "missing-retrieved-at",
        message: `documents:${index} is missing retrieved_at.`,
      });
    }
  });
  output.field_catalog.forEach((field, fieldIndex) => {
    field.evidence.forEach((evidence, evidenceIndex) => {
      if (!evidence.source_url) {
        results.push({
          level: "fail",
          name: "missing-source-url",
          message: `field_catalog:${fieldIndex}:evidence:${evidenceIndex} is missing source_url.`,
        });
      }
      if (!evidence.retrieved_at) {
        results.push({
          level: "fail",
          name: "missing-retrieved-at",
          message: `field_catalog:${fieldIndex}:evidence:${evidenceIndex} is missing retrieved_at.`,
        });
      }
    });
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
    return value.flatMap((item, index) => scanPlaceholders(item, [...currentPath, String(index)]));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, nestedValue]) =>
      scanPlaceholders(nestedValue, [...currentPath, key]),
    );
  }
  return [];
}

function listFiles(rootDir: string, extension: string): string[] {
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const entryPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") {
        return [];
      }
      return listFiles(entryPath, extension);
    }
    return entry.isFile() && entry.name.endsWith(extension) ? [entryPath] : [];
  });
}

function noOutsideImports(skillRoot: string): CheckResult {
  const offenders: string[] = [];
  const importPattern =
    /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?["']([^"']+)["']/g;

  for (const filePath of listFiles(skillRoot, ".ts")) {
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
      hint: "ingest-docs must stay self-contained; duplicate primitives locally.",
    };
  }
  return { level: "ok", name: "no-outside-imports", message: "" };
}

function noPersistenceMarkers(skillRoot: string): CheckResult {
  const scriptRoot = path.join(skillRoot, "scripts");
  const markerParts = [
    ["business", "profile", "documents"],
    ["journey", "sessions"],
    ["create", "Admin", "Client"],
    ["SUPABASE", "SERVICE", "ROLE", "KEY"],
  ];
  const markers = markerParts.map((parts) => parts.join(parts[0] === "create" ? "" : "_"));
  const offenders: string[] = [];

  for (const filePath of listFiles(scriptRoot, ".ts")) {
    if (path.basename(filePath) === "sanity-check.ts") {
      continue;
    }
    const content = fs.readFileSync(filePath, "utf-8");
    for (const marker of markers) {
      if (content.includes(marker)) {
        offenders.push(`${path.relative(skillRoot, filePath)} contains forbidden persistence marker`);
      }
    }
  }

  if (offenders.length > 0) {
    return {
      level: "fail",
      name: "no-supabase-write",
      message: offenders.join(", "),
      hint: "ingest-docs emits JSON only and must not persist data.",
    };
  }
  return { level: "ok", name: "no-supabase-write", message: "" };
}

function noExampleDomain(output: IngestDocsOutput): CheckResult {
  const serialized = JSON.stringify(output);
  if (/example\.com/i.test(serialized)) {
    return {
      level: "fail",
      name: "no-example-domain",
      message: "Fixture output must use real-domain or accepted signed-source URLs, not example.com.",
    };
  }
  return { level: "ok", name: "no-example-domain", message: "" };
}

function main(): void {
  const outputPath = process.argv[2];
  if (!outputPath) {
    process.stderr.write("Usage: sanity-check.ts <output.json>\n");
    process.exit(2);
  }

  const skillRoot = path.resolve(process.cwd());
  const schema = schemaValid(outputPath);
  const results: CheckResult[] = [
    schema.result,
    noOutsideImports(skillRoot),
    noPersistenceMarkers(skillRoot),
  ];

  if (schema.output) {
    results.push(
      noExampleDomain(schema.output),
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

  if (fails.length > 0) {
    process.stderr.write(`\n[sanity-check] ${fails.length} FAIL - blocking.\n`);
    process.exit(1);
  }

  process.stdout.write(`[sanity-check] ${fails.length} fail, ${warns.length} warn\n`);
}

main();
