import { describe, expect, it } from "vitest";
import { extractFirstJsonObject, repairGtmJsonText } from "@/lib/gtm/skill-object";

describe("extractFirstJsonObject", () => {
  it("extracts JSON from markdown fences", () => {
    expect(
      extractFirstJsonObject('```json\n{"ok":true,"nested":{"value":1}}\n```')
    ).toBe('{"ok":true,"nested":{"value":1}}');
  });

  it("extracts the first balanced JSON object from surrounding text", () => {
    expect(
      extractFirstJsonObject('Result:\n{"text":"brace } in string","ok":true}\nDone')
    ).toBe('{"text":"brace } in string","ok":true}');
  });

  it("returns null when no JSON object can be recovered", () => {
    expect(extractFirstJsonObject("No structured output was produced.")).toBe(
      null
    );
  });
});

describe("repairGtmJsonText", () => {
  it("returns repaired JSON text for AI SDK object parsing", async () => {
    await expect(
      repairGtmJsonText({
        text: '```json\n{"ok":true}\n```',
        error: new Error("parse failed") as never,
      })
    ).resolves.toBe('{"ok":true}');
  });
});
