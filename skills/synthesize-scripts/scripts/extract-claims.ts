import type { SourcedClaim } from "../schemas/output.ts";
import type { SynthesizeScriptsInput, UpstreamArtifact } from "../schemas/input.ts";

export interface ExtractedClaim extends SourcedClaim {
  skill: SourcedClaim["category"] extends string ? string : string;
}

const REQUIRED_UPSTREAM_KEYS = [
  "research-voc",
  "research-icp",
  "research-offer",
  "synthesize-positioning",
] as const;

const OPTIONAL_UPSTREAM_KEYS = [
  "synthesize-media-plan",
  "research-competitor",
  "research-keywords",
] as const;

function withSourcePath(claim: SourcedClaim, sourcePath: string): SourcedClaim {
  return {
    ...claim,
    source_path: claim.source_path ?? sourcePath,
  };
}

function claimsFromArtifact(key: string, artifact: UpstreamArtifact): SourcedClaim[] {
  return artifact.claims.map((claim, index) =>
    withSourcePath(claim, `${key}.claims.${index}`),
  );
}

function dedupeClaims(claims: SourcedClaim[]): SourcedClaim[] {
  const seen = new Set<string>();
  return claims.filter((claim) => {
    const key = `${claim.claim.toLowerCase()}|${claim.source_url}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function extractClaims(input: SynthesizeScriptsInput): SourcedClaim[] {
  const briefClaims = [
    ...input.locked_brief.fields.claims.map((claim, index) =>
      withSourcePath(claim, `locked_brief.fields.claims.${index}`),
    ),
    ...input.locked_brief.fields.metrics.map((claim, index) =>
      withSourcePath(claim, `locked_brief.fields.metrics.${index}`),
    ),
    ...input.locked_brief.fields.testimonials.map((claim, index) =>
      withSourcePath(claim, `locked_brief.fields.testimonials.${index}`),
    ),
    ...input.locked_brief.fields.caseStudies.map((claim, index) =>
      withSourcePath(claim, `locked_brief.fields.caseStudies.${index}`),
    ),
  ];

  const requiredClaims = REQUIRED_UPSTREAM_KEYS.flatMap((key) =>
    claimsFromArtifact(key, input.upstream_outputs[key]),
  );

  const optionalClaims = OPTIONAL_UPSTREAM_KEYS.flatMap((key) => {
    const artifact = input.upstream_outputs[key];
    return artifact ? claimsFromArtifact(key, artifact) : [];
  });

  return dedupeClaims([...briefClaims, ...requiredClaims, ...optionalClaims]);
}

export function competitorHooks(input: SynthesizeScriptsInput): string[] {
  const artifact = input.upstream_outputs["research-competitor"];
  if (!artifact) {
    return [];
  }
  return artifact.claims
    .filter((claim) => claim.category === "competitor-hook")
    .map((claim) => claim.claim);
}
