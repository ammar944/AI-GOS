/**
 * Validate budget-specific media-plan gates against the locked GTM brief.
 *
 * Usage:
 *   node --import tsx/esm scripts/validate-budget-gates.ts <input.json> <output.json>
 */
import * as fs from "fs";
import { synthesizeMediaPlanInputSchema } from "../schemas/input.ts";
import {
  synthesizeMediaPlanOutputSchema,
  type Campaign,
  type SynthesizeMediaPlanOutput,
} from "../schemas/output.ts";

type Violation = {
  code: string;
  message: string;
};

function parseMoney(raw: string): number {
  const normalized = raw.replace(/,/g, "");
  const match = /(\d+(?:\.\d+)?)/.exec(normalized);
  if (!match || !match[1]) {
    throw new Error(`monthlyAdBudget value is not parseable: ${raw}`);
  }
  return Number.parseFloat(match[1]);
}

function normalizeAwareness(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function uniqueCampaignPlatforms(campaigns: Campaign[]): Set<string> {
  return new Set(campaigns.map((campaign) => campaign.platform));
}

function allCampaigns(output: SynthesizeMediaPlanOutput): Campaign[] {
  return [
    ...output.audience_campaign_matrix,
    ...output.rollout_phases.flatMap((phase) => phase.campaigns),
  ];
}

function validateBudgetConcentration(
  budget: number,
  output: SynthesizeMediaPlanOutput,
): Violation[] {
  const violations: Violation[] = [];
  const topLevelPlatforms = uniqueCampaignPlatforms(output.audience_campaign_matrix);
  const planPlatforms = uniqueCampaignPlatforms(allCampaigns(output));

  if (budget < 5000) {
    if (output.channel_mix.length > 1) {
      violations.push({
        code: "under_5k_channel_mix",
        message: `monthly budget ${budget} requires one channel recommendation; got ${output.channel_mix.length}.`,
      });
    }
    if (topLevelPlatforms.size > 1 || planPlatforms.size > 1) {
      violations.push({
        code: "under_5k_platform_count",
        message: `monthly budget ${budget} requires one platform; got ${Array.from(planPlatforms).join(", ")}.`,
      });
    }
    if (output.audience_campaign_matrix.length > 1) {
      violations.push({
        code: "under_5k_campaign_count",
        message: `monthly budget ${budget} requires one campaign; got ${output.audience_campaign_matrix.length}.`,
      });
    }
    output.rollout_phases.forEach((phase) => {
      if (phase.campaigns.length > 1) {
        violations.push({
          code: "under_5k_phase_campaign_count",
          message: `phase ${phase.phase} has ${phase.campaigns.length} campaigns; under $5k requires one.`,
        });
      }
    });
  }

  if (budget >= 5000 && budget <= 15000) {
    if (planPlatforms.size > 2) {
      violations.push({
        code: "mid_budget_platform_count",
        message: `monthly budget ${budget} allows at most two platforms; got ${Array.from(planPlatforms).join(", ")}.`,
      });
    }
    output.rollout_phases.forEach((phase) => {
      if (phase.campaigns.length > 2) {
        violations.push({
          code: "mid_budget_phase_campaign_count",
          message: `phase ${phase.phase} has ${phase.campaigns.length} campaigns; max is two.`,
        });
      }
    });
  }

  return violations;
}

function validateUnawareGoogleGate(
  awareness: string,
  output: SynthesizeMediaPlanOutput,
): Violation[] {
  if (awareness !== "unaware") {
    return [];
  }
  const phaseOne = output.rollout_phases.find((phase) => phase.phase === 1);
  if (!phaseOne) {
    return [
      {
        code: "missing_phase_one",
        message: "unaware-audience gate requires a phase 1 rollout phase.",
      },
    ];
  }
  const hasGoogle = phaseOne.campaigns.some(
    (campaign) => campaign.platform === "google",
  );
  if (hasGoogle && !phaseOne.google_phase_out_reason) {
    return [
      {
        code: "unaware_google_phase_one",
        message:
          "unaware audience includes Google in phase 1 without google_phase_out_reason.",
      },
    ];
  }
  return [];
}

function main(): void {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];
  if (!inputPath || !outputPath) {
    process.stderr.write("Usage: validate-budget-gates.ts <input.json> <output.json>\n");
    process.exit(2);
  }

  const input = synthesizeMediaPlanInputSchema.parse(
    JSON.parse(fs.readFileSync(inputPath, "utf-8")) as unknown,
  );
  const output = synthesizeMediaPlanOutputSchema.parse(
    JSON.parse(fs.readFileSync(outputPath, "utf-8")) as unknown,
  );

  const budget = parseMoney(input.gtm_brief.fields.monthlyAdBudget.value);
  const awareness = normalizeAwareness(input.gtm_brief.fields.awarenessLevel.value);
  const violations = [
    ...validateBudgetConcentration(budget, output),
    ...validateUnawareGoogleGate(awareness, output),
  ];

  if (violations.length > 0) {
    process.stderr.write(
      `[validate-budget-gates] FAILED (${violations.length} violations):\n` +
        violations
          .map((violation) => `  ${violation.code} - ${violation.message}`)
          .join("\n") +
        "\n",
    );
    process.exit(1);
  }

  process.stdout.write("[validate-budget-gates] pass\n");
}

main();
