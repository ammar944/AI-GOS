// W5 tool-evidence provenance bridge — competitor ad wall.
//
// The competitor body's adPresence/evidence strings cite figures the wall
// builder measured deterministically ("28 displayable creatives (13 Google,
// 15 Meta)", verifiedCount=0, ad detail URLs). Those numbers exist only in
// CompetitorAdEvidenceGroup metadata — never verbatim in any per-platform
// probe toolResult — so the structural verifier flags honest, tool-measured
// claims as unsupported (run 1d0a4831: every wall sourceAttribution claim was
// no_match). This module renders the SAME groups the body was built from into
// ONE synthetic verifier-only AgentStep so honest wall copy verifies and
// invented counts still fail.
//
// Verifier-only by construction: the step is appended in
// buildVerifierEvidenceSteps (run-section.ts), never into model context.

import type { CompetitorAdEvidenceGroup } from "../artifacts/schemas/competitor-landscape";
import type { AgentStep } from "./section-agent";

export const AD_EVIDENCE_WALL_DIGEST_TOOL_NAME = "ad_evidence_wall_digest";

const maxHooksPerAdvertiser = 12;

const platformLabels: Record<string, string> = {
  google: "Google",
  linkedin: "LinkedIn",
  meta: "Meta",
};

function formatPlatformCounts(
  counts: CompetitorAdEvidenceGroup["displayableCounts"],
): string {
  const parts = Object.entries(counts)
    .filter(([, count]) => typeof count === "number" && count > 0)
    .map(([platform, count]) => `${count} ${platformLabels[platform] ?? platform}`);

  return parts.length === 0 ? "" : ` (${parts.join(", ")})`;
}

function collectAdvertiserHooks(
  group: CompetitorAdEvidenceGroup,
): readonly string[] {
  const seen = new Set<string>();
  const hooks: string[] = [];

  for (const creative of group.creatives) {
    const headline = creative.headline?.trim();

    if (headline === undefined || headline.length === 0) {
      continue;
    }

    const key = headline.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    hooks.push(headline);

    if (hooks.length >= maxHooksPerAdvertiser) {
      break;
    }
  }

  return hooks;
}

function collectAdvertiserUrls(
  group: CompetitorAdEvidenceGroup,
): readonly string[] {
  const urls = new Set<string>();

  for (const creative of group.creatives) {
    urls.add(creative.sourceUrl);

    if (creative.detailsUrl !== null) {
      urls.add(creative.detailsUrl);
    }
  }

  for (const link of Object.values(group.libraryLinks)) {
    if (typeof link === "string" && link.length > 0) {
      urls.add(link);
    }
  }

  return Array.from(urls);
}

function buildAdvertiserDigest(group: CompetitorAdEvidenceGroup): {
  advertiser: string;
  digest: string;
  hooks: readonly string[];
  urls: readonly string[];
  dataGaps: readonly string[];
  sourceErrors: readonly string[];
} {
  const domainText = group.domain === null ? "" : ` (${group.domain})`;
  const countsText = formatPlatformCounts(group.displayableCounts);
  const hooks = collectAdvertiserHooks(group);
  // Body copy cites hooks as `Top hook: '...'` — keep the label in the digest
  // line so the claim's leading "Top" entity finds source text to match.
  const hooksText =
    hooks.length === 0
      ? ""
      : `; top hooks: ${hooks.map((hook) => `"${hook}"`).join(" | ")}`;
  const digest =
    `${group.advertiserName}${domainText} — ${group.displayableTotal} displayable ` +
    `creatives${countsText}; returned ${group.returnedCreativeCount}; ` +
    `verifiedCount=${group.verifiedCount ?? 0}; ` +
    `quarantinedCount=${group.quarantinedCount ?? 0}; ` +
    `identityConfidence=${group.identityConfidence ?? "unknown"}; ` +
    `observed ${group.observedAt}${hooksText}`;

  return {
    advertiser: group.advertiserName,
    digest,
    hooks,
    urls: collectAdvertiserUrls(group),
    dataGaps: group.dataGaps.map((gap) => gap.reason),
    sourceErrors: group.sourceErrors.map(
      (error) => `${error.platform}: ${error.message}`,
    ),
  };
}

export function buildAdEvidenceWallDigestStep(
  groups: readonly CompetitorAdEvidenceGroup[],
): AgentStep | undefined {
  if (groups.length === 0) {
    return undefined;
  }

  return {
    stepNumber: 0,
    finishReason: "synthetic",
    text: "",
    toolCalls: [],
    toolResults: [
      {
        toolName: AD_EVIDENCE_WALL_DIGEST_TOOL_NAME,
        type: "tool-result",
        output: {
          type: "result",
          source: "deterministic ad evidence wall",
          advertisers: groups.map((group) => buildAdvertiserDigest(group)),
        },
      },
    ],
  };
}
