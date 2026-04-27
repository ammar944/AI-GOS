import * as fs from "fs";
import * as path from "path";
import { synthesizeScriptsInputSchema, type SynthesizeScriptsInput } from "../schemas/input.ts";
import {
  synthesizeScriptsOutputSchema,
  type DerivedLine,
  type Script,
  type SynthesizeScriptsOutput,
} from "../schemas/output.ts";
import { competitorHooks } from "./extract-claims.ts";
import { runQualityGate } from "./quality-gate.ts";

type Level = "fail" | "warn" | "ok";

interface CheckResult {
  level: Level;
  name: string;
  message: string;
}

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
  /^skills\/(?!synthesize-scripts\/)/,
];

function readJson(pathname: string): unknown {
  return JSON.parse(fs.readFileSync(pathname, "utf-8"));
}

function parseOutput(outputPath: string): { output?: SynthesizeScriptsOutput; result: CheckResult } {
  const parsed = synthesizeScriptsOutputSchema.safeParse(readJson(outputPath));
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 8)
      .map((issue) => `${issue.path.map(String).join(":")} - ${issue.message}`)
      .join("; ");
    return {
      result: {
        level: "fail",
        name: "schema-valid",
        message: `Output does not match schema: ${issues}`,
      },
    };
  }
  return {
    output: parsed.data,
    result: { level: "ok", name: "schema-valid", message: "" },
  };
}

function parseInputForOutput(outputPath: string): SynthesizeScriptsInput | null {
  const inputPath = path.join(path.dirname(outputPath), "input.json");
  if (!fs.existsSync(inputPath)) {
    return null;
  }
  const parsed = synthesizeScriptsInputSchema.safeParse(readJson(inputPath));
  return parsed.success ? parsed.data : null;
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

  return offenders.length > 0
    ? {
        level: "fail",
        name: "no-outside-imports",
        message: `Forbidden imports found: ${offenders.join(", ")}`,
      }
    : { level: "ok", name: "no-outside-imports", message: "" };
}

function scanPlaceholders(value: unknown, currentPath: string[] = []): CheckResult[] {
  if (typeof value === "string") {
    const matched = PLACEHOLDER_PATTERNS.find((pattern) => pattern.test(value));
    return matched
      ? [{
          level: "fail",
          name: "placeholder-rejection",
          message: `${currentPath.join(":")} contains placeholder text "${value}".`,
        }]
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

function allLines(script: Script): DerivedLine[] {
  return [
    script.hook,
    ...script.middle,
    script.cta,
    ...script.hook_variants,
    ...(script.objection_handled ? [script.objection_handled] : []),
  ];
}

function matrixShape(output: SynthesizeScriptsOutput): CheckResult[] {
  const results: CheckResult[] = [];
  if (output.scripts.length < 9 || output.scripts.length > 15) {
    results.push({
      level: "fail",
      name: "script-count",
      message: `Expected 9 to 15 scripts; received ${output.scripts.length}.`,
    });
  }
  const levels = new Set(output.scripts.map((script) => script.awareness_level));
  for (const level of levels) {
    const scripts = output.scripts.filter((script) => script.awareness_level === level);
    const angles = new Set(scripts.map((script) => script.angle));
    if (scripts.length !== 3) {
      results.push({
        level: "fail",
        name: "tier-count",
        message: `${level} has ${scripts.length} scripts; expected 3.`,
      });
    }
    if (angles.size !== scripts.length) {
      results.push({
        level: "fail",
        name: "tier-angle-diversity",
        message: `${level} repeats a primary angle.`,
      });
    }
  }
  return results.length > 0 ? results : [{ level: "ok", name: "matrix-shape", message: "" }];
}

function provenanceCoverage(output: SynthesizeScriptsOutput): CheckResult[] {
  const results: CheckResult[] = [];
  output.scripts.forEach((script) => {
    allLines(script).forEach((line) => {
      if (line.derived_from.length === 0) {
        results.push({
          level: "fail",
          name: "missing-derived-from",
          message: `${script.id} has a line without derived_from.`,
        });
      }
      line.evidence.forEach((evidence, index) => {
        if (!evidence.source_url || !evidence.retrieved_at) {
          results.push({
            level: "fail",
            name: "missing-source",
            message: `${script.id} evidence ${index} lacks source_url or retrieved_at.`,
          });
        }
      });
    });
  });
  return results.length > 0
    ? results
    : [{ level: "ok", name: "provenance-coverage", message: "" }];
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function copyText(script: Script): string {
  return allLines(script).map((line) => line.text).join(" ");
}

function forbiddenClaimLeak(output: SynthesizeScriptsOutput, input: SynthesizeScriptsInput | null): CheckResult[] {
  if (!input) {
    return [{ level: "warn", name: "forbidden-claim-leak", message: "No sibling input.json found; skipped." }];
  }
  const forbidden = input.locked_brief.fields.forbiddenClaims.map(normalizeText);
  const results: CheckResult[] = [];
  output.scripts.forEach((script) => {
    const text = normalizeText(copyText(script));
    forbidden.forEach((claim) => {
      if (claim.length > 0 && text.includes(claim)) {
        results.push({
          level: "fail",
          name: "forbidden-claim-leak",
          message: `${script.id} includes forbidden claim "${claim}".`,
        });
      }
    });
  });
  return results.length > 0
    ? results
    : [{ level: "ok", name: "forbidden-claim-leak", message: "" }];
}

function copiedCompetitorHook(output: SynthesizeScriptsOutput, input: SynthesizeScriptsInput | null): CheckResult[] {
  if (!input) {
    return [];
  }
  const hooks = competitorHooks(input)
    .map((hook) => hook.replace(/^.*hook:\s*/i, "").replace(/^"|"$/g, ""))
    .map(normalizeText)
    .filter((hook) => hook.length > 8);
  const results: CheckResult[] = [];
  output.scripts.forEach((script) => {
    const text = normalizeText(copyText(script));
    hooks.forEach((hook) => {
      if (text.includes(hook)) {
        results.push({
          level: "fail",
          name: "copied-competitor-hook",
          message: `${script.id} copies competitor hook "${hook}".`,
        });
      }
    });
  });
  return results;
}

function unprovenProof(output: SynthesizeScriptsOutput): CheckResult[] {
  const results: CheckResult[] = [];
  output.scripts.forEach((script) => {
    allLines(script).forEach((line) => {
      const numberTokens = line.text.match(/\b\d[\d,.]*[%$]?\b/g) ?? [];
      const evidenceText = normalizeText(line.evidence.map((claim) => claim.claim).join(" "));
      numberTokens.forEach((token) => {
        if (!evidenceText.includes(token.toLowerCase())) {
          results.push({
            level: "fail",
            name: "unproven-proof",
            message: `${script.id} line "${line.text}" uses numeric proof "${token}" without matching evidence.`,
          });
        }
      });
      if (/\b(testimonial|case study|customer said|client said)\b/i.test(line.text)) {
        const hasProofEvidence = line.evidence.some((claim) =>
          /testimonial|case-study|case study|customer|client/i.test(`${claim.category ?? ""} ${claim.claim}`),
        );
        if (!hasProofEvidence) {
          results.push({
            level: "fail",
            name: "unproven-proof",
            message: `${script.id} uses proof language without testimonial or case-study evidence.`,
          });
        }
      }
    });
  });
  return results.length > 0
    ? results
    : [{ level: "ok", name: "unproven-proof", message: "" }];
}

function qualityGateFresh(output: SynthesizeScriptsOutput): CheckResult[] {
  const results: CheckResult[] = [];
  output.scripts.forEach((script) => {
    const gated = runQualityGate(script);
    const failed = gated.violations.filter((violation) => violation.severity === "fail");
    if (gated.auto_fixes > 0) {
      results.push({
        level: "fail",
        name: "quality-gate-stale-copy",
        message: `${script.id} requires ${gated.auto_fixes} quality-gate auto-fix(es); rerun orchestrate so fixed copy is written.`,
      });
    }
    if (!script.quality_gate.passed || failed.length > 0) {
      results.push({
        level: "fail",
        name: "quality-gate",
        message: `${script.id} has blocking quality gate failures: ${failed.map((violation) => violation.detail).join("; ")}`,
      });
    }
    const nonAutoViolations = gated.violations.filter((violation) => violation.severity !== "auto-fixed");
    nonAutoViolations.forEach((violation) => {
      results.push({
        level: violation.severity === "fail" ? "fail" : "warn",
        name: violation.check,
        message: `${script.id}: ${violation.detail}`,
      });
    });
  });
  return results.length > 0
    ? results
    : [{ level: "ok", name: "quality-gate", message: "" }];
}

function flaggedClaimsAbsent(output: SynthesizeScriptsOutput): CheckResult[] {
  const results: CheckResult[] = [];
  output.scripts.forEach((script) => {
    const text = normalizeText(copyText(script));
    script.flagged_claims.forEach((flag) => {
      if (text.includes(normalizeText(flag.claim))) {
        results.push({
          level: "fail",
          name: "flagged-claim-in-copy",
          message: `${script.id} includes flagged claim "${flag.claim}".`,
        });
      }
    });
  });
  return results.length > 0
    ? results
    : [{ level: "ok", name: "flagged-claims-absent", message: "" }];
}

function main(): void {
  const outputPath = process.argv[2];
  if (!outputPath) {
    process.stderr.write("Usage: sanity-check.ts <output.json>\n");
    process.exit(2);
  }

  const skillRoot = process.cwd();
  const schema = parseOutput(outputPath);
  const input = parseInputForOutput(outputPath);
  const results: CheckResult[] = [
    schema.result,
    noOutsideImports(skillRoot),
  ];

  if (schema.output) {
    results.push(
      ...matrixShape(schema.output),
      ...provenanceCoverage(schema.output),
      ...forbiddenClaimLeak(schema.output, input),
      ...copiedCompetitorHook(schema.output, input),
      ...unprovenProof(schema.output),
      ...qualityGateFresh(schema.output),
      ...flaggedClaimsAbsent(schema.output),
      ...scanPlaceholders(schema.output),
    );
  }

  const active = results.filter((result) => result.level !== "ok");
  const fails = active.filter((result) => result.level === "fail");
  const warns = active.filter((result) => result.level === "warn");

  active.forEach((result) => {
    process.stderr.write(`[sanity-check][${result.level.toUpperCase()}] ${result.name}: ${result.message}\n`);
  });

  if (fails.length > 0) {
    process.stderr.write(`\n[sanity-check] ${fails.length} FAIL, ${warns.length} warn\n`);
    process.exit(1);
  }

  process.stdout.write(`[sanity-check] 0 fail, ${warns.length} warn\n`);
}

main();
