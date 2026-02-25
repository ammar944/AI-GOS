import { describe, expect, it } from "vitest";
import tokens, {
  bg,
  text,
  border,
  accent,
  semantic,
  shadow,
  space,
  radius,
  chart,
  gradient,
} from "@/lib/design-tokens";

describe("design-tokens", () => {
  it("exports all named groups", () => {
    expect(bg).toBeDefined();
    expect(text).toBeDefined();
    expect(border).toBeDefined();
    expect(accent).toBeDefined();
    expect(semantic).toBeDefined();
    expect(shadow).toBeDefined();
    expect(space).toBeDefined();
    expect(radius).toBeDefined();
    expect(chart).toBeDefined();
    expect(gradient).toBeDefined();
  });

  it("aggregated tokens object contains all groups", () => {
    expect(tokens.bg).toBe(bg);
    expect(tokens.text).toBe(text);
    expect(tokens.border).toBe(border);
    expect(tokens.accent).toBe(accent);
    expect(tokens.semantic).toBe(semantic);
    expect(tokens.shadow).toBe(shadow);
    expect(tokens.space).toBe(space);
    expect(tokens.radius).toBe(radius);
    expect(tokens.chart).toBe(chart);
    expect(tokens.gradient).toBe(gradient);
  });

  it("spot-checks token values against CSS variables", () => {
    expect(bg.base).toBe("rgb(7, 9, 14)");
    expect(text.primary).toBe("rgb(252, 252, 250)");
    expect(accent.blue).toBe("rgb(54, 94, 255)");
    expect(border.focus).toBe("rgb(54, 94, 255)");
    expect(semantic.success).toBe("#22c55e");
    expect(radius.full).toBe("999px");
    expect(space[3]).toBe("16px");
  });

  it("chart palette has 5 entries", () => {
    expect(chart).toHaveLength(5);
  });

  it("shadow.glow uses rgba equivalent of oklch", () => {
    expect(shadow.glow).toBe("0 0 20px rgba(54, 94, 255, 0.2)");
  });

  it("frozen objects throw on mutation", () => {
    expect(() => {
      // @ts-expect-error — intentional mutation test
      bg.base = "red";
    }).toThrow();

    expect(() => {
      // @ts-expect-error — intentional mutation test
      chart[0] = "red";
    }).toThrow();
  });
});
