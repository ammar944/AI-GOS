#!/usr/bin/env python3
"""Validate Buyer & ICP Validation section against load-bearing minimums.

Run with the agent's draft plan.json as the single argument:

    python scripts/validate.py plan.json

Prints a JSON result to stdout: {"valid": bool, "errors": [...], "counts": {...}}.
Always exits 0; the agent reads stdout to decide whether to fix and retry.

Schema lives in research-worker/src/agents/subagents/schemas/buyer-icp.ts.
SKILL.md embeds this script for the agent to write to /tmp at runtime.
Edit ALL THREE when the contract changes.
"""
import json
import re
import sys
from pathlib import Path

MIN_PERSONAS = 5
MIN_FIRMOGRAPHIC_CUTS = 3
MIN_TRIGGERS = 3
MIN_COMMUNITIES = 2
MIN_NEWSLETTERS = 2
AWARENESS_LEVELS = ("unaware", "problem-aware", "solution-aware", "product-aware", "most-aware")
CUT_TYPES = ("industry", "employeeBands", "revenueBands", "geography", "techStack")
TRIGGER_WINDOWS = ("immediate", "weeks", "quarters")
BUCKET_TYPES = ("community", "newsletter", "conference", "podcast")
URL_RE = re.compile(r"^https?://[^\s]+\.[^\s]+$", re.IGNORECASE)


def load_plan(path):
    try:
        return json.loads(Path(path).read_text())
    except FileNotFoundError:
        return {"_load_error": f"plan file not found: {path}"}
    except json.JSONDecodeError as exc:
        return {"_load_error": f"plan is not valid JSON: {exc}"}


def check_envelope(plan, errors):
    if not (plan.get("verdict") or "").strip():
        errors.append("verdict: missing or empty")
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
    cuts = plan.get("icpAccountCounts") or []
    if not isinstance(cuts, list):
        errors.append("icpAccountCounts: must be an array of typed firmographic cuts")
        return
    if len(cuts) < MIN_FIRMOGRAPHIC_CUTS:
        errors.append(
            f"icpAccountCounts: have {len(cuts)} cuts, need >={MIN_FIRMOGRAPHIC_CUTS}. "
            f"Expected cutType values: {list(CUT_TYPES)} — pick >=3."
        )
    seen_types = []
    for i, cut in enumerate(cuts):
        if not isinstance(cut, dict):
            errors.append(f"icpAccountCounts[{i}]: must be an object")
            continue
        cut_type = cut.get("cutType")
        if cut_type not in CUT_TYPES:
            errors.append(
                f"icpAccountCounts[{i}]: cutType must be one of {list(CUT_TYPES)}, got {cut_type!r}"
            )
        seen_types.append(cut_type)
        if not cut.get("value"):
            errors.append(f"icpAccountCounts[{i}] (cutType={cut_type}): missing 'value'")
        if not cut.get("source"):
            errors.append(f"icpAccountCounts[{i}] (cutType={cut_type}): missing 'source'")
        if not cut.get("dateObserved"):
            errors.append(f"icpAccountCounts[{i}] (cutType={cut_type}): missing 'dateObserved' (YYYY-MM-DD)")
    duplicates = [t for t in CUT_TYPES if seen_types.count(t) > 1]
    if duplicates:
        errors.append(f"icpAccountCounts: duplicate cutType entries {duplicates} — one per dimension")


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
        window = t.get("window")
        if window not in TRIGGER_WINDOWS:
            errors.append(
                f"triggers[{i}] ({t.get('name','?')}): window must be one of {list(TRIGGER_WINDOWS)}, got {window!r}"
            )


def check_clusters(plan, errors):
    clusters = plan.get("clusters") or []
    if not isinstance(clusters, list):
        errors.append("clusters: must be a flat array of cluster entries with bucketType")
        return
    by_bucket = {b: 0 for b in BUCKET_TYPES}
    for i, entry in enumerate(clusters):
        if not isinstance(entry, dict):
            errors.append(f"clusters[{i}]: must be an object")
            continue
        bucket = entry.get("bucketType")
        if bucket not in BUCKET_TYPES:
            errors.append(
                f"clusters[{i}] ({entry.get('name','?')}): bucketType must be one of {list(BUCKET_TYPES)}, got {bucket!r}"
            )
            continue
        by_bucket[bucket] += 1
        if not entry.get("name"):
            errors.append(f"clusters[{i}] (bucketType={bucket}): missing 'name'")
        if not entry.get("sourceUrl"):
            errors.append(f"clusters[{i}] (bucketType={bucket}): missing 'sourceUrl'")
    if by_bucket["community"] < MIN_COMMUNITIES:
        errors.append(
            f"clusters: have {by_bucket['community']} community entries, need >={MIN_COMMUNITIES} "
            "(subreddit/Discord/Slack/forum) with subscriber metric"
        )
    if by_bucket["newsletter"] < MIN_NEWSLETTERS:
        errors.append(
            f"clusters: have {by_bucket['newsletter']} newsletter entries, need >={MIN_NEWSLETTERS} "
            "with subscriber estimate"
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

    clusters = plan.get("clusters") or []
    counts = {
        "personas": len(plan.get("personas") or []),
        "firmographicCuts": len(plan.get("icpAccountCounts") or []),
        "awarenessLevels": len(plan.get("awarenessDistribution") or []),
        "triggers": len(plan.get("triggers") or []),
        "communities": sum(
            1 for c in clusters if isinstance(c, dict) and c.get("bucketType") == "community"
        ),
    }
    result = {"valid": not errors, "errors": errors, "counts": counts}
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
