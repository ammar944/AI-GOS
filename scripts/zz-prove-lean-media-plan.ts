#!/usr/bin/env tsx
/**
 * zz-prove-lean-media-plan.ts — PROOF (throwaway).
 *
 * Demonstrates the "lean media plan" thesis: one DeepSeek call that reads the 6
 * committed positioning sections, reasons across them (thinker insight folded
 * INLINE), and emits the RovR deck shape — against a tolerant (non-.strict)
 * schema — fast, with no thinker/synthesis/critic serial stages.
 *
 *   npx tsx scripts/zz-prove-lean-media-plan.ts [--run <run_id>]
 *
 * Default run = 0dc9720b (Ramp, 06-04, richest research + a real 24k plan).
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { generateText, Output } from "ai";
import { z } from "zod";

const RUN_ID =
  process.argv.indexOf("--run") !== -1
    ? process.argv[process.argv.indexOf("--run") + 1]
    : "0dc9720b-81a3-487f-ab1f-fac60329b25b";

const RESEARCH_ZONES = [
  "positioningMarketCategory",
  "positioningBuyerICP",
  "positioningCompetitorLandscape",
  "positioningVoiceOfCustomer",
  "positioningDemandIntent",
  "positioningOfferDiagnostic",
] as const;

// --- LEAN schema: the 7 RovR deck blocks + folded cross-section insight. ---
// Plain z.object() => Zod STRIPS unknown keys (the opposite of .strict()),
// so a stray field never hard-fails the section.
const leanMediaPlanSchema = z.object({
  campaignOverview: z.object({
    prose: z.string(),
    platform: z.string().describe("Primary ad platform, usually Meta"),
    monthlyBudget: z.string(),
    dailySpend: z.string(),
    totalMonths: z.number(),
    phaseCount: z.number(),
    primaryKpi: z.string(),
  }),
  campaignPhases: z
    .array(
      z.object({
        phaseName: z.string(),
        monthsLabel: z.string(),
        monthlyBudget: z.string(),
        bullets: z.array(z.string()),
      }),
    )
    .describe("Phase 1 testing -> Phase 2 optimize & scale"),
  audienceTypes: z
    .array(
      z.object({
        slot: z.string(),
        archetype: z.string(),
        dailyBudget: z.string(),
        detail: z.string().describe("Specific Meta targeting, grounded in ICP"),
      }),
    )
    .describe("Usually 3 audiences tested in parallel"),
  creativeStrategy: z.object({
    prose: z.string(),
    staticCount: z.number(),
    videoCount: z.number(),
    totalPerAudience: z.number(),
  }),
  creativeFramework: z
    .array(
      z.object({
        label: z.string().describe("Fixed slot: 'Static 1'..'Static 5', 'UGC 1'..'UGC 3'"),
        angleType: z
          .string()
          .describe("Fixed per slot — do not change the assignment"),
        hook: z.string().describe("A SPECIFIC, deployable hook grounded in the research, not generic"),
        sourceSection: z
          .string()
          .describe("Which committed section this hook's claim draws from"),
        grounding: z
          .string()
          .describe("The exact fact/number/quote from that section the hook rests on, or 'UNVERIFIED' if you could not ground it in a section"),
      }),
    )
    .describe("Exactly 8: the 5 static + 3 UGC creatives, each filled with a grounded hook"),
  kpis: z.array(
    z.object({
      metric: z.string(),
      role: z.string(),
      definition: z.string(),
    }),
  ),
  // The thinker's value, folded inline — NOT a separate serial stage.
  crossSectionInsight: z
    .array(
      z.object({
        tension: z.string().describe("A collision visible only across >=2 sections"),
        sourceSections: z.array(z.string()),
        implicationForPlan: z
          .string()
          .describe("So-what: how this tension shaped an audience/creative/phase choice"),
      }),
    )
    .describe("1-3 cross-section threads that DROVE the plan"),
});

function clip(s: string | null | undefined, n: number): string {
  if (!s) return "(empty)";
  return s.length > n ? s.slice(0, n) + "\n…[truncated]" : s;
}

async function main(): Promise<void> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY missing");
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sbKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!sbUrl || !sbKey) throw new Error("Supabase URL/key missing");
  const usingServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  console.log(`[proof] run=${RUN_ID} supabaseKey=${usingServiceRole ? "service-role" : "anon(RLS may block)"}`);

  const sb = createClient(sbUrl, sbKey, { auth: { persistSession: false } });

  const { data: arts, error: aErr } = await sb
    .from("research_artifacts")
    .select("id")
    .eq("run_id", RUN_ID)
    .limit(1);
  if (aErr) throw new Error("artifact query: " + aErr.message);
  const artifactId = arts?.[0]?.id;
  if (!artifactId) throw new Error("no artifact for run " + RUN_ID);

  const { data: sections, error: sErr } = await sb
    .from("research_artifact_sections")
    .select("zone,title,markdown")
    .eq("artifact_id", artifactId)
    .in("zone", RESEARCH_ZONES as unknown as string[])
    .eq("status", "complete");
  if (sErr) throw new Error("sections query: " + sErr.message);
  console.log(`[proof] fetched ${sections?.length ?? 0} research sections`);
  if (!sections?.length) throw new Error("no sections (RLS? need SUPABASE_SERVICE_ROLE_KEY)");

  const sectionBlock = RESEARCH_ZONES.map((zone) => {
    const row = sections.find((s) => s.zone === zone);
    return `\n## ${zone} — ${row?.title ?? "(missing)"}\n${clip(row?.markdown, 7000)}`;
  }).join("\n");

  // Representative brief context (proof; real path uses onboarding.monthlyAdBudget).
  const brief = `Company: Ramp. Primary channel: Meta Ads. Monthly ad budget: $9,000. Campaign duration: 4 months, 2 phases. Primary KPI: MQLs (free deep-analysis sign-ups).`;

  const prompt = [
    "You are a senior SaaS Launch media buyer. You FILL a fixed Meta paid-media template (the RovR deck) with grounded specifics from the SIX committed research sections below. Do NOT redesign the template — the structure is fixed; your job is grounded copy + targeting + the cross-section reasoning that justifies the creative direction.",
    "",
    "STEP 1 — CROSS-SECTION REASONING (do first): find 2-3 collisions — claims weak in any one section but decisive when two are read together. Each must cite >=2 section ids. These tensions MUST drive your creative angle and audience choices. Put them in `crossSectionInsight` with a concrete `implicationForPlan`.",
    "",
    "STEP 2 — FILL THE FIXED TEMPLATE:",
    "• campaignOverview: platform=Meta; budget math from the brief (monthly -> daily -> per-audience); primaryKpi=MQLs.",
    "• campaignPhases: EXACTLY 2 — 'Phase 1: Testing' (months 1-2) then 'Phase 2: Optimize & Scale' (months 3-4). Fill 4-5 specific bullets each.",
    "• audienceTypes: EXACTLY these 3 fixed archetypes, each at an equal daily split, each `detail` filled with company-SPECIFIC Meta targeting grounded in the Buyer ICP section:",
    "    1) 'Broad Prospecting — Interest Stack' (layered interest targeting)",
    "    2) 'High Intent — ABM ICP List + 1% Lookalike' (uploaded best-fit list + lookalike)",
    "    3) 'AI Optimized — Advantage+' (Meta Advantage+, minimal constraints)",
    "• creativeStrategy: 5 static + 3 UGC = 8 creatives/audience.",
    "• creativeFramework: EXACTLY these 8 fixed slots with FIXED angle assignments — fill each `hook` with specific, deployable copy and attribute it:",
    "    Static 1 — Problem-Solution-Transformation",
    "    Static 2 — Problem-Solution-Transformation",
    "    Static 3 — Problem-Solution-Transformation",
    "    Static 4 — Objection Handling",
    "    Static 5 — Objection Handling",
    "    UGC 1 — USP (who it's for, the problem, the impact)",
    "    UGC 2 — USP + Objection Handling",
    "    UGC 3 — Before/After",
    "• kpis: MQL (primary), CTR (creative health), CPL (efficiency).",
    "",
    "GROUNDING RULES (non-negotiable):",
    "- Every creative hook must be SPECIFIC — name the pain, the competitor, the number, the outcome. Never generic ('Struggling with X?', 'Tired of manual work?').",
    "- For each hook set `sourceSection` to the section it draws from and `grounding` to the exact fact/number/quote behind it. If you cannot ground a hook in a section, write the hook conservatively and set `grounding` to 'UNVERIFIED' — do NOT invent statistics.",
    "- Ground audience targeting in Buyer ICP; ground hooks in Offer + Voice-of-Customer + Competitor.",
    "- If a section is thin/an evidence gap, lean on the stronger sections and keep hooks claim-free rather than fabricating.",
    "",
    "=== BRIEF ===",
    brief,
    "",
    "=== SIX COMMITTED SECTIONS ===",
    sectionBlock,
  ].join("\n");

  const deepseek = createDeepSeek({ apiKey });
  const model = deepseek("deepseek-v4-flash");

  console.log("[proof] single DeepSeek call (deepseek-v4-flash, lean tolerant schema)…");
  const startMs = Date.now();
  const result = await generateText({
    model,
    output: Output.object({
      schema: leanMediaPlanSchema,
      name: "LeanMediaPlan",
      description: "RovR-shape Meta paid-media plan with folded cross-section insight.",
    }),
    maxOutputTokens: 8192,
    abortSignal: AbortSignal.timeout(200_000),
    system:
      "You are a senior B2B SaaS paid-media strategist. Output only the structured plan. Be specific and decision-useful; honest about evidence gaps.",
    prompt,
  });
  const elapsedMs = Date.now() - startMs;

  const parsed = leanMediaPlanSchema.parse(result.output);

  const outDir = join(process.cwd(), "tmp", "zz-section-out");
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, "lean-media-plan.json");
  await writeFile(
    outPath,
    JSON.stringify({ runId: RUN_ID, elapsedMs, usage: result.usage, plan: parsed }, null, 2),
    "utf8",
  );

  console.log(`\n[proof] COMMITTED in ${(elapsedMs / 1000).toFixed(1)}s — tokens out=${result.usage?.outputTokens ?? "?"}`);
  console.log(`  campaignOverview.platform: ${parsed.campaignOverview.platform}`);
  console.log(`  phases: ${parsed.campaignPhases.length} | audiences: ${parsed.audienceTypes.length} | creatives: ${parsed.creativeFramework.length} | kpis: ${parsed.kpis.length}`);
  console.log(`  crossSectionInsight threads: ${parsed.crossSectionInsight.length}`);
  parsed.crossSectionInsight.forEach((t, i) =>
    console.log(`    [${i + 1}] ${t.tension.slice(0, 110)}  (${t.sourceSections.join("+")})`),
  );
  console.log(`  output: ${outPath}`);
}

main().catch((err) => {
  console.error("[proof] FATAL", err);
  process.exit(1);
});
