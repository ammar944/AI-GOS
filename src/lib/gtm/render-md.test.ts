import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { renderSkillOutputToMd } from "./render-md";
import type { LighthouseSkill } from "./types";

const SKILLS: LighthouseSkill[] = [
  "ingest-url",
  "ingest-identity",
  "research-market",
  "research-competitor",
  "research-icp",
];

function loadFixture(skill: LighthouseSkill): unknown {
  const fixturePath = path.join(
    process.cwd(),
    "skills",
    skill,
    "example",
    "output.json",
  );
  return JSON.parse(fs.readFileSync(fixturePath, "utf-8"));
}

describe("renderSkillOutputToMd", () => {
  it.each(SKILLS)("renders %s fixture without throwing + non-empty MD", (skill) => {
    const fixture = loadFixture(skill);
    const md = renderSkillOutputToMd(skill, fixture);
    expect(md).toBeTruthy();
    expect(md.length).toBeGreaterThan(50);
    expect(md.startsWith("#")).toBe(true);
  });

  it("is idempotent — same input produces identical output", () => {
    const fixture = loadFixture("ingest-url");
    const md1 = renderSkillOutputToMd("ingest-url", fixture);
    const md2 = renderSkillOutputToMd("ingest-url", fixture);
    expect(md1).toBe(md2);
  });

  it("renders ingest-url with company name + prefilled fields + evidence URLs", () => {
    const md = renderSkillOutputToMd("ingest-url", loadFixture("ingest-url"));
    expect(md).toContain("Airtable");
    expect(md).toContain("## Prefilled fields");
    expect(md).toMatch(/\bhigh\b|\bmedium\b|\blow\b/);
    expect(md).toMatch(/\[.*\]\(https?:\/\/[^)]+\)/);
  });

  it("renders source_gaps section when present", () => {
    const md = renderSkillOutputToMd("ingest-url", loadFixture("ingest-url"));
    expect(md).toContain("Source gaps");
    expect(md).toContain("avgAcv");
  });

  it("throws on unknown skill", () => {
    expect(() =>
      renderSkillOutputToMd("not-a-skill" as LighthouseSkill, {}),
    ).toThrow(/unknown skill/);
  });

  it("handles empty/minimal output without crashing", () => {
    const md = renderSkillOutputToMd("ingest-url", {});
    expect(md).toBeTruthy();
    expect(md).toContain("Unknown company");
  });
});
