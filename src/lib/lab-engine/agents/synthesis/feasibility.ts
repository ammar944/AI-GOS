import type {
  FactLedger,
  KeywordMetric,
} from "./fact-ledger";

export interface NumberRange {
  min: number;
  max: number;
  basis: string;
}

export interface SpendCeiling {
  min: number;
  max: number;
  basis: string;
}

export type FeasibilityVerdict = "fits" | "exceeds" | "unknown";

export interface FunnelClosure {
  clicks: NumberRange;
  conversions: NumberRange;
  costPerConversion: NumberRange;
  breakEvenConversionRate?: number;
  basis: string;
}

export interface AudienceFeasibilityVerdict {
  audience: string;
  allocation?: number;
  allocationBasis: string;
  measuredVolume?: number;
  volumeBasis: string;
  cpcRange?: NumberRange;
  ctrRange?: NumberRange;
  cvrRange?: NumberRange;
  ceiling?: SpendCeiling;
  targetCostPerConversion?: number;
  verdict: FeasibilityVerdict;
  math: string[];
  matchedKeywords: Array<{
    keyword: string;
    monthlyVolume: number;
    cpc?: number;
  }>;
}

export interface PaidMediaFeasibilityAudit {
  verdicts: AudienceFeasibilityVerdict[];
  summary: string;
}

interface AuditPaidMediaFeasibilityParams {
  paidMediaBody: Record<string, unknown> | undefined;
  factLedger: FactLedger;
}

const searchCtrBenchmark: NumberRange = {
  basis: "benchmark search CTR range",
  max: 0.08,
  min: 0.02,
};

const searchCpcBenchmark: NumberRange = {
  basis: "benchmark search CPC range because measured CPC is missing",
  max: 12,
  min: 5,
};

const defaultCvrBenchmark: NumberRange = {
  basis: "benchmark click-to-conversion range",
  max: 0.04,
  min: 0.01,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];

  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function getNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];

  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function parseMoney(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const match = /\$?\s*(\d[\d,]*(?:\.\d+)?)/.exec(value);

  if (match === null) {
    return undefined;
  }

  const parsed = Number.parseFloat(match[1].replace(/,/g, ""));

  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseDailyBudget(value: string | undefined): number | undefined {
  const amount = parseMoney(value);

  if (amount === undefined) {
    return undefined;
  }

  return /\/\s*(?:day|daily)|per\s+day/i.test(value ?? "")
    ? amount * 30
    : amount;
}

function quotedPhrases(value: string): string[] {
  const phrases: string[] = [];
  const pattern = /['"]([^'"]+)['"]/g;
  let match = pattern.exec(value);

  while (match !== null) {
    phrases.push(match[1].toLowerCase());
    match = pattern.exec(value);
  }

  return phrases;
}

function normalizeKeyword(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function audienceKeywords({
  audience,
  keywordMetrics,
}: {
  audience: Record<string, unknown>;
  keywordMetrics: readonly KeywordMetric[];
}): KeywordMetric[] {
  const text = [
    getString(audience, "archetype"),
    getString(audience, "detail"),
    getString(audience, "grounding"),
  ]
    .filter((value): value is string => value !== undefined)
    .join("\n")
    .toLowerCase();
  const quoted = quotedPhrases(text);

  return keywordMetrics.filter((metric) => {
    const keyword = normalizeKeyword(metric.keyword);

    if (quoted.includes(keyword)) {
      return true;
    }

    if (keyword.split(" ").length === 1) {
      return false;
    }

    return text.includes(keyword);
  });
}

function parseVolumeFromText(value: string): number | undefined {
  const match = /(?:~|about|combined)?\s*(\d[\d,]*)\s*\/?\s*(?:mo|month|monthly)?\s+search/i.exec(
    value,
  );

  if (match === null) {
    return undefined;
  }

  const parsed = Number.parseFloat(match[1].replace(/,/g, ""));

  return Number.isFinite(parsed) ? parsed : undefined;
}

function measuredVolumeForAudience({
  audience,
  matchedKeywords,
}: {
  audience: Record<string, unknown>;
  matchedKeywords: readonly KeywordMetric[];
}): { basis: string; volume?: number } {
  const grounding = getString(audience, "grounding");
  const detail = getString(audience, "detail");
  const parsed =
    parseVolumeFromText(grounding ?? "") ?? parseVolumeFromText(detail ?? "");

  if (parsed !== undefined) {
    return { basis: "stated audience grounding volume", volume: parsed };
  }

  if (matchedKeywords.length > 0) {
    return {
      basis: "sum of matched demand-intent keyword rows",
      volume: matchedKeywords.reduce(
        (sum, metric) => sum + metric.monthlyVolume,
        0,
      ),
    };
  }

  return { basis: "missing measured keyword volume" };
}

function cpcRangeForKeywords(metrics: readonly KeywordMetric[]): NumberRange {
  const cpcs = metrics
    .map((metric) => metric.cpc)
    .filter((value): value is number => value !== undefined && value > 0);

  if (cpcs.length === 0) {
    return searchCpcBenchmark;
  }

  return {
    basis: "measured keyword CPC range",
    max: Math.max(...cpcs),
    min: Math.min(...cpcs),
  };
}

export function maxAbsorbableSpend({
  cpcRange,
  ctrRange,
  volume,
}: {
  volume: number;
  ctrRange: NumberRange;
  cpcRange: NumberRange;
}): SpendCeiling {
  return {
    basis: `${volume.toLocaleString("en-US")} monthly searches x ${Math.round(ctrRange.min * 100)}-${Math.round(ctrRange.max * 100)}% CTR x $${cpcRange.min}-$${cpcRange.max} CPC`,
    max: volume * ctrRange.max * cpcRange.max,
    min: volume * ctrRange.min * cpcRange.min,
  };
}

export function closeFunnelMath({
  allocation,
  cpcRange,
  cvrRange = defaultCvrBenchmark,
  targetCostPerConversion,
}: {
  allocation: number;
  cpcRange: NumberRange;
  cvrRange?: NumberRange;
  targetCostPerConversion?: number;
}): FunnelClosure {
  const clicks: NumberRange = {
    basis: `${allocation.toLocaleString("en-US")} allocation / ${cpcRange.basis}`,
    max: allocation / cpcRange.min,
    min: allocation / cpcRange.max,
  };
  const conversions: NumberRange = {
    basis: `${clicks.min.toFixed(1)}-${clicks.max.toFixed(1)} clicks x ${cvrRange.basis}`,
    max: clicks.max * cvrRange.max,
    min: clicks.min * cvrRange.min,
  };
  const costPerConversion: NumberRange = {
    basis: `${allocation.toLocaleString("en-US")} allocation / conversion range`,
    max: conversions.min > 0 ? allocation / conversions.min : Number.POSITIVE_INFINITY,
    min: conversions.max > 0 ? allocation / conversions.max : Number.POSITIVE_INFINITY,
  };

  return {
    basis: "budget to clicks to conversions closure",
    ...(targetCostPerConversion === undefined
      ? {}
      : { breakEvenConversionRate: cpcRange.max / targetCostPerConversion }),
    clicks,
    conversions,
    costPerConversion,
  };
}

function targetCostFromProjectedResults(
  paidMediaBody: Record<string, unknown>,
): number | undefined {
  const projectedResults = Array.isArray(paidMediaBody.projectedResults)
    ? paidMediaBody.projectedResults
    : [];
  const first = projectedResults.find(isRecord);

  return first === undefined ? undefined : getNumber(first, "kpiCostValue");
}

function monthlyAllocationForAudience(
  audience: Record<string, unknown>,
): number | undefined {
  const monthlyBudgetValue = getNumber(audience, "monthlyBudgetValue");

  if (monthlyBudgetValue !== undefined) {
    return monthlyBudgetValue;
  }

  const dailyBudgetValue = getNumber(audience, "dailyBudgetValue");

  if (dailyBudgetValue !== undefined) {
    return dailyBudgetValue * 30;
  }

  return parseDailyBudget(getString(audience, "dailyBudget"));
}

function buildMathLines({
  allocation,
  ceiling,
  cpcRange,
  closure,
  ctrRange,
  measuredVolume,
  targetCostPerConversion,
}: {
  allocation?: number;
  ceiling?: SpendCeiling;
  cpcRange?: NumberRange;
  closure?: FunnelClosure;
  ctrRange?: NumberRange;
  measuredVolume?: number;
  targetCostPerConversion?: number;
}): string[] {
  const lines: string[] = [];

  if (measuredVolume !== undefined && ctrRange !== undefined && cpcRange !== undefined) {
    lines.push(
      `ceiling = ${measuredVolume.toLocaleString("en-US")} volume x ${(ctrRange.min * 100).toFixed(1)}-${(ctrRange.max * 100).toFixed(1)}% CTR x $${cpcRange.min}-$${cpcRange.max} CPC`,
    );
  }

  if (allocation !== undefined && ceiling !== undefined) {
    lines.push(
      `allocation $${allocation.toLocaleString("en-US")}/mo vs ceiling $${Math.round(ceiling.max).toLocaleString("en-US")}/mo`,
    );
  }

  if (closure !== undefined) {
    lines.push(
      `clicks ${closure.clicks.min.toFixed(1)}-${closure.clicks.max.toFixed(1)} -> conversions ${closure.conversions.min.toFixed(1)}-${closure.conversions.max.toFixed(1)} -> cost/conversion $${Math.round(closure.costPerConversion.min).toLocaleString("en-US")}-$${Math.round(closure.costPerConversion.max).toLocaleString("en-US")}`,
    );
  }

  if (
    targetCostPerConversion !== undefined &&
    closure?.breakEvenConversionRate !== undefined
  ) {
    lines.push(
      `break-even conversion rate at target $${targetCostPerConversion.toLocaleString("en-US")} = ${(closure.breakEvenConversionRate * 100).toFixed(1)}%`,
    );
  }

  return lines;
}

function verdictForAllocation({
  allocation,
  ceiling,
  measuredVolume,
}: {
  allocation?: number;
  ceiling?: SpendCeiling;
  measuredVolume?: number;
}): FeasibilityVerdict {
  if (
    allocation === undefined ||
    ceiling === undefined ||
    measuredVolume === undefined
  ) {
    return "unknown";
  }

  return allocation > ceiling.max ? "exceeds" : "fits";
}

export function auditPaidMediaFeasibility({
  factLedger,
  paidMediaBody,
}: AuditPaidMediaFeasibilityParams): PaidMediaFeasibilityAudit {
  if (paidMediaBody === undefined) {
    return {
      summary: "Paid-media body missing; feasibility audit could not run.",
      verdicts: [],
    };
  }

  const audienceTypes = Array.isArray(paidMediaBody.audienceTypes)
    ? paidMediaBody.audienceTypes.filter(isRecord)
    : [];
  const targetCostPerConversion = targetCostFromProjectedResults(paidMediaBody);
  const verdicts = audienceTypes.map((audience): AudienceFeasibilityVerdict => {
    const matchedKeywords = audienceKeywords({
      audience,
      keywordMetrics: factLedger.keywordMetrics,
    });
    const volume = measuredVolumeForAudience({ audience, matchedKeywords });
    const allocation = monthlyAllocationForAudience(audience);
    const cpcRange =
      volume.volume === undefined ? undefined : cpcRangeForKeywords(matchedKeywords);
    const ctrRange = volume.volume === undefined ? undefined : searchCtrBenchmark;
    const ceiling =
      volume.volume === undefined || cpcRange === undefined || ctrRange === undefined
        ? undefined
        : maxAbsorbableSpend({
            cpcRange,
            ctrRange,
            volume: volume.volume,
          });
    const closure =
      allocation === undefined || cpcRange === undefined
        ? undefined
        : closeFunnelMath({
            allocation,
            cpcRange,
            targetCostPerConversion,
          });
    const verdict = verdictForAllocation({
      allocation,
      ceiling,
      measuredVolume: volume.volume,
    });

    return {
      allocation,
      allocationBasis:
        allocation === undefined
          ? "missing audience allocation"
          : "audience budget parsed as monthly allocation",
      ...(ceiling === undefined ? {} : { ceiling }),
      ...(cpcRange === undefined ? {} : { cpcRange }),
      cvrRange: defaultCvrBenchmark,
      math: buildMathLines({
        allocation,
        ceiling,
        closure,
        cpcRange,
        ctrRange,
        measuredVolume: volume.volume,
        targetCostPerConversion,
      }),
      matchedKeywords: matchedKeywords.map((metric) => ({
        keyword: metric.keyword,
        monthlyVolume: metric.monthlyVolume,
        ...(metric.cpc === undefined ? {} : { cpc: metric.cpc }),
      })),
      ...(targetCostPerConversion === undefined
        ? {}
        : { targetCostPerConversion }),
      audience:
        getString(audience, "archetype") ??
        getString(audience, "slot") ??
        "Audience",
      ...(ctrRange === undefined ? {} : { ctrRange }),
      ...(volume.volume === undefined ? {} : { measuredVolume: volume.volume }),
      verdict,
      volumeBasis: volume.basis,
    };
  });
  const exceedsCount = verdicts.filter((verdict) => verdict.verdict === "exceeds")
    .length;
  const unknownCount = verdicts.filter((verdict) => verdict.verdict === "unknown")
    .length;

  return {
    summary:
      exceedsCount > 0
        ? `${exceedsCount} audience allocation(s) exceed the measured spend ceiling.`
        : unknownCount > 0
          ? `${unknownCount} audience allocation(s) have unknown feasibility because volume or allocation basis is missing.`
          : "All audited audience allocations fit the measured spend ceiling.",
    verdicts,
  };
}
