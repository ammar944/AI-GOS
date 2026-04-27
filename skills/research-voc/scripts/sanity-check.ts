/**
 * Deterministic integrity checks for research-voc outputs.
 *
 * Usage:
 *   node --import tsx/esm scripts/sanity-check.ts <output.json>
 */
import * as fs from "fs";
import * as path from "path";
import {
  containsNormalizedTerm,
  normalizeForExclusion,
  researchVocOutputSchema,
  type ExclusionTerm,
  type ResearchVocOutput,
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
  /^skills\/(?!research-voc\/)/,
  /^\.\.\/(?:research-|ingest-|synthesize-|present-|chat-)/,
];

function schemaValid(outputPath: string): { output?: ResearchVocOutput; result: CheckResult } {
  const raw = JSON.parse(fs.readFileSync(outputPath, "utf-8")) as unknown;
  const parsed = researchVocOutputSchema.safeParse(raw);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 10)
      .map((issue) => `${issue.path.map(String).join(":")} - ${issue.message}`)
      .join("; ");
    return {
      result: {
        level: "fail",
        name: "schema-valid",
        message: `Output does not match researchVocOutputSchema: ${issues}`,
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
      hint: "research-voc must stay self-contained; duplicate primitives locally.",
    };
  }

  return { level: "ok", name: "no-outside-imports", message: "" };
}

function placeholderResults(value: unknown, currentPath: string[] = []): CheckResult[] {
  if (typeof value === "string") {
    const matched = PLACEHOLDER_PATTERNS.find((pattern) => pattern.test(value));
    if (!matched) {
      return [];
    }

    return [
      {
        level: "fail",
        name: "placeholder-rejection",
        message: `${currentPath.join(":")} contains placeholder text "${value}".`,
      },
    ];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => placeholderResults(entry, [...currentPath, String(index)]));
  }

  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, entry]) => placeholderResults(entry, [...currentPath, key]));
  }

  return [];
}

function matchedExclusion(value: string | undefined, terms: ExclusionTerm[]): ExclusionTerm | undefined {
  if (!value) {
    return undefined;
  }

  return terms.find((term) => containsNormalizedTerm(value, term.term));
}

function competitorLeakage(output: ResearchVocOutput): CheckResult[] {
  const results: CheckResult[] = [];
  const terms = output.exclusion_terms;

  const scanValue = (checkName: string, objectPath: string, value: string | undefined): void => {
    const match = matchedExclusion(value, terms);
    if (!match) {
      return;
    }

    results.push({
      level: "fail",
      name: checkName,
      message: `${objectPath} contains excluded term "${match.term}" from ${match.source}.`,
    });
  };

  output.category_pain_language.forEach((entry, index) => {
    scanValue("competitor-name-leakage", `category_pain_language:${index}:quote`, entry.quote);
    scanValue("competitor-name-leakage", `category_pain_language:${index}:source_title`, entry.source_title);
    if (entry.source_platform === "review_site") {
      scanValue("product-review-rejection", `category_pain_language:${index}:review_site`, [
        entry.quote,
        entry.problem_space,
        entry.source_title,
      ].filter(Boolean).join(" "));
    }
  });

  output.status_quo_frustrations.forEach((entry, index) => {
    scanValue("competitor-name-leakage", `status_quo_frustrations:${index}:quote`, entry.quote);
    scanValue("competitor-name-leakage", `status_quo_frustrations:${index}:source_title`, entry.source_title);
    if (entry.source_platform === "review_site") {
      scanValue("product-review-rejection", `status_quo_frustrations:${index}:review_site`, [
        entry.quote,
        entry.problem_space,
        entry.source_title,
      ].filter(Boolean).join(" "));
    }
  });

  output.objection_language.forEach((entry, index) => {
    scanValue("competitor-name-leakage", `objection_language:${index}:quote`, entry.quote);
    scanValue("competitor-name-leakage", `objection_language:${index}:source_title`, entry.source_title);
    if (entry.source_platform === "review_site") {
      scanValue("product-review-rejection", `objection_language:${index}:review_site`, [
        entry.quote,
        entry.problem_space,
        entry.source_title,
      ].filter(Boolean).join(" "));
    }
  });

  output.workarounds.forEach((entry, index) => {
    scanValue("competitor-name-leakage", `workarounds:${index}:workaround`, entry.workaround);
    scanValue("competitor-name-leakage", `workarounds:${index}:quote`, entry.quote);
    scanValue("competitor-name-leakage", `workarounds:${index}:source_title`, entry.source_title);
  });

  output.desired_outcomes.forEach((entry, index) => {
    scanValue("competitor-name-leakage", `desired_outcomes:${index}:claim`, entry.claim);
    scanValue("competitor-name-leakage", `desired_outcomes:${index}:source_title`, entry.source_title);
  });

  return results.length > 0
    ? results
    : [{ level: "ok", name: "competitor-leakage", message: "" }];
}

function sourceCoverage(output: ResearchVocOutput): CheckResult[] {
  const missing: CheckResult[] = [];
  const check = (objectPath: string, entry: { source_url?: string; retrieved_at?: string }): void => {
    if (!entry.source_url) {
      missing.push({
        level: "fail",
        name: "missing-source-url",
        message: `${objectPath} is missing source_url.`,
      });
    }
    if (!entry.retrieved_at) {
      missing.push({
        level: "fail",
        name: "missing-retrieved-at",
        message: `${objectPath} is missing retrieved_at.`,
      });
    }
  };

  output.category_pain_language.forEach((entry, index) => check(`category_pain_language:${index}`, entry));
  output.status_quo_frustrations.forEach((entry, index) => check(`status_quo_frustrations:${index}`, entry));
  output.workarounds.forEach((entry, index) => check(`workarounds:${index}`, entry));
  output.desired_outcomes.forEach((entry, index) => check(`desired_outcomes:${index}`, entry));
  output.objection_language.forEach((entry, index) => check(`objection_language:${index}`, entry));
  output.source_gaps.forEach((entry, index) => check(`source_gaps:${index}`, entry));
  output.rejected_competitor_matches.forEach((entry, index) => {
    check(`rejected_competitor_matches:${index}`, entry);
  });

  return missing.length > 0
    ? missing
    : [{ level: "ok", name: "source-coverage", message: "" }];
}

function reviewSiteScope(output: ResearchVocOutput): CheckResult[] {
  const results: CheckResult[] = [];
  const reviewEntries = [
    ...output.category_pain_language,
    ...output.status_quo_frustrations,
    ...output.objection_language,
  ].filter((entry) => entry.source_platform === "review_site");

  reviewEntries.forEach((entry, index) => {
    const text = normalizeForExclusion(
      [entry.quote, entry.problem_space, entry.speaker_context, entry.theme, entry.source_title]
        .filter(Boolean)
        .join(" "),
    );
    if (/\b(review of|reviews for|product review|software review)\b/.test(text)) {
      results.push({
        level: "fail",
        name: "product-review-rejection",
        message: `review_site entry ${index} appears product-specific instead of category/status-quo scoped.`,
      });
    }
  });

  return results.length > 0
    ? results
    : [{ level: "ok", name: "review-site-scope", message: "" }];
}

function main(): void {
  const outputPath = process.argv[2];

  if (!outputPath) {
    process.stderr.write("Usage: sanity-check.ts <output.json>\n");
    process.exit(2);
  }

  const skillRoot = path.resolve(process.cwd());
  const schema = schemaValid(outputPath);
  const results: CheckResult[] = [schema.result, noOutsideImports(skillRoot)];

  if (schema.output) {
    results.push(
      ...sourceCoverage(schema.output),
      ...competitorLeakage(schema.output),
      ...reviewSiteScope(schema.output),
      ...placeholderResults(schema.output),
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
