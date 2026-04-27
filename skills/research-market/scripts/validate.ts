/**
 * research-market - output validator
 *
 * Usage:
 *   npx tsx scripts/validate.ts [output.json]
 */
import * as fs from "node:fs";
import { ResearchMarketOutputSchema } from "../schemas/output";

function readJson(path: string): unknown {
  if (!fs.existsSync(path)) {
    throw new Error(`[validate] file missing: ${path}`);
  }

  try {
    return JSON.parse(fs.readFileSync(path, "utf-8")) as unknown;
  } catch (error: unknown) {
    throw new Error(
      `[validate] JSON parse failed for ${path}: ${(error as Error).message}`,
    );
  }
}

function main(): void {
  const target = process.argv[2] ?? "./example/output.json";
  const parsed = readJson(target);
  const result = ResearchMarketOutputSchema.safeParse(parsed);

  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 20)
      .map((issue) => `  ${issue.path.join(".")} - ${issue.message}`)
      .join("\n");
    process.stderr.write(
      `[validate] schema validation failed (${result.error.issues.length} issues):\n${issues}\n`,
    );
    process.exit(1);
  }

  process.stdout.write(`[validate] ok: ${target}\n`);
}

main();
