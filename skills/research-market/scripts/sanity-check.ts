/**
 * research-market - integrity and anti-fabrication checks
 *
 * Usage:
 *   npx tsx scripts/sanity-check.ts <output.json> [--allow-suspect]
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ResearchMarketOutputSchema,
  type MarketSizeSignal,
  type ResearchMarketOutput,
  type SourcedMarketClaim,
} from "../schemas/output";

type Level = "fail" | "warn";

interface CheckResult {
  level: Level;
  code: string;
  message: string;
}

const FORBIDDEN_IMPORT_PREFIXES = [
  "../..",
  "@/",
  "src/",
  "research-worker/",
] as const;

function skillRoot(): string {
  return path.dirname(path.dirname(fileURLToPath(import.meta.url)));
}

function listTypeScriptFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name === "node_modules") {
      continue;
    }

    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTypeScriptFiles(entryPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(entryPath);
    }
  }

  return files;
}

function getImportSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const importPattern =
    /^\s*import\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["']([^"']+)["'];?/gm;

  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1];
    if (specifier) {
      specifiers.push(specifier);
    }
  }

  return specifiers;
}

function isForbiddenImport(specifier: string): boolean {
  if (FORBIDDEN_IMPORT_PREFIXES.some((prefix) => specifier.startsWith(prefix))) {
    return true;
  }

  return /^skills\/(?!research-market(?:\/|$))/.test(specifier);
}

function checkNoOutsideImports(): CheckResult[] {
  const root = skillRoot();
  const violations: string[] = [];

  for (const filePath of listTypeScriptFiles(root)) {
    const source = fs.readFileSync(filePath, "utf-8");
    for (const specifier of getImportSpecifiers(source)) {
      if (isForbiddenImport(specifier)) {
        violations.push(`${path.relative(root, filePath)} -> ${specifier}`);
      }
    }
  }

  if (violations.length === 0) {
    return [];
  }

  return [
    {
      level: "fail",
      code: "no_outside_imports",
      message: `Forbidden imports found: ${violations.join(", ")}`,
    },
  ];
}

function readOutput(path: string): ResearchMarketOutput {
  if (!fs.existsSync(path)) {
    throw new Error(`[sanity-check] file missing: ${path}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(path, "utf-8")) as unknown;
  } catch (error: unknown) {
    throw new Error(
      `[sanity-check] JSON parse failed for ${path}: ${(error as Error).message}`,
    );
  }

  const result = ResearchMarketOutputSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `[sanity-check] schema validation failed: ${JSON.stringify(result.error.issues, null, 2)}`,
    );
  }

  return result.data;
}

function isPlaceholder(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.length === 0 ||
    normalized === "unknown" ||
    normalized === "n/a" ||
    normalized === "tbd" ||
    normalized.includes("placeholder") ||
    normalized.includes("scaffold")
  );
}

function collectSourceRefs(output: ResearchMarketOutput): Set<string> {
  const refs = new Set<string>();

  const addClaim = (claim: SourcedMarketClaim): void => {
    refs.add(claim.source_url);
    if (claim.source_id) refs.add(claim.source_id);
  };

  const addSize = (signal: MarketSizeSignal): void => {
    refs.add(signal.source_url);
    if (signal.source_id) refs.add(signal.source_id);
  };

  addClaim(output.category_definition);
  addClaim(output.category_maturity);
  for (const signal of output.market_size_signals) addSize(signal);
  for (const signal of output.timing_signals) addClaim(signal);
  for (const driver of output.demand_drivers) addClaim(driver);
  for (const trigger of output.buying_triggers) addClaim(trigger);
  for (const barrier of output.adoption_barriers) addClaim(barrier);
  for (const pain of output.category_pain_points.primary) addClaim(pain);
  for (const pain of output.category_pain_points.secondary) addClaim(pain);
  for (const trigger of output.category_pain_points.triggers) addClaim(trigger);
  for (const signal of output.competitive_intensity.observable_signals) {
    addClaim(signal);
  }
  for (const opportunity of output.opportunity_candidates) addClaim(opportunity);

  return refs;
}

function checkRequiredEvidence(output: ResearchMarketOutput): CheckResult[] {
  const refs = collectSourceRefs(output);
  const missing = output.evidenceIds.filter((id) => !refs.has(id));
  if (missing.length === 0) {
    return [];
  }

  return [
    {
      level: "fail",
      code: "summary_evidence_not_backed",
      message: `evidenceIds contains IDs/URLs not present on sourced claims: ${missing.join(", ")}`,
    },
  ];
}

function checkMarketSize(output: ResearchMarketOutput): CheckResult[] {
  const results: CheckResult[] = [];
  const marketSizeGap = output.source_gaps.some(
    (gap) => gap.topic === "market_size",
  );

  if (output.market_size_signals.length === 0 && !marketSizeGap) {
    results.push({
      level: "fail",
      code: "market_size_missing_without_gap",
      message:
        "market_size_signals is empty but no source_gaps entry explains missing market sizing evidence",
    });
  }

  for (const signal of output.market_size_signals) {
    if (signal.label === "tam_context") {
      const caveatText = signal.caveats.join(" ").toLowerCase();
      const hasParentCaveat =
        caveatText.includes("parent") ||
        caveatText.includes("broader") ||
        caveatText.includes("not direct") ||
        caveatText.includes("not the direct") ||
        caveatText.includes("context");
      if (!hasParentCaveat) {
        results.push({
          level: "fail",
          code: "tam_context_missing_caveat",
          message: `tam_context signal "${signal.market_scope}" must state it is broader/parent context, not direct niche size`,
        });
      }
    }

    if (signal.label !== "tam_context" && signal.basis === "parent_market_context") {
      results.push({
        level: "fail",
        code: "parent_basis_without_tam_context",
        message: `${signal.label} signal "${signal.market_scope}" uses parent_market_context basis`,
      });
    }

    if (isPlaceholder(signal.value)) {
      results.push({
        level: "fail",
        code: "placeholder_market_size",
        message: `market size value for "${signal.market_scope}" is placeholder-like: ${signal.value}`,
      });
    }
  }

  return results;
}

function checkScaffoldMarkers(output: ResearchMarketOutput): CheckResult[] {
  const results: CheckResult[] = [];

  if (isPlaceholder(output.source_company_name)) {
    results.push({
      level: "fail",
      code: "placeholder_company",
      message: `source_company_name is placeholder-like: ${output.source_company_name}`,
    });
  }

  if (isPlaceholder(output.market_scope.category)) {
    results.push({
      level: "fail",
      code: "placeholder_category",
      message: `market_scope.category is placeholder-like: ${output.market_scope.category}`,
    });
  }

  if (output.tool_calls_used.length === 0) {
    results.push({
      level: "fail",
      code: "no_tool_calls",
      message: "tool_calls_used is empty; market research should record collection tools",
    });
  }

  if (isPlaceholder(output.summary)) {
    results.push({
      level: "fail",
      code: "scaffold_summary",
      message: "summary contains placeholder/scaffold language",
    });
  }

  return results;
}

function checkLegacyProjection(output: ResearchMarketOutput): CheckResult[] {
  const results: CheckResult[] = [];

  if (output.categorySnapshot.category !== output.market_scope.category) {
    results.push({
      level: "warn",
      code: "legacy_category_mismatch",
      message: `categorySnapshot.category (${output.categorySnapshot.category}) differs from market_scope.category (${output.market_scope.category})`,
    });
  }

  if (
    output.marketOpportunities.length === 0 &&
    output.opportunity_candidates.length > 0
  ) {
    results.push({
      level: "warn",
      code: "legacy_opportunities_missing",
      message:
        "opportunity_candidates is populated but legacy marketOpportunities is empty",
    });
  }

  return results;
}

function detectIssues(output: ResearchMarketOutput): CheckResult[] {
  return [
    ...checkNoOutsideImports(),
    ...checkScaffoldMarkers(output),
    ...checkRequiredEvidence(output),
    ...checkMarketSize(output),
    ...checkLegacyProjection(output),
  ];
}

function main(): void {
  const target = process.argv[2];
  const allowSuspect =
    process.argv.includes("--allow-suspect") ||
    process.env.ALLOW_SUSPECT === "1";

  if (!target) {
    process.stderr.write("Usage: sanity-check.ts <output.json> [--allow-suspect]\n");
    process.exit(2);
  }

  let output: ResearchMarketOutput;
  try {
    output = readOutput(target);
  } catch (error: unknown) {
    process.stderr.write(`${(error as Error).message}\n`);
    process.exit(1);
  }

  const issues = detectIssues(output);
  if (issues.length === 0) {
    process.stdout.write("[sanity-check] ok\n");
    return;
  }

  const failures = issues.filter((issue) => issue.level === "fail");
  const warnings = issues.filter((issue) => issue.level === "warn");
  for (const issue of [...failures, ...warnings]) {
    process.stderr.write(
      `[sanity-check][${issue.level.toUpperCase()}] ${issue.code}: ${issue.message}\n`,
    );
  }

  if (failures.length > 0 && !allowSuspect) {
    process.stderr.write(
      "[sanity-check] set ALLOW_SUSPECT=1 or pass --allow-suspect only for a verified dev run\n",
    );
    process.exit(1);
  }

  process.stdout.write("[sanity-check] completed with warnings/suspect bypass\n");
}

main();
