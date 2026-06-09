#!/usr/bin/env tsx
/**
 * zz-prove-lean-media-plan-v3.ts — PROOF (throwaway).
 *
 * Empirically validates the NEW positioning-paid-media-plan/SKILL.md (v3.0.0-lab,
 * the full 13-slide official SaaSLaunch template) by:
 *   1. Reading the REAL SKILL.md from disk + wrapping it with the SAME preamble
 *      production uses (withGtmStrategicStandardPreamble — note: the task brief
 *      named `gtmMediaBuyingStandardPreamble`, which does NOT exist; the only
 *      preamble actually applied to lab sections, incl. paid-media, is the
 *      strategic-standard one, mirrored from lab-section-job.ts:loadLabSkill).
 *   2. Fetching the 6 committed positioning sections from Supabase (same fetch as
 *      scripts/zz-prove-lean-media-plan.ts).
 *   3. One deepseek-v4-flash call, Output.object({ schema: leanMediaPlanV3Schema }),
 *      maxOutputTokens 16384, providerOptions.deepseek.thinking.type='disabled',
 *      generous abort timeout.
 *   4. Writing plan + usage + finishReason to tmp/zz-section-out/v3-<runShort>.json.
 *
 *   npx tsx scripts/zz-prove-lean-media-plan-v3.ts --run <run_id>
 *
 * THROWAWAY. Does not touch the production schema or the production runSection path.
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { generateText, Output } from "ai";
import { z } from "zod";
import { withGtmStrategicStandardPreamble } from "@/lib/lab-engine/skills/gtm-strategic-standard";

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

// ===========================================================================
// leanMediaPlanV3Schema — pasted verbatim from the task brief (THROWAWAY).
// ===========================================================================

const moneyFieldShape = {
  value: z.string().describe("Rendered money label, e.g. '$9,000 / month'"),
  provenance: z
    .string()
    .describe(
      "Money provenance label for the needs_review badge: user-supplied | tool-measured | source-reported | model-estimated | unknown (free string — do not hard-enum)",
    ),
} as const;
void moneyFieldShape; // kept for parity with brief; not referenced by the root schema

const campaignOverviewSchema = z.object({
  prose: z.string().describe("1-2 sentence overview narrative for slides 1-2"),
  platform: z
    .string()
    .describe("Primary ad platform, channel-aware, default Meta"),
  monthlyBudget: z.string().describe("Monthly paid media budget label"),
  monthlyBudgetProvenance: z
    .string()
    .describe("Provenance for monthlyBudget (free string, default user-supplied)"),
  dailySpend: z.string().describe("Daily spend label = monthly / 30"),
  dailySpendProvenance: z
    .string()
    .describe("Provenance for dailySpend (free string, usually model-estimated/derived)"),
  totalMonths: z.number().describe("Total campaign months, usually 4"),
  phaseCount: z.number().describe("Number of phases, fixed at 2"),
  primaryKpi: z.string().describe("Primary KPI, default 'MQLs / Signups'"),
});

const campaignPhaseSchema = z.object({
  phaseName: z
    .string()
    .describe("'Phase 1 — Testing' or 'Phase 2 — Optimization & Scale'"),
  monthsLabel: z.string().describe("e.g. 'Months 1-2' / 'Months 3-4'"),
  monthlyBudget: z.string().describe("Phase monthly budget label"),
  monthlyBudgetProvenance: z
    .string()
    .describe("Provenance for this phase's monthly budget (free string)"),
  bullets: z
    .array(z.string())
    .describe("4-5 phase bullets (mostly fixed template copy, lightly tailored)"),
});

const audienceTypeSchema = z.object({
  slot: z.string().describe("'01' | '02' | '03'"),
  archetype: z
    .string()
    .describe(
      "Fixed: 'Broad Prospecting — Interest Stack' | 'High Intent — ABM ICP List + 1% Lookalike' | 'AI Optimized — Advantage+'",
    ),
  dailyBudget: z.string().describe("Equal split, = daily / 3, label"),
  dailyBudgetProvenance: z
    .string()
    .describe("Provenance for this audience's daily budget (free string)"),
  detail: z
    .string()
    .describe("Company-SPECIFIC Meta targeting grounded in Buyer ICP"),
  sourceSection: z
    .string()
    .describe("Which committed section the targeting draws from (free string)"),
  grounding: z
    .string()
    .describe("The exact fact/quote behind the targeting, or 'UNVERIFIED'"),
});

const angleSchema = z.object({
  shortName: z.string().describe("Punchy angle name"),
  description: z.string().describe("One-sentence angle description"),
  angleType: z
    .string()
    .describe(
      "DR type label (free string, e.g. Problem-Aware | Mechanism-Led | Proof-Stacked | Enemy | Contrarian | Identity | Comparison) — NO hard enum; enforce diversity in prompt",
    ),
  sourceSection: z
    .string()
    .describe("Which committed section this angle draws from (free string)"),
  grounding: z
    .string()
    .describe("Exact fact/quote the angle rests on, or 'UNVERIFIED'"),
});

const creativeStrategySchema = z.object({
  prose: z.string().describe("Creative-mix narrative for slide 6"),
  staticCount: z.number().describe("Fixed 5"),
  videoCount: z.number().describe("Fixed 3 (UGC)"),
  totalPerAudience: z.number().describe("Fixed 8"),
});

const creativeFrameworkSlotSchema = z.object({
  label: z
    .string()
    .describe(
      "Fixed slot: 'PST 1'..'PST 3', 'Objection 1'..'Objection 2', 'USP', 'Demo + Objection', 'Before / After'",
    ),
  angleType: z
    .string()
    .describe("FIXED per slot — DR type label, free string (do not re-enum)"),
  hook: z
    .string()
    .describe("Specific, deployable hook copy grounded in research, never generic"),
  executesAngle: z
    .string()
    .describe("Which of the 4 Slide-5 angles this slot executes (shortName ref)"),
  sourceSection: z
    .string()
    .describe("Which committed section this hook draws from (free string)"),
  grounding: z
    .string()
    .describe("The exact fact/number/quote behind the hook, or 'UNVERIFIED'"),
});

const funnelIdeationSchema = z.object({
  rank: z.string().describe("'1 — PRIMARY' | '2 — SECONDARY' | '3 — TEST'"),
  name: z.string().describe("Funnel path name"),
  description: z.string().describe("What this path does and why ordered here"),
  whatItProves: z.string().describe("The metric / hypothesis this path tests"),
});

const salesProcessAssetSchema = z.object({
  label: z
    .string()
    .describe(
      "'Sales Process Overview' | 'SDR Opt-In Flow' | 'Personalization Playbook' | 'Loom Walkthrough'",
    ),
  assetType: z.string().describe("'sop-doc' | 'loom' (free string)"),
  url: z
    .string()
    .describe("Link from onboarding, or empty string if the gap is real — never fabricate"),
  note: z.string().describe("What this asset covers, or the explicit gap if absent"),
});

const competitorMarketingInsightSchema = z.object({
  competitor: z.string().describe("Competitor name"),
  messaging: z.string().describe("Their core marketing messaging"),
  adPlatforms: z
    .string()
    .describe("Channels they run on + est spend if known, or explicit gap — never guess spend"),
  estSpendProvenance: z
    .string()
    .describe("Provenance for any spend figure (free string, default unknown)"),
  icp: z.string().describe("Who they target — niched vs broad"),
  angles: z.string().describe("What their ads lean on and avoid"),
  positioning: z.string().describe("Their positioning vs the category"),
  offer: z.string().describe("Marketed offer vs backend offer"),
  sourceSection: z
    .string()
    .describe("Grounded in positioningCompetitorLandscape (+ ad evidence) — free string"),
  grounding: z.string().describe("Exact evidence, or explicit gap / 'UNVERIFIED'"),
});

const competitorReviewInsightSchema = z.object({
  complaint: z
    .string()
    .describe("Direct quote or paraphrased pattern from competitor reviews"),
  howWeLeverage: z
    .string()
    .describe("How we use it in ads / sales scripts / positioning"),
  sourceSection: z
    .string()
    .describe("Grounded in VoC/Competitor evidence — free string"),
  grounding: z
    .string()
    .describe("Exact review evidence, or say so if thin — never invent quotes"),
});

const channelSuggestionSchema = z.object({
  channel: z
    .string()
    .describe("'Website' | 'Content / Organic' | 'Other Ad Platforms' | 'Email / Nurture'"),
  recommendation: z
    .string()
    .describe("Concrete fix/keep advice — name a specific asset/page/metric + action verb"),
  verdict: z
    .string()
    .describe(
      "Verdict label (free string, e.g. FIX | REWORK | REVIEW | KEEP | ADD | KILL | SCALE) — NO hard enum",
    ),
  sourceSection: z
    .string()
    .describe("Driven by onboarding.channels + current-activity context — free string"),
});

const kpiSchema = z.object({
  metric: z.string().describe("KPI name, e.g. 'MQLs', 'CTR', 'CPL'"),
  role: z
    .string()
    .describe("What this KPI signals (primary outcome / creative health / efficiency)"),
  definition: z.string().describe("Definition + how it is measured"),
});

const crossSectionInsightSchema = z.object({
  tension: z.string().describe("A collision visible only across >=2 sections"),
  sourceSections: z
    .array(z.string())
    .describe("The >=2 section ids this tension is read across"),
  implicationForPlan: z
    .string()
    .describe("So-what: how this tension shaped an audience/creative/phase choice"),
  clientBlindSpot: z
    .string()
    .describe("What the client is not seeing that this collision exposes"),
  secondOrderRisk: z
    .string()
    .describe("The downstream risk if the plan ignores this tension"),
  contrarianInversion: z
    .string()
    .describe("The contrarian read — what if the obvious interpretation is backwards"),
});

const leanMediaPlanV3Schema = z.object({
  campaignOverview: campaignOverviewSchema,
  campaignPhases: z
    .array(campaignPhaseSchema)
    .length(2)
    .describe("Phase 1 Testing -> Phase 2 Optimize & Scale (EXACTLY 2)"),
  audienceTypes: z
    .array(audienceTypeSchema)
    .length(3)
    .describe("3 fixed archetypes tested in parallel (EXACTLY 3)"),
  anglesToTest: z
    .array(angleSchema)
    .length(4)
    .describe("4 DISTINCT creative angles, diversity-enforced (EXACTLY 4)"),
  creativeStrategy: creativeStrategySchema,
  creativeFramework: z
    .array(creativeFrameworkSlotSchema)
    .length(8)
    .describe("5 static + 3 UGC fixed slots, each executes one of the 4 angles (EXACTLY 8)"),
  funnelIdeation: z
    .array(funnelIdeationSchema)
    .length(3)
    .describe("3 funnel paths: PRIMARY / SECONDARY / TEST (EXACTLY 3)"),
  salesProcess: z
    .array(salesProcessAssetSchema)
    .describe("3 sales docs + 1 Loom; state gaps, never fabricate URLs"),
  competitorMarketingInsights: z
    .array(competitorMarketingInsightSchema)
    .min(2)
    .describe("Competitor marketing teardown (>=2)"),
  competitorReviewInsights: z
    .array(competitorReviewInsightSchema)
    .length(3)
    .describe("3 competitor-review complaints + leverage (EXACTLY 3)"),
  channelSuggestions: z
    .array(channelSuggestionSchema)
    .length(4)
    .describe("4 current-funnel suggestion cards with verdict badge (EXACTLY 4)"),
  kpis: z
    .array(kpiSchema)
    .length(3)
    .describe("3 fixed KPIs: primary + CTR + CPL (EXACTLY 3)"),
  crossSectionInsight: z
    .array(crossSectionInsightSchema)
    .describe("1-3 cross-section tensions that DROVE the deck (folded thinker)"),
});

type LeanMediaPlanV3 = z.infer<typeof leanMediaPlanV3Schema>;

// ===========================================================================

function clip(s: string | null | undefined, n: number): string {
  if (!s) return "(empty)";
  return s.length > n ? s.slice(0, n) + "\n…[truncated]" : s;
}

async function loadPaidMediaSkill(): Promise<string> {
  // Mirror lab-section-job.ts:loadLabSkill — read the REAL SKILL.md, then wrap
  // with the SAME preamble production applies to every lab section.
  const skillPath = join(
    process.cwd(),
    "src",
    "lib",
    "lab-engine",
    "skills",
    "positioning-paid-media-plan",
    "SKILL.md",
  );
  const skillMd = await readFile(skillPath, "utf8");
  return withGtmStrategicStandardPreamble(skillMd);
}

async function main(): Promise<void> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY missing");
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sbKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!sbUrl || !sbKey) throw new Error("Supabase URL/key missing");
  const usingServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const runShort = RUN_ID.slice(0, 8);
  console.log(
    `[v3] run=${RUN_ID} supabaseKey=${usingServiceRole ? "service-role" : "anon(RLS may block)"}`,
  );

  const skillText = await loadPaidMediaSkill();
  console.log(`[v3] loaded REAL SKILL.md + preamble: ${skillText.length} chars`);

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
  console.log(`[v3] fetched ${sections?.length ?? 0} research sections`);
  if (!sections?.length)
    throw new Error("no sections (RLS? need SUPABASE_SERVICE_ROLE_KEY)");

  const sectionBlock = RESEARCH_ZONES.map((zone) => {
    const row = sections.find((s) => s.zone === zone);
    return `\n## ${zone} — ${row?.title ?? "(missing)"}\n${clip(row?.markdown, 7000)}`;
  }).join("\n");

  // Representative brief (proof). Real path uses onboarding.* fields.
  const brief = [
    "Primary channel: Meta Ads.",
    "Monthly ad budget: $9,000 (operator-supplied).",
    "Campaign duration: 4 months, 2 phases.",
    "Primary KPI: MQLs (qualified sign-ups).",
    "Channels declared: Meta, Google, Email.",
    "Sales process docs: none provided (state the gap honestly).",
    "Lead list available: yes.",
  ].join(" ");

  // Mirror run-section's shape: the SKILL.md IS the instruction set (it carries
  // the full 13-slide template, the angle engine, hook craft, grounding rules).
  // The prompt's job is to (a) inject the brief + sections, (b) bind the skill's
  // narrative slots to the v3 schema field names so the model fills the right keys.
  const prompt = [
    "You are executing the Paid Media Plan section skill below. Follow it EXACTLY — it carries the fixed 13-slide SaaSLaunch template, the angle engine, hook craft, the banned-tells list, and the grounding discipline. Do not redesign the template.",
    "",
    "Emit the structured object that the schema defines. Field-binding map (skill slide -> schema field):",
    "- Slides 1-2 (Title + Campaign Overview) -> campaignOverview (platform, monthlyBudget(+Provenance), dailySpend(+Provenance)=monthly/30, totalMonths=4, phaseCount=2, primaryKpi).",
    "- Slide 3 (Campaign Phases) -> campaignPhases (EXACTLY 2: 'Phase 1 — Testing' Months 1-2, 'Phase 2 — Optimization & Scale' Months 3-4; 4-5 bullets each; each carries monthlyBudget+Provenance).",
    "- Slide 4 (Audience Types) -> audienceTypes (EXACTLY 3 fixed archetypes, equal daily split = daily/3; detail = company-specific ICP-grounded targeting; sourceSection + grounding).",
    "- Slide 5 (Angles to Test) -> anglesToTest (EXACTLY 4 DISTINCT angles; angleType = one named DR type; no two angles share an emotional lever; sourceSection + grounding).",
    "- Slide 6 (Creative Strategy counts) -> creativeStrategy (staticCount 5, videoCount 3, totalPerAudience 8).",
    "- Slide 7 (Creative Framework) -> creativeFramework (EXACTLY 8 fixed slots; each hook clears the five craft moves + Four U's + Halbert test; executesAngle references one of the 4 anglesToTest shortNames; angleType fixed per slot; sourceSection + grounding).",
    "- Slide 8 (Funnel Ideation) -> funnelIdeation (EXACTLY 3: '1 — PRIMARY' / '2 — SECONDARY' / '3 — TEST'; whatItProves = the metric/hypothesis).",
    "- Slide 9 (Sales Process) -> salesProcess (3 docs + 1 Loom; url empty + note the gap when absent; NEVER fabricate a URL).",
    "- Slide 10 (Competitor Insights: Marketing) -> competitorMarketingInsights (>=2 competitors, all 6 marketing cells each; estSpendProvenance free string, default 'unknown'; sourceSection + grounding).",
    "- Slide 11 (Competitor Insights: Reviews) -> competitorReviewInsights (EXACTLY 3 complaint + howWeLeverage rows; NEVER invent a quote — if VoC is starved, say so and set grounding accordingly).",
    "- Slide 12 (Suggestions on Current Funnels) -> channelSuggestions (EXACTLY 4 cards; verdict is one of FIX/REWORK/REVIEW/KEEP/ADD/KILL/SCALE).",
    "- Slide 13 (KPIs) -> kpis (EXACTLY 3: primary MQLs, CTR, CPL).",
    "- Folded thinker -> crossSectionInsight (1-3 threads; each cites >=2 distinct section ids; implicationForPlan = the so-what; carry the THREE depth fields clientBlindSpot / secondOrderRisk / contrarianInversion on the strongest thread, load-bearing, not decorative).",
    "",
    "GROUNDING (non-negotiable, from the skill): every hook/angle/insight carries sourceSection + grounding. If a claim cannot be grounded in a section, write it conservatively and set grounding to the literal 'UNVERIFIED'. NEVER label a fact 'verified' unless the cited section actually tags it verified. NEVER quote a structurally-empty section — route around starved sections and say so. NEVER fabricate a statistic, spend value, competitor platform, URL, or buyer quote.",
    "",
    "Do STEP 1 (cross-section reasoning) FIRST, then fill the template so every angle/audience/phase traces back to a tension.",
    "",
    "=========================== SKILL ===========================",
    skillText,
    "",
    "=========================== BRIEF ===========================",
    brief,
    "",
    "==================== SIX COMMITTED SECTIONS ====================",
    sectionBlock,
  ].join("\n");

  const deepseek = createDeepSeek({ apiKey });
  const model = deepseek("deepseek-v4-flash");

  console.log(
    "[v3] single DeepSeek call (deepseek-v4-flash, thinking DISABLED, maxOutputTokens 16384)…",
  );
  const startMs = Date.now();
  const result = await generateText({
    model,
    output: Output.object({
      schema: leanMediaPlanV3Schema,
      name: "LeanMediaPlanV3",
      description:
        "Full 13-slide SaaSLaunch paid-media deck with folded cross-section insight.",
    }),
    maxOutputTokens: 16384,
    abortSignal: AbortSignal.timeout(300_000),
    providerOptions: { deepseek: { thinking: { type: "disabled" } } },
    system:
      "You are the SaaSLaunch senior media buyer. Fill the fixed 13-slide template with grounded specifics from the six committed sections. Output only the structured plan. Be specific and decision-useful; honest about evidence gaps; zero banned AI tells.",
    prompt,
  });
  const elapsedMs = Date.now() - startMs;
  const finishReason = result.finishReason;

  // GATE: never trust token-count alone. Assert finishReason === 'stop' AND parse.
  let parsed: LeanMediaPlanV3 | null = null;
  let parseError: string | null = null;
  let cleanCommit = false;
  try {
    parsed = leanMediaPlanV3Schema.parse(result.output);
    cleanCommit = finishReason === "stop";
  } catch (e) {
    parseError = e instanceof Error ? e.message : String(e);
  }

  const outDir = join(process.cwd(), "tmp", "zz-section-out");
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, `v3-${runShort}.json`);
  await writeFile(
    outPath,
    JSON.stringify(
      {
        runId: RUN_ID,
        elapsedMs,
        finishReason,
        usage: result.usage,
        cleanCommit,
        parseError,
        plan: parsed ?? result.output,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(
    `\n[v3] finishReason=${finishReason} | elapsed=${(elapsedMs / 1000).toFixed(1)}s | tokensOut=${result.usage?.outputTokens ?? "?"} | cleanCommit=${cleanCommit}`,
  );
  if (parseError) {
    console.log(`[v3] PARSE FAILED: ${parseError}`);
  } else if (parsed) {
    const c = parsed;
    console.log(
      `[v3] slot counts: phases=${c.campaignPhases.length} audiences=${c.audienceTypes.length} angles=${c.anglesToTest.length} creatives=${c.creativeFramework.length} funnels=${c.funnelIdeation.length} kpis=${c.kpis.length} compMktg=${c.competitorMarketingInsights.length} compReviews=${c.competitorReviewInsights.length} channels=${c.channelSuggestions.length} salesProcess=${c.salesProcess.length} crossInsight=${c.crossSectionInsight.length}`,
    );
    c.crossSectionInsight.forEach((t, i) =>
      console.log(`  [thread ${i + 1}] ${t.tension.slice(0, 120)}  (${t.sourceSections.join("+")})`),
    );
  }
  console.log(`[v3] output: ${outPath}`);
}

main().catch((err) => {
  console.error("[v3] FATAL", err);
  process.exit(1);
});
