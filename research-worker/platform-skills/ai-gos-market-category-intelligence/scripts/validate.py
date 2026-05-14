#!/usr/bin/env python3
"""Validate Market & Category Intelligence section against load-bearing minimums.

Run with the agent's draft plan.json as the single argument:

    python scripts/validate.py plan.json

Prints a JSON result to stdout: {"valid": bool, "errors": [...], "counts": {...}}.
Always exits 0; the agent reads stdout to decide whether to fix and retry.

Minimums mirror the Required Outputs prose in SKILL.md / positioning-skills/01.
Edit both together when changing the contract.
"""
import json
import re
import sys
from pathlib import Path

# Load-bearing minimums (the ones that distinguish a real section from "## starting").
MIN_ADJACENT_CATEGORIES = 2     # SKILL.md: "2-4 adjacent categories buyers confuse this with"
MIN_TOP_FUNDED = 3              # "top 3 funded competitors with round size + lead investor"
MIN_STRUCTURAL_FORCES = 3       # regulatory + platform + behavior — at least one of each kind
MIN_SOURCES = 3                 # "three independent sources for any market-size claim"
MATURITY_ENUM = ("emerging", "growing", "consolidating", "commoditizing")
URL_RE = re.compile(r"^https?://[^\s]+\.[^\s]+$", re.IGNORECASE)


def load_plan(path: str):
    try:
        return json.loads(Path(path).read_text())
    except FileNotFoundError:
        return {"_load_error": f"plan file not found: {path}"}
    except json.JSONDecodeError as exc:
        return {"_load_error": f"plan is not valid JSON: {exc}"}


def check_envelope(plan, errors):
    if plan.get("cardType") != "market-category-intelligence":
        errors.append(
            f"cardType: expected 'market-category-intelligence', got {plan.get('cardType')!r}"
        )
    if not (plan.get("verdict") or "").strip():
        errors.append("verdict: missing or empty — one sharp executive verdict required")
    if len((plan.get("summary") or "")) < 50:
        errors.append("summary: shorter than 50 chars — Required Outputs need a real executive summary")


def check_category_definition(plan, errors):
    cat = plan.get("categoryDefinition") or {}
    sentence = (cat.get("buyerSentence") or "").strip()
    if len(sentence.split()) < 6:
        errors.append(
            "categoryDefinition.buyerSentence: must be a buyer-language sentence (>=6 words). "
            "Use the buyer's own words, not the company's brand language."
        )
    adjacent = cat.get("adjacentCategories") or []
    if len(adjacent) < MIN_ADJACENT_CATEGORIES:
        errors.append(
            f"categoryDefinition.adjacentCategories: have {len(adjacent)}, need >={MIN_ADJACENT_CATEGORIES} "
            "adjacent categories with disambiguating signal"
        )
    for i, item in enumerate(adjacent):
        if not isinstance(item, dict) or not item.get("disambiguatingSignal"):
            errors.append(
                f"categoryDefinition.adjacentCategories[{i}]: missing 'disambiguatingSignal'"
            )


def check_market_signals(plan, errors):
    signals = plan.get("marketSizeSignals") or {}
    sam = signals.get("sam")
    if not sam or not isinstance(sam, dict) or not sam.get("value"):
        errors.append(
            "marketSizeSignals.sam: missing. SAM must come BEFORE TAM. If undisclosed, "
            "provide a proxy: (target companies) x (annual category spend), labeled 'proxy'."
        )
    funded = signals.get("topFundedCompetitors") or []
    if len(funded) < MIN_TOP_FUNDED:
        errors.append(
            f"marketSizeSignals.topFundedCompetitors: have {len(funded)}, "
            f"need >={MIN_TOP_FUNDED} with roundSize + leadInvestor"
        )
    for i, comp in enumerate(funded):
        if not isinstance(comp, dict):
            continue
        if not comp.get("roundSize") or not comp.get("leadInvestor"):
            errors.append(
                f"marketSizeSignals.topFundedCompetitors[{i}] ({comp.get('name','?')}): "
                "missing roundSize or leadInvestor"
            )


def check_structural_forces(plan, errors):
    forces = plan.get("structuralForces") or []
    if len(forces) < MIN_STRUCTURAL_FORCES:
        errors.append(
            f"structuralForces: have {len(forces)}, need >={MIN_STRUCTURAL_FORCES}. "
            "Cover regulatory + platform + buyer-behavior shifts."
        )
    kinds = {f.get("kind") for f in forces if isinstance(f, dict)}
    expected = {"regulatory", "platform", "behavior"}
    missing_kinds = expected - kinds
    if missing_kinds:
        errors.append(
            f"structuralForces: missing kinds {sorted(missing_kinds)} (each force needs kind in {sorted(expected)})"
        )


def check_maturity(plan, errors):
    maturity = plan.get("categoryMaturity") or {}
    classification = maturity.get("classification")
    if classification not in MATURITY_ENUM:
        errors.append(
            f"categoryMaturity.classification: got {classification!r}, must be one of {list(MATURITY_ENUM)}"
        )
    if not (maturity.get("evidenceForRubric") or "").strip():
        errors.append(
            "categoryMaturity.evidenceForRubric: missing. State why this classification fits "
            "(player count + buyer education + feature parity + price pressure rubric)."
        )
    if not (maturity.get("adStrategyImplication") or "").strip():
        errors.append(
            "categoryMaturity.adStrategyImplication: missing. State whether cold-traffic should "
            "educate / differentiate / price-attack."
        )


def check_sources(plan, errors):
    sources = plan.get("citations") or plan.get("sources") or []
    if len(sources) < MIN_SOURCES:
        errors.append(
            f"citations: have {len(sources)}, need >={MIN_SOURCES} independent sources for "
            "market-size claims (Gartner / Forrester / IDC / Grand View / Crunchbase / LinkedIn)."
        )
    for i, src in enumerate(sources):
        if not isinstance(src, dict):
            continue
        url = src.get("url") or ""
        if url and not URL_RE.match(url):
            errors.append(f"citations[{i}]: url is not a valid URL: {url!r}")


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
    check_category_definition(plan, errors)
    check_market_signals(plan, errors)
    check_structural_forces(plan, errors)
    check_maturity(plan, errors)
    check_sources(plan, errors)

    result = {
        "valid": not errors,
        "errors": errors,
        "counts": {
            "adjacentCategories": len((plan.get("categoryDefinition") or {}).get("adjacentCategories") or []),
            "topFundedCompetitors": len((plan.get("marketSizeSignals") or {}).get("topFundedCompetitors") or []),
            "structuralForces": len(plan.get("structuralForces") or []),
            "citations": len(plan.get("citations") or plan.get("sources") or []),
        },
    }
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
