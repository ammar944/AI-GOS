#!/usr/bin/env python3
"""Validate Buyer & ICP Validation section against load-bearing minimums.

Run with the agent's draft plan.json as the single argument:

    python scripts/validate.py plan.json

Prints a JSON result to stdout: {"valid": bool, "errors": [...], "counts": {...}}.
Always exits 0; the agent reads stdout to decide whether to fix and retry.

Minimums mirror the Required Outputs prose in SKILL.md / positioning-skills/02.
Edit both together when changing the contract.
"""
import json
import re
import sys
from pathlib import Path

# Load-bearing minimums.
MIN_PERSONAS = 5                # SKILL.md: ">=5 named real persons at named real ICP companies"
MIN_FIRMOGRAPHIC_CUTS = 3       # industry + employee bands + revenue is the floor
MIN_TRIGGERS = 3                # publicly detectable, not "internal frustration"
MIN_COMMUNITIES = 2             # named subreddit/Discord/Slack/forum with subscriber count
MIN_NEWSLETTERS = 2             # named with subscriber estimate
AWARENESS_LEVELS = ("unaware", "problem-aware", "solution-aware", "product-aware", "most-aware")
URL_RE = re.compile(r"^https?://[^\s]+\.[^\s]+$", re.IGNORECASE)


def load_plan(path):
    try:
        return json.loads(Path(path).read_text())
    except FileNotFoundError:
        return {"_load_error": f"plan file not found: {path}"}
    except json.JSONDecodeError as exc:
        return {"_load_error": f"plan is not valid JSON: {exc}"}


def check_envelope(plan, errors):
    # cardType is informational only — the worker's Output.object schema doesn't
    # produce it. If present, sanity-check the value; otherwise skip.
    card_type = plan.get("cardType")
    if card_type is not None and card_type != "buyer-icp-validation":
        errors.append(f"cardType: if present, expected 'buyer-icp-validation', got {card_type!r}")
    if not (plan.get("verdict") or "").strip():
        errors.append("verdict: missing or empty")
    # Accept either 'statusSummary' (worker schema) or 'summary' (SKILL.md prose).
    summary = plan.get("statusSummary") or plan.get("summary") or ""
    if len(summary) < 50:
        errors.append(
            "statusSummary: shorter than 50 chars — needs a real 2-4 sentence executive summary"
        )


def check_personas(plan, errors):
    personas = plan.get("personas") or []
    if len(personas) < MIN_PERSONAS:
        errors.append(
            f"personas: have {len(personas)}, need >={MIN_PERSONAS} named real persons at named real "
            "ICP companies. Pull from LinkedIn / conference rosters / public bios."
        )
    for i, p in enumerate(personas):
        if not isinstance(p, dict):
            errors.append(f"personas[{i}]: must be an object")
            continue
        missing = [k for k in ("name", "title", "company", "sourceUrl") if not p.get(k)]
        if missing:
            errors.append(
                f"personas[{i}] (name={p.get('name','?')}): missing {missing}. "
                "Required: name, title, company, sourceUrl."
            )
        url = p.get("sourceUrl") or ""
        if url and not URL_RE.match(url):
            errors.append(
                f"personas[{i}] (name={p.get('name','?')}): sourceUrl is not a valid URL: {url!r}"
            )


def check_firmographics(plan, errors):
    cuts = plan.get("icpAccountCounts") or {}
    present = [k for k, v in cuts.items() if v]
    if len(present) < MIN_FIRMOGRAPHIC_CUTS:
        errors.append(
            f"icpAccountCounts: have {len(present)} cuts {present}, need >={MIN_FIRMOGRAPHIC_CUTS}. "
            "Expected: industry, employeeBands, revenueBands, geography, techStack — pick >=3."
        )
    for cut, payload in cuts.items():
        if not isinstance(payload, dict):
            continue
        if not payload.get("source"):
            errors.append(
                f"icpAccountCounts.{cut}: missing 'source' (LinkedIn Sales Navigator / ZoomInfo / BuiltWith)"
            )
        if not payload.get("dateObserved"):
            errors.append(f"icpAccountCounts.{cut}: missing 'dateObserved' (YYYY-MM-DD)")


def check_awareness(plan, errors):
    awareness = plan.get("awarenessDistribution") or []
    levels_present = {a.get("level") for a in awareness if isinstance(a, dict)}
    missing_levels = [lvl for lvl in AWARENESS_LEVELS if lvl not in levels_present]
    if missing_levels:
        errors.append(
            f"awarenessDistribution: missing Schwartz levels {missing_levels}. "
            f"All five required: {list(AWARENESS_LEVELS)}."
        )
    for i, a in enumerate(awareness):
        if not isinstance(a, dict):
            continue
        if a.get("evidence") in (None, "", []):
            errors.append(
                f"awarenessDistribution[{i}] (level={a.get('level')}): missing 'evidence' "
                "(search-volume split, review-language sample, or content gap)."
            )


def check_triggers(plan, errors):
    triggers = plan.get("triggers") or []
    if len(triggers) < MIN_TRIGGERS:
        errors.append(
            f"triggers: have {len(triggers)}, need >={MIN_TRIGGERS} publicly detectable events. "
            "Examples: funding rounds (Crunchbase), leadership changes (LinkedIn), "
            "regulatory deadlines, hiring spikes."
        )
    for i, t in enumerate(triggers):
        if not isinstance(t, dict):
            continue
        if not t.get("detectionSignal"):
            errors.append(
                f"triggers[{i}] ({t.get('name','?')}): missing 'detectionSignal'. "
                "Triggers must be publicly observable; internal frustration is not detectable."
            )


def check_clusters(plan, errors):
    clusters = plan.get("clusters") or {}
    communities = clusters.get("communities") or []
    newsletters = clusters.get("newsletters") or []
    if len(communities) < MIN_COMMUNITIES:
        errors.append(
            f"clusters.communities: have {len(communities)}, need >={MIN_COMMUNITIES} named "
            "(subreddit/Discord/Slack/forum) WITH subscriber count"
        )
    if len(newsletters) < MIN_NEWSLETTERS:
        errors.append(
            f"clusters.newsletters: have {len(newsletters)}, need >={MIN_NEWSLETTERS} named with subscriber estimate"
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
    check_personas(plan, errors)
    check_firmographics(plan, errors)
    check_awareness(plan, errors)
    check_triggers(plan, errors)
    check_clusters(plan, errors)

    result = {
        "valid": not errors,
        "errors": errors,
        "counts": {
            "personas": len(plan.get("personas") or []),
            "firmographicCuts": len(plan.get("icpAccountCounts") or {}),
            "awarenessLevels": len(plan.get("awarenessDistribution") or []),
            "triggers": len(plan.get("triggers") or []),
            "communities": len((plan.get("clusters") or {}).get("communities") or []),
        },
    }
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
