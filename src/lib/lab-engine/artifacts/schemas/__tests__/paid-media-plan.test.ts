import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  creativeTypeValues,
  snapAngleTypesInMix,
  snapCreativeType,
} from "../paid-media-plan";

const angleTypesInMixSchema = z.array(z.enum(creativeTypeValues));

describe("snapCreativeType", () => {
  it("snaps human-readable label to its slug member", () => {
    expect(snapCreativeType("Unique Selling Point")).toBe(
      "unique-selling-point",
    );
  });

  it("snaps a SCREAMING_SNAKE_CASE value to its slug member", () => {
    expect(snapCreativeType("PROBLEM_SOLUTION_TRANSFORMATION")).toBe(
      "problem-solution-transformation",
    );
  });

  it("falls back to product-demo for an unrecognized value", () => {
    expect(snapCreativeType("testimonial")).toBe("product-demo");
  });

  it("round-trips each canonical enum value unchanged", () => {
    for (const value of creativeTypeValues) {
      expect(snapCreativeType(value)).toBe(value);
    }
  });
});

describe("snapAngleTypesInMix", () => {
  it("snaps every entry to a valid enum member", () => {
    const result = snapAngleTypesInMix([
      "unique-selling-point",
      "User Generated Content",
      "founder talking head",
    ]);

    expect(angleTypesInMixSchema.safeParse(result).success).toBe(true);
  });

  it("produces an array that parses clean against the enum after snapping an out-of-enum value", () => {
    const raw = ["unique-selling-point", "carousel-swipe", "product demo"];
    const snapped = snapAngleTypesInMix(raw);

    const parsed = angleTypesInMixSchema.safeParse(snapped);
    expect(parsed.success).toBe(true);
  });
});
