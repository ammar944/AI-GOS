/**
 * ingest-identity — output validator
 *
 * Reads <path>, parses JSON, validates against IdentityCardOutputSchema.
 * Prints `[validate] ok` to stdout and exits 0 on success.
 * Prints Zod error to stderr and exits 1 on failure.
 */
import * as fs from "node:fs";
import { IdentityCardOutputSchema } from "../schemas/output";

function main(): void {
  const target = process.argv[2];
  if (!target) {
    process.stderr.write("Usage: validate.ts <output.json>\n");
    process.exit(2);
  }
  if (!fs.existsSync(target)) {
    process.stderr.write(`[validate] file missing: ${target}\n`);
    process.exit(1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(target, "utf-8"));
  } catch (err) {
    process.stderr.write(
      `[validate] JSON parse error in ${target}: ${(err as Error).message}\n`,
    );
    process.exit(1);
  }

  const result = IdentityCardOutputSchema.safeParse(parsed);
  if (!result.success) {
    process.stderr.write(
      `[validate] schema errors in ${target}:\n${JSON.stringify(
        result.error.issues,
        null,
        2,
      )}\n`,
    );
    process.exit(1);
  }
  process.stdout.write(`[validate] ok\n`);
}

main();
