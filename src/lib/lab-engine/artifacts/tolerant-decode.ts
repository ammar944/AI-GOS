import { z } from "zod";

import {
  decodeRepairSchema,
  type DecodeRepair,
} from "./artifact-envelope";
import { findDecodeEnumFallback } from "./decode-fallbacks";

/*
Installed Zod probe, 2026-06-12, zod@4.3.5:
- enum mismatch: code="invalid_value", values=[...], path is the field path.
- literal mismatch: code="invalid_value"; literal unions emit code="invalid_union"
  with nested invalid_value issues.
- array max: code="too_big", origin="array", maximum=<number>.
- array min: code="too_small", origin="array", minimum=<number>.
- string min: code="too_small", origin="string", minimum=<number>.
- missing required key: code="invalid_type", expected=<type>, path includes the
  missing key, message says "received undefined".
- unrecognized keys: code="unrecognized_keys", keys=[...], path is the object.
- wrong primitive in array row: code="invalid_type", path includes numeric
  indexes, for example ["items", 0, "n"].
*/

const MAX_DECODE_PASSES = 30;
const decodeRepairsInternalKey = "__decodeRepairs";

type DecodePathSegment = string | number | symbol;
type DecodePath = readonly DecodePathSegment[];

export interface DecodeShortfall {
  path: string;
  code: string;
  message: string;
}

export type TolerantDecodeResult<TValue> =
  | {
      ok: true;
      value: TValue;
      snaps: DecodeRepair[];
    }
  | {
      ok: false;
      snaps: DecodeRepair[];
      shortfalls: DecodeShortfall[];
    };

export interface TolerantDecodeOptions {
  sectionId: string;
}

export interface DecodeRepairsMetadataResult {
  value: unknown;
  snaps: DecodeRepair[];
}

export class TolerantDecodeShortfallError extends Error {
  public readonly shortfalls: DecodeShortfall[];

  public constructor({
    context,
    shortfalls,
  }: {
    context: string;
    shortfalls: readonly DecodeShortfall[];
  }) {
    super(
      `${context}: ${formatDecodeShortfalls(shortfalls).join("; ")}`,
    );
    this.name = "TolerantDecodeShortfallError";
    this.shortfalls = [...shortfalls];
  }
}

interface FixApplied {
  value: unknown;
  repair: DecodeRepair;
}

interface RowLocation {
  arrayPath: DecodePath;
  index: number;
}

export function formatDecodeShortfalls(
  shortfalls: readonly DecodeShortfall[],
): string[] {
  return shortfalls.map(
    (shortfall) => `${shortfall.path}: ${shortfall.message}`,
  );
}

export function createTolerantDecodeShortfallError({
  context,
  shortfalls,
}: {
  context: string;
  shortfalls: readonly DecodeShortfall[];
}): TolerantDecodeShortfallError {
  return new TolerantDecodeShortfallError({ context, shortfalls });
}

export function withDecodeRepairsMetadata(
  value: unknown,
  snaps: readonly DecodeRepair[],
): unknown {
  if (snaps.length === 0 || !isMutableRecord(value)) {
    return value;
  }

  return {
    ...value,
    [decodeRepairsInternalKey]: [...snaps],
  };
}

export function takeDecodeRepairsMetadata(
  value: unknown,
): DecodeRepairsMetadataResult {
  if (!isMutableRecord(value)) {
    return { value, snaps: [] };
  }

  const parsed = z
    .array(decodeRepairSchema)
    .safeParse(value[decodeRepairsInternalKey]);

  if (!parsed.success) {
    return { value, snaps: [] };
  }

  const cleaned = { ...value };
  delete cleaned[decodeRepairsInternalKey];

  return {
    value: cleaned,
    snaps: parsed.data,
  };
}

export function tolerantDecode<TValue>(
  schema: z.ZodType<TValue>,
  raw: unknown,
  options: TolerantDecodeOptions,
): TolerantDecodeResult<TValue> {
  let working = structuredClone(raw) as unknown;
  const snaps: DecodeRepair[] = [];

  for (let pass = 0; pass < MAX_DECODE_PASSES; pass += 1) {
    const result = schema.safeParse(working);

    if (result.success) {
      return {
        ok: true,
        value: result.data,
        snaps,
      };
    }

    const applied = findFirstApplicableFix({
      issues: result.error.issues,
      options,
      schema,
      value: working,
    });

    if (applied === null) {
      return {
        ok: false,
        snaps,
        shortfalls: result.error.issues.map(shortfallFromIssue),
      };
    }

    working = applied.value;
    snaps.push(applied.repair);
  }

  const finalResult = schema.safeParse(working);

  if (finalResult.success) {
    return {
      ok: true,
      value: finalResult.data,
      snaps,
    };
  }

  return {
    ok: false,
    snaps,
    shortfalls: finalResult.error.issues.map(shortfallFromIssue),
  };
}

function findFirstApplicableFix<TValue>({
  issues,
  options,
  schema,
  value,
}: {
  issues: readonly z.ZodIssue[];
  options: TolerantDecodeOptions;
  schema: z.ZodType<TValue>;
  value: unknown;
}): FixApplied | null {
  for (const issue of issues) {
    const applied = applyFix({ issue, options, schema, value });

    if (applied !== null) {
      return applied;
    }
  }

  return null;
}

function applyFix<TValue>({
  issue,
  options,
  schema,
  value,
}: {
  issue: z.ZodIssue;
  options: TolerantDecodeOptions;
  schema: z.ZodType<TValue>;
  value: unknown;
}): FixApplied | null {
  if (isEnumLikeIssue(issue)) {
    return applyEnumFix({ issue, options, schema, value });
  }

  if (issue.code === "too_big" && getIssueOrigin(issue) === "array") {
    return applyArrayTooBigFix({ issue, value });
  }

  if (issue.code === "too_small") {
    return applyContentFloorFix({ issue, value });
  }

  if (issue.code === "unrecognized_keys") {
    return applyUnrecognizedKeysFix({ issue, value });
  }

  if (issue.code === "invalid_type") {
    return applyInvalidTypeFix({ issue, schema, value });
  }

  return null;
}

function applyEnumFix<TValue>({
  issue,
  options,
  schema,
  value,
}: {
  issue: z.ZodIssue;
  options: TolerantDecodeOptions;
  schema: z.ZodType<TValue>;
  value: unknown;
}): FixApplied | null {
  const allowedValues = getIssueAllowedValues(issue);
  const currentValue = getAtPath(value, issue.path);
  const path = formatPath(issue.path);
  const pathPattern = formatPathPattern(issue.path);

  if (typeof currentValue === "string") {
    const matchedValue = findUniqueNormalizedEnumMatch({
      allowedValues,
      candidate: currentValue,
    });

    if (matchedValue !== undefined) {
      const nextValue = setAtPath(structuredClone(value), issue.path, matchedValue);

      if (nextValue.changed) {
        return {
          value: nextValue.value,
          repair: {
            path,
            action: "snap-enum",
            from: currentValue,
            to: matchedValue,
          },
        };
      }
    }
  }

  const fallback = findDecodeEnumFallback({
    allowedValues,
    pathPattern,
    sectionId: options.sectionId,
  });

  if (fallback !== undefined) {
    const nextValue = setAtPath(
      structuredClone(value),
      issue.path,
      fallback.fallback,
    );

    if (nextValue.changed) {
      return {
        value: nextValue.value,
        repair: {
          path,
          action: "fallback-enum",
          from: currentValue,
          to: fallback.fallback,
          detail: fallback.reason,
        },
      };
    }
  }

  const optionalDelete = applyOptionalDeleteTrial({
    issue,
    schema,
    value,
    action: "delete-optional-enum",
    from: currentValue,
  });

  if (optionalDelete !== null) {
    return optionalDelete;
  }

  return applyRowDropFix({
    action: "drop-row-enum",
    detail: `Dropped row because ${path} did not match a closed enum and no safe fallback was declared.`,
    issue,
    value,
  });
}

function applyArrayTooBigFix({
  issue,
  value,
}: {
  issue: z.ZodIssue;
  value: unknown;
}): FixApplied | null {
  const maximum = getIssueNumberProperty(issue, "maximum");

  if (maximum === undefined) {
    return null;
  }

  const currentValue = getAtPath(value, issue.path);

  if (!Array.isArray(currentValue) || currentValue.length <= maximum) {
    return null;
  }

  const truncated = currentValue.slice(0, maximum);
  const nextValue = setAtPath(structuredClone(value), issue.path, truncated);

  if (!nextValue.changed) {
    return null;
  }

  return {
    value: nextValue.value,
    repair: {
      path: formatPath(issue.path),
      action: "truncate-array",
      from: currentValue.length,
      to: truncated.length,
      detail: `Dropped ${currentValue.length - truncated.length} overflow rows from the end.`,
    },
  };
}

function applyContentFloorFix({
  issue,
  value,
}: {
  issue: z.ZodIssue;
  value: unknown;
}): FixApplied | null {
  const origin = getIssueOrigin(issue);

  if (origin !== "array" && origin !== "string") {
    return null;
  }

  return applyRowDropFix({
    action: "drop-row-floor",
    detail: `Dropped row because ${formatPath(issue.path)} failed a ${origin} content floor.`,
    issue,
    value,
  });
}

function applyUnrecognizedKeysFix({
  issue,
  value,
}: {
  issue: z.ZodIssue;
  value: unknown;
}): FixApplied | null {
  const keys = getIssueStringArrayProperty(issue, "keys");

  if (keys.length === 0) {
    return null;
  }

  const nextValue = structuredClone(value);
  const target = getAtPath(nextValue, issue.path);

  if (!isMutableRecord(target)) {
    return null;
  }

  const strippedKeys = keys.filter((key) =>
    Object.prototype.hasOwnProperty.call(target, key),
  );

  if (strippedKeys.length === 0) {
    return null;
  }

  for (const key of strippedKeys) {
    delete target[key];
  }

  return {
    value: nextValue,
    repair: {
      path: formatPath(issue.path),
      action: "strip-unknown-keys",
      detail: `Stripped unknown keys: ${strippedKeys.join(", ")}`,
    },
  };
}

function applyInvalidTypeFix<TValue>({
  issue,
  schema,
  value,
}: {
  issue: z.ZodIssue;
  schema: z.ZodType<TValue>;
  value: unknown;
}): FixApplied | null {
  const expected = getIssueStringProperty(issue, "expected");
  const currentValue = getAtPath(value, issue.path);

  if (expected === "number" && typeof currentValue === "string") {
    const coerced = coerceCleanNumber(currentValue);

    if (coerced !== undefined) {
      const nextValue = setAtPath(structuredClone(value), issue.path, coerced);

      if (nextValue.changed) {
        return {
          value: nextValue.value,
          repair: {
            path: formatPath(issue.path),
            action: "coerce-number",
            from: currentValue,
            to: coerced,
          },
        };
      }
    }
  }

  if (
    expected === "array" &&
    currentValue !== undefined &&
    currentValue !== null &&
    !Array.isArray(currentValue)
  ) {
    const nextValue = setAtPath(structuredClone(value), issue.path, [
      currentValue,
    ]);

    if (nextValue.changed) {
      return {
        value: nextValue.value,
        repair: {
          path: formatPath(issue.path),
          action: "wrap-array",
          from: currentValue,
          to: [currentValue],
        },
      };
    }
  }

  if (currentValue === null) {
    const optionalDelete = applyOptionalDeleteTrial({
      issue,
      schema,
      value,
      action: "delete-null-optional",
      from: null,
    });

    if (optionalDelete !== null) {
      return optionalDelete;
    }
  }

  return applyRowDropFix({
    action: "drop-row-invalid-type",
    detail: `Dropped row because ${formatPath(issue.path)} had wrong primitive type.`,
    issue,
    value,
  });
}

function applyOptionalDeleteTrial<TValue>({
  action,
  from,
  issue,
  schema,
  value,
}: {
  action: string;
  from: unknown;
  issue: z.ZodIssue;
  schema: z.ZodType<TValue>;
  value: unknown;
}): FixApplied | null {
  if (issue.path.length === 0) {
    return null;
  }

  const candidate = structuredClone(value);
  const deleted = deleteAtPath(candidate, issue.path);

  if (!deleted.changed) {
    return null;
  }

  const result = schema.safeParse(deleted.value);

  if (
    !result.success &&
    result.error.issues.some((candidateIssue) =>
      pathsEqual(candidateIssue.path, issue.path),
    )
  ) {
    return null;
  }

  return {
    value: deleted.value,
    repair: {
      path: formatPath(issue.path),
      action,
      from,
      detail:
        "Deleted field only after reparsing proved the same path no longer failed.",
    },
  };
}

function applyRowDropFix({
  action,
  detail,
  issue,
  value,
}: {
  action: string;
  detail: string;
  issue: z.ZodIssue;
  value: unknown;
}): FixApplied | null {
  const row = getRowLocation(issue.path);

  if (row === null) {
    return null;
  }

  const nextValue = structuredClone(value);
  const arrayValue = getAtPath(nextValue, row.arrayPath);

  if (!Array.isArray(arrayValue) || row.index < 0 || row.index >= arrayValue.length) {
    return null;
  }

  arrayValue.splice(row.index, 1);

  return {
    value: nextValue,
    repair: {
      path: formatPath([...row.arrayPath, row.index]),
      action,
      detail,
    },
  };
}

function shortfallFromIssue(issue: z.ZodIssue): DecodeShortfall {
  return {
    path: formatPath(issue.path),
    code: issue.code,
    message: issue.message,
  };
}

function isEnumLikeIssue(issue: z.ZodIssue): boolean {
  return getIssueAllowedValues(issue).length > 0;
}

function getIssueAllowedValues(issue: z.ZodIssue): readonly string[] {
  if (issue.code === "invalid_value") {
    return getIssueStringArrayProperty(issue, "values");
  }

  if (issue.code !== "invalid_union") {
    return [];
  }

  const nestedErrors = getIssueUnknownArrayProperty(issue, "errors");
  const values = new Set<string>();

  for (const nestedError of nestedErrors) {
    if (!Array.isArray(nestedError)) {
      continue;
    }

    for (const nestedIssue of nestedError) {
      if (!isIssueRecord(nestedIssue)) {
        continue;
      }

      if (nestedIssue.code !== "invalid_value") {
        continue;
      }

      for (const value of getIssueStringArrayProperty(nestedIssue, "values")) {
        values.add(value);
      }
    }
  }

  return [...values];
}

function isIssueRecord(value: unknown): value is z.ZodIssue {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    "path" in value &&
    "message" in value
  );
}

function findUniqueNormalizedEnumMatch({
  allowedValues,
  candidate,
}: {
  allowedValues: readonly string[];
  candidate: string;
}): string | undefined {
  const normalizedCandidate = normalizeEnumToken(candidate);
  const matches = allowedValues.filter(
    (value) => normalizeEnumToken(value) === normalizedCandidate,
  );

  return matches.length === 1 ? matches[0] : undefined;
}

function normalizeEnumToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "-")
    .replace(/[.:]+$/g, "")
    .trim();
}

function coerceCleanNumber(value: string): number | undefined {
  const trimmed = value.trim();
  const currencyPattern = /^\$?\s*-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/;

  if (!currencyPattern.test(trimmed)) {
    return undefined;
  }

  const normalized = trimmed.replace(/[$,\s]/g, "");
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : undefined;
}

function getRowLocation(path: DecodePath): RowLocation | null {
  const index = path.findIndex((part) => typeof part === "number");

  if (index < 0) {
    return null;
  }

  return {
    arrayPath: path.slice(0, index),
    index: path[index] as number,
  };
}

function getAtPath(root: unknown, path: DecodePath): unknown {
  let current = root;

  for (const part of path) {
    if (typeof part === "number") {
      if (!Array.isArray(current)) {
        return undefined;
      }
      current = current[part];
      continue;
    }

    if (!isMutableRecord(current)) {
      return undefined;
    }

    current = current[part];
  }

  return current;
}

function setAtPath(
  root: unknown,
  path: DecodePath,
  nextValue: unknown,
): { changed: boolean; value: unknown } {
  if (path.length === 0) {
    return { changed: true, value: nextValue };
  }

  const parent = getAtPath(root, path.slice(0, -1));
  const key = path[path.length - 1];

  if (key === undefined) {
    return { changed: false, value: root };
  }

  if (typeof key === "number") {
    if (!Array.isArray(parent)) {
      return { changed: false, value: root };
    }
    parent[key] = nextValue;
    return { changed: true, value: root };
  }

  if (!isMutableRecord(parent)) {
    return { changed: false, value: root };
  }

  parent[key] = nextValue;
  return { changed: true, value: root };
}

function deleteAtPath(
  root: unknown,
  path: DecodePath,
): { changed: boolean; value: unknown } {
  const parent = getAtPath(root, path.slice(0, -1));
  const key = path[path.length - 1];

  if (key === undefined) {
    return { changed: false, value: root };
  }

  if (typeof key === "number") {
    if (!Array.isArray(parent) || key < 0 || key >= parent.length) {
      return { changed: false, value: root };
    }
    parent.splice(key, 1);
    return { changed: true, value: root };
  }

  if (
    !isMutableRecord(parent) ||
    !Object.prototype.hasOwnProperty.call(parent, key)
  ) {
    return { changed: false, value: root };
  }

  delete parent[key];
  return { changed: true, value: root };
}

function isMutableRecord(value: unknown): value is Record<string | symbol, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pathsEqual(first: DecodePath, second: DecodePath): boolean {
  return (
    first.length === second.length &&
    first.every((part, index) => part === second[index])
  );
}

function formatPath(path: DecodePath): string {
  if (path.length === 0) {
    return "(root)";
  }

  let output = "";

  for (const part of path) {
    if (typeof part === "number") {
      output = `${output}[${part}]`;
      continue;
    }

    const key = String(part);
    output = output.length === 0 ? key : `${output}.${key}`;
  }

  return output;
}

function formatPathPattern(path: DecodePath): string {
  if (path.length === 0) {
    return "(root)";
  }

  let output = "";

  for (const part of path) {
    if (typeof part === "number") {
      output = `${output}[]`;
      continue;
    }

    const key = String(part);
    output = output.length === 0 ? key : `${output}.${key}`;
  }

  return output;
}

function issueRecord(issue: z.ZodIssue): Record<string, unknown> {
  return issue as unknown as Record<string, unknown>;
}

function getIssueOrigin(issue: z.ZodIssue): string | undefined {
  return getIssueStringProperty(issue, "origin");
}

function getIssueStringProperty(
  issue: z.ZodIssue,
  property: string,
): string | undefined {
  const value = issueRecord(issue)[property];

  return typeof value === "string" ? value : undefined;
}

function getIssueNumberProperty(
  issue: z.ZodIssue,
  property: string,
): number | undefined {
  const value = issueRecord(issue)[property];

  return typeof value === "number" && Number.isFinite(value)
    ? Math.trunc(value)
    : undefined;
}

function getIssueStringArrayProperty(
  issue: z.ZodIssue,
  property: string,
): readonly string[] {
  const value = issueRecord(issue)[property];

  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function getIssueUnknownArrayProperty(
  issue: z.ZodIssue,
  property: string,
): readonly unknown[] {
  const value = issueRecord(issue)[property];

  return Array.isArray(value) ? value : [];
}
