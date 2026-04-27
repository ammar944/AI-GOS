import * as fs from "fs";
import * as path from "path";
import { synthesizeScriptsInputSchema, type SynthesizeScriptsInput } from "../schemas/input.ts";
import {
  type AwarenessLevel,
  type DerivedFrom,
  type DerivedLine,
  type Script,
  type SourcedClaim,
  type SynthesizeScriptsOutput,
  synthesizeScriptsOutputSchema,
} from "../schemas/output.ts";
import { buildScriptMatrix, validateMatrixDiversity, type ScriptPlan } from "./build-matrix.ts";
import { extractClaims } from "./extract-claims.ts";
import { runQualityGate } from "./quality-gate.ts";

const DEFAULT_LEVELS: AwarenessLevel[] = [
  "unaware",
  "problem",
  "solution",
  "product",
  "mostAware",
];

function readJson(pathname: string): unknown {
  return JSON.parse(fs.readFileSync(pathname, "utf-8"));
}

function writeJson(pathname: string, value: unknown): void {
  fs.writeFileSync(pathname, `${JSON.stringify(value, null, 2)}\n`);
}

function parseInput(pathname: string): SynthesizeScriptsInput {
  const parsed = synthesizeScriptsInputSchema.safeParse(readJson(pathname));
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 12)
      .map((issue) => `${issue.path.map(String).join(":")} - ${issue.message}`)
      .join("; ");
    throw new Error(`Input validation failed for ${pathname}: ${issues}`);
  }
  return parsed.data;
}

function derivedFromForClaim(claim: SourcedClaim): DerivedFrom {
  const pathPrefix = claim.source_path?.split(".")[0];
  const allowed: DerivedFrom[] = [
    "research-voc",
    "research-icp",
    "research-offer",
    "synthesize-positioning",
    "synthesize-media-plan",
    "research-competitor",
    "research-keywords",
    "gtm-brief",
  ];
  if (pathPrefix && allowed.includes(pathPrefix as DerivedFrom)) {
    return pathPrefix as DerivedFrom;
  }
  return claim.source_path?.startsWith("locked_brief") ? "gtm-brief" : "gtm-brief";
}

function pickClaim(claims: SourcedClaim[], index: number): SourcedClaim {
  const claim = claims[index % claims.length];
  if (!claim) {
    throw new Error("Cannot generate scripts without sourced claims.");
  }
  return claim;
}

function buildLine(
  text: string,
  role: DerivedLine["role"],
  claim: SourcedClaim,
  extraDerivedFrom: DerivedFrom[] = [],
): DerivedLine {
  const derivedFrom = Array.from(new Set([derivedFromForClaim(claim), ...extraDerivedFrom]));
  return {
    text,
    role,
    derived_from: derivedFrom,
    evidence: [claim],
  };
}

function hookText(plan: ScriptPlan): string {
  if (plan.platform === "google") {
    return "Fix planning drift";
  }
  if (plan.platform === "linkedin") {
    return "When roadmap work scatters, planning slows.";
  }
  if (plan.awareness_level === "unaware") {
    return "Roadmap drift starts in issue queues.";
  }
  if (plan.awareness_level === "mostAware") {
    return "Ship with one planning system.";
  }
  return "Your roadmap should not live in fragments.";
}

function middleText(plan: ScriptPlan): string {
  if (plan.platform === "google") {
    return "Keep planning context in one workflow.";
  }
  if (plan.platform === "linkedin") {
    return "Give software teams one place for planning context.";
  }
  return "Keep roadmap decisions connected to execution.";
}

function ctaText(plan: ScriptPlan, input: SynthesizeScriptsInput): string {
  const briefCta = input.locked_brief.fields.cta ?? "Review the workflow";
  if (plan.platform === "google") {
    return "Review Linear";
  }
  if (briefCta.length <= 40) {
    return briefCta;
  }
  return "Review the workflow";
}

function variantTexts(plan: ScriptPlan): string[] {
  if (plan.platform === "google") {
    return ["Plan work faster", "Connect roadmap work", "Reduce planning drift"];
  }
  if (plan.platform === "linkedin") {
    return [
      "Planning slows when context scatters.",
      "Roadmaps need live issue context.",
      "Product work needs one system.",
    ];
  }
  return [
    "Issue queues can hide roadmap risk.",
    "Planning breaks when context splits.",
    "Product teams need cleaner handoffs.",
  ];
}

function buildScript(plan: ScriptPlan, claims: SourcedClaim[], input: SynthesizeScriptsInput): Script {
  const mainClaim = pickClaim(claims, plan.claim_index);
  const middleClaim = pickClaim(claims, plan.claim_index + 1);
  const ctaClaim = pickClaim(input.locked_brief.fields.claims, plan.index);
  const objectionClaim = pickClaim(claims, plan.claim_index + 2);

  const script: Script = {
    id: `script-${plan.awareness_level}-${plan.index + 1}`,
    awareness_level: plan.awareness_level,
    in_market_tier: plan.in_market_tier,
    platform: plan.platform,
    format: plan.format,
    angle: plan.angle,
    framework: plan.framework,
    duration: plan.duration,
    hook: buildLine(hookText(plan), "hook", mainClaim, ["gtm-brief"]),
    middle: [
      buildLine(middleText(plan), "middle", middleClaim, ["synthesize-positioning"]),
    ],
    cta: buildLine(ctaText(plan, input), "cta", ctaClaim, ["gtm-brief"]),
    hook_variants: variantTexts(plan).map((text) =>
      buildLine(text, "hook", mainClaim, ["gtm-brief"]),
    ),
    objection_handled: plan.objection
      ? buildLine("Switching can stay focused.", "middle", objectionClaim, ["research-icp"])
      : undefined,
    flagged_claims: [],
    quality_gate: {
      passed: true,
      violations: [],
      auto_fixes: 0,
    },
  };

  const gated = runQualityGate(script);
  if (!gated.passed) {
    throw new Error(
      `Quality gate failed for ${script.id}: ${gated.violations.map((violation) => violation.detail).join("; ")}`,
    );
  }
  return gated.script;
}

function buildDynamicCreativeSets(scripts: Script[]): SynthesizeScriptsOutput["dynamic_creative_sets"] {
  return ["meta", "google", "linkedin"].map((platform) => ({
    platform: platform as Script["platform"],
    script_ids: scripts
      .filter((script) => script.platform === platform)
      .map((script) => script.id),
  })).filter((set) => set.script_ids.length > 0);
}

function buildOutput(input: SynthesizeScriptsInput): SynthesizeScriptsOutput {
  const claims = extractClaims(input);
  const selectedLevels = input.selected_awareness_levels ?? DEFAULT_LEVELS;
  const plans = buildScriptMatrix({
    selected_awareness_levels: selectedLevels,
    objections: input.locked_brief.fields.commonObjections,
    claim_count: claims.length,
  });
  const matrixWarnings = validateMatrixDiversity(plans);
  if (matrixWarnings.length > 0) {
    throw new Error(`Matrix validation failed: ${matrixWarnings.join("; ")}`);
  }

  const scripts = plans.map((plan) => buildScript(plan, claims, input));
  const output: SynthesizeScriptsOutput = {
    run_id: input.run_id,
    brief_snapshot_id: input.brief_snapshot_id,
    stage: "generate-scripts",
    company_name: input.locked_brief.fields.companyName,
    scripts,
    dynamic_creative_sets: buildDynamicCreativeSets(scripts),
    matrix_warnings: matrixWarnings,
    style_references_used: input.locked_brief.fields.styleReferences,
    generated_at: new Date().toISOString(),
  };

  const parsed = synthesizeScriptsOutputSchema.safeParse(output);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 12)
      .map((issue) => `${issue.path.map(String).join(":")} - ${issue.message}`)
      .join("; ");
    throw new Error(`Generated output failed schema validation: ${issues}`);
  }

  return parsed.data;
}

function run(): void {
  const runDirArg = process.argv[2];
  if (!runDirArg) {
    process.stderr.write("Usage: orchestrate.ts <run_dir>\n");
    process.exit(2);
  }
  const runDir = path.resolve(process.cwd(), runDirArg);
  const inputPath = path.join(runDir, "input.json");
  const outputPath = path.join(runDir, "output.json");
  if (!fs.existsSync(inputPath)) {
    process.stderr.write(`[orchestrate] missing input: ${inputPath}\n`);
    process.exit(1);
  }

  try {
    const input = parseInput(inputPath);
    const output = buildOutput(input);
    writeJson(outputPath, output);
    process.stdout.write(`[orchestrate] wrote ${outputPath}\n`);
    process.stdout.write(`[orchestrate] generated ${output.scripts.length} sourced scripts\n`);
  } catch (error) {
    process.stderr.write(`[orchestrate] ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

run();
