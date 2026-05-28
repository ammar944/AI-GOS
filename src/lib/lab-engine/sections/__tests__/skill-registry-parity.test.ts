import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { TOOL_CATALOG } from "../../agents/tools";
import { SECTION_REGISTRY } from "../section-registry";

const toolTablePattern = /^\|\s*`([^`]+)`\s*\|/gm;
const knownToolNames = new Set<string>(Object.keys(TOOL_CATALOG));

function readSkillToolNames(skillSlug: string): string[] {
  const skillPath = join(
    process.cwd(),
    "src/lib/lab-engine/skills",
    skillSlug,
    "SKILL.md",
  );
  const markdown = readFileSync(skillPath, "utf8");
  const tools = new Set<string>();

  for (const match of markdown.matchAll(toolTablePattern)) {
    const toolName = match[1];

    if (knownToolNames.has(toolName)) {
      tools.add(toolName);
    }
  }

  return Array.from(tools).sort();
}

describe("lab-engine skill tool tables", (): void => {
  it("only advertises tools allowed by the section registry", (): void => {
    for (const definition of Object.values(SECTION_REGISTRY)) {
      const skillTools = readSkillToolNames(definition.skillSlug);
      const allowedTools = new Set<string>(definition.allowedTools);
      const extraTools = skillTools.filter((toolName) => !allowedTools.has(toolName));

      expect(extraTools, definition.id).toEqual([]);
    }
  });
});
