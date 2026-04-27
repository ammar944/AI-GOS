import * as fs from "fs";
import * as path from "path";
import {
  ingestUrlOutputSchema,
  type IngestUrlOutput,
  type SourcedClaim,
} from "../schemas/output.ts";

type Level = "fail" | "warn" | "ok";

interface CheckResult {
  level: Level;
  name: string;
  message: string;
  hint?: string;
}

const placeholderPatterns: RegExp[] = [
  /^\s*$/i,
  /^unknown$/i,
  /^tbd$/i,
  /^n\/a$/i,
  /^na$/i,
  /^not found$/i,
  /\bscaffold\b/i,
  /\btodo\b/i,
  /\blorem ipsum\b/i,
];

const legacyFieldKeys = new Set([
  "websiteUrl",
  "valueProp",
  "headquartersLocation",
  "testimonialQuote",
  "caseStudiesUrl",
  "testimonialsUrl",
  "pricingUrl",
  "demoUrl",
]);

const forbiddenImportPatterns: RegExp[] = [
  /^\.\.\/\.\./,
  /^@\//,
  /^src\//,
  /^research-worker\//,
  /^skills\/(?!ingest-url\/)/,
  /^\.\.\/(?:research-|ingest-(?!url)|synthesize-|present-|chat-)/,
];

function schemaValid(outputPath: string): { output?: IngestUrlOutput; result: CheckResult } {
  const raw = JSON.parse(fs.readFileSync(outputPath, "utf-8")) as unknown;
  const parsed = ingestUrlOutputSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 10)
      .map((issue) => `${issue.path.join(":")} - ${issue.message}`)
      .join("; ");
    return {
      result: {
        level: "fail",
        name: "schema-valid",
        message: `Output does not match ingestUrlOutputSchema: ${issues}`,
        hint: "Run npm run validate for the full Zod issue list.",
      },
    };
  }
  return {
    output: parsed.data,
    result: { level: "ok", name: "schema-valid", message: "" },
  };
}

function rawJson(outputPath: string): unknown {
  return JSON.parse(fs.readFileSync(outputPath, "utf-8")) as unknown;
}

function scanPlaceholders(value: unknown, currentPath: string[] = []): CheckResult[] {
  if (typeof value === "string") {
    const matched = placeholderPatterns.find((pattern) => pattern.test(value));
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

function legacyFieldKeyRawCheck(value: unknown): CheckResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { level: "ok", name: "field-key-normalization", message: "" };
  }
  const prefilledFields = (value as Record<string, unknown>).prefilled_fields;
  if (!Array.isArray(prefilledFields)) {
    return { level: "ok", name: "field-key-normalization", message: "" };
  }
  const offenders = prefilledFields.flatMap((field) => {
    if (!field || typeof field !== "object" || Array.isArray(field)) {
      return [];
    }
    const fieldKey = (field as Record<string, unknown>).field_key;
    return typeof fieldKey === "string" && legacyFieldKeys.has(fieldKey) ? [fieldKey] : [];
  });
  if (offenders.length > 0) {
    return {
      level: "fail",
      name: "field-key-normalization",
      message: `Legacy field keys were emitted directly: ${offenders.join(", ")}`,
      hint: "Normalize legacy keys into current GTM brief field keys before output.",
    };
  }
  return { level: "ok", name: "field-key-normalization", message: "" };
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
      if (forbiddenImportPatterns.some((pattern) => pattern.test(importPath))) {
        offenders.push(`${path.relative(skillRoot, filePath)} -> ${importPath}`);
      }
    }
  }

  if (offenders.length > 0) {
    return {
      level: "fail",
      name: "no-outside-imports",
      message: `Forbidden imports found: ${offenders.join(", ")}`,
      hint: "ingest-url must stay self-contained; duplicate primitives locally.",
    };
  }
  return { level: "ok", name: "no-outside-imports", message: "" };
}

function listScriptFiles(scriptsDir: string): string[] {
  if (!fs.existsSync(scriptsDir)) {
    return [];
  }
  return fs
    .readdirSync(scriptsDir, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(scriptsDir, entry.name);
      if (entry.isDirectory()) {
        return listScriptFiles(entryPath);
      }
      return entry.isFile() && entry.name.endsWith(".ts") ? [entryPath] : [];
    });
}

function noForbiddenWriteMarkers(skillRoot: string): CheckResult {
  const markerFragments = [
    ["create", "Client"].join(""),
    ["from", "('journey_", "sessions')"].join(""),
    ["from", "(\"journey_", "sessions\")"].join(""),
    ["SUPABASE", "_SERVICE", "_ROLE", "_KEY"].join(""),
    ["service", "_role"].join(""),
  ];
  const offenders: string[] = [];
  for (const filePath of listScriptFiles(path.join(skillRoot, "scripts"))) {
    const content = fs.readFileSync(filePath, "utf-8");
    const matched = markerFragments.filter((marker) => content.includes(marker));
    if (matched.length > 0) {
      offenders.push(`${path.relative(skillRoot, filePath)} -> ${matched.join(", ")}`);
    }
  }
  if (offenders.length > 0) {
    return {
      level: "fail",
      name: "no-supabase-write",
      message: `Forbidden write markers found: ${offenders.join("; ")}`,
    };
  }
  return { level: "ok", name: "no-supabase-write", message: "" };
}

function legacyFieldKeyCheck(output: IngestUrlOutput): CheckResult {
  const offenders = output.prefilled_fields
    .map((field) => field.field_key)
    .filter((fieldKey) => legacyFieldKeys.has(fieldKey));
  if (offenders.length > 0) {
    return {
      level: "fail",
      name: "field-key-normalization",
      message: `Legacy field keys were emitted directly: ${offenders.join(", ")}`,
      hint: "Normalize legacy keys into current GTM brief field keys before output.",
    };
  }
  return { level: "ok", name: "field-key-normalization", message: "" };
}

function sourcedClaimCheck(claim: SourcedClaim, currentPath: string): CheckResult[] {
  const results: CheckResult[] = [];
  if (!claim.source_url) {
    results.push({
      level: "fail",
      name: "missing-source-url",
      message: `${currentPath} is missing source_url.`,
    });
  }
  if (!claim.retrieved_at) {
    results.push({
      level: "fail",
      name: "missing-retrieved-at",
      message: `${currentPath} is missing retrieved_at.`,
    });
  }
  return results;
}

function sourceCoverage(output: IngestUrlOutput): CheckResult[] {
  const results: CheckResult[] = [
    ...sourcedClaimCheck(output.canonical_url, "canonical_url"),
    ...sourcedClaimCheck(output.company_name, "company_name"),
  ];

  output.discovered_pages.forEach((page, index) => {
    if (page.title) {
      results.push(...sourcedClaimCheck(page.title, `discovered_pages:${index}:title`));
    }
    if (page.excerpt) {
      results.push(...sourcedClaimCheck(page.excerpt, `discovered_pages:${index}:excerpt`));
    }
  });

  output.prefilled_fields.forEach((field, fieldIndex) => {
    field.evidence.forEach((evidence, evidenceIndex) => {
      results.push(
        ...sourcedClaimCheck(
          evidence,
          `prefilled_fields:${fieldIndex}:evidence:${evidenceIndex}`,
        ),
      );
    });
  });

  return results.length > 0
    ? results
    : [{ level: "ok", name: "source-coverage", message: "" }];
}

function noResearchCards(output: IngestUrlOutput): CheckResult {
  const outputRecord = output as unknown as Record<string, unknown>;
  const forbiddenKeys = ["cards", "research_cards", "researchResults", "research_results"];
  const offenders = forbiddenKeys.filter((key) => key in outputRecord);
  if (offenders.length > 0) {
    return {
      level: "fail",
      name: "no-research-cards",
      message: `Output contains research-card keys: ${offenders.join(", ")}`,
    };
  }
  return { level: "ok", name: "no-research-cards", message: "" };
}

function main(): void {
  const outputPath = process.argv[2];
  const allowSuspect = process.argv.includes("--allow-suspect") || process.env.ALLOW_SUSPECT === "1";

  if (!outputPath) {
    process.stderr.write("Usage: sanity-check.ts <output.json> [--allow-suspect]\n");
    process.exit(2);
  }

  const skillRoot = path.resolve(process.cwd());
  const rawOutput = rawJson(outputPath);
  const schema = schemaValid(outputPath);
  const results: CheckResult[] = [
    schema.result,
    noOutsideImports(skillRoot),
    noForbiddenWriteMarkers(skillRoot),
    legacyFieldKeyRawCheck(rawOutput),
    ...scanPlaceholders(rawOutput),
  ];

  if (schema.output) {
    results.push(
      noResearchCards(schema.output),
      ...sourceCoverage(schema.output),
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

  process.stdout.write(`[sanity-check] ${fails.length} fail (allowed), ${warns.length} warn\n`);
}

main();
