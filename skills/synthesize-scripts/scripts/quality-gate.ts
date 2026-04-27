import * as fs from "fs";
import * as path from "path";
import type {
  DerivedLine,
  Script,
  ScriptPlatform,
} from "../schemas/output.ts";

type ViolationSeverity = "auto-fixed" | "warning" | "fail";

export interface QualityViolation {
  check: string;
  severity: ViolationSeverity;
  detail: string;
  field: string;
}

export interface QualityGateResult {
  script: Script;
  violations: QualityViolation[];
  auto_fixes: number;
  passed: boolean;
}

interface Limit {
  max: number;
  optimal?: number;
}

type PlatformLimits = Record<ScriptPlatform, {
  hook: Limit;
  middle: Limit;
  cta: Limit;
  hook_variant: Limit;
}>;

interface KillList {
  tier1_always_replace: Record<string, string>;
  banned_phrases: string[];
  template_openers: string[];
  corporate_filler: string[];
  chatbot_closers: string[];
}

const SKILL_ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

function loadPlatformLimits(): PlatformLimits {
  return readJsonFile<PlatformLimits>(path.join(SKILL_ROOT, "references", "platform-limits.json"));
}

function loadKillList(): KillList {
  return readJsonFile<KillList>(path.join(SKILL_ROOT, "references", "kill-list.json"));
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fixDashes(text: string): { text: string; fixed: boolean } {
  if (!/[—–]/.test(text)) {
    return { text, fixed: false };
  }
  const fixed = text
    .replace(/\s[—–]\s/g, ". ")
    .replace(/(\d[\d$%KkMmBb.,]*)[—–](\$?\d)/g, "$1 to $2")
    .replace(/([a-zA-Z])([—–])([a-zA-Z])/g, "$1, $3")
    .replace(/[—–]/g, ",");
  return { text: fixed, fixed: true };
}

function replaceTierOne(text: string, field: string, killList: KillList): {
  text: string;
  violations: QualityViolation[];
} {
  const violations: QualityViolation[] = [];
  let current = text;
  for (const [word, replacement] of Object.entries(killList.tier1_always_replace)) {
    const pattern = new RegExp(`\\b${escapeRegex(word)}\\b`, "gi");
    if (!pattern.test(current)) {
      continue;
    }
    current = current.replace(pattern, replacement);
    violations.push({
      check: "corporate-filler",
      severity: "auto-fixed",
      detail: `Replaced "${word}" with "${replacement}".`,
      field,
    });
  }
  return { text: current, violations };
}

function checkIncludes(text: string, field: string, phrases: string[], check: string): QualityViolation[] {
  const lower = text.toLowerCase();
  return phrases
    .filter((phrase) => lower.includes(phrase.toLowerCase()))
    .map((phrase) => ({
      check,
      severity: "warning" as const,
      detail: `Contains "${phrase}".`,
      field,
    }));
}

function checkTemplateOpeners(text: string, field: string, killList: KillList): QualityViolation[] {
  return killList.template_openers.flatMap((pattern) => {
    const regex = new RegExp(pattern, "i");
    return regex.test(text)
      ? [{
          check: "template-opener",
          severity: "warning" as const,
          detail: `Opens with template pattern "${pattern}".`,
          field,
        }]
      : [];
  });
}

function checkRuleOfThree(text: string, field: string): QualityViolation[] {
  const matches = text.match(/\b\w+,\s+\w+,\s+(?:and|&)\s+\w+\b/gi) ?? [];
  return matches.map((match) => ({
    check: "rule-of-three",
    severity: "warning" as const,
    detail: `Rule-of-three phrasing detected: "${match}".`,
    field,
  }));
}

function limitForRole(platform: ScriptPlatform, role: DerivedLine["role"], limits: PlatformLimits): Limit {
  return limits[platform][role];
}

function lineFieldName(scriptId: string, linePath: string): string {
  return `${scriptId}.${linePath}`;
}

function checkPlatformLimit(
  text: string,
  field: string,
  platform: ScriptPlatform,
  role: DerivedLine["role"] | "hook_variant",
  limits: PlatformLimits,
): QualityViolation[] {
  const limit = role === "hook_variant" ? limits[platform].hook_variant : limitForRole(platform, role, limits);
  if (text.length <= limit.max) {
    return [];
  }
  return [{
    check: "platform-limit",
    severity: "fail",
    detail: `${field} is ${text.length} chars; ${platform} ${role} max is ${limit.max}.`,
    field,
  }];
}

function gateLine(
  line: DerivedLine,
  field: string,
  platform: ScriptPlatform,
  limits: PlatformLimits,
  killList: KillList,
  roleOverride?: "hook_variant",
): { line: DerivedLine; violations: QualityViolation[] } {
  const violations: QualityViolation[] = [];
  const dashResult = fixDashes(line.text);
  if (dashResult.fixed) {
    violations.push({
      check: "dash-elimination",
      severity: "auto-fixed",
      detail: "Removed em or en dash.",
      field,
    });
  }

  const tierOne = replaceTierOne(dashResult.text, field, killList);
  violations.push(...tierOne.violations);
  violations.push(...checkIncludes(tierOne.text, field, killList.banned_phrases, "banned-phrase"));
  violations.push(...checkTemplateOpeners(tierOne.text, field, killList));
  violations.push(...checkRuleOfThree(tierOne.text, field));
  violations.push(...checkIncludes(tierOne.text, field, killList.corporate_filler, "corporate-filler"));
  violations.push(...checkIncludes(tierOne.text, field, killList.chatbot_closers, "chatbot-closer"));
  violations.push(...checkPlatformLimit(
    tierOne.text,
    field,
    platform,
    roleOverride ?? line.role,
    limits,
  ));

  return {
    line: {
      ...line,
      text: tierOne.text,
    },
    violations,
  };
}

export function runQualityGate(script: Script): QualityGateResult {
  const limits = loadPlatformLimits();
  const killList = loadKillList();

  const hook = gateLine(
    script.hook,
    lineFieldName(script.id, "hook"),
    script.platform,
    limits,
    killList,
  );
  const middle = script.middle.map((line, index) =>
    gateLine(
      line,
      lineFieldName(script.id, `middle.${index}`),
      script.platform,
      limits,
      killList,
    ),
  );
  const cta = gateLine(
    script.cta,
    lineFieldName(script.id, "cta"),
    script.platform,
    limits,
    killList,
  );
  const variants = script.hook_variants.map((line, index) =>
    gateLine(
      line,
      lineFieldName(script.id, `hook_variants.${index}`),
      script.platform,
      limits,
      killList,
      "hook_variant",
    ),
  );
  const objection = script.objection_handled
    ? gateLine(
        script.objection_handled,
        lineFieldName(script.id, "objection_handled"),
        script.platform,
        limits,
        killList,
      )
    : undefined;

  const violations = [
    ...hook.violations,
    ...middle.flatMap((result) => result.violations),
    ...cta.violations,
    ...variants.flatMap((result) => result.violations),
    ...(objection ? objection.violations : []),
  ];
  const autoFixes = violations.filter((violation) => violation.severity === "auto-fixed").length;
  const failures = violations.filter((violation) => violation.severity === "fail").length;

  return {
    script: {
      ...script,
      hook: hook.line,
      middle: middle.map((result) => result.line),
      cta: cta.line,
      hook_variants: variants.map((result) => result.line),
      objection_handled: objection?.line,
      quality_gate: {
        passed: failures === 0,
        violations: violations.map((violation) => `${violation.check}: ${violation.detail}`),
        auto_fixes: autoFixes,
      },
    },
    violations,
    auto_fixes: autoFixes,
    passed: failures === 0,
  };
}
