/**
 * Merge research-market JSON fragments into output.json.
 *
 * Usage:
 *   npx tsx scripts/merge-fragments.ts <output.json> <fragments_dir>
 */
import * as fs from "node:fs";
import * as path from "node:path";
import {
  MarketResearchFragmentSchema,
  ResearchMarketOutputSchema,
  type LegacyMarketDynamics,
  type LegacyMessagingOpportunities,
  type LegacyPainPoints,
  type MarketResearchFragment,
  type ResearchMarketOutput,
} from "../schemas/output";

function readJson(filePath: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as unknown;
  } catch (error: unknown) {
    throw new Error(
      `[merge-fragments] JSON parse failed for ${filePath}: ${(error as Error).message}`,
    );
  }
}

function readOutput(outputPath: string): ResearchMarketOutput {
  if (!fs.existsSync(outputPath)) {
    throw new Error(`[merge-fragments] output file missing: ${outputPath}`);
  }

  const parsed = ResearchMarketOutputSchema.safeParse(readJson(outputPath));
  if (!parsed.success) {
    throw new Error(
      `[merge-fragments] output schema invalid before merge: ${JSON.stringify(parsed.error.issues, null, 2)}`,
    );
  }

  return parsed.data;
}

function readFragments(fragmentsDir: string): MarketResearchFragment[] {
  if (!fs.existsSync(fragmentsDir)) {
    throw new Error(`[merge-fragments] fragments dir missing: ${fragmentsDir}`);
  }

  const files = fs
    .readdirSync(fragmentsDir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => path.join(fragmentsDir, file));

  if (files.length === 0) {
    throw new Error(`[merge-fragments] no JSON fragments found: ${fragmentsDir}`);
  }

  return files.map((file) => {
    const parsed = MarketResearchFragmentSchema.safeParse(readJson(file));
    if (!parsed.success) {
      throw new Error(
        `[merge-fragments] invalid fragment ${file}: ${JSON.stringify(parsed.error.issues, null, 2)}`,
      );
    }
    return parsed.data;
  });
}

function mergeUniqueStrings(left: string[], right: string[] | undefined): string[] {
  const seen = new Set(left);
  const merged = [...left];
  for (const value of right ?? []) {
    if (!seen.has(value)) {
      seen.add(value);
      merged.push(value);
    }
  }
  return merged;
}

function mergeArray<T>(left: T[], right: T[] | undefined): T[] {
  return [...left, ...(right ?? [])];
}

function mergePainPoints(
  left: LegacyPainPoints,
  right: LegacyPainPoints | undefined,
): LegacyPainPoints {
  if (!right) return left;
  return {
    primary: mergeUniqueStrings(left.primary, right.primary),
    secondary: mergeUniqueStrings(left.secondary, right.secondary),
    triggers: mergeUniqueStrings(left.triggers, right.triggers),
  };
}

function mergeMarketDynamics(
  left: LegacyMarketDynamics,
  right: LegacyMarketDynamics | undefined,
): LegacyMarketDynamics {
  if (!right) return left;
  return {
    demandDrivers: mergeUniqueStrings(left.demandDrivers, right.demandDrivers),
    buyingTriggers: mergeUniqueStrings(left.buyingTriggers, right.buyingTriggers),
    barriersToPurchase: mergeUniqueStrings(
      left.barriersToPurchase,
      right.barriersToPurchase,
    ),
    macroRisks: right.macroRisks ?? left.macroRisks,
  };
}

function mergeMessaging(
  left: LegacyMessagingOpportunities,
  right: LegacyMessagingOpportunities | undefined,
): LegacyMessagingOpportunities {
  if (!right) return left;
  return {
    summaryRecommendations: mergeUniqueStrings(
      left.summaryRecommendations,
      right.summaryRecommendations,
    ),
  };
}

function mergeFragment(
  output: ResearchMarketOutput,
  fragment: MarketResearchFragment,
): ResearchMarketOutput {
  return ResearchMarketOutputSchema.parse({
    ...output,
    run_id: fragment.run_id ?? output.run_id,
    brief_snapshot_id: fragment.brief_snapshot_id ?? output.brief_snapshot_id,
    source_company_name:
      fragment.source_company_name ?? output.source_company_name,
    source_company: fragment.source_company ?? output.source_company,
    generated_at: fragment.generated_at ?? output.generated_at,
    tool_calls_used: mergeUniqueStrings(
      output.tool_calls_used,
      fragment.tool_calls_used,
    ),
    summary: fragment.summary ?? output.summary,
    keyFindings: mergeUniqueStrings(output.keyFindings, fragment.keyFindings),
    evidenceIds: mergeUniqueStrings(output.evidenceIds, fragment.evidenceIds),
    assumptions: mergeUniqueStrings(output.assumptions, fragment.assumptions),
    market_scope: fragment.market_scope ?? output.market_scope,
    category_definition:
      fragment.category_definition ?? output.category_definition,
    market_size_signals: mergeArray(
      output.market_size_signals,
      fragment.market_size_signals,
    ),
    category_maturity: fragment.category_maturity ?? output.category_maturity,
    timing_signals: mergeArray(output.timing_signals, fragment.timing_signals),
    demand_drivers: mergeArray(output.demand_drivers, fragment.demand_drivers),
    buying_triggers: mergeArray(output.buying_triggers, fragment.buying_triggers),
    adoption_barriers: mergeArray(
      output.adoption_barriers,
      fragment.adoption_barriers,
    ),
    category_pain_points: fragment.category_pain_points
      ? {
          primary: mergeArray(
            output.category_pain_points.primary,
            fragment.category_pain_points.primary,
          ),
          secondary: mergeArray(
            output.category_pain_points.secondary,
            fragment.category_pain_points.secondary,
          ),
          triggers: mergeArray(
            output.category_pain_points.triggers,
            fragment.category_pain_points.triggers,
          ),
        }
      : output.category_pain_points,
    competitive_intensity:
      fragment.competitive_intensity ?? output.competitive_intensity,
    opportunity_candidates: mergeArray(
      output.opportunity_candidates,
      fragment.opportunity_candidates,
    ),
    source_gaps: mergeArray(output.source_gaps, fragment.source_gaps),
    categorySnapshot: fragment.categorySnapshot ?? output.categorySnapshot,
    painPoints: mergePainPoints(output.painPoints, fragment.painPoints),
    marketDynamics: mergeMarketDynamics(
      output.marketDynamics,
      fragment.marketDynamics,
    ),
    trendSignals: mergeArray(output.trendSignals, fragment.trendSignals),
    messagingOpportunities: mergeMessaging(
      output.messagingOpportunities,
      fragment.messagingOpportunities,
    ),
    marketOpportunities: mergeArray(
      output.marketOpportunities,
      fragment.marketOpportunities,
    ),
  });
}

function main(): void {
  const [outputPath, fragmentsDir] = process.argv.slice(2);
  if (!outputPath || !fragmentsDir) {
    process.stderr.write(
      "Usage: merge-fragments.ts <output.json> <fragments_dir>\n",
    );
    process.exit(2);
  }

  try {
    const baseOutput = readOutput(outputPath);
    const fragments = readFragments(fragmentsDir);
    const merged = fragments.reduce<ResearchMarketOutput>(
      (current, fragment) => mergeFragment(current, fragment),
      baseOutput,
    );

    fs.writeFileSync(outputPath, `${JSON.stringify(merged, null, 2)}\n`);
    process.stdout.write(
      `[merge-fragments] merged ${fragments.length} fragment(s) into ${outputPath}\n`,
    );
  } catch (error: unknown) {
    process.stderr.write(`${(error as Error).message}\n`);
    process.exit(1);
  }
}

main();
