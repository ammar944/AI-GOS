import { describe, expect, it } from "vitest";
import { z } from "zod";

import { SECTION_REGISTRY, type SupportedSectionId } from "../../sections/section-registry";
import { normalizePaidMediaPlanBody } from "../schemas/paid-media-plan";
import {
  getDecodeFallbackLeafStrings,
} from "../decode-fallbacks";
import {
  tolerantDecode,
  type DecodeShortfall,
  type TolerantDecodeResult,
} from "../tolerant-decode";

type MutableRecord = Record<string, unknown>;

interface MutationCase {
  name: string;
  value: unknown;
}

const enumRecasePaths: Record<SupportedSectionId, readonly string[]> = {
  positioningBuyerICP: ["personaReality", "personas", "0", "role"],
  positioningCompetitorLandscape: [
    "competitorSet",
    "competitors",
    "0",
    "competitorType",
  ],
  positioningDemandIntent: ["keywordDemand", "keywords", "0", "intentType"],
  positioningMarketCategory: ["marketSize", "signals", "0", "trajectory"],
  positioningOfferDiagnostic: ["channelTruth", "channels", "0", "hasWorked"],
  positioningPaidMediaPlan: ["channelSuggestions", "0", "verdict"],
  positioningVoiceOfCustomer: ["painLanguage", "quotes", "0", "source"],
};

function expectOk<TValue>(
  result: TolerantDecodeResult<TValue>,
): Extract<TolerantDecodeResult<TValue>, { ok: true }> {
  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error(
      `Expected tolerant decode success, got ${formatShortfalls(result.shortfalls)}`,
    );
  }

  return result;
}

function expectShortfall<TValue>(
  result: TolerantDecodeResult<TValue>,
): Extract<TolerantDecodeResult<TValue>, { ok: false }> {
  expect(result.ok).toBe(false);

  if (result.ok) {
    throw new Error("Expected tolerant decode shortfall.");
  }

  return result;
}

function formatShortfalls(shortfalls: readonly DecodeShortfall[]): string {
  return shortfalls
    .map((shortfall) => `${shortfall.path}:${shortfall.code}`)
    .join(", ");
}

function cloneValue<TValue>(value: TValue): TValue {
  return structuredClone(value);
}

function asRecord(value: unknown): MutableRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Expected mutable record in test fixture.");
  }

  return value as MutableRecord;
}

function asArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error("Expected mutable array in test fixture.");
  }

  return value;
}

function getAtPath(root: unknown, path: readonly string[]): unknown {
  let current = root;

  for (const segment of path) {
    if (/^\d+$/.test(segment)) {
      current = asArray(current)[Number(segment)];
      continue;
    }

    current = asRecord(current)[segment];
  }

  return current;
}

function setAtPath(
  root: unknown,
  path: readonly string[],
  value: unknown,
): void {
  const parent = getAtPath(root, path.slice(0, -1));
  const key = path[path.length - 1];

  if (key === undefined) {
    throw new Error("Cannot set empty path in test fixture.");
  }

  if (/^\d+$/.test(key)) {
    asArray(parent)[Number(key)] = value;
    return;
  }

  asRecord(parent)[key] = value;
}

function titleCaseEnum(value: unknown): string {
  return String(value)
    .split(/[-_]/g)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function duplicateFirstNonEmptyArray(value: unknown): boolean {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return false;
    }

    const last = value[value.length - 1];
    value.push(cloneValue(last), cloneValue(last));
    return true;
  }

  if (typeof value !== "object" || value === null) {
    return false;
  }

  return Object.values(value as MutableRecord).some((child) =>
    duplicateFirstNonEmptyArray(child),
  );
}

function renameFirstArrayRowKey(value: unknown): boolean {
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item !== "object" || item === null || Array.isArray(item)) {
        continue;
      }

      const record = item as MutableRecord;
      const key = Object.keys(record).find(
        (candidate) => typeof record[candidate] === "string",
      );

      if (key === undefined) {
        continue;
      }

      record[`${key}Drifted`] = record[key];
      delete record[key];
      return true;
    }
  }

  if (typeof value !== "object" || value === null) {
    return false;
  }

  return Object.values(value as MutableRecord).some((child) =>
    renameFirstArrayRowKey(child),
  );
}

function stringifyFirstNumber(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => stringifyFirstNumber(item));
  }

  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as MutableRecord;

  for (const [key, child] of Object.entries(record)) {
    if (typeof child === "number" && Number.isFinite(child)) {
      record[key] = String(child);
      return true;
    }

    if (stringifyFirstNumber(child)) {
      return true;
    }
  }

  return false;
}

function dropFirstArrayRowString(value: unknown): boolean {
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item !== "object" || item === null || Array.isArray(item)) {
        continue;
      }

      const record = item as MutableRecord;
      const key = Object.keys(record).find(
        (candidate) => typeof record[candidate] === "string",
      );

      if (key === undefined) {
        continue;
      }

      delete record[key];
      return true;
    }
  }

  if (typeof value !== "object" || value === null) {
    return false;
  }

  return Object.values(value as MutableRecord).some((child) =>
    dropFirstArrayRowString(child),
  );
}

function buildMutationCases(
  sectionId: SupportedSectionId,
  body: unknown,
): MutationCase[] {
  const mutations: MutationCase[] = [];
  const enumRecase = cloneValue(body);
  const enumPath = enumRecasePaths[sectionId];
  setAtPath(enumRecase, enumPath, titleCaseEnum(getAtPath(enumRecase, enumPath)));
  mutations.push({ name: "enum recasing", value: enumRecase });

  const arrayOvershoot = cloneValue(body);
  expect(duplicateFirstNonEmptyArray(arrayOvershoot)).toBe(true);
  mutations.push({ name: "array overshoot", value: arrayOvershoot });

  const driftedKey = cloneValue(body);
  expect(renameFirstArrayRowKey(driftedKey)).toBe(true);
  mutations.push({ name: "drifted key", value: driftedKey });

  const numericString = cloneValue(body);
  if (stringifyFirstNumber(numericString)) {
    mutations.push({ name: "numeric string", value: numericString });
  }

  const missingString = cloneValue(body);
  expect(dropFirstArrayRowString(missingString)).toBe(true);
  mutations.push({ name: "missing row string", value: missingString });

  return mutations;
}

function collectLeafStrings(value: unknown, output: Set<string>): void {
  if (typeof value === "string") {
    output.add(value);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectLeafStrings(item, output);
    }
    return;
  }

  if (typeof value !== "object" || value === null) {
    return;
  }

  for (const child of Object.values(value as MutableRecord)) {
    collectLeafStrings(child, output);
  }
}

describe("tolerantDecode", (): void => {
  it("snaps enum casing and punctuation without changing content fields", (): void => {
    const schema = z
      .object({
        verdict: z.enum(["direct-response", "brand"]),
        label: z.string().min(1),
      })
      .strict();

    const result = expectOk(
      tolerantDecode(
        schema,
        { verdict: "Direct Response:", label: "Keep this string" },
        { sectionId: "positioningPaidMediaPlan" },
      ),
    );

    expect(result.value).toEqual({
      verdict: "direct-response",
      label: "Keep this string",
    });
    expect(result.snaps).toEqual([
      expect.objectContaining({
        action: "snap-enum",
        from: "Direct Response:",
        path: "verdict",
        to: "direct-response",
      }),
    ]);
  });

  it("uses only declared neutral enum fallbacks", (): void => {
    const schema = z
      .object({
        channelSuggestions: z.array(
          z
            .object({
              verdict: z.enum(["FIX", "REVIEW", "KEEP"]),
              recommendation: z.string().min(1),
            })
            .strict(),
        ),
      })
      .strict();

    const result = expectOk(
      tolerantDecode(
        schema,
        {
          channelSuggestions: [
            { verdict: "defer to human", recommendation: "Review current mix." },
          ],
        },
        { sectionId: "positioningPaidMediaPlan" },
      ),
    );

    expect(result.value.channelSuggestions[0]?.verdict).toBe("REVIEW");
    expect(result.snaps).toEqual([
      expect.objectContaining({
        action: "fallback-enum",
        path: "channelSuggestions[0].verdict",
        to: "REVIEW",
      }),
    ]);
  });

  it("truncates array ceilings, strips unknown keys, coerces safe numbers, and wraps single arrays", (): void => {
    const schema = z
      .object({
        amount: z.number(),
        tags: z.array(z.string().min(1)),
        rows: z
          .array(
            z
              .object({
                label: z.string().min(1),
              })
              .strict(),
          )
          .max(1),
      })
      .strict();

    const result = expectOk(
      tolerantDecode(
        schema,
        {
          amount: "$1,234",
          tags: "single-tag",
          rows: [
            { label: "first", extra: "strip me" },
            { label: "second" },
          ],
        },
        { sectionId: "positioningBuyerICP" },
      ),
    );

    expect(result.value).toEqual({
      amount: 1234,
      tags: ["single-tag"],
      rows: [{ label: "first" }],
    });
    expect(result.snaps.map((snap) => snap.action)).toEqual(
      expect.arrayContaining([
        "coerce-number",
        "strip-unknown-keys",
        "truncate-array",
        "wrap-array",
      ]),
    );
  });

  it("drops irreparable bad rows but returns top-level floors as shortfalls", (): void => {
    const schema = z
      .object({
        rows: z
          .array(
            z
              .object({
                label: z.string().min(1),
                verdict: z.enum(["KEEP", "KILL"]),
              })
              .strict(),
          )
          .min(1),
      })
      .strict();

    const rowDrop = expectOk(
      tolerantDecode(
        schema,
        {
          rows: [
            { label: "usable", verdict: "KEEP" },
            { label: "bad", verdict: "maybe" },
          ],
        },
        { sectionId: "positioningBuyerICP" },
      ),
    );

    expect(rowDrop.value.rows).toEqual([{ label: "usable", verdict: "KEEP" }]);
    expect(rowDrop.snaps).toEqual([
      expect.objectContaining({ action: "drop-row-enum" }),
    ]);

    const shortfall = expectShortfall(
      tolerantDecode(schema, { rows: [] }, { sectionId: "positioningBuyerICP" }),
    );

    expect(shortfall.shortfalls).toEqual([
      expect.objectContaining({
        code: "too_small",
        path: "rows",
      }),
    ]);
  });

  it("does not fabricate leaf strings outside input, fallback values, or schema defaults", (): void => {
    const schema = z
      .object({
        channelSuggestions: z.array(
          z
            .object({
              amount: z.number(),
              label: z.string().min(1),
              verdict: z.enum(["KEEP", "REVIEW"]),
            })
            .strict(),
        ),
      })
      .strict();
    const raw = {
      channelSuggestions: [
        {
          amount: "$1,234",
          label: "Original recommendation",
          verdict: "not a declared verdict",
          unknown: "delete this",
        },
      ],
    };
    const inputStrings = new Set<string>();
    collectLeafStrings(raw, inputStrings);
    for (const fallback of getDecodeFallbackLeafStrings()) {
      inputStrings.add(fallback);
    }

    const result = expectOk(
      tolerantDecode(schema, raw, { sectionId: "positioningPaidMediaPlan" }),
    );
    const outputStrings = new Set<string>();
    collectLeafStrings(result.value, outputStrings);

    expect(
      [...outputStrings].filter((value) => !inputStrings.has(value)),
    ).toEqual([]);
  });
});

describe("historical decode kill-shape regressions", (): void => {
  it("f4699ed3: null optional model fields no longer hard-kill Buyer ICP", (): void => {
    const definition = SECTION_REGISTRY.positioningBuyerICP;
    const body = cloneValue(definition.fixtureArtifact.body);
    const personas = asArray(asRecord(asRecord(body).personaReality).personas);
    asRecord(personas[0]).teamSize = null;

    expectOk(
      tolerantDecode(definition.bodySchema, body, {
        sectionId: definition.id,
      }),
    );
  });

  it("f5bdddd0: missing TAM input-type rows decode without parse death", (): void => {
    const definition = SECTION_REGISTRY.positioningMarketCategory;
    const body = cloneValue(definition.fixtureArtifact.body);
    const marketSize = asRecord(asRecord(body).marketSize);
    const bottomUpTam = asRecord(marketSize.bottomUpTam);
    bottomUpTam.inputs = asArray(bottomUpTam.inputs).slice(0, 2);

    expectOk(
      tolerantDecode(definition.bodySchema, body, {
        sectionId: definition.id,
      }),
    );
  });

  it("64d37a5b: Demand Intent exampleCompany accepts explicit null", (): void => {
    const definition = SECTION_REGISTRY.positioningDemandIntent;
    const body = cloneValue(definition.fixtureArtifact.body);
    const items = asArray(asRecord(asRecord(body).intentSignals).items);
    asRecord(items[0]).exampleCompany = null;

    expectOk(
      tolerantDecode(definition.bodySchema, body, {
        sectionId: definition.id,
      }),
    );
  });

  it("a4b91ade: degenerate blockGaps normalize away instead of rejecting", (): void => {
    const definition = SECTION_REGISTRY.positioningDemandIntent;
    const body = cloneValue(definition.fixtureArtifact.body);
    asRecord(asRecord(body).keywordDemand).blockGap = {
      foundCount: 2,
      requiredCount: 0,
      sourcingPlan: [],
      summary: "Vestigial model-authored gap on a populated block.",
    };

    expectOk(
      tolerantDecode(definition.bodySchema, body, {
        sectionId: definition.id,
      }),
    );
  });

  it("11b2bc91: TAM benchmark status snaps to evidence-gap", (): void => {
    const definition = SECTION_REGISTRY.positioningMarketCategory;
    const body = cloneValue(definition.fixtureArtifact.body);
    const inputs = asArray(
      asRecord(asRecord(asRecord(body).marketSize).bottomUpTam).inputs,
    );
    asRecord(inputs[0]).status = "benchmark";

    const result = expectOk(
      tolerantDecode(definition.bodySchema, body, {
        sectionId: definition.id,
      }),
    );
    const parsedMarketSize = asRecord(asRecord(result.value).marketSize);
    const parsedInputs = asArray(asRecord(parsedMarketSize.bottomUpTam).inputs);

    expect(asRecord(parsedInputs[0]).status).toBe("evidence-gap");
  });

  it("3d72174f: keyFindings basis aliases stay deterministic", (): void => {
    const definition = SECTION_REGISTRY.positioningMarketCategory;
    const body = cloneValue(definition.fixtureArtifact.body);
    asRecord(body).keyFindings = [
      {
        basis: "verified",
        finding: "Market evidence is sourced in the fixture.",
        sourceUrls: ["https://example.com/saaslaunch"],
      },
    ];

    expectOk(
      tolerantDecode(definition.bodySchema, body, {
        sectionId: definition.id,
      }),
    );
  });

  it("3b3c6ea0: paid-media funnelIdeation overshoot truncates instead of rejecting", (): void => {
    const definition = SECTION_REGISTRY.positioningPaidMediaPlan;
    const body = cloneValue(definition.fixtureArtifact.body);
    const rows = asArray(asRecord(body).funnelIdeation);
    rows.push(cloneValue(rows[0]), cloneValue(rows[1]));

    const result = expectOk(
      tolerantDecode(definition.bodySchema, body, {
        sectionId: definition.id,
      }),
    );

    expect(result.value.funnelIdeation).toHaveLength(3);
    expect(result.snaps).toEqual([
      expect.objectContaining({
        action: "truncate-array",
        path: "funnelIdeation",
      }),
    ]);
  });

  it("38d19b68: paid-media channel overshoot snaps but projectedResults floor stays a shortfall", (): void => {
    const definition = SECTION_REGISTRY.positioningPaidMediaPlan;
    const overshootBody = cloneValue(definition.fixtureArtifact.body);
    const channelSuggestions = asArray(asRecord(overshootBody).channelSuggestions);
    channelSuggestions.push(
      cloneValue(channelSuggestions[0]),
      cloneValue(channelSuggestions[1]),
    );

    expectOk(
      tolerantDecode(definition.bodySchema, overshootBody, {
        sectionId: definition.id,
      }),
    );

    const floorBody = cloneValue(definition.fixtureArtifact.body);
    asRecord(floorBody).projectedResults = [];

    const result = expectShortfall(
      tolerantDecode(definition.bodySchema, floorBody, {
        sectionId: definition.id,
      }),
    );

    expect(result.shortfalls).toEqual([
      expect.objectContaining({
        code: "too_small",
        path: "projectedResults",
      }),
    ]);
  });

  it("0249f5c9: paid-media key drift is normalized before tolerant decode", (): void => {
    const definition = SECTION_REGISTRY.positioningPaidMediaPlan;
    const body = cloneValue(definition.fixtureArtifact.body);
    const row = asRecord(asArray(asRecord(body).channelSuggestions)[0]);
    row.detail = row.recommendation;
    delete row.recommendation;
    const normalized = normalizePaidMediaPlanBody(body, {});

    expectOk(
      tolerantDecode(definition.bodySchema, normalized, {
        sectionId: definition.id,
      }),
    );
  });
});

describe("fixture mutation fuzz", (): void => {
  it("never throws and reparsed ok values pass the original section body schema", (): void => {
    for (const [sectionId, definition] of Object.entries(SECTION_REGISTRY) as Array<
      [SupportedSectionId, (typeof SECTION_REGISTRY)[SupportedSectionId]]
    >) {
      const schema = definition.bodySchema as z.ZodType<unknown>;

      for (const mutation of buildMutationCases(
        sectionId,
        definition.fixtureArtifact.body,
      )) {
        const result = tolerantDecode(schema, mutation.value, {
          sectionId,
        });

        if (result.ok) {
          expect(() => schema.parse(result.value)).not.toThrow();
        } else {
          expect(result.shortfalls.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("leaves valid fixtures unchanged with zero snaps", (): void => {
    for (const [sectionId, definition] of Object.entries(SECTION_REGISTRY) as Array<
      [SupportedSectionId, (typeof SECTION_REGISTRY)[SupportedSectionId]]
    >) {
      const schema = definition.bodySchema as z.ZodType<unknown>;
      const body = cloneValue(definition.fixtureArtifact.body);
      const result = expectOk(
        tolerantDecode(schema, body, { sectionId }),
      );

      expect(result.value).toEqual(schema.parse(body));
      expect(result.snaps).toEqual([]);
    }
  });
});
