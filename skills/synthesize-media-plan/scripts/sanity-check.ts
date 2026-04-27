/**
 * Deterministic integrity checks for synthesize-media-plan outputs.
 *
 * Usage:
 *   node --import tsx/esm scripts/sanity-check.ts <output.json>
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import {
  synthesizeMediaPlanOutputSchema,
  type Campaign,
  type SynthesizeMediaPlanOutput,
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
  /\bplaceholder\b/i,
  /\bscaffold\b/i,
  /\btodo\b/i,
  /\blorem ipsum\b/i,
];

const PROHIBITED_LANGUAGE_PATTERNS: RegExp[] = [
  /\bretargeting\b/i,
  /\bremarketing\b/i,
  /\bpixel audience\b/i,
  /\bvisitor retarget\b/i,
];

const FORBIDDEN_IMPORT_PATTERNS: RegExp[] = [
  /^\.\.\/\.\./,
  /^@\//,
  /^src\//,
  /^research-worker\//,
  /^skills\/(?!synthesize-media-plan(?:\/|$))/,
];

function schemaValid(outputPath: string): {
  output?: SynthesizeMediaPlanOutput;
  result: CheckResult;
} {
  const raw = JSON.parse(fs.readFileSync(outputPath, "utf-8")) as unknown;
  const parsed = synthesizeMediaPlanOutputSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 8)
      .map((issue) => `${issue.path.join(":")} - ${issue.message}`)
      .join("; ");
    return {
      result: {
        level: "fail",
        name: "schema-valid",
        message: `Output does not match synthesizeMediaPlanOutputSchema: ${issues}`,
        hint: "Run npm run validate for the full Zod issue list.",
      },
    };
  }
  return {
    output: parsed.data,
    result: { level: "ok", name: "schema-valid", message: "" },
  };
}

function scanStrings(
  value: unknown,
  patterns: RegExp[],
  checkName: string,
  currentPath: string[] = [],
): CheckResult[] {
  if (typeof value === "string") {
    const matched = patterns.find((pattern) => pattern.test(value));
    if (matched) {
      return [
        {
          level: "fail",
          name: checkName,
          message: `${currentPath.join(":")} contains disallowed text "${value}".`,
        },
      ];
    }
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      scanStrings(item, patterns, checkName, [...currentPath, String(index)]),
    );
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, nestedValue]) =>
      scanStrings(nestedValue, patterns, checkName, [...currentPath, key]),
    );
  }
  return [];
}

function campaignCap(output: SynthesizeMediaPlanOutput): CheckResult[] {
  const results: CheckResult[] = [];
  output.rollout_phases.forEach((phase) => {
    if (phase.campaigns.length > 2) {
      results.push({
        level: "fail",
        name: "campaign-cap",
        message: `rollout_phases:${phase.phase}:campaigns has ${phase.campaigns.length} campaigns; max is 2.`,
      });
    }
  });
  return results.length > 0
    ? results
    : [{ level: "ok", name: "campaign-cap", message: "" }];
}

function campaignBudgetShares(output: SynthesizeMediaPlanOutput): CheckResult[] {
  const results: CheckResult[] = [];
  const topLevelTotal = output.audience_campaign_matrix.reduce(
    (sum: number, campaign: Campaign) => sum + campaign.budget_share_pct,
    0,
  );
  if (topLevelTotal > 100.5) {
    results.push({
      level: "fail",
      name: "campaign-budget-share",
      message: `audience_campaign_matrix budget_share_pct sums to ${topLevelTotal}; max is 100.`,
    });
  }
  output.rollout_phases.forEach((phase) => {
    const phaseTotal = phase.campaigns.reduce(
      (sum: number, campaign: Campaign) => sum + campaign.budget_share_pct,
      0,
    );
    if (phaseTotal > 100.5) {
      results.push({
        level: "fail",
        name: "phase-budget-share",
        message: `rollout_phases:${phase.phase}:campaigns budget_share_pct sums to ${phaseTotal}; max is 100.`,
      });
    }
  });
  return results.length > 0
    ? results
    : [{ level: "ok", name: "campaign-budget-share", message: "" }];
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
      hint: "Duplicate primitives locally instead of importing across skill/runtime boundaries.",
    };
  }
  return { level: "ok", name: "no-outside-imports", message: "" };
}

function skillRootFromScript(): string {
  const scriptPath = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(scriptPath), "..");
}

function main(): void {
  const outputPath = process.argv[2];
  if (!outputPath) {
    process.stderr.write("Usage: sanity-check.ts <output.json>\n");
    process.exit(2);
  }

  const schema = schemaValid(outputPath);
  const results: CheckResult[] = [
    schema.result,
    noOutsideImports(skillRootFromScript()),
  ];

  if (schema.output) {
    results.push(
      ...scanStrings(schema.output, PLACEHOLDER_PATTERNS, "placeholder-rejection"),
      ...scanStrings(
        schema.output,
        PROHIBITED_LANGUAGE_PATTERNS,
        "prohibited-language",
      ),
      ...campaignCap(schema.output),
      ...campaignBudgetShares(schema.output),
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

  process.stdout.write(`[sanity-check] 0 fail, ${warns.length} warn\n`);
}

main();
