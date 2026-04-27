/**
 * Deterministic integrity checks for synthesize-positioning outputs.
 *
 * Usage:
 *   node --import tsx/esm scripts/sanity-check.ts <output.json> [--input input.json]
 */
import * as fs from "fs";
import * as path from "path";
import {
  synthesizePositioningOutputSchema,
  type SynthesizePositioningOutput,
} from "../schemas/output.ts";
import {
  synthesizePositioningInputSchema,
  type SynthesizePositioningInput,
} from "../schemas/input.ts";

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
  /^skills\/(?!synthesize-positioning\/)/,
];

const LEGACY_KEYS = new Set([
  "platformRecommendations",
  "readinessScorecard",
  "launchPlan",
  "launchPlans",
  "nextSteps",
  "topActions",
  "keywordPlan",
  "scriptPlan",
  "scripts",
  "budget",
  "budgetAllocation",
  "scores",
  "overallScore",
]);

function parseArgs(argv: string[]): { outputPath?: string; inputPath: string } {
  const inputIndex = argv.indexOf("--input");
  return {
    outputPath: argv[2],
    inputPath:
      inputIndex >= 0 && argv[inputIndex + 1]
        ? argv[inputIndex + 1] ?? "./example/input.json"
        : "./example/input.json",
  };
}

function readJson(pathName: string): unknown {
  return JSON.parse(fs.readFileSync(pathName, "utf-8"));
}

function schemaValid(outputPath: string): {
  output?: SynthesizePositioningOutput;
  result: CheckResult;
} {
  const raw = readJson(outputPath);
  const parsed = synthesizePositioningOutputSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 8)
      .map((issue) => `${issue.path.join(":")} - ${issue.message}`)
      .join("; ");
    return {
      result: {
        level: "fail",
        name: "schema-valid",
        message: `Output does not match synthesizePositioningOutputSchema: ${issues}`,
        hint: "Run npm run validate for the full Zod issue list.",
      },
    };
  }
  return {
    output: parsed.data,
    result: { level: "ok", name: "schema-valid", message: "" },
  };
}

function inputValid(inputPath: string): {
  input?: SynthesizePositioningInput;
  result: CheckResult;
} {
  if (!fs.existsSync(inputPath)) {
    return {
      result: {
        level: "warn",
        name: "input-present",
        message: `Input file not found at ${inputPath}; forbiddenClaims leak check skipped.`,
      },
    };
  }

  const parsed = synthesizePositioningInputSchema.safeParse(readJson(inputPath));
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 8)
      .map((issue) => `${issue.path.join(":")} - ${issue.message}`)
      .join("; ");
    return {
      result: {
        level: "fail",
        name: "input-valid",
        message: `Input does not match synthesizePositioningInputSchema: ${issues}`,
      },
    };
  }

  return {
    input: parsed.data,
    result: { level: "ok", name: "input-valid", message: "" },
  };
}

function valuePropFloor(output: SynthesizePositioningOutput): CheckResult {
  if (output.ranked_value_props.length < 3) {
    return {
      level: "fail",
      name: "value-prop-floor",
      message: "ranked_value_props must contain at least three sourced value props.",
    };
  }
  return { level: "ok", name: "value-prop-floor", message: "" };
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

function scanLegacyKeys(value: unknown, currentPath: string[] = []): CheckResult[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      scanLegacyKeys(item, [...currentPath, String(index)]),
    );
  }
  if (!value || typeof value !== "object") {
    return [];
  }
  return Object.entries(value).flatMap(([key, nestedValue]) => {
    const nextPath = [...currentPath, key];
    const nestedResults = scanLegacyKeys(nestedValue, nextPath);
    if (!LEGACY_KEYS.has(key)) {
      return nestedResults;
    }
    return [
      {
        level: "fail",
        name: "legacy-field-drop",
        message: `${nextPath.join(":")} uses legacy field "${key}".`,
      },
      ...nestedResults,
    ];
  });
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function forbiddenClaims(input: SynthesizePositioningInput): string[] {
  const value = input.gtm_brief.fields.forbiddenClaims?.value ?? "";
  return value
    .split(/[\n;]+/)
    .map((claim) => claim.trim())
    .filter((claim) => claim.length > 0);
}

function outputTextValues(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(outputTextValues);
  }
  if (value && typeof value === "object") {
    return Object.values(value).flatMap(outputTextValues);
  }
  return [];
}

function forbiddenClaimLeaks(
  output: SynthesizePositioningOutput,
  input?: SynthesizePositioningInput,
): CheckResult[] {
  if (!input) {
    return [];
  }

  const outputText = outputTextValues(output).map(normalizeText);
  const leaks = forbiddenClaims(input).filter((claim) => {
    const normalizedClaim = normalizeText(claim);
    return outputText.some((text) => text.includes(normalizedClaim));
  });

  return leaks.map((leak) => ({
    level: "fail",
    name: "forbidden-claim-leak",
    message: `Forbidden brief claim leaked into output copy: "${leak}".`,
  }));
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
      hint: "synthesize-positioning must stay self-contained; duplicate primitives locally.",
    };
  }
  return { level: "ok", name: "no-outside-imports", message: "" };
}

function main(): void {
  const args = parseArgs(process.argv);
  const outputPath = args.outputPath;
  if (!outputPath) {
    process.stderr.write(
      "Usage: sanity-check.ts <output.json> [--input input.json]\n",
    );
    process.exit(2);
  }

  const skillRoot = process.cwd();
  const schema = schemaValid(outputPath);
  const input = inputValid(args.inputPath);
  const results: CheckResult[] = [
    schema.result,
    input.result,
    noOutsideImports(skillRoot),
  ];

  if (schema.output) {
    results.push(
      valuePropFloor(schema.output),
      ...scanPlaceholders(schema.output),
      ...scanLegacyKeys(schema.output),
      ...forbiddenClaimLeaks(schema.output, input.input),
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
