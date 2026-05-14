#!/usr/bin/env python3
"""Validate Competitive Positioning section against load-bearing minimums.

Run with the agent's draft plan.json as the single argument:

    python scripts/validate.py plan.json

Prints JSON to stdout: {"valid": bool, "errors": [...], "counts": {...}}.
Always exits 0; agent reads stdout to decide whether to fix and retry.

Minimums mirror the Required Outputs prose in SKILL.md / positioning-skills/03.
"""
import json
import re
import sys
from pathlib import Path

# Load-bearing minimums.
MIN_DIRECT_COMPETITORS = 5      # SKILL.md: "top 5-10 direct competitors"
MIN_INDIRECT_COMPETITORS = 3    # "top 3-5 in adjacent categories"
MIN_STATUS_QUO = 1              # what the buyer does without any vendor
MIN_DIY_OPTIONS = 1             # build-your-own paths
TOP_N_DEEP = 5                  # the top-5 each need verbatim hero + reviews + narrative arc
MIN_REVIEW_QUOTES_PER_SIDE = 2  # 2 strength + 2 weakness verbatim review quotes per top-5
MIN_SOV_KEYWORDS = 10           # share-of-voice claims need numbers
URL_RE = re.compile(r"^https?://[^\s]+\.[^\s]+$", re.IGNORECASE)


def load_plan(path):
    try:
        return json.loads(Path(path).read_text())
    except FileNotFoundError:
        return {"_load_error": f"plan file not found: {path}"}
    except json.JSONDecodeError as exc:
        return {"_load_error": f"plan is not valid JSON: {exc}"}


def check_envelope(plan, errors):
    if plan.get("cardType") != "competitive-positioning":
        errors.append(f"cardType: expected 'competitive-positioning', got {plan.get('cardType')!r}")
    if not (plan.get("verdict") or "").strip():
        errors.append("verdict: missing or empty")


def check_competitor_set(plan, errors):
    direct = plan.get("directCompetitors") or []
    indirect = plan.get("indirectCompetitors") or []
    status_quo = plan.get("statusQuo") or []
    diy = plan.get("diyOptions") or []

    if len(direct) < MIN_DIRECT_COMPETITORS:
        errors.append(
            f"directCompetitors: have {len(direct)}, need >={MIN_DIRECT_COMPETITORS} "
            "(named, with G2/Capterra/homepage URL)"
        )
    if len(indirect) < MIN_INDIRECT_COMPETITORS:
        errors.append(
            f"indirectCompetitors: have {len(indirect)}, need >={MIN_INDIRECT_COMPETITORS}"
        )
    if len(status_quo) < MIN_STATUS_QUO:
        errors.append(
            "statusQuo: missing. Name what the buyer does TODAY without any vendor "
            "(spreadsheets, manual process, existing internal tool)."
        )
    if len(diy) < MIN_DIY_OPTIONS:
        errors.append(
            "diyOptions: missing. Name build-your-own paths the buyer credibly considers "
            "(in-house engineering, open-source stack, no-code assembly)."
        )

    for i, c in enumerate(direct[:TOP_N_DEEP]):
        if not isinstance(c, dict):
            continue
        name = c.get("name") or f"#{i}"
        missing = [
            k for k in ("heroH1", "subhead", "primaryCTA", "sourceUrl", "dateObserved")
            if not c.get(k)
        ]
        if missing:
            errors.append(
                f"directCompetitors[{i}] ({name}): missing verbatim {missing}. "
                "Top-5 each need heroH1 + subhead + primaryCTA quoted EXACTLY from the homepage."
            )
        if not c.get("pricing") and not c.get("pricingGated"):
            errors.append(
                f"directCompetitors[{i}] ({name}): missing pricing OR pricingGated flag. "
                "Provide price tiers OR set pricingGated=true with 'contact sales' evidence."
            )
        strengths = c.get("strengthQuotes") or []
        weaknesses = c.get("weaknessQuotes") or []
        if len(strengths) < MIN_REVIEW_QUOTES_PER_SIDE:
            errors.append(
                f"directCompetitors[{i}] ({name}): strengthQuotes have {len(strengths)}, "
                f"need >={MIN_REVIEW_QUOTES_PER_SIDE} verbatim 4-5 star quotes with sourceUrl + role + date"
            )
        if len(weaknesses) < MIN_REVIEW_QUOTES_PER_SIDE:
            errors.append(
                f"directCompetitors[{i}] ({name}): weaknessQuotes have {len(weaknesses)}, "
                f"need >={MIN_REVIEW_QUOTES_PER_SIDE} verbatim 1-3 star quotes"
            )
        narrative = c.get("narrativeArc") or {}
        missing_narr = [k for k in ("villain", "hero", "transformationClaim") if not narrative.get(k)]
        if missing_narr:
            errors.append(
                f"directCompetitors[{i}] ({name}): narrativeArc missing {missing_narr}. "
                "From about page / manifesto. If none stated, set to 'no explicit narrative arc'."
            )


def check_share_of_voice(plan, errors):
    sov = plan.get("shareOfVoice") or []
    if len(sov) < MIN_SOV_KEYWORDS:
        errors.append(
            f"shareOfVoice: have {len(sov)} keywords, need >={MIN_SOV_KEYWORDS} with "
            "top-3 organic rankings + paid bidders + SoV split"
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
    check_competitor_set(plan, errors)
    check_share_of_voice(plan, errors)

    result = {
        "valid": not errors,
        "errors": errors,
        "counts": {
            "directCompetitors": len(plan.get("directCompetitors") or []),
            "indirectCompetitors": len(plan.get("indirectCompetitors") or []),
            "statusQuo": len(plan.get("statusQuo") or []),
            "diyOptions": len(plan.get("diyOptions") or []),
            "sovKeywords": len(plan.get("shareOfVoice") or []),
        },
    }
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
