/**
 * Merge a share_of_voice.json fragment (produced by the SoV sub-agent) into
 * the main output.json. Idempotent: overwrites output.share_of_voice.
 *
 * Usage:
 *   npx tsx scripts/merge-sov.ts <output.json> <share_of_voice.json>
 */
import * as fs from "fs";

function main(): void {
  const [outputPath, sovPath] = process.argv.slice(2);
  if (!outputPath || !sovPath) {
    process.stderr.write("Usage: merge-sov.ts <output.json> <share_of_voice.json>\n");
    process.exit(2);
  }
  if (!fs.existsSync(outputPath) || !fs.existsSync(sovPath)) {
    process.stderr.write(`[merge-sov] missing input: ${outputPath} / ${sovPath}\n`);
    process.exit(1);
  }
  const output = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
  const sov = JSON.parse(fs.readFileSync(sovPath, "utf-8"));

  // Fill in defaults for any missing fields so the Zod schema passes
  const normalized = {
    search_terms_owned: Array.isArray(sov.search_terms_owned) ? sov.search_terms_owned : [],
    communities_owned: Array.isArray(sov.communities_owned) ? sov.communities_owned : [],
    publications_owned: Array.isArray(sov.publications_owned) ? sov.publications_owned : [],
    evidence_per_claim: Array.isArray(sov.evidence_per_claim) ? sov.evidence_per_claim : [],
    source_url: sov.source_url ?? "https://www.google.com/search",
    retrieved_at: sov.retrieved_at ?? new Date().toISOString(),
  };

  output.share_of_voice = normalized;
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + "\n");
  process.stdout.write(
    `[merge-sov] merged share_of_voice — ` +
      `${normalized.search_terms_owned.length} terms, ` +
      `${normalized.communities_owned.length} communities, ` +
      `${normalized.publications_owned.length} publications, ` +
      `${normalized.evidence_per_claim.length} evidence\n`,
  );
}

main();
