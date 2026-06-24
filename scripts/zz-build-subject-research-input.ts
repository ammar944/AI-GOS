#!/usr/bin/env tsx
/**
 * zz-build-subject-research-input.ts — assemble a ResearchInput fixture from a
 * subject's GLM orchestrator output (gtm-fields.json + research-digest.md +
 * transcript.json), so the agentic section harness can run orchestrator-first
 * with NO hand-built corpus. Faithful to the "no corpus; gather after
 * onboarding" production flow.
 *
 * Output: tmp/zz-section-out/<subject>-research-input.json
 * Then:   npx tsx scripts/zz-agentic-section.ts <section> --corpus tmp/zz-section-out/<subject>-research-input.json --subject <subject>
 *
 * Pure assembly — no paid APIs, no env required. Reads tmp/zz-orchestrator-glm/<subject>/.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

interface OrchestratorGtmFields {
  companyName: string;
  category: string;
  productDescription: string;
  targetCustomer: string;
  topCompetitors: string[];
  marketProblem: string;
}

interface TranscriptEntry {
  step: number;
  toolName: string;
  toolCallId: string;
  input: unknown;
  output: { type?: string; url?: string; sourceUrl?: string; link?: string; title?: string; source?: string; text?: string; markdown?: string; content?: string; summary?: string } | null;
  isError: boolean;
}

const SECTION_EXCERPT_KEYS = [
  "positioningMarketCategory",
  "positioningBuyerICP",
  "positioningCompetitorLandscape",
  "positioningVoiceOfCustomer",
  "positioningDemandIntent",
  "positioningOfferDiagnostic",
  "positioningPaidMediaPlan",
] as const;

function excerptFromEntry(entry: TranscriptEntry, idx: number) {
  const o = entry.output ?? {};
  const url = o.url ?? o.sourceUrl ?? o.link ?? "";
  const title = o.title ?? o.source ?? url;
  const text = o.text ?? o.markdown ?? o.content ?? o.summary ?? title;
  return {
    id: `excerpt_orch_${idx}`,
    sourceUrl: url,
    title,
    text,
  };
}

async function main(): Promise<void> {
  const subject = process.argv[2] ?? "";
  if (subject.length === 0) {
    console.error("usage: npx tsx scripts/zz-build-subject-research-input.ts <subject>");
    process.exit(2);
  }
  const orchDir = join(process.cwd(), "tmp", "zz-orchestrator-glm", subject);
  if (!existsSync(orchDir)) {
    console.error(`no orchestrator output for subject "${subject}" at ${orchDir}`);
    process.exit(1);
  }
  const gtm: OrchestratorGtmFields = JSON.parse(await readFile(join(orchDir, "gtm-fields.json"), "utf8"));
  const transcript: TranscriptEntry[] = JSON.parse(await readFile(join(orchDir, "transcript.json"), "utf8"));
  const websiteUrl = `https://www.${subject}.com`;

  // Build flat excerpts (non-error, url-bearing) + per-section excerpts.
  // For orchestrator-first, every section gets the SAME full excerpt set as
  // background orientation (the orchestrator's gather); the section then
  // top-ups with its own tools. This mirrors how the ledger would seed sections.
  const flatExcerpts = transcript
    .filter((e) => !e.isError && e.output && /^https?:\/\//.test(e.output.url ?? e.output.sourceUrl ?? e.output.link ?? ""))
    .map((e, i) => excerptFromEntry(e, i));

  const sectionExcerpts: Record<string, typeof flatExcerpts> = {};
  for (const k of SECTION_EXCERPT_KEYS) sectionExcerpts[k] = flatExcerpts;

  const sources = flatExcerpts.map((e, i) => ({
    id: `source_orch_${i}`,
    title: e.title,
    url: e.sourceUrl,
    observedAt: new Date().toISOString(),
  }));

  const built = {
    runId: `valuebar-${subject}`,
    fixtureId: `orchestrator-derived-${subject}`,
    company: {
      id: `company_${subject}`,
      name: gtm.companyName,
      websiteUrl,
      category: gtm.category,
      description: gtm.productDescription,
      stage: "growth",
      targetCustomer: gtm.targetCustomer,
    },
    onboarding: {
      primaryGoal: "Position the product and generate qualified pipeline.",
      targetSegments: [gtm.targetCustomer],
      keyOffers: [gtm.productDescription],
      distributionChannels: ["Outbound", "Paid media", "Content"],
      gtmMotion: "PLG / outbound hybrid",
      economics: { targetCac: "(operator-reported not supplied)" },
    },
    corpus: {
      excerpts: flatExcerpts,
      sectionExcerpts,
    },
    sources,
    competitorAds: [],
    competitorSeeds: gtm.topCompetitors.map((name) => ({ name })),
  };

  const parsed = built;

  const out = join(process.cwd(), "tmp", "zz-section-out", `${subject}-research-input.json`);
  await mkdir(join(process.cwd(), "tmp", "zz-section-out"), { recursive: true });
  await writeFile(out, JSON.stringify(parsed, null, 2));
  console.log(`wrote ${out}`);
  console.log(
    `company=${parsed.company.name} excerpts=${flatExcerpts.length} sources=${sources.length} competitorSeeds=${parsed.competitorSeeds?.length ?? 0}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});