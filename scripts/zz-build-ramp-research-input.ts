#!/usr/bin/env tsx
/**
 * zz-build-ramp-research-input.ts — assemble a Ramp ResearchInput fixture from
 * the saved corpus (tmp/grill/ramp-fresh/deepResearchProgram.json) + the brief
 * (tmp/grill/ramp-fresh/_manifest.json briefInput), via the canonical
 * corpusToResearchInput builder, validated against researchInputSchema.
 *
 * Output: tmp/zz-section-out/ramp-research-input.json
 * Then: npx tsx scripts/zz-run-one-section.ts --section positioningBuyerICP \
 *         --fixture tmp/zz-section-out/ramp-research-input.json
 *
 * Pure assembly — no paid APIs, no env required.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { researchInputSchema } from "../src/lib/lab-engine/artifacts/artifact-envelope";
import { corpusToResearchInput } from "../src/lib/research-v2/corpus-to-research-input";

const RUN_DIR = "tmp/grill/ramp-fresh";
const OUT = "tmp/zz-section-out/ramp-research-input.json";

async function main(): Promise<void> {
  const program = JSON.parse(
    await readFile(`${RUN_DIR}/deepResearchProgram.json`, "utf8"),
  );
  const manifest = JSON.parse(await readFile(`${RUN_DIR}/_manifest.json`, "utf8"));
  const onboardingData = manifest.briefInput ?? {};

  const built = corpusToResearchInput({
    runId: manifest.run_id ?? "ramp-proof-run",
    deepResearchProgramData: program,
    onboardingData,
  });

  const parsed = researchInputSchema.safeParse(built);
  if (!parsed.success) {
    console.error("ResearchInput failed schema validation:");
    console.error(JSON.stringify(parsed.error.flatten(), null, 2).slice(0, 4000));
    process.exit(1);
  }

  await mkdir("tmp/zz-section-out", { recursive: true });
  await writeFile(OUT, JSON.stringify(parsed.data, null, 2));
  const r = parsed.data;
  console.log(`wrote ${OUT}`);
  console.log(
    `company=${r.company.name} category=${r.company.category} sources=${r.sources.length} corpusExcerpts=${r.corpus.excerpts.length} competitorSeeds=${r.competitorSeeds?.length ?? 0}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
