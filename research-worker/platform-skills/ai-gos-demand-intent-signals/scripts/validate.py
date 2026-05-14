#!/usr/bin/env python3
"""Validate Demand & Intent Signals section against load-bearing minimums.

Run with the agent's draft plan.json as the single argument:

    python scripts/validate.py plan.json

Prints JSON to stdout: {"valid": bool, "errors": [...], "counts": {...}}.
Always exits 0; agent reads stdout to decide whether to fix and retry.

Minimums mirror the Required Outputs prose in SKILL.md / positioning-skills/05.
"""
import json
import re
import sys
from pathlib import Path

# Load-bearing minimums.
MIN_KEYWORDS = 20               # SKILL.md: "Top 20+ category-relevant keywords"
MIN_BUYER_QUESTIONS = 10        # PAA / Reddit / Quora / community questions
MIN_CONTENT_GAPS = 5            # high-volume + weak top-ranking content
MIN_JOB_SIGNALS = 3             # job-posting searches with query + result count
MIN_COMMUNITIES = 3             # named events / communities / publications / podcasts
INTENT_ENUM = ("transactional", "commercial-investigation", "informational", "navigational")
URL_RE = re.compile(r"^https?://[^\s]+\.[^\s]+$", re.IGNORECASE)


def load_plan(path):
    try:
        return json.loads(Path(path).read_text())
    except FileNotFoundError:
        return {"_load_error": f"plan file not found: {path}"}
    except json.JSONDecodeError as exc:
        return {"_load_error": f"plan is not valid JSON: {exc}"}


def check_envelope(plan, errors):
    if plan.get("cardType") != "demand-intent-signals":
        errors.append(f"cardType: expected 'demand-intent-signals', got {plan.get('cardType')!r}")
    if not (plan.get("verdict") or "").strip():
        errors.append("verdict: missing or empty")


def check_keywords(plan, errors):
    keywords = plan.get("keywords") or []
    if len(keywords) < MIN_KEYWORDS:
        errors.append(
            f"keywords: have {len(keywords)}, need >={MIN_KEYWORDS} category-relevant terms "
            "with monthlyVolume + intentType + top-3 ranking domains."
        )
    for i, k in enumerate(keywords):
        if not isinstance(k, dict):
            continue
        if not k.get("keyword"):
            errors.append(f"keywords[{i}]: missing 'keyword' string")
        if k.get("monthlyVolume") in (None, ""):
            errors.append(f"keywords[{i}] ({k.get('keyword','?')}): missing 'monthlyVolume'")
        if k.get("intentType") not in INTENT_ENUM:
            errors.append(
                f"keywords[{i}] ({k.get('keyword','?')}): intentType must be one of {list(INTENT_ENUM)}, "
                f"got {k.get('intentType')!r}"
            )
        if not k.get("source") or not k.get("sourceDate"):
            errors.append(
                f"keywords[{i}] ({k.get('keyword','?')}): missing 'source' + 'sourceDate' "
                "(Ahrefs / SEMrush / SearchAPI export with date)"
            )
        rankings = k.get("topRankingDomains") or []
        if len(rankings) < 3:
            errors.append(
                f"keywords[{i}] ({k.get('keyword','?')}): topRankingDomains has {len(rankings)}, need top-3"
            )


def check_buyer_questions(plan, errors):
    questions = plan.get("buyerQuestions") or []
    if len(questions) < MIN_BUYER_QUESTIONS:
        errors.append(
            f"buyerQuestions: have {len(questions)}, need >={MIN_BUYER_QUESTIONS} verbatim questions "
            "from PAA / Reddit / Quora / community threads with sourceUrl + community + date."
        )
    for i, q in enumerate(questions):
        if not isinstance(q, dict):
            continue
        missing = [k for k in ("question", "sourceUrl", "community", "date") if not q.get(k)]
        if missing:
            errors.append(f"buyerQuestions[{i}]: missing {missing}")


def check_content_gaps(plan, errors):
    gaps = plan.get("contentGaps") or []
    if len(gaps) < MIN_CONTENT_GAPS:
        errors.append(
            f"contentGaps: have {len(gaps)}, need >={MIN_CONTENT_GAPS} with topRankingUrl + "
            "whyWeak + serpSnapshotDate."
        )
    for i, g in enumerate(gaps):
        if not isinstance(g, dict):
            continue
        missing = [k for k in ("keyword", "topRankingUrl", "whyWeak", "serpSnapshotDate") if not g.get(k)]
        if missing:
            errors.append(f"contentGaps[{i}]: missing {missing}")


def check_intent_signals(plan, errors):
    signals = plan.get("intentSignals") or {}
    jobs = signals.get("jobPostings") or []
    triggers = signals.get("newsTriggers") or []
    if len(jobs) < MIN_JOB_SIGNALS:
        errors.append(
            f"intentSignals.jobPostings: have {len(jobs)}, need >={MIN_JOB_SIGNALS} with "
            "query + resultCount + date (LinkedIn / Indeed / Greenhouse)"
        )
    for i, j in enumerate(jobs):
        if not isinstance(j, dict):
            continue
        if not j.get("query") or not j.get("resultCount"):
            errors.append(f"intentSignals.jobPostings[{i}]: missing query + resultCount")
    if len(triggers) < 3:
        errors.append(
            f"intentSignals.newsTriggers: have {len(triggers)}, need >=3 types with example URL per type "
            "(leadership change, funding, regulatory, outage, layoff, merger)"
        )


def check_event_map(plan, errors):
    event_map = plan.get("eventCommunityMap") or {}
    communities = event_map.get("communities") or []
    if len(communities) < MIN_COMMUNITIES:
        errors.append(
            f"eventCommunityMap.communities: have {len(communities)}, need >={MIN_COMMUNITIES} named "
            "with subscriber/attendance count + last-12-month activity signal."
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
    check_keywords(plan, errors)
    check_buyer_questions(plan, errors)
    check_content_gaps(plan, errors)
    check_intent_signals(plan, errors)
    check_event_map(plan, errors)

    result = {
        "valid": not errors,
        "errors": errors,
        "counts": {
            "keywords": len(plan.get("keywords") or []),
            "buyerQuestions": len(plan.get("buyerQuestions") or []),
            "contentGaps": len(plan.get("contentGaps") or []),
            "jobPostings": len((plan.get("intentSignals") or {}).get("jobPostings") or []),
            "communities": len((plan.get("eventCommunityMap") or {}).get("communities") or []),
        },
    }
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
