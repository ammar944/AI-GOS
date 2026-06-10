// Media-Plan SOP channel policy (SaaSLaunch Media-Plan SOP, encoded 2026-06-10).
//
// The SOP's ACV-band logic decides which ad platforms a paid-media plan may
// structure spend on; platform minimum budgets turn an under-funded brief into
// EXPLICIT conflicts the plan must surface instead of silently downgrading to
// whichever platform happens to fit the budget (the Anura 89135f99 failure:
// $3k/mo fit Meta's minimum, so the plan went Meta-first against a high-ACV
// client the SOP routes to LinkedIn + Google only).
//
// Pure derivation — no I/O. Derived at prompt-build time (binding prompt block)
// and re-derived at validation time (post-required-evidence hook), so the
// constraint survives repair attempts without threading state.

import type {
  OnboardingSnapshot,
  ResearchInput,
} from "../artifacts/artifact-envelope";

export type AdPlatform = "meta" | "google" | "linkedin";

export type AcvBand = "low" | "mid" | "high" | "unknown";

export interface ChannelPolicy {
  acvBand: AcvBand;
  /** The raw brief string the band was parsed from, for honest provenance. */
  acvSignal: string | null;
  /** Platforms the campaign structure may place spend on. */
  allowedPlatforms: readonly AdPlatform[];
  forbiddenPlatforms: readonly { platform: AdPlatform; reason: string }[];
  platformMinimumsMonthlyUsd: Readonly<Record<AdPlatform, number>>;
  monthlyBudgetUsd: number | null;
  /** Human-readable conflicts (budget below an allowed platform's minimum). */
  budgetConflicts: readonly string[];
  /** False when the ACV band is unknown — policy becomes advisory, not binding. */
  constrained: boolean;
}

// SOP platform minimums (monthly USD).
export const SOP_PLATFORM_MINIMUMS: Readonly<Record<AdPlatform, number>> = {
  meta: 3_000,
  google: 5_000,
  linkedin: 5_000,
};

const PLATFORM_LABELS: Record<AdPlatform, string> = {
  meta: "Meta",
  google: "Google",
  linkedin: "LinkedIn",
};

// SOP ACV bands: <$3k -> Meta+Google; $3k-$5k -> Meta+Google+LinkedIn;
// >$5k -> LinkedIn+Google only (enterprise motion never buys Meta).
const BAND_ALLOWED: Record<Exclude<AcvBand, "unknown">, readonly AdPlatform[]> =
  {
    low: ["meta", "google"],
    mid: ["meta", "google", "linkedin"],
    high: ["linkedin", "google"],
  };

function formatUsd(value: number): string {
  return `$${value.toLocaleString("en-US")}`;
}

/**
 * Parse a single money token like "$3,000", "$3k", "3000", "$10K" -> dollars.
 */
function parseMoneyToken(token: string): number | null {
  const match = /\$?\s*([\d][\d,.]*)\s*([kKmM])?/.exec(token);
  if (match === null || match[1] === undefined) {
    return null;
  }
  const raw = Number.parseFloat(match[1].replaceAll(",", ""));
  if (!Number.isFinite(raw)) {
    return null;
  }
  const suffix = match[2]?.toLowerCase();
  if (suffix === "k") {
    return raw * 1_000;
  }
  if (suffix === "m") {
    return raw * 1_000_000;
  }
  return raw;
}

/** Extract every dollar-ish number from a free-text money string. */
function extractMoneyValues(text: string): number[] {
  const values: number[] = [];
  const pattern = /\$?\s*\d[\d,.]*\s*[kKmM]?/g;
  for (const match of text.match(pattern) ?? []) {
    const value = parseMoneyToken(match);
    if (value !== null && value > 0) {
      values.push(value);
    }
  }
  return values;
}

function bandFromAmount(amount: number): Exclude<AcvBand, "unknown"> {
  if (amount < 3_000) {
    return "low";
  }
  if (amount <= 5_000) {
    return "mid";
  }
  return "high";
}

/**
 * Map the brief's ACV signal to an SOP band. Handles the onboarding enum
 * tokens, the canonical radio labels ("<$1K", "$1K–$10K", "$10K–$50K",
 * "$50K+"), bare amounts ("$24,000"), and generic ranges (midpoint).
 */
export function parseAcvBand(acv: string | undefined): {
  band: AcvBand;
  signal: string | null;
} {
  if (acv === undefined || acv.trim() === "") {
    return { band: "unknown", signal: null };
  }
  const signal = acv.trim();
  const normalized = signal.toLowerCase().replaceAll(/[\s,]/g, "");

  // Onboarding enum tokens + the canonical bracket labels. The 1k-10k bracket
  // straddles the SOP's $3k/$5k boundaries -> mid (all three platforms stay
  // open); the >=10k brackets are unambiguously high.
  if (normalized.includes("lt_1k") || /^<?\$?1k?$|^<\$?1k/.test(normalized)) {
    return { band: "low", signal };
  }
  if (normalized.includes("1k_10k") || /\$?1k[-–—to]+\$?10k/.test(normalized)) {
    return { band: "mid", signal };
  }
  if (
    normalized.includes("10k_50k") ||
    /\$?10k[-–—to]+\$?50k/.test(normalized)
  ) {
    return { band: "high", signal };
  }
  if (normalized.includes("gt_50k") || /\$?50k\+/.test(normalized)) {
    return { band: "high", signal };
  }

  const values = extractMoneyValues(signal);
  if (values.length === 0) {
    return { band: "unknown", signal };
  }
  const amount =
    values.length === 1
      ? values[0]!
      : (Math.min(...values) + Math.max(...values)) / 2;
  return { band: bandFromAmount(amount), signal };
}

/** Parse the brief's monthly ad budget string ("$3,000 / month") to dollars. */
export function parseMonthlyBudgetUsd(
  monthlyAdBudget: string | undefined,
): number | null {
  if (monthlyAdBudget === undefined || monthlyAdBudget.trim() === "") {
    return null;
  }
  const values = extractMoneyValues(monthlyAdBudget);
  return values.length === 0 ? null : Math.max(...values);
}

export function deriveChannelPolicy(
  onboarding: OnboardingSnapshot,
): ChannelPolicy {
  const economics = onboarding.economics;
  const { band, signal } = parseAcvBand(economics?.acv);
  const monthlyBudgetUsd = parseMonthlyBudgetUsd(economics?.monthlyAdBudget);

  if (band === "unknown") {
    return {
      acvBand: band,
      acvSignal: signal,
      allowedPlatforms: ["meta", "google", "linkedin"],
      forbiddenPlatforms: [],
      platformMinimumsMonthlyUsd: SOP_PLATFORM_MINIMUMS,
      monthlyBudgetUsd,
      budgetConflicts: [],
      constrained: false,
    };
  }

  const allowedPlatforms = BAND_ALLOWED[band];
  const forbiddenPlatforms = (
    ["meta", "google", "linkedin"] as const
  ).flatMap((platform) =>
    allowedPlatforms.includes(platform)
      ? []
      : [
          {
            platform,
            reason:
              platform === "meta"
                ? `SOP: ACV band ${band} (${signal ?? "unknown"}) runs LinkedIn + Google only; an enterprise-priced motion never buys Meta.`
                : `SOP: ACV band ${band} (${signal ?? "unknown"}) does not fund ${PLATFORM_LABELS[platform]} (${formatUsd(SOP_PLATFORM_MINIMUMS[platform])}/mo minimum).`,
          },
        ],
  );

  const budgetConflicts =
    monthlyBudgetUsd === null
      ? []
      : allowedPlatforms.flatMap((platform) => {
          const minimum = SOP_PLATFORM_MINIMUMS[platform];
          return monthlyBudgetUsd < minimum
            ? [
                `Brief budget ${formatUsd(monthlyBudgetUsd)}/mo is below the SOP platform minimum for ${PLATFORM_LABELS[platform]} (${formatUsd(minimum)}/mo). The plan must stage entry or recommend the raise explicitly — never resolve this by moving spend to a forbidden platform.`,
              ]
            : [];
        });

  return {
    acvBand: band,
    acvSignal: signal,
    allowedPlatforms,
    forbiddenPlatforms,
    platformMinimumsMonthlyUsd: SOP_PLATFORM_MINIMUMS,
    monthlyBudgetUsd,
    budgetConflicts,
    constrained: true,
  };
}

// Platform fingerprints. The platform field is checked against name patterns;
// audience slots also check Meta-native mechanism names (Advantage+, Lookalike)
// because a "LinkedIn" plan whose audiences are Meta mechanisms is still a
// Meta plan wearing a LinkedIn title.
const PLATFORM_NAME_PATTERNS: Record<AdPlatform, RegExp> = {
  meta: /\bmeta\b|facebook|instagram/i,
  google: /\bgoogle\b|youtube|performance\s*max|\bpmax\b/i,
  linkedin: /linked\s*in/i,
};

const META_MECHANISM_PATTERN =
  /advantage\+|\blookalike\b|facebook|instagram|\bmeta\b/i;

const PLATFORM_MINIMUM_TOKEN = "platform minimum";

export interface PaidMediaPolicyCheckBody {
  campaignOverview?: { platform?: unknown; prose?: unknown };
  audienceTypes?: readonly { archetype?: unknown; detail?: unknown }[];
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Post-draft channel-policy gate for the paid-media section. Returns
 * self-explanatory error strings (they double as repair instructions).
 */
export function checkPaidMediaChannelPolicy({
  body,
  policy,
}: {
  body: PaidMediaPolicyCheckBody;
  policy: ChannelPolicy;
}): string[] {
  if (!policy.constrained) {
    return [];
  }

  const errors: string[] = [];
  const allowedLabel = policy.allowedPlatforms
    .map((platform) => PLATFORM_LABELS[platform])
    .join(" + ");
  const platform = asString(body.campaignOverview?.platform);

  for (const forbidden of policy.forbiddenPlatforms) {
    if (PLATFORM_NAME_PATTERNS[forbidden.platform].test(platform)) {
      errors.push(
        `body.campaignOverview.platform: "${platform}" is on a forbidden platform. ${forbidden.reason} Set the platform to the SOP-allowed set (${allowedLabel}) and rebuild the campaign structure for it.`,
      );
    }
  }

  const namesAllowedPlatform = policy.allowedPlatforms.some((allowed) =>
    PLATFORM_NAME_PATTERNS[allowed].test(platform),
  );
  if (!namesAllowedPlatform && errors.length === 0) {
    errors.push(
      `body.campaignOverview.platform: "${platform}" does not name an SOP-allowed platform. Name the primary platform explicitly from: ${allowedLabel}.`,
    );
  }

  const metaForbidden = policy.forbiddenPlatforms.some(
    (forbidden) => forbidden.platform === "meta",
  );
  for (const [index, audience] of (body.audienceTypes ?? []).entries()) {
    const audienceText = `${asString(audience.archetype)} ${asString(audience.detail)}`;
    if (metaForbidden && META_MECHANISM_PATTERN.test(audienceText)) {
      errors.push(
        `body.audienceTypes[${index}]: "${asString(audience.archetype)}" uses a Meta-native mechanism but the SOP channel policy forbids Meta for this brief (ACV band ${policy.acvBand}). Rebuild this audience slot natively for ${allowedLabel} (LinkedIn: firmographic stack / ABM company list + Predictive Audiences / retargeting; Google: solution-aware search themes / competitor brand terms / PMax retargeting).`,
      );
      continue;
    }
    for (const forbidden of policy.forbiddenPlatforms) {
      if (
        forbidden.platform !== "meta" &&
        PLATFORM_NAME_PATTERNS[forbidden.platform].test(audienceText)
      ) {
        errors.push(
          `body.audienceTypes[${index}]: targets forbidden platform ${PLATFORM_LABELS[forbidden.platform]}. ${forbidden.reason} Rebuild this audience slot for ${allowedLabel}.`,
        );
      }
    }
  }

  if (policy.budgetConflicts.length > 0) {
    const prose = asString(body.campaignOverview?.prose).toLowerCase();
    if (!prose.includes(PLATFORM_MINIMUM_TOKEN)) {
      errors.push(
        `body.campaignOverview.prose: the brief budget conflicts with SOP platform minimums (${policy.budgetConflicts.join(" ")}) but the prose does not surface it. State the conflict explicitly using the literal phrase "platform minimum" and describe the staged-entry or raise recommendation.`,
      );
    }
  }

  return errors;
}

/**
 * Binding prompt block for the paid-media section (returns [] for all other
 * sections). Included by both structured prompt builders, so repair prompts
 * carry it too.
 */
export function buildChannelPolicyPromptLines(
  definition: { sectionOutputSchemaName?: string },
  researchInput: Pick<ResearchInput, "onboarding">,
): string[] {
  if (definition.sectionOutputSchemaName !== "PaidMediaPlanSectionOutput") {
    return [];
  }
  const policy = deriveChannelPolicy(researchInput.onboarding);
  const minimums = (Object.keys(SOP_PLATFORM_MINIMUMS) as AdPlatform[])
    .map(
      (platform) =>
        `${PLATFORM_LABELS[platform]} ${formatUsd(SOP_PLATFORM_MINIMUMS[platform])}/mo`,
    )
    .join(" · ");

  if (!policy.constrained) {
    return [
      "CHANNEL POLICY (Media-Plan SOP):",
      "- The brief does not carry a parseable ACV signal, so no SOP platform branch is binding.",
      `- SOP platform minimums for reference: ${minimums}.`,
      "- Choose the platform from evidence (where the ICP lives, where competitors actually advertise per the ad walls) and justify the choice in campaignOverview.prose. Do not default to Meta out of template habit.",
      "",
    ];
  }

  const allowedLabel = policy.allowedPlatforms
    .map((platform) => PLATFORM_LABELS[platform])
    .join(" + ");

  return [
    "CHANNEL POLICY (Media-Plan SOP — BINDING, validator-enforced):",
    `- ACV band: ${policy.acvBand} (brief signal: ${policy.acvSignal ?? "unknown"}).`,
    `- Allowed platforms for the campaign structure: ${allowedLabel}. Slide 1 platform, every audience slot, and the creative formats live on these platforms only.`,
    ...policy.forbiddenPlatforms.map(
      (forbidden) =>
        `- FORBIDDEN: ${PLATFORM_LABELS[forbidden.platform]} — ${forbidden.reason}`,
    ),
    `- SOP platform minimums: ${minimums}.`,
    ...(policy.monthlyBudgetUsd === null
      ? [
          "- Brief monthly budget is not provided; keep budget strings in the honest not-provided state and still structure platforms per this policy.",
        ]
      : [
          `- Brief monthly budget: ${formatUsd(policy.monthlyBudgetUsd)}/mo.`,
        ]),
    ...policy.budgetConflicts.map((conflict) => `- BUDGET CONFLICT: ${conflict}`),
    ...(policy.budgetConflicts.length > 0
      ? [
          '- Surface every budget conflict in campaignOverview.prose using the literal phrase "platform minimum", structure the phases as a staged entry the budget can actually fund, and put the raise recommendation in channelSuggestions. Never resolve a conflict by moving spend to a forbidden platform.',
        ]
      : []),
    "- Audience archetypes are platform-native: LinkedIn -> 01 Firmographic Stack (industry/size/function/seniority), 02 ABM Company List + Predictive Audiences (honor leadListAvailable), 03 Retargeting (website + engagement). Google -> 01 Solution-aware search themes, 02 Competitor brand terms with comparison copy, 03 PMax/display retargeting. Meta trio (Interest Stack / ABM List + 1% Lookalike / Advantage+) only when Meta is allowed.",
    "",
  ];
}
