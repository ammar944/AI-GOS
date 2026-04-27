/**
 * Validate that the strategy snapshot does not introduce unsupported channels.
 *
 * Usage:
 *   node --import tsx/esm scripts/validate-snapshot.ts <output.json>
 */
import * as fs from "fs";
import {
  platformSchema,
  synthesizeMediaPlanOutputSchema,
  type Platform,
  type SynthesizeMediaPlanOutput,
} from "../schemas/output.ts";

type Violation = {
  path: string;
  message: string;
};

const PLATFORM_ALIASES: Record<Platform, RegExp[]> = {
  meta: [/\bmeta\b/i, /\bfacebook\b/i, /\binstagram\b/i],
  google: [/\bgoogle\b/i, /\bsearch ads\b/i],
  linkedin: [/\blinkedin\b/i],
  youtube: [/\byoutube\b/i],
  tiktok: [/\btiktok\b/i],
  reddit: [/\breddit\b/i],
  other: [/\bother\b/i],
};

function recommendedPlatforms(output: SynthesizeMediaPlanOutput): Set<Platform> {
  const values = [
    ...output.audience_campaign_matrix.map((campaign) => campaign.platform),
    ...output.rollout_phases.flatMap((phase) =>
      phase.campaigns.map((campaign) => campaign.platform),
    ),
  ];
  return new Set(values);
}

function platformMentions(text: string): Platform[] {
  return platformSchema.options.filter((platform) =>
    PLATFORM_ALIASES[platform].some((pattern) => pattern.test(text)),
  );
}

function validateSnapshot(output: SynthesizeMediaPlanOutput): Violation[] {
  const planned = recommendedPlatforms(output);
  return output.strategy_snapshot.flatMap((claim, index) => {
    const mentions = platformMentions(claim.value);
    return mentions
      .filter((platform) => !planned.has(platform))
      .map((platform) => ({
        path: `strategy_snapshot:${index}`,
        message: `mentions ${platform} but that platform is absent from planned campaigns.`,
      }));
  });
}

function main(): void {
  const outputPath = process.argv[2];
  if (!outputPath) {
    process.stderr.write("Usage: validate-snapshot.ts <output.json>\n");
    process.exit(2);
  }

  const output = synthesizeMediaPlanOutputSchema.parse(
    JSON.parse(fs.readFileSync(outputPath, "utf-8")) as unknown,
  );
  const violations = validateSnapshot(output);
  if (violations.length > 0) {
    process.stderr.write(
      `[validate-snapshot] FAILED (${violations.length} violations):\n` +
        violations
          .map((violation) => `  ${violation.path} - ${violation.message}`)
          .join("\n") +
        "\n",
    );
    process.exit(1);
  }
  process.stdout.write("[validate-snapshot] pass\n");
}

main();
