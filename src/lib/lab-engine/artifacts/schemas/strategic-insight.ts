import { z } from "zod";

const keyFindingBasisValues = [
  "measured",
  "sourced",
  "benchmark",
  "assumption",
] as const;

type KeyFindingBasis = (typeof keyFindingBasisValues)[number];

// Models drift off the basis enum under load ("verified", "estimated",
// "evidence-gap"...). Snap in code instead of rejecting the section
// (run f3993043: VoC + MarketCategory hard-failed on basis labels).
const keyFindingBasisAliases: Record<string, KeyFindingBasis> = {
  "tool-measured": "measured",
  observed: "measured",
  cited: "sourced",
  verified: "sourced",
  "source-reported": "sourced",
  "industry-benchmark": "benchmark",
  estimate: "assumption",
  estimated: "assumption",
  inferred: "assumption",
  "model-estimated": "assumption",
  "user-supplied": "assumption",
  "client-supplied": "assumption",
  "evidence-gap": "assumption",
  gap: "assumption",
  unknown: "assumption",
};

const keyFindingBasisSchema = z
  .string()
  .transform((value): KeyFindingBasis => {
    const normalized = value.trim().toLowerCase();
    if ((keyFindingBasisValues as readonly string[]).includes(normalized)) {
      return normalized as KeyFindingBasis;
    }
    return keyFindingBasisAliases[normalized] ?? "assumption";
  });

export const evidenceBlockGapSchema = z
  .object({
    summary: z.string().min(1),
    foundCount: z.number().int().nonnegative(),
    // Models emit vestigial gaps (requiredCount: 0) on blocks that have rows;
    // normalize in code instead of rejecting the body (run d838ed4e).
    requiredCount: z.number().int().nonnegative().catch(0),
    sourcingPlan: z.array(z.string().min(1)).catch([]),
  })
  .strict();

// Canonical optional blockGap field: degenerate gaps (requiredCount <= 0)
// are dropped; meaningful gaps always carry a sourcing plan.
export const evidenceBlockGapFieldSchema = evidenceBlockGapSchema
  .nullable()
  .transform((value) => {
    if (value === null || value === undefined || value.requiredCount <= 0) {
      return undefined;
    }
    if (value.sourcingPlan.length === 0) {
      return {
        ...value,
        sourcingPlan: ["Re-run acquisition for this block with verified sources."],
      };
    }
    return value;
  })
  .optional();

// Shared acquisition-sufficiency summary. Attached (optionally) to a section's
// evidenceGapReport so the SaaSLaunch coverage eval and the live-quality gate can read
// ONE deterministic verdict on whether upstream evidence was actually acquired, rather
// than re-deriving it per section. It is a DIAGNOSTIC roll-up of the section's
// acquisition ledger: how many candidate sources were found, how many were promoted
// into the artifact, how many were rejected, and the resulting sufficiency tier.
// IMPORTANT: 'sufficient' is the section's self-report only. Consumers must still apply
// their own floors — a self-reported 'sufficient' must NEVER override a real evidence
// gap. The coverage eval treats only 'insufficient' as load-bearing (an extra
// trip-wire), never as an escape hatch.
export const acquisitionSufficiencySchema = z
  .object({
    tier: z.enum(["sufficient", "partial", "insufficient"]),
    rationale: z.string().min(1),
    candidatesFound: z.number().int().nonnegative(),
    promoted: z.number().int().nonnegative(),
    rejected: z.number().int().nonnegative(),
  })
  .strict();

// Canonical optional sufficiency field. Mirrors evidenceBlockGapFieldSchema's
// nullable -> undefined -> optional collapse so DeepSeek's explicit null fills coerce
// to undefined instead of failing the strict body parse.
export const acquisitionSufficiencyFieldSchema = acquisitionSufficiencySchema
  .nullable()
  .transform((value) => value ?? undefined)
  .optional();

/**
 * Deterministic acquisition-sufficiency roll-up (Wave 2B). A pure tally of an
 * acquisition ledger's promotionStatus values plus section floors -> tier. No
 * LLM, no fabrication: zero promoted is ALWAYS "insufficient", and "sufficient"
 * is reached ONLY by clearing an absolute floor (the promoted count, or an
 * optional independent-domain floor) — never by a promotion ratio, so a thin
 * pack can never launder itself up. Mirrors the AGENTS.md upstream-sufficiency
 * iron law: only "insufficient" is load-bearing downstream; "sufficient" is the
 * section's self-report and must never clear a real evidence floor.
 *
 * candidatesFound = promoted + rejected (rows representing a classified
 * candidate). "not_applicable" attempt rows are excluded from every tally.
 */
export function computeAcquisitionSufficiency(
  rows: ReadonlyArray<{
    promotionStatus: "promoted" | "rejected" | "not_applicable";
    domain?: string | null;
  }>,
  {
    promotedFloor,
    promotedDomainFloor,
  }: { promotedFloor: number; promotedDomainFloor?: number },
): AcquisitionSufficiency {
  const promotedRows = rows.filter((row) => row.promotionStatus === "promoted");
  const promoted = promotedRows.length;
  const rejected = rows.filter(
    (row) => row.promotionStatus === "rejected",
  ).length;
  const candidatesFound = promoted + rejected;

  if (promoted === 0) {
    return {
      tier: "insufficient",
      rationale: "Zero candidates were promoted; evidence acquisition failed.",
      candidatesFound,
      promoted,
      rejected,
    };
  }

  const promotedDomains = new Set(
    promotedRows
      .map((row) => (row.domain ?? "").trim().toLowerCase())
      .filter((domain) => domain.length > 0),
  ).size;
  const meetsAbsoluteFloor =
    promoted >= promotedFloor ||
    (promotedDomainFloor !== undefined && promotedDomains >= promotedDomainFloor);

  if (meetsAbsoluteFloor) {
    return {
      tier: "sufficient",
      rationale: `${promoted} of ${candidatesFound} candidate(s) promoted cleared the sufficiency floor.`,
      candidatesFound,
      promoted,
      rejected,
    };
  }

  return {
    tier: "partial",
    rationale: `${promoted} of ${candidatesFound} candidate(s) promoted; below the sufficiency floor but above zero.`,
    candidatesFound,
    promoted,
    rejected,
  };
}

export const keyFindingSchema = z
  .object({
    finding: z.string().min(1),
    basis: keyFindingBasisSchema,
    sourceUrls: z.array(z.string().url()),
  })
  .strict()
  .superRefine((finding, context) => {
    if (finding.basis !== "assumption" && finding.sourceUrls.length === 0) {
      context.addIssue({
        code: "custom",
        message:
          "sourceUrls may be empty only when basis is assumption.",
        path: ["sourceUrls"],
      });
    }
  });

export const keyFindingsSchema = z.array(keyFindingSchema).min(1).max(6);

export const keyTensionSchema = z
  .object({
    tension: z.string().min(1),
    side: z.string().min(1),
    costOfPosition: z.string().min(1),
  })
  .strict();

export const strategicInsightSchema = z
  .object({
    strategicVerdict: z.string().min(1),
    nonObviousRead: z.string().min(1).nullable().transform((value) => value ?? undefined).optional(),
    secondOrderImplication: z.string().min(1).nullable().transform((value) => value ?? undefined).optional(),
    keyTension: keyTensionSchema,
  })
  .strict();

export const categoryPowerBetSchema = z
  .object({
    bet: z.string().min(1),
    whyNow: z.string().min(1),
    riskAccepted: z.string().min(1),
  })
  .strict();

export const whereToAttackVsConcedeSchema = z
  .object({
    attack: z.string().min(1),
    concede: z.string().min(1),
    rationale: z.string().min(1),
  })
  .strict();

export const incumbentBlindSpotSchema = z
  .object({
    incumbent: z.string().min(1),
    blindSpot: z.string().min(1),
    whyTheyMissIt: z.string().min(1),
  })
  .strict();

export const fourForcesBalanceVerdictSchema = z
  .object({
    push: z.string().min(1),
    pull: z.string().min(1),
    anxiety: z.string().min(1),
    habit: z.string().min(1),
    balanceVerdict: z.string().min(1),
  })
  .strict();

export const orderedStrategicMoveSchema = z
  .object({
    rank: z.number().int().positive(),
    move: z.string().min(1),
    dependsOn: z.array(z.number().int().positive()),
    rationale: z.string().min(1),
  })
  .strict();

export const provesWrongIfSchema = z
  .object({
    metric: z.string().min(1),
    threshold: z.string().min(1),
    window: z.string().min(1),
  })
  .strict();

export const bindingConstraintSchema = z
  .object({
    constraint: z.string().min(1),
    whyBinding: z.string().min(1),
    unlockCondition: z.string().min(1),
  })
  .strict();

export type StrategicInsight = z.infer<typeof strategicInsightSchema>;
export type EvidenceBlockGap = z.infer<typeof evidenceBlockGapSchema>;
export type AcquisitionSufficiency = z.infer<typeof acquisitionSufficiencySchema>;
export type KeyFinding = z.infer<typeof keyFindingSchema>;
export type OrderedStrategicMove = z.infer<typeof orderedStrategicMoveSchema>;
export type ProvesWrongIf = z.infer<typeof provesWrongIfSchema>;

interface StrategicTextValidationOptions {
  comparisonTexts?: readonly string[];
}

const vacuousTextPattern =
  /\b(?:summary|summarizes|this section|generic strategy|strategic opportunity|improve messaging|better positioning|clearer narrative|drive growth|increase conversion|optimize funnel|win buyers|focus on the (?:right|best|most important)|differentiate (?:itself|the company))\b/i;
const stopWords = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

function isEvidenceGap(value: string): boolean {
  return /^evidence\s+gap:/i.test(value.trim());
}

function normalizeForComparison(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function contentTokens(value: string): string[] {
  return normalizeForComparison(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !stopWords.has(token));
}

function tokenOverlapRatio(a: string, b: string): number {
  const aTokens = new Set(contentTokens(a));
  const bTokens = new Set(contentTokens(b));

  if (aTokens.size === 0 || bTokens.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) {
      overlap += 1;
    }
  }

  return overlap / Math.min(aTokens.size, bTokens.size);
}

function isNearDuplicateOfComparison(
  value: string,
  comparisonTexts: readonly string[] | undefined,
): boolean {
  const normalizedValue = normalizeForComparison(value);

  return (comparisonTexts ?? []).some((comparisonText) => {
    const normalizedComparison = normalizeForComparison(comparisonText);

    if (
      normalizedValue.length > 0 &&
      (normalizedComparison === normalizedValue ||
        normalizedComparison.includes(normalizedValue) ||
        normalizedValue.includes(normalizedComparison))
    ) {
      return true;
    }

    return tokenOverlapRatio(value, comparisonText) >= 0.82;
  });
}

function isStrategicText(
  value: string,
  options: StrategicTextValidationOptions = {},
): boolean {
  const trimmed = value.trim();

  if (isEvidenceGap(trimmed)) {
    return true;
  }

  return (
    trimmed.length >= 32 &&
    !vacuousTextPattern.test(trimmed) &&
    !isNearDuplicateOfComparison(trimmed, options.comparisonTexts)
  );
}

function isFalsifiabilityText(value: string): boolean {
  const trimmed = value.trim();

  if (isEvidenceGap(trimmed)) {
    return true;
  }

  return (
    trimmed.length >= 2 &&
    !/^(?:unknown|not disclosed|n\/a|none)$/i.test(trimmed)
  );
}

export function validateStrategicText(
  errors: string[],
  path: string,
  value: string,
  options: StrategicTextValidationOptions = {},
): void {
  if (!isStrategicText(value, options)) {
    errors.push(
      `${path}: must be a specific strategic judgment or write exactly \`evidence gap: <missing signal>\`, not a summary/restatement. Do not satisfy "specific" with numbers that are not in fetched evidence - unsupported numeric precision is treated as fabrication.`,
    );
  }
}

export function validateStrategicInsightMinimums(
  errors: string[],
  path: string,
  insight: StrategicInsight,
  options: StrategicTextValidationOptions = {},
): void {
  const entries: Array<{ key: string; value: string }> = [
    { key: "strategicVerdict", value: insight.strategicVerdict },
    { key: "keyTension.tension", value: insight.keyTension.tension },
    { key: "keyTension.side", value: insight.keyTension.side },
    {
      key: "keyTension.costOfPosition",
      value: insight.keyTension.costOfPosition,
    },
  ];
  if (insight.nonObviousRead !== undefined) {
    entries.push({ key: "nonObviousRead", value: insight.nonObviousRead });
  }
  if (insight.secondOrderImplication !== undefined) {
    entries.push({
      key: "secondOrderImplication",
      value: insight.secondOrderImplication,
    });
  }
  const observed = new Map<string, string>();

  entries.forEach(({ key, value }) => {
    const normalized = normalizeForComparison(value);

    if (observed.has(normalized)) {
      // Evidence gaps get NO duplication exemption: a shared gap is stated
      // ONCE, in the field it most affects — a repeated gap line is filler.
      errors.push(
        isEvidenceGap(value)
          ? `${path}.${key}: repeats the evidence gap already stated in ${path}.${observed.get(normalized)}; state a shared gap once, in the field it most affects, and make this field a distinct judgment.`
          : `${path}.${key}: duplicates ${path}.${observed.get(normalized)}; strategic fields must make distinct judgments.`,
      );
      return;
    }

    observed.set(normalized, key);
  });

  validateStrategicText(
    errors,
    `${path}.strategicVerdict`,
    insight.strategicVerdict,
    options,
  );
  if (insight.nonObviousRead !== undefined) {
    validateStrategicText(
      errors,
      `${path}.nonObviousRead`,
      insight.nonObviousRead,
      options,
    );
  }
  if (insight.secondOrderImplication !== undefined) {
    validateStrategicText(
      errors,
      `${path}.secondOrderImplication`,
      insight.secondOrderImplication,
      options,
    );
  }
  validateStrategicText(
    errors,
    `${path}.keyTension.tension`,
    insight.keyTension.tension,
    options,
  );
  validateStrategicText(
    errors,
    `${path}.keyTension.side`,
    insight.keyTension.side,
    options,
  );
  validateStrategicText(
    errors,
    `${path}.keyTension.costOfPosition`,
    insight.keyTension.costOfPosition,
    options,
  );
}

export function validateOrderedStrategicMovesMinimums(
  errors: string[],
  path: string,
  moves: readonly OrderedStrategicMove[],
): void {
  if (moves.length < 2) {
    errors.push(`${path}: have ${moves.length}, need >=2 sequenced moves.`);
  }

  const ranks = moves.map((move) => move.rank);
  const sortedRanks = [...ranks].sort((a, b) => a - b);
  const duplicateRanks = ranks.filter(
    (rank, index) => ranks.indexOf(rank) !== index,
  );

  if (duplicateRanks.length > 0) {
    errors.push(`${path}: duplicate rank values ${Array.from(new Set(duplicateRanks)).join(", ")}.`);
  }
  sortedRanks.forEach((rank, index) => {
    const expectedRank = index + 1;

    if (rank !== expectedRank) {
      errors.push(`${path}: ranks must be consecutive starting at 1.`);
    }
  });

  moves.forEach((move, index) => {
    validateStrategicText(errors, `${path}[${index}].move`, move.move);
    validateStrategicText(errors, `${path}[${index}].rationale`, move.rationale);

    if (move.rank === 1 && move.dependsOn.length > 0) {
      errors.push(`${path}[${index}].dependsOn: first-ranked move must not depend on another move.`);
    }

    const invalidDependencies = move.dependsOn.filter(
      (dependency) => dependency >= move.rank || !ranks.includes(dependency),
    );
    if (invalidDependencies.length > 0) {
      errors.push(
        `${path}[${index}].dependsOn: dependencies must reference lower existing ranks.`,
      );
    }
  });
}

export function validateProvesWrongIfMinimums(
  errors: string[],
  path: string,
  provesWrongIf: ProvesWrongIf,
): void {
  for (const [key, value] of Object.entries(provesWrongIf)) {
    if (!isFalsifiabilityText(value)) {
      errors.push(
        `${path}.${key}: must be a concrete falsifiability ${key} or explicit evidence gap.`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Phase 1 — Evidence-tier primitives (context-engineering redesign §4.1–4.5).
//
// Pure ADDITIONS consumed by nobody yet (BuyerICP pilot wires them in Phase 3).
// They model the five real data types the tools deliver so the verifier can
// DOWNGRADE instead of DELETE. Optional/additive — no existing schema changes.
// ---------------------------------------------------------------------------

// §4.1 — the core new primitive. The tier a row declares decides whether it is
// re-fetch-gated (only hard_evidence is) and whether it requires a source.
export const evidenceTierSchema = z.enum([
  "hard_evidence", // live URL + verbatim quote/number on the page; the ONLY tier re-fetch-gated
  "directional_signal", // real source, weaker provenance; kept + labelled, never auto-stripped
  "strategic_inference", // analyst synthesis; NO citation required; validated on reasoning
  "operator_input", // value from the operator brief; labelled as input, never a finding
]);
export type EvidenceTier = z.infer<typeof evidenceTierSchema>;

// §4.2 — the evidence-meta mixin (every block row gets this).
export const evidenceSourceSchema = z.object({
  url: z.string().url(),
  quote: z.string().min(1), // verbatim supporting text
  retrievedVia: z.string().min(1), // firecrawl | spyfu | searchapi | review-scraper | corpus | ad-library
});

// Written by the VERIFIER after authoring — never by the model.
export const rowVerificationSchema = z
  .object({
    reach: z.enum(["contained", "uncontained", "unreachable", "not_checked"]),
    //  contained   = re-fetch confirmed the claim on the page
    //  uncontained = re-fetch succeeded, text lacked the claim (JS-render OR genuine mismatch)
    //  unreachable = re-fetch failed/redirected/empty shell — NOT evidence of falsity
    outcome: z.enum(["verified", "downgraded", "refuted"]),
    method: z.string().min(1),
    note: z.string().optional(),
  })
  .optional();

export const evidenceMetaSchema = z.object({
  tier: evidenceTierSchema,
  source: evidenceSourceSchema.nullable(), // required for hard/directional; null for inference/operator
  derivedFrom: z.string().min(1).optional(), // required for strategic_inference: what it reasons from
  verification: rowVerificationSchema,
});

// Wrap any section-specific row payload. One refinement enforces tier↔source.
// The merge always carries the evidenceMeta keys; the generic shape `T` loses
// the literal property types through the merge, so the refinement reads `row`
// via the known EvidenceMeta shape.
export function withEvidenceMeta<T extends z.ZodRawShape>(
  payload: z.ZodObject<T>,
) {
  return payload.merge(evidenceMetaSchema).superRefine((value, ctx) => {
    const row = value as unknown as EvidenceMeta;
    const needsSource =
      row.tier === "hard_evidence" || row.tier === "directional_signal";
    if (needsSource && row.source === null)
      ctx.addIssue({
        code: "custom",
        message: `${row.tier} requires source {url, quote}`,
      });
    if (row.tier === "strategic_inference" && !row.derivedFrom)
      ctx.addIssue({
        code: "custom",
        message: "strategic_inference requires derivedFrom",
      });
    if (row.tier === "operator_input" && row.source !== null)
      ctx.addIssue({
        code: "custom",
        message: "operator_input must not carry a source",
      });
  });
}

// §4.3 — first-class gap + stripped states (no more identical boilerplate).
export const acquisitionGapSchema = z.object({
  whatWasSought: z.string().min(1),
  reason: z.enum(["no_tool_wired", "tool_returned_empty", "not_applicable"]),
  surfacesQueried: z.array(z.string()).default([]),
  sourcingPlan: z.array(z.string().min(1)).min(1),
});

// Verifier-written: what was removed and WHY, so the reader sees the loss.
export const strippedRowSchema = z.object({
  summary: z.string().min(1), // what the row claimed
  originalTier: evidenceTierSchema,
  droppedReason: z.string().min(1), // containment-mismatch | http-404 | unreachable
  sourceUrl: z.string().optional(),
});

// §4.4 — the coverage block (replaces count-floor + blockGap).
export const blockCoverageSchema = z.object({
  byTier: z.object({
    hard_evidence: z.number().int().nonnegative(),
    directional_signal: z.number().int().nonnegative(),
    strategic_inference: z.number().int().nonnegative(),
    operator_input: z.number().int().nonnegative(),
  }),
  acquisitionGaps: z.array(acquisitionGapSchema).default([]),
  strippedByVerifier: z.array(strippedRowSchema).default([]), // verifier-written
  readiness: z.enum(["rich", "adequate", "thin", "gap"]), // honest self-report
});

export function coverageBlock<T extends z.ZodRawShape>(
  rowPayload: z.ZodObject<T>,
) {
  return z.object({
    prose: z.string().min(1),
    rows: z.array(withEvidenceMeta(rowPayload)), // MAY be empty when coverage explains why
    coverage: blockCoverageSchema,
  });
}

export type EvidenceSource = z.infer<typeof evidenceSourceSchema>;
export type RowVerification = z.infer<typeof rowVerificationSchema>;
export type EvidenceMeta = z.infer<typeof evidenceMetaSchema>;
export type AcquisitionGap = z.infer<typeof acquisitionGapSchema>;
export type StrippedRow = z.infer<typeof strippedRowSchema>;
export type BlockCoverage = z.infer<typeof blockCoverageSchema>;
