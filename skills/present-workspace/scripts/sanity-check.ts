import * as fs from "fs";
import * as path from "path";
import { presentWorkspaceOutputSchema, type PresentWorkspaceOutput } from "../schemas/output.ts";

type Level = "fail" | "warn" | "ok";
type CheckResult = {
  level: Level;
  name: string;
  message: string;
  hint?: string;
};

const PLACEHOLDER_PATTERNS: RegExp[] = [
  /^unknown$/i,
  /^tbd$/i,
  /^n\/a$/i,
  /^not found$/i,
  /^scaffold$/i,
];

const FORBIDDEN_IMPORT_PATTERNS: RegExp[] = [
  /^\.\.\/\.\./,
  /^@\//,
  /^src\//,
  /^research-worker\//,
  /^skills\/(?:ingest-|research-|synthesize-|chat-|present-)(?!workspace\b)/,
];

function readOutput(outputPath: string): unknown {
  return JSON.parse(fs.readFileSync(outputPath, "utf-8"));
}

function schemaValid(outputPath: string): { output?: PresentWorkspaceOutput; result: CheckResult } {
  const parsed = presentWorkspaceOutputSchema.safeParse(readOutput(outputPath));
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 10)
      .map((issue) => `${issue.path.join(":")} - ${issue.message}`)
      .join("; ");
    return {
      result: {
        level: "fail",
        name: "schema-valid",
        message: `Output does not match presentWorkspaceOutputSchema: ${issues}`,
        hint: "Run npm run validate for the full Zod issue list.",
      },
    };
  }

  return {
    output: parsed.data,
    result: { level: "ok", name: "schema-valid", message: "" },
  };
}

function scanPlaceholders(value: unknown, currentPath: string[] = []): CheckResult[] {
  if (typeof value === "string") {
    const pattern = PLACEHOLDER_PATTERNS.find((candidate) => candidate.test(value.trim()));
    return pattern
      ? [
          {
            level: "fail",
            name: "placeholder-rejection",
            message: `${currentPath.join(":")} contains placeholder value "${value}".`,
          },
        ]
      : [];
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

function listTypeScriptFiles(rootDir: string): string[] {
  return fs.readdirSync(rootDir, { withFileTypes: true }).flatMap((entry) => {
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
      hint: "present-workspace must stay self-contained; duplicate primitives locally.",
    };
  }

  return { level: "ok", name: "no-outside-imports", message: "" };
}

function hasRenderableData(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return true;
  }
  if (Array.isArray(value)) {
    return value.some((item) => hasRenderableData(item));
  }
  if (typeof value === "object") {
    return Object.values(value).some((item) => hasRenderableData(item));
  }
  return false;
}

function cardRenderableData(output: PresentWorkspaceOutput): CheckResult[] {
  const failures = output.cards
    .filter((card) => !hasRenderableData(card.content))
    .map((card) => ({
      level: "fail" as const,
      name: "empty-renderable-data",
      message: `card_id=${card.id} run_id=${card.run_id} section_key=${card.section_key} has empty content.`,
    }));

  return failures.length > 0
    ? failures
    : [{ level: "ok", name: "empty-renderable-data", message: "" }];
}

function editOverlayLocation(output: PresentWorkspaceOutput): CheckResult {
  if ("__cardEdits" in output.research_result_envelope.data) {
    return {
      level: "fail",
      name: "edit-overlay-location",
      message: "__cardEdits must be section-level on research_result_envelope, not nested inside data.",
    };
  }
  return { level: "ok", name: "edit-overlay-location", message: "" };
}

function writeReceiptIdentity(output: PresentWorkspaceOutput): CheckResult[] {
  if (!output.write.write_happened && !output.write.wrote_research_results) {
    return [{ level: "ok", name: "write-receipt-identity", message: "" }];
  }

  const failures: CheckResult[] = [];
  if (!output.write.idempotency_key || !output.write.run_id || !output.write.section_key) {
    failures.push({
      level: "fail",
      name: "write-receipt-identity",
      message: "Supabase write receipt must include idempotency_key, run_id, and section_key.",
    });
  }

  output.write.card_results.forEach((result) => {
    if (!result.idempotency_key || !result.run_id || !result.card_kind) {
      failures.push({
        level: "fail",
        name: "write-receipt-identity",
        message: `card write receipt card_id=${result.card_id} must include idempotency_key, run_id, and card_kind.`,
      });
    }
  });

  return failures.length > 0
    ? failures
    : [{ level: "ok", name: "write-receipt-identity", message: "" }];
}

function cardEvidenceCoverage(output: PresentWorkspaceOutput): CheckResult[] {
  const failures = output.cards.flatMap((card) =>
    card.evidence.flatMap((evidence, index) => {
      const cardFailures: CheckResult[] = [];
      if (!evidence.source_url) {
        cardFailures.push({
          level: "fail",
          name: "missing-source-url",
          message: `card_id=${card.id} evidence:${index} is missing source_url.`,
        });
      }
      if (!evidence.retrieved_at) {
        cardFailures.push({
          level: "fail",
          name: "missing-retrieved-at",
          message: `card_id=${card.id} evidence:${index} is missing retrieved_at.`,
        });
      }
      return cardFailures;
    }),
  );

  return failures.length > 0
    ? failures
    : [{ level: "ok", name: "card-evidence-coverage", message: "" }];
}

function main(): void {
  const outputPath = process.argv[2];
  if (!outputPath) {
    process.stderr.write("Usage: sanity-check.ts <output.json>\n");
    process.exit(2);
  }

  const skillRoot = process.cwd();
  const schema = schemaValid(outputPath);
  const results: CheckResult[] = [schema.result, noOutsideImports(skillRoot)];

  if (schema.output) {
    results.push(
      ...cardEvidenceCoverage(schema.output),
      ...cardRenderableData(schema.output),
      editOverlayLocation(schema.output),
      ...writeReceiptIdentity(schema.output),
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
