#!/usr/bin/env python3
"""Validate Offer & Performance Diagnostic section against load-bearing minimums.

Run with the agent's draft plan.json as the single argument:

    python scripts/validate.py plan.json

Prints JSON to stdout: {"valid": bool, "errors": [...], "counts": {...}}.
Always exits 0; agent reads stdout to decide whether to fix and retry.

Minimums mirror the Required Outputs prose in SKILL.md / positioning-skills/06.

NOTE: This section uses the company's OWN reported numbers — do not import external
benchmarks as if they were the company's data.
"""
import json
import re
import sys
from pathlib import Path

# Load-bearing minimums.
MIN_PROOF_POINTS = 3            # SKILL.md: every claim cited or marked 'not reported'
MIN_QUANTIFIED_CHANNELS = 2     # channels with spend + result + CAC
MIN_RED_FLAGS = 3               # claim vs contradicting number
EVIDENCE_TYPE_ENUM = ("customer-outcome", "scale", "engagement", "commercial")
HEALTH_VERDICT_ENUM = ("healthy", "leaky", "death-spiral")


def load_plan(path):
    try:
        return json.loads(Path(path).read_text())
    except FileNotFoundError:
        return {"_load_error": f"plan file not found: {path}"}
    except json.JSONDecodeError as exc:
        return {"_load_error": f"plan is not valid JSON: {exc}"}


def check_envelope(plan, errors):
    if plan.get("cardType") != "offer-performance-diagnostic":
        errors.append(f"cardType: expected 'offer-performance-diagnostic', got {plan.get('cardType')!r}")
    if not (plan.get("verdict") or "").strip():
        errors.append("verdict: missing or empty")


def check_proof_points(plan, errors):
    proofs = plan.get("proofPoints") or []
    if len(proofs) < MIN_PROOF_POINTS:
        errors.append(
            f"proofPoints: have {len(proofs)}, need >={MIN_PROOF_POINTS} quantitative claims "
            "from the company (corpus / onboarding / homepage / case studies / podcast)."
        )
    for i, p in enumerate(proofs):
        if not isinstance(p, dict):
            continue
        if not p.get("metric") or p.get("value") in (None, ""):
            errors.append(f"proofPoints[{i}]: missing 'metric' + 'value'")
        if not p.get("source") and not p.get("corpusField"):
            errors.append(
                f"proofPoints[{i}] (metric={p.get('metric','?')}): missing 'source' OR 'corpusField'. "
                "If unsubstantiated, set value=null and add to risksOrGaps instead."
            )
        if p.get("evidenceType") and p.get("evidenceType") not in EVIDENCE_TYPE_ENUM:
            errors.append(
                f"proofPoints[{i}]: evidenceType must be one of {list(EVIDENCE_TYPE_ENUM)}, "
                f"got {p.get('evidenceType')!r}"
            )


def check_funnel(plan, errors):
    funnel = plan.get("funnelDiagnosis") or {}
    leaks = funnel.get("leakStages") or []
    if len(leaks) < 1:
        errors.append(
            "funnelDiagnosis.leakStages: missing. Identify >=1 specific stage where their numbers "
            "leak (top-of-funnel / MQL-SQL / SQL-opp / opp-close / activation / retention / expansion)."
        )
    for i, leak in enumerate(leaks):
        if not isinstance(leak, dict):
            continue
        missing = [k for k in ("stage", "reportedValue", "benchmarkRange", "gap") if not leak.get(k)]
        if missing:
            errors.append(
                f"funnelDiagnosis.leakStages[{i}]: missing {missing}. "
                "Each leak needs stage + reportedValue + benchmarkRange + gap."
            )


def check_channels(plan, errors):
    channels = plan.get("channels") or {}
    quantified = channels.get("quantified") or []
    opinion = channels.get("opinionOnly") or []
    if len(quantified) < MIN_QUANTIFIED_CHANNELS:
        errors.append(
            f"channels.quantified: have {len(quantified)}, need >={MIN_QUANTIFIED_CHANNELS} with "
            "spend + result + CAC + timeWindow. If they have less actual proof, say so explicitly."
        )
    for i, c in enumerate(quantified):
        if not isinstance(c, dict):
            continue
        missing = [k for k in ("channel", "spend", "result", "timeWindow") if not c.get(k)]
        if missing:
            errors.append(f"channels.quantified[{i}] ({c.get('channel','?')}): missing {missing}")


def check_retention(plan, errors):
    retention = plan.get("retentionActivation") or {}
    if not retention.get("activationCriterion"):
        errors.append(
            "retentionActivation.activationCriterion: missing. State the first-value moment that "
            "predicts retention (their reported criterion, or infer from product type and flag as inferred)."
        )
    verdict = retention.get("healthVerdict")
    if verdict and verdict not in HEALTH_VERDICT_ENUM:
        errors.append(
            f"retentionActivation.healthVerdict: must be one of {list(HEALTH_VERDICT_ENUM)}, got {verdict!r}"
        )


def check_red_flags(plan, errors):
    flags = plan.get("redFlags") or []
    if len(flags) < MIN_RED_FLAGS:
        errors.append(
            f"redFlags: have {len(flags)}, need >={MIN_RED_FLAGS} contradictions between "
            "claimed motion and actual numbers (e.g. 'PLG' but cycle=90 days; 'PMF' but churn=8%)."
        )
    for i, f in enumerate(flags):
        if not isinstance(f, dict):
            continue
        missing = [k for k in ("claim", "contradictingNumber", "source") if not f.get(k)]
        if missing:
            errors.append(
                f"redFlags[{i}]: missing {missing}. Quote BOTH the claim AND the contradicting number with sources."
            )


def main(argv):
    if len(argv) < 2:
        print(json.dumps({"valid": False, "errors": ["Usage: validate.py <plan.json>"]}))
        return 0
    plan = load_plan(argv[1])
    if "_load_error" in plan:
        print(json.dumps({"valid": False, "errors": [plan["_load_error"]]}))
        return 0

    errors = []
    check_envelope(plan, errors)
    check_proof_points(plan, errors)
    check_funnel(plan, errors)
    check_channels(plan, errors)
    check_retention(plan, errors)
    check_red_flags(plan, errors)

    result = {
        "valid": not errors,
        "errors": errors,
        "counts": {
            "proofPoints": len(plan.get("proofPoints") or []),
            "leakStages": len((plan.get("funnelDiagnosis") or {}).get("leakStages") or []),
            "channelsQuantified": len((plan.get("channels") or {}).get("quantified") or []),
            "redFlags": len(plan.get("redFlags") or []),
        },
    }
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
