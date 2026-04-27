/**
 * Reject fields and text that do not belong in the Wave 3 media-plan contract.
 *
 * Usage:
 *   node --import tsx/esm scripts/validate-removed-fields.ts <output.json>
 */
import * as fs from "fs";

const REMOVED_KEYS = new Set<string>([
  "formatSpecs",
  "kpis",
  "cacFramework",
  "expectedLeads",
  "expectedLeadCount",
  "expectedRevenue",
  "expectedCac",
  "expectedCAC",
  "retargetingSegments",
]);

const PROHIBITED_TEXT_PATTERNS: RegExp[] = [
  /\bretargeting\b/i,
  /\bremarketing\b/i,
  /\bpixel audience\b/i,
  /\bvisitor retarget\b/i,
];

type Violation = {
  path: string;
  message: string;
};

function scan(value: unknown, currentPath: string[] = []): Violation[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => scan(item, [...currentPath, String(index)]));
  }
  if (typeof value === "string") {
    const matched = PROHIBITED_TEXT_PATTERNS.find((pattern) => pattern.test(value));
    return matched
      ? [
          {
            path: currentPath.join(":"),
            message: `contains prohibited media-plan language: ${value}`,
          },
        ]
      : [];
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, nestedValue]) => {
      const path = [...currentPath, key];
      const keyViolation = REMOVED_KEYS.has(key)
        ? [
            {
              path: path.join(":"),
              message: `contains removed field key "${key}"`,
            },
          ]
        : [];
      return [...keyViolation, ...scan(nestedValue, path)];
    });
  }
  return [];
}

function main(): void {
  const outputPath = process.argv[2];
  if (!outputPath) {
    process.stderr.write("Usage: validate-removed-fields.ts <output.json>\n");
    process.exit(2);
  }
  const raw = JSON.parse(fs.readFileSync(outputPath, "utf-8")) as unknown;
  const violations = scan(raw);
  if (violations.length > 0) {
    process.stderr.write(
      `[validate-removed-fields] FAILED (${violations.length} violations):\n` +
        violations
          .slice(0, 12)
          .map((violation) => `  ${violation.path} - ${violation.message}`)
          .join("\n") +
        "\n",
    );
    process.exit(1);
  }
  process.stdout.write("[validate-removed-fields] pass\n");
}

main();
