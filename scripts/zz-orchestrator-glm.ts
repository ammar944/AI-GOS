/**
 * zz-orchestrator-glm.ts — LIVE proof harness for the GLM orchestrator.
 *
 * Runs generateAgenticGLMOrchestrator against a real subject via the local
 * Ollama Cloud GLM proxy (glm-5.2:cloud), with real Firecrawl/Perplexity
 * tools. Proves the orchestrator loop runs end-to-end: identity-lock + GTM
 * extraction + corpus gather + ledger promotion.
 *
 * Usage:
 *   npx tsx scripts/zz-orchestrator-glm.ts --url https://www.clay.com --subject clay
 *   npx tsx scripts/zz-orchestrator-glm.ts --url https://www.clay.com --dry   # tools only, no live call
 *
 * Output: tmp/zz-orchestrator-glm/<subject>/{gtm-fields.json,research-digest.md,transcript.json}
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd()); // pulls FIRECRAWL_API_KEY / PERPLEXITY_API_KEY / GLM_* from .env.local

import {
  buildOrchestratorTools,
  generateAgenticGLMOrchestrator,
  promoteOrchestratorFactsToLedger,
  buildOrchestratorFactsFromTranscript,
} from "../src/lib/lab-engine/agents/orchestrator-glm";
import { createInMemoryResearchFactStore } from "../src/lib/lab-engine/evidence/research-fact";

interface CliArgs {
  url: string;
  subject: string;
  dry: boolean;
  maxSteps: number;
}

function parseArgs(argv: string[]): CliArgs {
  let url = "";
  let subject = "";
  let dry = false;
  let maxSteps = 14;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry") dry = true;
    else if (a === "--url") url = argv[++i];
    else if (a.startsWith("--url=")) url = a.slice("--url=".length);
    else if (a === "--subject") subject = argv[++i];
    else if (a.startsWith("--subject=")) subject = a.slice("--subject=".length);
    else if (a === "--max-steps") maxSteps = Number(argv[++i]);
    else if (a.startsWith("--max-steps=")) maxSteps = Number(a.slice("--max-steps=".length));
  }
  if (url.length === 0) {
    throw new Error(
      "usage: npx tsx scripts/zz-orchestrator-glm.ts --url <https://company.com> [--subject <slug>] [--dry] [--max-steps N]",
    );
  }
  if (subject.length === 0) {
    try {
      subject = new URL(url).hostname.replace(/^www\./, "").split(".")[0];
    } catch {
      subject = "subject";
    }
  }
  return { url, subject, dry, maxSteps };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const outDir = join(process.cwd(), "tmp", "zz-orchestrator-glm", args.subject);
  mkdirSync(outDir, { recursive: true });

  const onboardingBrief = JSON.stringify({
    websiteUrl: args.url,
    companyName: args.subject,
    note: "Operator onboarding is thin in this dry harness — the orchestrator gathers the real facts.",
  });

  console.log(`[orchestrator-proof] subject=${args.subject} url=${args.url} dry=${args.dry} maxSteps=${args.maxSteps}`);

  if (args.dry) {
    const tools = buildOrchestratorTools(process.env);
    console.log(`[orchestrator-proof] tools wired: ${Object.keys(tools).join(", ") || "(none — missing credentials)"}`);
    writeFileSync(join(outDir, "tools.json"), JSON.stringify(Object.keys(tools), null, 2));
    console.log(`[orchestrator-proof] dry ok → ${outDir}/tools.json`);
    return;
  }

  const startedAt = Date.now();
  const result = await generateAgenticGLMOrchestrator({
    websiteUrl: args.url,
    onboardingBrief,
    maxSteps: args.maxSteps,
    env: process.env,
  });
  const elapsedMs = Date.now() - startedAt;

  console.log(
    `[orchestrator-proof] done stepCount=${result.stepCount} elapsedMs=${elapsedMs} gtmFields=${result.gtmFields ? "yes" : "null"} digestLen=${result.researchDigest.length}`,
  );

  writeFileSync(
    join(outDir, "gtm-fields.json"),
    JSON.stringify(result.gtmFields, null, 2),
  );
  writeFileSync(join(outDir, "research-digest.md"), result.researchDigest);
  writeFileSync(
    join(outDir, "transcript.json"),
    JSON.stringify(result.transcript, null, 2),
  );

  // Ledger promotion proof — in-memory store (no DB in the harness).
  const store = createInMemoryResearchFactStore();
  await promoteOrchestratorFactsToLedger(store, result.transcript, {
    runId: `proof-${args.subject}`,
    createdAt: new Date().toISOString(),
  });
  const facts = store.getFacts();
  const factCount = facts.length;
  console.log(`[orchestrator-proof] ledger facts promoted: ${factCount}`);
  writeFileSync(join(outDir, "ledger-facts.json"), JSON.stringify(facts, null, 2));

  // Also expose the raw promoter output for inspection without the store.
  const promoted = buildOrchestratorFactsFromTranscript(result.transcript, {
    runId: `proof-${args.subject}`,
    createdAt: new Date().toISOString(),
  });
  writeFileSync(join(outDir, "promoted-facts.json"), JSON.stringify(promoted, null, 2));

  console.log(`[orchestrator-proof] artifacts → ${outDir}`);
}

main().catch((err) => {
  console.error("[orchestrator-proof] FAILED:", err);
  process.exit(1);
});