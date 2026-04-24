/**
 * ingest-identity — sanity check
 *
 * Reads <output.json> and verifies it is not a scaffold and not obviously
 * malformed. Hard-fails (exit 1) on "suspect" output so the enrich-brief
 * stage can trust whatever the skill emits. Set ALLOW_SUSPECT=1 to
 * downgrade the fail to a stderr warning — useful during dev loops where
 * the agent-fragment layer is not yet wired.
 *
 * Suspect triggers:
 *   - company_name trimmed is empty
 *   - category trimmed is empty OR category === "unknown"
 *   - sources[] is empty
 *   - any source has describes === "scaffold_fallback"
 *
 * Usage:
 *   tsx scripts/sanity-check.ts <output.json>
 *   ALLOW_SUSPECT=1 tsx scripts/sanity-check.ts <output.json>
 */
import * as fs from "node:fs";
import {
  IdentityCardOutputSchema,
  type IdentityCardOutput,
} from "../schemas/output";

interface SuspectReason {
  code: string;
  message: string;
}

function detectSuspects(card: IdentityCardOutput): SuspectReason[] {
  const reasons: SuspectReason[] = [];

  if (card.company_name.trim().length === 0) {
    reasons.push({
      code: "empty_company_name",
      message: "company_name is blank",
    });
  }

  if (card.category.trim().length === 0 || card.category === "unknown") {
    reasons.push({
      code: "placeholder_category",
      message: `category is "${card.category}" — looks like a scaffold placeholder`,
    });
  }

  if (card.sources.length === 0) {
    reasons.push({
      code: "no_sources",
      message: "sources[] is empty — every factual claim must be anchored",
    });
  }

  for (const source of card.sources) {
    if (source.describes === "scaffold_fallback") {
      reasons.push({
        code: "scaffold_fallback_source",
        message: `source ${JSON.stringify(source.source_url)} is a scaffold_fallback marker`,
      });
      break;
    }
  }

  return reasons;
}

function main(): void {
  const target = process.argv[2];
  if (!target) {
    process.stderr.write("Usage: sanity-check.ts <output.json>\n");
    process.exit(2);
  }
  if (!fs.existsSync(target)) {
    process.stderr.write(`[sanity-check] file missing: ${target}\n`);
    process.exit(1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(target, "utf-8"));
  } catch (err) {
    process.stderr.write(
      `[sanity-check] JSON parse error in ${target}: ${(err as Error).message}\n`,
    );
    process.exit(1);
  }

  const result = IdentityCardOutputSchema.safeParse(parsed);
  if (!result.success) {
    process.stderr.write(
      `[sanity-check] schema errors in ${target}:\n${JSON.stringify(
        result.error.issues,
        null,
        2,
      )}\n`,
    );
    process.exit(1);
  }

  const suspects = detectSuspects(result.data);
  if (suspects.length === 0) {
    process.stdout.write("[sanity-check] ok\n");
    return;
  }

  const allow = process.env.ALLOW_SUSPECT === "1";
  const summary = suspects
    .map((reason) => `  - [${reason.code}] ${reason.message}`)
    .join("\n");
  const prefix = allow
    ? "[sanity-check] WARN (ALLOW_SUSPECT=1)"
    : "[sanity-check] FAIL";
  process.stderr.write(`${prefix} — output is suspect:\n${summary}\n`);

  if (allow) {
    process.stdout.write("[sanity-check] bypassed via ALLOW_SUSPECT=1\n");
    return;
  }

  process.stderr.write(
    `[sanity-check] set ALLOW_SUSPECT=1 to bypass; prefer supplying a real agent fragment.\n`,
  );
  process.exit(1);
}

main();
