/**
 * Merge per-competitor fragment JSON files into a full output.json.
 *
 * Workflow:
 *   1. Main agent discovers competitor_set and writes an initial output.json
 *      with run_id, source_company_name, and competitor_set populated.
 *   2. Main agent dispatches N sub-agents in parallel, one per competitor,
 *      each writing fragments/<slug>.json (see prompts/competitor-subagent.md).
 *   3. This script reads all fragments and populates:
 *        - positioning_taxonomy
 *        - pricing_reality
 *        - review_mined_feedback
 *        - competitor_narrative_arc
 *      Leaves paid_social_ad_inventory, ad_activity_signals, share_of_voice,
 *      paid_search_ad_inventory, and organic_vs_paid_narrative_delta untouched.
 *
 * Usage:
 *   npx tsx scripts/merge-fragments.ts <output.json> <fragments_dir>
 */
import * as fs from "fs";
import * as path from "path";

interface Fragment {
  name: string;
  type?: string;
  homepage_url?: string;
  retrieved_at?: string;
  competitor_ref?: unknown;
  positioning?: unknown;
  pricing?: unknown;
  reviews?: unknown[];
  narrative_arc?: unknown;
}

function main(): void {
  const [outputPath, fragmentsDir] = process.argv.slice(2);
  if (!outputPath || !fragmentsDir) {
    process.stderr.write(
      "Usage: merge-fragments.ts <output.json> <fragments_dir>\n",
    );
    process.exit(2);
  }
  if (!fs.existsSync(outputPath)) {
    process.stderr.write(`[merge-fragments] no output at ${outputPath}\n`);
    process.exit(1);
  }
  if (!fs.existsSync(fragmentsDir)) {
    process.stderr.write(
      `[merge-fragments] fragments dir missing: ${fragmentsDir}\n`,
    );
    process.exit(1);
  }

  const output = JSON.parse(fs.readFileSync(outputPath, "utf-8")) as Record<
    string,
    unknown
  > & {
    competitor_set?: Array<{ name: string }>;
    positioning_taxonomy?: unknown[];
    pricing_reality?: unknown[];
    review_mined_feedback?: unknown[];
    competitor_narrative_arc?: unknown[];
  };

  const files = fs
    .readdirSync(fragmentsDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.join(fragmentsDir, f));

  const fragments: Fragment[] = [];
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(file, "utf-8"));
      if (data && typeof data === "object" && "name" in data) {
        fragments.push(data as Fragment);
      } else {
        process.stderr.write(`[merge-fragments] skip ${file}: no name field\n`);
      }
    } catch (err) {
      process.stderr.write(
        `[merge-fragments] skip ${file}: parse error ${(err as Error).message}\n`,
      );
    }
  }

  if (!fragments.length) {
    process.stderr.write("[merge-fragments] no fragments found\n");
    process.exit(1);
  }

  // Deduplicate by name, last-wins
  const byName = new Map<string, Fragment>();
  for (const f of fragments) byName.set(f.name, f);
  const deduped = [...byName.values()];

  output.positioning_taxonomy = deduped
    .map((f) => f.positioning)
    .filter(Boolean);
  output.pricing_reality = deduped.map((f) => f.pricing).filter(Boolean);
  output.review_mined_feedback = deduped.flatMap((f) =>
    Array.isArray(f.reviews) ? f.reviews : [],
  );
  output.competitor_narrative_arc = deduped
    .map((f) => f.narrative_arc)
    .filter(Boolean);

  // If competitor_set is empty but fragments have competitor_ref, populate it
  if (
    (!output.competitor_set || output.competitor_set.length === 0) &&
    deduped.some((f) => f.competitor_ref)
  ) {
    output.competitor_set = deduped
      .map((f) => f.competitor_ref)
      .filter(Boolean) as Array<{ name: string }>;
  }

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + "\n");
  process.stdout.write(
    `[merge-fragments] merged ${deduped.length} competitor fragment(s) into ${outputPath}\n` +
      `  positioning: ${(output.positioning_taxonomy as unknown[]).length}\n` +
      `  pricing:     ${(output.pricing_reality as unknown[]).length}\n` +
      `  reviews:     ${(output.review_mined_feedback as unknown[]).length}\n` +
      `  narrative:   ${(output.competitor_narrative_arc as unknown[]).length}\n`,
  );
}

main();
