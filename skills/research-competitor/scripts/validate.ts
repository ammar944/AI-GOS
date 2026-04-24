/**
 * Schema validation gate.
 * Reads example/output.json (or argv[2]) and validates against output schema.
 * Exit 0 on pass, 1 on fail.
 * Usage: npx tsx scripts/validate.ts [output.json]
 */
import { ResearchCompetitorOutputSchema } from "../schemas/output.js";
import * as fs from "fs";

const path = process.argv[2] ?? "./example/output.json";
const raw = JSON.parse(fs.readFileSync(path, "utf-8"));

const result = ResearchCompetitorOutputSchema.safeParse(raw);

if (result.success) {
  console.log("Schema validates ✓");
  process.exit(0);
} else {
  const issues = result.error.issues
    .slice(0, 10)
    .map((i) => `  ${i.path.join(":")} — ${i.message}`)
    .join("\n");
  console.error(`Schema validation FAILED (${result.error.issues.length} issues):\n${issues}`);
  process.exit(1);
}
