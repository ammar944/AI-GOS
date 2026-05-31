import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { SECTION_REGISTRY } from "../section-registry";

function readSkill(skillSlug: string): string {
  const skillPath = join(
    process.cwd(),
    "src/lib/lab-engine/skills",
    skillSlug,
    "SKILL.md",
  );

  return readFileSync(skillPath, "utf8");
}

function frontmatterName(markdown: string): string | null {
  const frontmatter = markdown.match(/^---\n([\s\S]*?)\n---/);

  if (!frontmatter) {
    return null;
  }

  const name = frontmatter[1].match(/^name:\s*(.+?)\s*$/m);

  return name ? name[1] : null;
}

describe("lab-engine skill resolution", (): void => {
  it("resolves a readable SKILL.md for every registry slug", (): void => {
    for (const definition of Object.values(SECTION_REGISTRY)) {
      // readFileSync throws if the SKILL.md is missing — that is the failure
      // we want surfaced when a section is registered without its skill file.
      const markdown = readSkill(definition.skillSlug);

      expect(
        markdown.length,
        `${definition.id}: ${definition.skillSlug}/SKILL.md is too short to be a real skill`,
      ).toBeGreaterThan(200);
    }
  });

  it("keeps each SKILL.md frontmatter name equal to its registry slug", (): void => {
    for (const definition of Object.values(SECTION_REGISTRY)) {
      const markdown = readSkill(definition.skillSlug);

      expect(frontmatterName(markdown), definition.id).toBe(
        definition.skillSlug,
      );
    }
  });
});
