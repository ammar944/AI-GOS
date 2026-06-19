// Centralized BuyerICP grounding validator (Option B).
//
// The old single gate was `isLikelyNamedBuyerIdentity`, a pure name-shape
// classifier: it only accepted a persona whose NAME field looks like a human.
// That over-rejected perfectly real buyer units — a media buyer does not need a
// named individual, they need a grounded ROLE/SEGMENT tied to a live source
// (e.g. "VP of Finance at mid-market SaaS, 200-1000 employees"). Live-proven on
// the Ramp corpus (run b0d12b45): the run FOUND 3 real champions and shipped 0
// personas because their role labels sat in the name field.
//
// A buyer unit is a VALID grounded unit iff:
//   1. it carries a LIVE http(s) sourceUrl, AND
//   2. confidence > 0 (when a confidence is supplied), AND
//   3. it has a grounded claim — EITHER a named human (`isLikelyNamedBuyerIdentity`)
//      OR a substantive `segmentLabel` (the role/segment grounding carrier).
//
// Names are OPTIONAL. Source-URL grounding is MANDATORY. The bare `role` enum
// value is NOT grounding on its own (it is a fixed dropdown value, trivially
// fabricated) — the free-text segmentLabel is what gets strict-contained on the
// live page by source-liveness (segmentLabel is in its entityFieldNames STRICT
// set). When `sourceText` is supplied here, this validator runs that same strict
// containment of the segmentLabel itself, so a fabricated segment is rejected.

import {
  BUYER_PERSONA_GROUNDING_FIELD,
  isLikelyNamedBuyerIdentity,
} from "../../artifacts/schemas/buyer-icp";
import { isEntityContainedInLiveText } from "./source-liveness";

const MIN_SEGMENT_LABEL_LENGTH = 2;

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function isHttpUrl(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value.trim());
}

export interface GroundedBuyerUnitOptions {
  // When provided, the unit's segmentLabel must be STRICT-contained in this live
  // page text (identical mechanism to source-liveness requiredEntities). Omit at
  // the downstream gate sites, where source-liveness has already dropped
  // non-contained rows.
  sourceText?: string | null;
}

// A buyer unit shape: the persona record fields the pipeline carries. All fields
// are read defensively because call sites pass schema-parsed personas, raw
// records, and case-study leads through here.
export interface GroundedBuyerUnit {
  name?: unknown;
  title?: unknown;
  role?: unknown;
  seniority?: unknown;
  company?: unknown;
  sourceUrl?: unknown;
  confidence?: unknown;
  [BUYER_PERSONA_GROUNDING_FIELD]?: unknown;
}

export function isValidGroundedBuyerUnit(
  unit: GroundedBuyerUnit,
  options: GroundedBuyerUnitOptions = {},
): boolean {
  // 1. Mandatory: a live http(s) source URL.
  if (!isHttpUrl(unit.sourceUrl)) {
    return false;
  }

  // 2. Confidence > 0 when supplied (the artifact-level confidence>0 contract,
  //    enforced at the unit when a per-unit confidence is present).
  if (typeof unit.confidence === "number" && !(unit.confidence > 0)) {
    return false;
  }

  const name = readString(unit.name);
  const segmentLabel = readString(unit[BUYER_PERSONA_GROUNDING_FIELD]);

  // 3a. Named-human grounding (preserved path): the name field is a real human
  //     identity. This keeps named-champion mining working unchanged.
  const namedHuman =
    name !== undefined &&
    isLikelyNamedBuyerIdentity(name, {
      company: readString(unit.company),
      role: readString(unit.role),
      seniority: readString(unit.seniority),
      title: readString(unit.title),
    });

  // 3b. Role/segment grounding (Option B): a substantive segmentLabel.
  const hasSegmentLabel =
    segmentLabel !== undefined &&
    segmentLabel.length >= MIN_SEGMENT_LABEL_LENGTH;

  if (!namedHuman && !hasSegmentLabel) {
    return false;
  }

  // 4. When live page text is supplied, strict-contain the role/segment grounding
  //    token on it (same strict mechanism as source-liveness requiredEntities).
  //    A named-human unit relies on its name/company containment, which
  //    source-liveness enforces separately.
  if (
    hasSegmentLabel &&
    typeof options.sourceText === "string" &&
    !isEntityContainedInLiveText(options.sourceText, segmentLabel)
  ) {
    return false;
  }

  return true;
}
