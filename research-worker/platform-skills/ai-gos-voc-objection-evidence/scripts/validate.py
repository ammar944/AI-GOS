#!/usr/bin/env python3
"""Validate Voice of Customer & Objection Evidence section.

Run with the agent's draft plan.json as the single argument:

    python scripts/validate.py plan.json

Prints JSON to stdout: {"valid": bool, "errors": [...], "counts": {...}}.
Always exits 0; agent reads stdout to decide whether to fix and retry.

Minimums mirror the Required Outputs prose in SKILL.md / positioning-skills/04.
"""
import json
import re
import sys
from pathlib import Path

# Load-bearing minimums.
MIN_VERBATIM_QUOTES = 15        # SKILL.md: ">=15 verbatim quotes from real public sources"
MIN_OBJECTIONS = 5              # "top 5 objections that block conversion"
MIN_SWITCHING_STORIES = 3       # named prior tool, trigger event
MIN_DECISION_CRITERIA = 5       # "5-7 most-frequent across independent quotes"
PAGE_COVERAGE_ENUM = ("yes", "partial", "no")
URL_RE = re.compile(r"^https?://[^\s]+\.[^\s]+$", re.IGNORECASE)


def load_plan(path):
    try:
        return json.loads(Path(path).read_text())
    except FileNotFoundError:
        return {"_load_error": f"plan file not found: {path}"}
    except json.JSONDecodeError as exc:
        return {"_load_error": f"plan is not valid JSON: {exc}"}


def looks_verbatim(text):
    """Heuristic: verbatim quotes are typically surrounded by quote marks OR contain
    informal markers (slang, all-caps emphasis, profanity, typos). Paraphrased content
    tends to be polished. Errs toward acceptance — we only flag obvious paraphrases."""
    if not isinstance(text, str) or len(text) < 10:
        return False
    stripped = text.strip()
    if stripped.startswith(("\"", "“", "'")) and stripped.endswith(("\"", "”", "'")):
        return True
    # Allow uncapped quote markers if the text reads colloquially (has informal markers)
    informal_markers = ("...", "!!", "??", "lol", "tbh", "wtf", "ugh")
    return any(m in stripped.lower() for m in informal_markers)


def check_envelope(plan, errors):
    if plan.get("cardType") != "voc-objection-evidence":
        errors.append(f"cardType: expected 'voc-objection-evidence', got {plan.get('cardType')!r}")
    if not (plan.get("verdict") or "").strip():
        errors.append("verdict: missing or empty")


def check_verbatim_quotes(plan, errors):
    quotes = plan.get("verbatimQuotes") or []
    if len(quotes) < MIN_VERBATIM_QUOTES:
        errors.append(
            f"verbatimQuotes: have {len(quotes)}, need >={MIN_VERBATIM_QUOTES}. "
            "Pull from G2/Capterra, Reddit, HackerNews, Discord, public LinkedIn — "
            "across the company AND competitors AND adjacent-category reviews."
        )
    for i, q in enumerate(quotes):
        if not isinstance(q, dict):
            errors.append(f"verbatimQuotes[{i}]: must be an object")
            continue
        missing = [k for k in ("quote", "sourceUrl", "role", "date") if not q.get(k)]
        if missing:
            errors.append(
                f"verbatimQuotes[{i}]: missing {missing}. "
                "Required: quote (verbatim text), sourceUrl, role/handle, date."
            )
        url = q.get("sourceUrl") or ""
        if url and not URL_RE.match(url):
            errors.append(f"verbatimQuotes[{i}]: sourceUrl invalid: {url!r}")
        if q.get("quote") and not looks_verbatim(q.get("quote")):
            errors.append(
                f"verbatimQuotes[{i}]: appears paraphrased — preserve original casing, "
                "punctuation, slang, typos. Wrap in quote marks if pulling from prose."
            )


def check_objections(plan, errors):
    objs = plan.get("objections") or []
    if len(objs) < MIN_OBJECTIONS:
        errors.append(
            f"objections: have {len(objs)}, need >={MIN_OBJECTIONS} ranked by frequency, "
            "in buyer's own words, with proof artifact and page-coverage flag."
        )
    for i, o in enumerate(objs):
        if not isinstance(o, dict):
            continue
        if not o.get("objection"):
            errors.append(f"objections[{i}]: missing 'objection' (verbatim buyer phrasing)")
        if not o.get("proofArtifact"):
            errors.append(
                f"objections[{i}]: missing 'proofArtifact' (case study / ROI / cert / pilot / guarantee)"
            )
        coverage = o.get("currentPageAddresses")
        if coverage not in PAGE_COVERAGE_ENUM:
            errors.append(
                f"objections[{i}]: currentPageAddresses must be one of {list(PAGE_COVERAGE_ENUM)}"
            )


def check_switching(plan, errors):
    stories = plan.get("switchingStories") or []
    if len(stories) < MIN_SWITCHING_STORIES:
        errors.append(
            f"switchingStories: have {len(stories)}, need >={MIN_SWITCHING_STORIES} "
            "with NAMED prior tool, replacement, and verbatim trigger event."
        )
    for i, s in enumerate(stories):
        if not isinstance(s, dict):
            continue
        if not s.get("priorTool"):
            errors.append(
                f"switchingStories[{i}]: missing 'priorTool' (must be a NAMED prior product)"
            )
        if not s.get("triggerEvent"):
            errors.append(f"switchingStories[{i}]: missing 'triggerEvent' (verbatim buyer phrasing)")


def check_decision_criteria(plan, errors):
    crits = plan.get("decisionCriteria") or []
    if len(crits) < MIN_DECISION_CRITERIA:
        errors.append(
            f"decisionCriteria: have {len(crits)}, need >={MIN_DECISION_CRITERIA} criteria "
            "from BUYER quotes (not vendor feature pages)."
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
    check_verbatim_quotes(plan, errors)
    check_objections(plan, errors)
    check_switching(plan, errors)
    check_decision_criteria(plan, errors)

    result = {
        "valid": not errors,
        "errors": errors,
        "counts": {
            "verbatimQuotes": len(plan.get("verbatimQuotes") or []),
            "objections": len(plan.get("objections") or []),
            "switchingStories": len(plan.get("switchingStories") or []),
            "decisionCriteria": len(plan.get("decisionCriteria") or []),
        },
    }
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
