#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import re
import uuid
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable
from zoneinfo import ZoneInfo

from chatgpt_second_brain_lib import (
    DEFAULT_MANIFEST_JSON,
    clip_text,
    dedupe_preserve_order,
    format_timestamp,
    human_title,
    load_json,
    load_manifest,
    normalize_text,
    obsidian_safe_title,
    parse_message,
    raw_file_inventory,
    reset_dir,
    resolve_raw_root,
    selected_nodes_from_current_path,
    slugify,
    write_json,
)


LAST_YEAR_START = datetime(2025, 4, 8, 0, 0, tzinfo=ZoneInfo("America/Toronto"))
DEFAULT_OUTPUT_ROOT = Path("./triage")
DEFAULT_WIKI_ROOT = Path("./wiki")
DEFAULT_TIMEZONE = "America/Toronto"
DEFAULT_MODEL = "gpt-4o-mini"
DEFAULT_BASE_URL = "https://api.openai.com/v1"
DEFAULT_BATCH_COUNT = 10
MAX_PROMPT_TRANSCRIPT_CHARS = 90000

PRIMARY_DOMAINS = [
    "Work & Business",
    "Code & AI",
    "Personal Growth",
    "Health",
    "Relationships & Family",
    "Money & Legal",
    "Life Admin & Home",
    "Travel & Experiences",
    "Creative & Content",
    "Learning & Research",
]

INTENTS = [
    "decision",
    "planning",
    "research",
    "debugging",
    "reflection",
    "administrivia",
    "drafting",
    "lookup",
]

WORTH_VALUES = {"yes", "no", "review"}
CONFIDENCE_VALUES = {"high", "medium", "low"}
G_GENERIC_LABELS = {"general", "misc", "miscellaneous", "other", "unclear", "none", "n/a"}


@dataclass
class NormalizedConversation:
    id: str
    date: str | None
    title: str
    source_shard: str
    transcript_path: str
    message_count: int
    char_count: int
    user_turns: int
    assistant_turns: int
    transcript_text: str


@dataclass
class TriageConversation:
    id: str
    date: str | None
    title: str
    transcript_path: str
    primary_domain: str
    themes: list[str]
    entities: list[str]
    intents: list[str]
    worth_porting: str
    worth_reason: str
    confidence: str
    one_line_summary: str
    key_points: list[str]
    topic_candidates: list[str]
    entity_candidates: list[str]
    seed_topic: bool
    central_entities: list[str]
    source_note_required: bool


def parse_cli() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "stage",
        choices=(
            "normalize",
            "plan",
            "prepare",
            "submit-pilot",
            "submit-wave",
            "sync-batch",
            "sync-all",
            "repair-batch",
            "merge",
            "promote",
        ),
    )
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST_JSON)
    parser.add_argument("--raw-root", type=Path, default=None)
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT_ROOT)
    parser.add_argument("--wiki-root", type=Path, default=DEFAULT_WIKI_ROOT)
    parser.add_argument("--timezone", default=DEFAULT_TIMEZONE)
    parser.add_argument("--start-date", default="2000-01-01")
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--base-url", default=os.environ.get("OPENAI_BASE_URL", DEFAULT_BASE_URL))
    parser.add_argument("--batch-count", type=int, default=DEFAULT_BATCH_COUNT)
    parser.add_argument("--batch-id", default=None)
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--rebuild", action="store_true")
    parser.add_argument("--force", action="store_true")
    return parser.parse_args()


def yaml_string(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def yaml_list(values: Iterable[str]) -> list[str]:
    unique = dedupe_preserve_order(values)
    if not unique:
        return ["  - none"]
    return [f"  - {yaml_string(value)}" for value in unique]


def ndjson_write(path: Path, rows: Iterable[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")


def ndjson_read(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    if not path.exists():
        return rows
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
    return rows


def to_utc_start(date_string: str, timezone_name: str) -> datetime:
    local = datetime.fromisoformat(f"{date_string}T00:00:00").replace(tzinfo=ZoneInfo(timezone_name))
    return local.astimezone(timezone.utc)


def normalized_root(output_root: Path) -> Path:
    return output_root / "normalized"


def project_root(output_root: Path) -> Path:
    return output_root / "project"


def api_root(output_root: Path) -> Path:
    return output_root / "api"


def api_requests_root(output_root: Path) -> Path:
    return api_root(output_root) / "requests"


def api_results_root(output_root: Path) -> Path:
    return api_root(output_root) / "results"


def triage_root(output_root: Path) -> Path:
    return output_root / "triage"


def wiki_index_root(wiki_root: Path) -> Path:
    return wiki_root / "99 System"


def tracker_path(output_root: Path) -> Path:
    return project_root(output_root) / "tracker.json"


def decisions_path(output_root: Path) -> Path:
    return project_root(output_root) / "decisions.md"


def batches_root(output_root: Path) -> Path:
    return project_root(output_root) / "batches"


def sessions_root(output_root: Path) -> Path:
    return project_root(output_root) / "sessions"


def batch_manifest_path(output_root: Path, batch_id: str) -> Path:
    return batches_root(output_root) / f"{batch_id}.json"


def request_file_path(output_root: Path, batch_id: str) -> Path:
    return api_requests_root(output_root) / f"{batch_id}.jsonl"


def result_file_path(output_root: Path, batch_id: str) -> Path:
    return api_results_root(output_root) / f"{batch_id}.jsonl"


def batch_retry_file_path(output_root: Path, batch_id: str) -> Path:
    return triage_root(output_root) / "retries" / f"{batch_id}.jsonl"


def batch_validated_path(output_root: Path, batch_id: str) -> Path:
    return triage_root(output_root) / "validated" / f"{batch_id}.ndjson"


def clean_topic_label(value: str) -> str:
    return slugify(value.replace("/", "-").replace("::", "-"), max_length=60)


def display_label(value: str) -> str:
    value = value.replace("_", " ").replace("-", " ").strip()
    value = re.sub(r"\s{2,}", " ", value)
    return value.title() or "Untitled"


def session_stamp() -> str:
    return datetime.now(tz=timezone.utc).strftime("%Y-%m-%d-%H%M")


def transcript_markdown(conversation_id: str, title: str, source_shard: str, date_value: str | None, messages: list[Any]) -> str:
    lines = [
        "---",
        f"id: {yaml_string(conversation_id)}",
        f"title: {yaml_string(title)}",
        f"source_shard: {yaml_string(source_shard)}",
        f"date: {yaml_string(date_value or '')}",
        "---",
        "",
        f"# {title}",
        "",
        "## Transcript",
        "",
    ]
    for message in messages:
        lines.extend(
            [
                f"### {message.role.title()} | {message.create_time or 'unknown'}",
                "",
                message.text,
                "",
            ]
        )
    return "\n".join(lines).rstrip() + "\n"


def conversation_messages(conversation: dict[str, Any], tz: ZoneInfo) -> list[Any]:
    selected_nodes = selected_nodes_from_current_path(conversation)
    preferred: list[Any] = []
    fallback: list[Any] = []
    for node in selected_nodes:
        message = node.get("message")
        if not message:
            continue
        parsed = parse_message(message, tz)
        if not parsed:
            continue
        fallback.append(parsed)
        if parsed.role in {"user", "assistant"}:
            preferred.append(parsed)
    return preferred or fallback


def build_normalized_record(
    conversation: dict[str, Any],
    shard_name: str,
    messages: list[Any],
    tz: ZoneInfo,
) -> NormalizedConversation:
    _, created_date = format_timestamp(conversation.get("create_time"), tz)
    _, updated_date = format_timestamp(conversation.get("update_time"), tz)
    date_value = created_date or updated_date
    title = human_title(conversation.get("title") or "")
    transcript_text = transcript_markdown(
        conversation.get("id") or slugify(title),
        title,
        shard_name,
        date_value,
        messages,
    )
    return NormalizedConversation(
        id=conversation.get("id") or slugify(title),
        date=date_value,
        title=title,
        source_shard=shard_name,
        transcript_path="",
        message_count=len(messages),
        char_count=sum(len(message.text) for message in messages),
        user_turns=sum(1 for message in messages if message.role == "user"),
        assistant_turns=sum(1 for message in messages if message.role == "assistant"),
        transcript_text=transcript_text,
    )


def normalize_stage(
    raw_root: Path,
    output_root: Path,
    *,
    tz_name: str,
    rebuild: bool,
    start_date: str,
    limit: int | None,
) -> tuple[list[NormalizedConversation], dict[str, Any]]:
    tz = ZoneInfo(tz_name)
    cutoff = to_utc_start(start_date, tz_name)
    normalized_dir = normalized_root(output_root)
    transcripts_dir = normalized_dir / "transcripts"
    if rebuild:
        reset_dir(normalized_dir)
    else:
        normalized_dir.mkdir(parents=True, exist_ok=True)
        transcripts_dir.mkdir(parents=True, exist_ok=True)
    transcripts_dir.mkdir(parents=True, exist_ok=True)

    conversations: list[NormalizedConversation] = []
    skipped = Counter[str]()
    counts_by_month = Counter[str]()
    shard_paths = sorted(raw_root.glob("conversations-*.json"))

    for shard_path in shard_paths:
        shard_data = load_json(shard_path)
        for conversation in shard_data:
            if limit is not None and len(conversations) >= limit:
                break
            mapping = conversation.get("mapping")
            if not mapping:
                skipped["null_mapping"] += 1
                continue
            timestamp = conversation.get("create_time") or conversation.get("update_time")
            if timestamp is None:
                skipped["missing_timestamp"] += 1
                continue
            try:
                dt = datetime.fromtimestamp(float(timestamp), tz=timezone.utc)
            except (TypeError, ValueError, OSError):
                skipped["bad_timestamp"] += 1
                continue
            if dt < cutoff:
                skipped["before_cutoff"] += 1
                continue

            messages = conversation_messages(conversation, tz)
            if not messages:
                skipped["no_readable_messages"] += 1
                continue

            record = build_normalized_record(conversation, shard_path.name, messages, tz)
            transcript_name = f"{record.date or 'undated'} {slugify(obsidian_safe_title(record.title), max_length=70)} [{record.id[:8]}].md"
            transcript_path = transcripts_dir / transcript_name
            record.transcript_path = str(transcript_path)
            transcript_path.write_text(record.transcript_text, encoding="utf-8")
            conversations.append(record)
            if record.date:
                counts_by_month[record.date[:7]] += 1
        if limit is not None and len(conversations) >= limit:
            break

    rows = [asdict(record) for record in conversations]
    ndjson_write(normalized_dir / "conversations.ndjson", rows)
    write_json(normalized_dir / "conversations.json", rows)
    write_json(
        normalized_dir / "normalize_report.json",
        {
            "generated_at": datetime.now(tz=timezone.utc).isoformat(timespec="seconds"),
            "raw_root": str(raw_root),
            "normalized_root": str(normalized_dir),
            "conversation_count": len(conversations),
            "start_date": start_date,
            "timezone": tz_name,
            "counts_by_month": dict(sorted(counts_by_month.items())),
            "skipped_counts": dict(skipped),
        },
    )
    return conversations, {
        "normalized_count": len(conversations),
        "normalized_root": str(normalized_dir),
        "skipped_counts": dict(skipped),
    }


def load_normalized_records(output_root: Path) -> list[NormalizedConversation]:
    rows = ndjson_read(normalized_root(output_root) / "conversations.ndjson")
    return [NormalizedConversation(**row) for row in rows]


def sanitize_list(value: Any) -> list[str]:
    if isinstance(value, list):
        items = value
    elif value is None:
        items = []
    else:
        items = [value]
    cleaned: list[str] = []
    for item in items:
        if not isinstance(item, str):
            continue
        text = item.strip()
        if text:
            cleaned.append(text)
    return dedupe_preserve_order(cleaned)


def sanitize_domain(value: str | None) -> str:
    if not value:
        return "Learning & Research"
    lowered = value.strip().lower()
    for domain in PRIMARY_DOMAINS:
        if domain.lower() == lowered:
            return domain
    return "Learning & Research"


def sanitize_intents(values: list[str]) -> list[str]:
    cleaned = [value.strip().lower() for value in values if value and value.strip().lower() in INTENTS]
    if not cleaned:
        return ["research"]
    return dedupe_preserve_order(cleaned)[:2]


def sanitize_worth(value: str | None) -> str:
    lowered = (value or "").strip().lower()
    return lowered if lowered in WORTH_VALUES else "review"


def sanitize_confidence(value: str | None) -> str:
    lowered = (value or "").strip().lower()
    return lowered if lowered in CONFIDENCE_VALUES else "low"


def sanitize_labels(values: list[str]) -> list[str]:
    cleaned: list[str] = []
    for value in values:
        label = clean_topic_label(value)
        if label and label not in G_GENERIC_LABELS:
            cleaned.append(label)
    return dedupe_preserve_order(cleaned)[:6]


def sanitize_entities(values: list[str]) -> list[str]:
    cleaned: list[str] = []
    for value in values:
        text = value.strip()
        if text:
            cleaned.append(text)
    return dedupe_preserve_order(cleaned)[:8]


def triage_system_prompt() -> str:
    return "\n".join(
        [
            "You triage one ChatGPT conversation for a personal knowledge base.",
            "Return exactly one JSON object and nothing else.",
            "Be strict, but not over-strict. The goal is to preserve durable knowledge and discard disposable chat.",
            "Start from a skeptical stance, but do not throw away conversations that contain reusable professional reasoning, reusable frameworks, or durable decisions.",
            "Use only the allowed taxonomy values.",
            f"primary_domain must be one of: {', '.join(PRIMARY_DOMAINS)}",
            f"intents must be 1-2 items chosen only from: {', '.join(INTENTS)}",
            "worth_porting must be exactly one of: yes, no, review",
            "confidence must be exactly one of: high, medium, low",
            "themes should be 1-4 normalized lowercase slugs for broad reusable themes.",
            "topic_candidates should be 1-4 normalized lowercase slugs for future wiki pages.",
            "entities should be canonical proper-noun names.",
            "entity_candidates should be canonical proper-noun names.",
            "central_entities should be 0-3 canonical entity names.",
            "seed_topic should be true only in rare cases where this single conversation clearly justifies a topic page by itself.",
            "source_note_required should be true only when worth_porting is yes.",
            "Use worth_porting=yes only for durable material such as:",
            "- ongoing project context that will matter later",
            "- business or technical decisions with reusable reasoning",
            "- reusable frameworks, checklists, architectures, workflows, or operating principles",
            "- durable personal reflection or self-knowledge that would matter to revisit later",
            "- research synthesis likely to inform future work, not just answer a one-off question",
            "- conversations that clearly update or strengthen an existing long-lived topic page",
            "- pricing, proposal, architecture, legal-structure, or product-strategy discussions when they contain reusable reasoning or durable business context",
            "Use worth_porting=no for anything disposable or one-off, including:",
            "- gift ideas, wedding ideas, shopping suggestions, product recommendations",
            "- etiquette questions, social phrasing, text rewrites, grammar fixes, tone fixes",
            "- simple definitions, abbreviations, terminology explanations, fact lookups",
            "- basic how-to questions with no broader project context",
            "- one-off legal, tax, finance, or technical lookups that answer a narrow question but do not create reusable reasoning",
            "- random travel, food, anime, weather, or current-event queries",
            "Use worth_porting=review for borderline professional conversations where the topic may matter later but the specific conversation is thin, mixed, or ambiguous.",
            "Important: being useful in the moment is not enough. Mark yes only if it is likely worth retrieving and rereading in the future.",
            "Important: if the conversation is just a lookup or advice snippet, even if the topic sounds serious, prefer no.",
            "Important: do not mark yes just because the topic could theoretically matter. There must be durable reasoning, durable context, reusable synthesis, or reusable communication in this specific conversation.",
            "Important: do not mark no just because the conversation is short. A short conversation can still be yes if it captures a durable decision, reusable template, or durable strategy.",
            "Borderline rule: if a conversation sits between yes and no and involves work, code, pricing, contracts, proposals, architecture, or reusable communication, prefer review over no.",
            "Examples that should usually be no: gift ideas, wedding gift ideas, etiquette questions, simple definitions, spelling checks, simple payment how-tos, weather/news lookups.",
            "Examples that can be yes: architecture tradeoff discussions, proposal/pricing rationale, contract clause analysis, reusable client communication strategy, project plans with concrete reasoning.",
            "When in doubt between yes and review, choose review. When in doubt between review and no for purely disposable consumer queries, choose no.",
            "Return valid JSON with exactly these keys:",
            "id, date, title, primary_domain, themes, entities, intents, worth_porting, worth_reason, confidence, one_line_summary, key_points, topic_candidates, entity_candidates, seed_topic, central_entities, source_note_required",
        ]
    )


def prompt_payload(record: NormalizedConversation) -> str:
    transcript = record.transcript_text
    if len(transcript) > MAX_PROMPT_TRANSCRIPT_CHARS:
        head_chars = MAX_PROMPT_TRANSCRIPT_CHARS // 2
        tail_chars = MAX_PROMPT_TRANSCRIPT_CHARS - head_chars
        transcript = "\n".join(
            [
                transcript[:head_chars].rstrip(),
                "",
                f"[TRUNCATED FOR LENGTH: showing first {head_chars} chars and last {tail_chars} chars of transcript]",
                "",
                transcript[-tail_chars:].lstrip(),
            ]
        )
    return "\n".join(
        [
            "CONVERSATION METADATA",
            f"id: {record.id}",
            f"title: {record.title}",
            f"date: {record.date or ''}",
            f"source_shard: {record.source_shard}",
            "",
            "TRANSCRIPT",
            transcript,
        ]
    )


def coerce_triage_record(raw: dict[str, Any], record: NormalizedConversation) -> TriageConversation:
    worth = sanitize_worth(raw.get("worth_porting"))
    entities = sanitize_entities(sanitize_list(raw.get("entities")))
    entity_candidates = sanitize_entities(sanitize_list(raw.get("entity_candidates"))) or entities
    central_entities = sanitize_entities(sanitize_list(raw.get("central_entities")))[:3]
    themes = sanitize_labels(sanitize_list(raw.get("themes")))
    topic_candidates = sanitize_labels(sanitize_list(raw.get("topic_candidates")))
    if not topic_candidates:
        topic_candidates = sanitize_labels([record.title, *(themes[:2] or []), *(entity_candidates[:2] or [])])
    if not themes:
        themes = topic_candidates[:2] or ["general"]
    result = TriageConversation(
        id=str(raw.get("id") or record.id),
        date=str(raw.get("date") or record.date or ""),
        title=str(raw.get("title") or record.title),
        transcript_path=record.transcript_path,
        primary_domain=sanitize_domain(raw.get("primary_domain")),
        themes=themes[:4],
        entities=entities[:8],
        intents=sanitize_intents(sanitize_list(raw.get("intents"))),
        worth_porting=worth,
        worth_reason=clip_text(str(raw.get("worth_reason") or "No reason provided.").strip(), 240),
        confidence=sanitize_confidence(raw.get("confidence")),
        one_line_summary=clip_text(str(raw.get("one_line_summary") or record.title), 220),
        key_points=[clip_text(item, 220) for item in sanitize_list(raw.get("key_points"))[:5]],
        topic_candidates=topic_candidates[:6],
        entity_candidates=entity_candidates[:8],
        seed_topic=bool(raw.get("seed_topic")),
        central_entities=central_entities[:3],
        source_note_required=worth == "yes",
    )
    if not result.key_points:
        result.key_points = [clip_text(record.title, 220)]
    return result


def plan_batches(records: list[NormalizedConversation], batch_count: int) -> list[dict[str, Any]]:
    ordered = sorted(records, key=lambda item: (item.date or "9999-99-99", item.id))
    if len(ordered) < batch_count:
        raise ValueError(f"Cannot create {batch_count} batches from only {len(ordered)} conversations.")

    suffix_chars = [0] * (len(ordered) + 1)
    for idx in range(len(ordered) - 1, -1, -1):
        suffix_chars[idx] = suffix_chars[idx + 1] + ordered[idx].char_count

    batches: list[dict[str, Any]] = []
    start = 0
    for batch_index in range(batch_count):
        batch_id = f"LYB{batch_index + 1:03d}"
        remaining_batches = batch_count - batch_index
        remaining_records = len(ordered) - start
        remaining_chars = suffix_chars[start]
        target_chars = remaining_chars / remaining_batches

        if remaining_batches == 1:
            end = len(ordered)
        else:
            max_end = len(ordered) - (remaining_batches - 1)
            running = 0
            best_end = start + 1
            best_diff = float("inf")
            for end_candidate in range(start + 1, max_end + 1):
                running += ordered[end_candidate - 1].char_count
                diff = abs(running - target_chars)
                if diff <= best_diff:
                    best_diff = diff
                    best_end = end_candidate
                if running >= target_chars and diff > best_diff:
                    break
            end = best_end

        items = ordered[start:end]
        batches.append(
            {
                "batch_id": batch_id,
                "status": "planned",
                "conversation_ids": [item.id for item in items],
                "date_start": items[0].date,
                "date_end": items[-1].date,
                "conversation_count": len(items),
                "char_count": sum(item.char_count for item in items),
                "request_file": "",
                "result_file": "",
                "submitted_at": None,
                "completed_at": None,
                "validated_at": None,
                "input_file_id": None,
                "batch_api_id": None,
                "output_file_id": None,
                "error_file_id": None,
                "triage_counts": {"yes": 0, "no": 0, "review": 0},
                "notes_touched": [],
                "session_summary": "",
                "open_followups": [],
            }
        )
        start = end

    if start != len(ordered):
        raise RuntimeError("Batch planning failed to assign every conversation.")
    return batches


def build_request_row(record: NormalizedConversation, model: str) -> dict[str, Any]:
    return {
        "custom_id": record.id,
        "method": "POST",
        "url": "/v1/chat/completions",
        "body": {
            "model": model,
            "temperature": 0.0,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": triage_system_prompt()},
                {"role": "user", "content": prompt_payload(record)},
            ],
        },
    }


def ensure_project_docs(output_root: Path) -> None:
    root = project_root(output_root)
    batches_root(output_root).mkdir(parents=True, exist_ok=True)
    sessions_root(output_root).mkdir(parents=True, exist_ok=True)
    api_requests_root(output_root).mkdir(parents=True, exist_ok=True)
    api_results_root(output_root).mkdir(parents=True, exist_ok=True)
    (triage_root(output_root) / "retries").mkdir(parents=True, exist_ok=True)
    (triage_root(output_root) / "validated").mkdir(parents=True, exist_ok=True)

    readme = "\n".join(
        [
            "# Last-Year API Rebuild Project",
            "",
            "This folder is the run-control surface for the 10-batch last-year chat triage rebuild.",
            "",
            "Workflow:",
            "",
            "1. Run `normalize` if the normalized corpus does not exist or needs a rebuild.",
            "2. Run `plan` to create exactly 10 chronological balanced batches and generate JSONL request files.",
            "3. Submit only the pilot batch `LYB001`.",
            "4. Sync and validate `LYB001` results.",
            "5. Review the pilot output manually.",
            "6. If accepted, submit `LYB002` through `LYB010` as one production wave.",
            "7. Sync all completed batches.",
            "8. Merge validated batch results into canonical triage outputs.",
            "9. Render the wiki from validated results only.",
            "",
            "Do not edit tracker status by hand unless you are recovering from a broken API run.",
        ]
    )
    (root / "README.md").write_text(readme + "\n", encoding="utf-8")

    decisions = "\n".join(
        [
            "# Decisions",
            "",
            "## Worth Porting",
            "",
            "- `yes`: durable project context, durable reflection, reusable reasoning, reusable research, or material that should update the persistent wiki.",
            "- `no`: disposable lookup, wording-only help, low-signal one-off, or random factual search with no durable value.",
            "- `review`: mixed, sensitive, or ambiguous conversations.",
            "",
            "## Domains",
            "",
            *[f"- `{domain}`" for domain in PRIMARY_DOMAINS],
            "",
            "## Intents",
            "",
            *[f"- `{intent}`" for intent in INTENTS],
        ]
    )
    decisions_path(output_root).write_text(decisions + "\n", encoding="utf-8")


def create_tracker(output_root: Path, records: list[NormalizedConversation], model: str, batches: list[dict[str, Any]]) -> dict[str, Any]:
    tracker = {
        "generated_at": datetime.now(tz=timezone.utc).isoformat(timespec="seconds"),
        "conversation_count": len(records),
        "batch_count": len(batches),
        "model": model,
        "run_mode": "openai_batch_api",
        "pilot_batch_id": "LYB001",
        "pilot_status": "planned",
        "remaining_wave_status": "planned",
        "next_action": "submit LYB001",
        "stats": {
            "pending": len(batches),
            "submitted": 0,
            "completed": 0,
            "validated": 0,
            "failed": 0,
            "promoted": 0,
            "discarded": 0,
            "review": 0,
        },
        "batches": [
            {
                "batch_id": batch["batch_id"],
                "status": batch["status"],
                "conversation_count": batch["conversation_count"],
                "char_count": batch["char_count"],
                "date_start": batch["date_start"],
                "date_end": batch["date_end"],
                "request_file": str(request_file_path(output_root, batch["batch_id"])),
                "result_file": str(result_file_path(output_root, batch["batch_id"])),
                "submitted_at": batch["submitted_at"],
                "completed_at": batch["completed_at"],
                "validated_at": batch["validated_at"],
                "input_file_id": batch["input_file_id"],
                "batch_api_id": batch["batch_api_id"],
                "output_file_id": batch["output_file_id"],
                "error_file_id": batch["error_file_id"],
                "triage_counts": batch["triage_counts"],
            }
            for batch in batches
        ],
    }
    return tracker


def recompute_tracker_stats(output_root: Path, tracker: dict[str, Any]) -> dict[str, Any]:
    batch_files = []
    for summary in tracker.get("batches", []):
        path = batch_manifest_path(output_root, summary["batch_id"])
        if path.exists():
            batch_files.append(load_json(path))

    status_counts = Counter(batch["status"] for batch in batch_files)
    promoted = 0
    discarded = 0
    review = 0
    for batch in batch_files:
        promoted += batch.get("triage_counts", {}).get("yes", 0)
        discarded += batch.get("triage_counts", {}).get("no", 0)
        review += batch.get("triage_counts", {}).get("review", 0)

    tracker["stats"] = {
        "pending": status_counts.get("planned", 0),
        "submitted": status_counts.get("submitted", 0),
        "completed": status_counts.get("completed", 0),
        "validated": status_counts.get("validated", 0),
        "failed": status_counts.get("failed", 0),
        "promoted": promoted,
        "discarded": discarded,
        "review": review,
    }
    tracker["pilot_status"] = next(
        (batch["status"] for batch in batch_files if batch["batch_id"] == tracker.get("pilot_batch_id")),
        "planned",
    )

    remaining_batches = [batch for batch in batch_files if batch["batch_id"] != tracker.get("pilot_batch_id")]
    if remaining_batches and all(batch["status"] == "validated" for batch in remaining_batches):
        tracker["remaining_wave_status"] = "validated"
    elif any(batch["status"] in {"submitted", "completed"} for batch in remaining_batches):
        tracker["remaining_wave_status"] = "submitted"
    elif any(batch["status"] == "failed" for batch in remaining_batches):
        tracker["remaining_wave_status"] = "failed"
    else:
        tracker["remaining_wave_status"] = "planned"

    next_batch = next((batch["batch_id"] for batch in batch_files if batch["status"] == "planned"), None)
    pilot_status = tracker.get("pilot_status")
    if pilot_status == "validated" and any(batch["status"] == "planned" for batch in remaining_batches):
        tracker["next_action"] = "review LYB001 before submit-wave"
    else:
        tracker["next_action"] = "merge validated results" if next_batch is None else f"submit {next_batch}"
    tracker["batches"] = [
        {
            "batch_id": batch["batch_id"],
            "status": batch["status"],
            "conversation_count": batch["conversation_count"],
            "char_count": batch["char_count"],
            "date_start": batch["date_start"],
            "date_end": batch["date_end"],
            "request_file": batch["request_file"],
            "result_file": batch["result_file"],
            "submitted_at": batch.get("submitted_at"),
            "completed_at": batch.get("completed_at"),
            "validated_at": batch.get("validated_at"),
            "input_file_id": batch.get("input_file_id"),
            "batch_api_id": batch.get("batch_api_id"),
            "output_file_id": batch.get("output_file_id"),
            "error_file_id": batch.get("error_file_id"),
            "triage_counts": batch.get("triage_counts", {"yes": 0, "no": 0, "review": 0}),
        }
        for batch in batch_files
    ]
    tracker["generated_at"] = datetime.now(tz=timezone.utc).isoformat(timespec="seconds")
    write_json(tracker_path(output_root), tracker)
    return tracker


def plan_stage(output_root: Path, *, model: str, batch_count: int, rebuild: bool) -> dict[str, Any]:
    records = load_normalized_records(output_root)
    if not records:
        raise RuntimeError("No normalized conversations found. Run normalize first.")

    if rebuild:
        reset_dir(project_root(output_root))
        reset_dir(api_root(output_root))
        reset_dir(triage_root(output_root))
        wiki_report = output_root / "wiki_report.json"
        if wiki_report.exists():
            wiki_report.unlink()
    ensure_project_docs(output_root)

    batches = plan_batches(records, batch_count)
    records_by_id = {record.id: record for record in records}

    for batch in batches:
        batch["request_file"] = str(request_file_path(output_root, batch["batch_id"]))
        batch["result_file"] = str(result_file_path(output_root, batch["batch_id"]))
        items = [records_by_id[conversation_id] for conversation_id in batch["conversation_ids"]]
        request_rows = [build_request_row(item, model) for item in items]
        ndjson_write(request_file_path(output_root, batch["batch_id"]), request_rows)
        write_json(batch_manifest_path(output_root, batch["batch_id"]), batch)

    tracker = create_tracker(output_root, records, model, batches)
    write_json(tracker_path(output_root), tracker)

    session_lines = [
        "# Session Log",
        "",
        f"- Action: planned {len(batches)} batches",
        f"- Conversations: {len(records)}",
        f"- Model: {model}",
        f"- Pilot batch: LYB001",
    ]
    (sessions_root(output_root) / f"{session_stamp()}-plan.md").write_text("\n".join(session_lines) + "\n", encoding="utf-8")

    batch_counts = {batch["batch_id"]: {"conversation_count": batch["conversation_count"], "char_count": batch["char_count"]} for batch in batches}
    report = {
        "generated_at": datetime.now(tz=timezone.utc).isoformat(timespec="seconds"),
        "batch_count": len(batches),
        "conversation_count": len(records),
        "model": model,
        "batches": batch_counts,
    }
    write_json(project_root(output_root) / "plan_report.json", report)
    return report


def ensure_api_key() -> str:
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is required for Batch API operations.")
    return api_key


def api_json_request(base_url: str, api_key: str, method: str, path: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    url = base_url.rstrip("/") + path
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method=method,
    )
    with urllib.request.urlopen(request, timeout=300) as response:
        return json.loads(response.read().decode("utf-8"))


def api_download(base_url: str, api_key: str, path: str) -> bytes:
    url = base_url.rstrip("/") + path
    request = urllib.request.Request(
        url,
        headers={"Authorization": f"Bearer {api_key}"},
        method="GET",
    )
    with urllib.request.urlopen(request, timeout=300) as response:
        return response.read()


def api_chat_completion_json(base_url: str, api_key: str, payload: dict[str, Any]) -> dict[str, Any]:
    url = base_url.rstrip("/") + "/chat/completions"
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=300) as response:
        return json.loads(response.read().decode("utf-8"))


def multipart_form_request(base_url: str, api_key: str, path: str, fields: dict[str, str], file_field: str, file_path: Path) -> dict[str, Any]:
    boundary = f"----CodexBoundary{uuid.uuid4().hex}"
    chunks: list[bytes] = []
    for name, value in fields.items():
        chunks.extend(
            [
                f"--{boundary}\r\n".encode("utf-8"),
                f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode("utf-8"),
                value.encode("utf-8"),
                b"\r\n",
            ]
        )
    mime_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
    file_bytes = file_path.read_bytes()
    chunks.extend(
        [
            f"--{boundary}\r\n".encode("utf-8"),
            f'Content-Disposition: form-data; name="{file_field}"; filename="{file_path.name}"\r\n'.encode("utf-8"),
            f"Content-Type: {mime_type}\r\n\r\n".encode("utf-8"),
            file_bytes,
            b"\r\n",
            f"--{boundary}--\r\n".encode("utf-8"),
        ]
    )
    body = b"".join(chunks)
    url = base_url.rstrip("/") + path
    request = urllib.request.Request(
        url,
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=300) as response:
        return json.loads(response.read().decode("utf-8"))


def load_tracker(output_root: Path) -> dict[str, Any]:
    path = tracker_path(output_root)
    if not path.exists():
        raise RuntimeError("Tracker missing. Run plan first.")
    return load_json(path)


def load_batch_manifest(output_root: Path, batch_id: str) -> dict[str, Any]:
    path = batch_manifest_path(output_root, batch_id)
    if not path.exists():
        raise RuntimeError(f"Batch manifest missing for {batch_id}.")
    return load_json(path)


def save_batch_manifest(output_root: Path, batch: dict[str, Any]) -> None:
    write_json(batch_manifest_path(output_root, batch["batch_id"]), batch)


def submit_batch(output_root: Path, base_url: str, model: str, batch_id: str) -> dict[str, Any]:
    tracker = load_tracker(output_root)
    batch = load_batch_manifest(output_root, batch_id)
    if batch["status"] not in {"planned", "failed"}:
        raise RuntimeError(f"Batch {batch_id} is not submittable from status {batch['status']}.")

    api_key = ensure_api_key()
    request_path = request_file_path(output_root, batch_id)
    upload = multipart_form_request(base_url, api_key, "/files", {"purpose": "batch"}, "file", request_path)
    batch_create = api_json_request(
        base_url,
        api_key,
        "POST",
        "/batches",
        {
            "input_file_id": upload["id"],
            "endpoint": "/v1/chat/completions",
            "completion_window": "24h",
            "metadata": {
                "batch_id": batch_id,
                "model": model,
            },
        },
    )

    timestamp = datetime.now(tz=timezone.utc).isoformat(timespec="seconds")
    batch["status"] = "submitted"
    batch["submitted_at"] = timestamp
    batch["input_file_id"] = upload["id"]
    batch["batch_api_id"] = batch_create["id"]
    batch["session_summary"] = f"Submitted {batch_id} to OpenAI Batch API using {model}."
    save_batch_manifest(output_root, batch)

    label = "pilot-submission" if batch_id == tracker.get("pilot_batch_id") else "wave-submission"
    (sessions_root(output_root) / f"{session_stamp()}-{label}.md").write_text(
        "\n".join(
            [
                "# Session Log",
                "",
                f"- Action: submitted {batch_id}",
                f"- Batch API id: {batch_create['id']}",
                f"- Input file id: {upload['id']}",
                f"- Request file: {request_path}",
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    return recompute_tracker_stats(output_root, tracker)


def submit_pilot_stage(output_root: Path, base_url: str, model: str) -> dict[str, Any]:
    return submit_batch(output_root, base_url, model, "LYB001")


def submit_wave_stage(output_root: Path, base_url: str, model: str) -> dict[str, Any]:
    tracker = load_tracker(output_root)
    if tracker.get("pilot_status") != "validated":
        raise RuntimeError("Pilot batch is not validated. Validate LYB001 before submitting the remaining wave.")
    for batch_summary in tracker.get("batches", []):
        batch_id = batch_summary["batch_id"]
        if batch_id == "LYB001":
            continue
        if batch_summary["status"] == "planned":
            submit_batch(output_root, base_url, model, batch_id)
    return load_tracker(output_root)


def parse_model_json(content: str) -> dict[str, Any]:
    text = content.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    if "{" in text and "}" in text:
        start = text.find("{")
        end = text.rfind("}")
        text = text[start : end + 1]
    return json.loads(text)


def sync_batch_stage(output_root: Path, base_url: str, batch_id: str) -> dict[str, Any]:
    tracker = load_tracker(output_root)
    batch = load_batch_manifest(output_root, batch_id)
    if not batch.get("batch_api_id"):
        raise RuntimeError(f"Batch {batch_id} has not been submitted.")

    api_key = ensure_api_key()
    remote = api_json_request(base_url, api_key, "GET", f"/batches/{batch['batch_api_id']}")
    remote_status = remote.get("status")
    batch["output_file_id"] = remote.get("output_file_id")
    batch["error_file_id"] = remote.get("error_file_id")

    if remote_status == "completed" and remote.get("output_file_id"):
        result_bytes = api_download(base_url, api_key, f"/files/{remote['output_file_id']}/content")
        result_path = result_file_path(output_root, batch_id)
        result_path.parent.mkdir(parents=True, exist_ok=True)
        result_path.write_bytes(result_bytes)
        batch["status"] = "completed"
        batch["completed_at"] = datetime.now(tz=timezone.utc).isoformat(timespec="seconds")
        batch["result_file"] = str(result_path)
    elif remote_status in {"failed", "expired", "cancelled"}:
        batch["status"] = "failed"
        batch["completed_at"] = datetime.now(tz=timezone.utc).isoformat(timespec="seconds")
        batch["open_followups"] = [f"Remote batch status: {remote_status}"]
    else:
        batch["status"] = "submitted"

    save_batch_manifest(output_root, batch)
    recompute_tracker_stats(output_root, tracker)

    if batch["status"] == "completed":
        return validate_batch_stage(output_root, batch_id)
    return load_tracker(output_root)


def validate_batch_stage(output_root: Path, batch_id: str) -> dict[str, Any]:
    tracker = load_tracker(output_root)
    batch = load_batch_manifest(output_root, batch_id)
    records_by_id = {record.id: record for record in load_normalized_records(output_root)}
    validated_path = batch_validated_path(output_root, batch_id)
    result_rows = ndjson_read(result_file_path(output_root, batch_id))
    existing_valid_rows = ndjson_read(validated_path)
    valid_by_id: dict[str, dict[str, Any]] = {row["id"]: row for row in existing_valid_rows}
    retry_rows: list[dict[str, Any]] = []
    triage_counts = Counter[str]()
    seen_ids: set[str] = set(valid_by_id)

    for row in result_rows:
        custom_id = row.get("custom_id")
        response = row.get("response") or {}
        body = response.get("body") or {}
        message_content = ""
        try:
            message_content = body["choices"][0]["message"]["content"]
            parsed = parse_model_json(message_content)
            if custom_id not in records_by_id:
                raise ValueError(f"Unknown custom_id {custom_id}")
            triage = coerce_triage_record(parsed, records_by_id[custom_id])
            if triage.source_note_required != (triage.worth_porting == "yes"):
                raise ValueError("source_note_required mismatch")
            if triage.primary_domain not in PRIMARY_DOMAINS:
                raise ValueError("invalid primary_domain")
            for intent in triage.intents:
                if intent not in INTENTS:
                    raise ValueError("invalid intent")
            if triage.worth_porting not in WORTH_VALUES:
                raise ValueError("invalid worth_porting")
            seen_ids.add(triage.id)
            valid_by_id[triage.id] = asdict(triage)
        except Exception as exc:
            retry_rows.append(
                {
                    "custom_id": custom_id,
                    "error": str(exc),
                    "raw_row": row,
                    "raw_content": message_content,
                }
            )

    expected_ids = set(batch["conversation_ids"])
    missing_ids = sorted(expected_ids - seen_ids)
    for missing_id in missing_ids:
        retry_rows.append({"custom_id": missing_id, "error": "Missing response row"})

    valid_rows = sorted(valid_by_id.values(), key=lambda item: (item.get("date") or "9999-99-99", item["id"]))
    for row in valid_rows:
        triage_counts[row["worth_porting"]] += 1
    ndjson_write(validated_path, valid_rows)
    if retry_rows:
        ndjson_write(batch_retry_file_path(output_root, batch_id), retry_rows)
        batch["status"] = "failed"
        batch["open_followups"] = [f"Retry invalid rows from {batch_retry_file_path(output_root, batch_id)}"]
    else:
        retry_path = batch_retry_file_path(output_root, batch_id)
        if retry_path.exists():
            retry_path.unlink()
        batch["status"] = "validated"
        batch["validated_at"] = datetime.now(tz=timezone.utc).isoformat(timespec="seconds")
        batch["open_followups"] = []

    batch["triage_counts"] = {"yes": triage_counts.get("yes", 0), "no": triage_counts.get("no", 0), "review": triage_counts.get("review", 0)}
    save_batch_manifest(output_root, batch)

    sample_path = project_root(output_root) / f"{batch_id}_pilot_sample.md"
    if batch_id == "LYB001" and valid_rows:
        sample_path.write_text(build_pilot_sample_markdown(valid_rows), encoding="utf-8")

    return recompute_tracker_stats(output_root, tracker)


def repair_batch_stage(output_root: Path, base_url: str, model: str, batch_id: str) -> dict[str, Any]:
    retry_path = batch_retry_file_path(output_root, batch_id)
    if not retry_path.exists():
        raise RuntimeError(f"No retry file found for {batch_id}.")

    api_key = ensure_api_key()
    records_by_id = {record.id: record for record in load_normalized_records(output_root)}
    retries = ndjson_read(retry_path)
    if not retries:
        raise RuntimeError(f"Retry file is empty for {batch_id}.")

    repaired_rows: list[dict[str, Any]] = []
    unresolved_rows: list[dict[str, Any]] = []

    for retry in retries:
        custom_id = retry.get("custom_id")
        if custom_id not in records_by_id:
            unresolved_rows.append({**retry, "error": f"Unknown custom_id {custom_id}"})
            continue
        record = records_by_id[custom_id]
        payload = {
            "model": model,
            "temperature": 0.0,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": triage_system_prompt()},
                {"role": "user", "content": prompt_payload(record)},
            ],
        }
        try:
            response = api_chat_completion_json(base_url, api_key, payload)
            content = response["choices"][0]["message"]["content"]
            parsed = json.loads(content)
            triage = coerce_triage_record(parsed, record)
            repaired_rows.append(asdict(triage))
        except Exception as exc:
            unresolved_rows.append({**retry, "error": str(exc)})

    validated_path = batch_validated_path(output_root, batch_id)
    existing_rows = ndjson_read(validated_path)
    by_id = {row["id"]: row for row in existing_rows}
    for row in repaired_rows:
        by_id[row["id"]] = row
    merged_rows = sorted(by_id.values(), key=lambda item: (item.get("date") or "9999-99-99", item["id"]))
    ndjson_write(validated_path, merged_rows)

    if unresolved_rows:
        ndjson_write(retry_path, unresolved_rows)
    else:
        retry_path.unlink(missing_ok=True)

    return validate_batch_stage(output_root, batch_id)


def build_pilot_sample_markdown(rows: list[dict[str, Any]]) -> str:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        grouped[row["worth_porting"]].append(row)
    sample: list[dict[str, Any]] = []
    for worth in ("yes", "no", "review"):
        sample.extend(grouped[worth][:10])
    if len(sample) < 30:
        leftovers = [row for row in rows if row not in sample]
        sample.extend(leftovers[: 30 - len(sample)])
    lines = [
        "# Pilot Sample",
        "",
        "Use this file for the manual acceptance review of LYB001.",
        "",
    ]
    for row in sample:
        lines.extend(
            [
                f"## {row['date'] or 'unknown'} | {row['worth_porting']} | {row['title']}",
                "",
                f"- id: `{row['id']}`",
                f"- domain: `{row['primary_domain']}`",
                f"- confidence: `{row['confidence']}`",
                f"- summary: {row['one_line_summary']}",
                f"- reason: {row['worth_reason']}",
                "",
            ]
        )
    return "\n".join(lines).rstrip() + "\n"


def sync_all_stage(output_root: Path, base_url: str) -> dict[str, Any]:
    tracker = load_tracker(output_root)
    for batch_summary in tracker.get("batches", []):
        if batch_summary["status"] == "submitted":
            sync_batch_stage(output_root, base_url, batch_summary["batch_id"])
    return load_tracker(output_root)


def merge_triage_stage(output_root: Path, model: str) -> dict[str, Any]:
    tracker = load_tracker(output_root)
    batches = [load_batch_manifest(output_root, item["batch_id"]) for item in tracker.get("batches", [])]
    validated_batches = [batch for batch in batches if batch["status"] == "validated"]
    rows: list[dict[str, Any]] = []
    for batch in sorted(validated_batches, key=lambda item: item["batch_id"]):
        rows.extend(ndjson_read(batch_validated_path(output_root, batch["batch_id"])))
    rows.sort(key=lambda item: (item.get("date") or "9999-99-99", item["id"]))
    ndjson_write(triage_root(output_root) / "triage.ndjson", rows)
    write_json(triage_root(output_root) / "triage.json", rows)

    domain_counts = Counter()
    intent_counts = Counter()
    worth_counts = Counter()
    confidence_counts = Counter()
    theme_counts = Counter()
    review_items = []

    for row in rows:
        domain_counts[row["primary_domain"]] += 1
        worth_counts[row["worth_porting"]] += 1
        confidence_counts[row["confidence"]] += 1
        for intent in row["intents"]:
            intent_counts[intent] += 1
        for theme in row["themes"]:
            theme_counts[theme] += 1
        if row["worth_porting"] == "review":
            review_items.append(
                {
                    "id": row["id"],
                    "date": row["date"],
                    "title": row["title"],
                    "reason": row["worth_reason"],
                    "transcript_path": row["transcript_path"],
                }
            )

    write_json(
        triage_root(output_root) / "review_queue.json",
        {
            "generated_at": datetime.now(tz=timezone.utc).isoformat(timespec="seconds"),
            "review_count": len(review_items),
            "items": review_items,
        },
    )
    write_json(
        triage_root(output_root) / "triage_report.json",
        {
            "generated_at": datetime.now(tz=timezone.utc).isoformat(timespec="seconds"),
            "conversation_count": len(rows),
            "validated_batch_count": len(validated_batches),
            "primary_domain_counts": dict(domain_counts),
            "intent_counts": dict(intent_counts),
            "worth_porting_counts": dict(worth_counts),
            "confidence_counts": dict(confidence_counts),
            "theme_counts": dict(theme_counts),
            "model": model,
            "mode": "openai_batch_api",
        },
    )
    review_md = ["# Review Queue", "", f"- Review items: {len(review_items)}", ""]
    for item in review_items:
        review_md.append(f"- `{item['date'] or 'unknown'}` {item['title']} [Open transcript](<{item['transcript_path']}>) - {item['reason']}")
    (triage_root(output_root) / "review_queue.md").write_text("\n".join(review_md).rstrip() + "\n", encoding="utf-8")
    return {
        "validated_batch_count": len(validated_batches),
        "triage_count": len(rows),
        "review_count": len(review_items),
        "triage_root": str(triage_root(output_root)),
    }


def load_triage_records(output_root: Path) -> list[TriageConversation]:
    rows = ndjson_read(triage_root(output_root) / "triage.ndjson")
    return [TriageConversation(**row) for row in rows]


def source_note_name(record: TriageConversation) -> str:
    title = obsidian_safe_title(record.title)
    return f"{record.date or 'undated'} {slugify(title, max_length=70)} [{record.id[:8]}].md"


def topic_name(label: str) -> str:
    return f"{slugify(label, max_length=80)}.md"


def entity_name(label: str) -> str:
    return f"{slugify(label, max_length=80)}.md"


def domain_note_name(domain: str) -> str:
    return f"{domain}.md"


def compute_source_note_tier(record: TriageConversation, normalized: NormalizedConversation | None) -> str:
    if record.worth_porting != "yes":
        return "none"
    score = 0
    key_point_count = len(record.key_points or [])
    topic_count = len(record.topic_candidates or [])
    entity_count = len(dedupe_preserve_order([*record.entity_candidates, *record.central_entities]))
    transcript_chars = normalized.char_count if normalized else 0

    if record.seed_topic:
        score += 3
    if key_point_count >= 4:
        score += 1
    if key_point_count >= 5:
        score += 1
    if topic_count >= 3:
        score += 1
    if entity_count >= 2:
        score += 1
    if len(record.worth_reason or "") >= 140:
        score += 1
    if record.confidence == "high":
        score += 1
    if transcript_chars >= 6000:
        score += 1
    if any(intent in {"decision", "planning", "research", "debugging", "reflection"} for intent in record.intents):
        score += 1
    return "full" if score >= 6 else "synthesis_only"


def render_source_note(record: TriageConversation, transcript_path: str) -> str:
    lines = [
        "---",
        f"id: {yaml_string(record.id)}",
        f"title: {yaml_string(record.title)}",
        f"date: {yaml_string(record.date or '')}",
        f"domain: {yaml_string(record.primary_domain)}",
        "note_type: source_note",
        "themes:",
        *yaml_list(record.themes),
        "topic_candidates:",
        *yaml_list(record.topic_candidates),
        "entities:",
        *yaml_list(record.entities),
        "entity_candidates:",
        *yaml_list(record.entity_candidates),
        "intents:",
        *yaml_list(record.intents),
        f"worth_porting: {yaml_string(record.worth_porting)}",
        'source_note_tier: "full"',
        f"seed_topic: {str(record.seed_topic).lower()}",
        "central_entities:",
        *yaml_list(record.central_entities),
        "---",
        "",
        f"# {record.title}",
        "",
        "## Summary",
        "",
        record.one_line_summary,
        "",
        "## Key Points",
        "",
    ]
    for point in record.key_points or [record.one_line_summary]:
        lines.append(f"- {point}")
    lines.extend(
        [
            "",
            "## Why It Was Kept",
            "",
            record.worth_reason,
            "",
            "## Topics",
            "",
        ]
    )
    for topic in record.topic_candidates or ["none"]:
        lines.append(f"- [[../02 Topics/{topic_name(topic)[:-3]}|{display_label(topic)}]]")
    lines.extend(["", "## Entities", ""])
    for entity in record.entity_candidates or ["none"]:
        lines.append(f"- [[../03 Entities/{entity_name(entity)[:-3]}|{entity}]]")
    lines.extend(["", "## Transcript", "", f"- Normalized transcript: [Open transcript](<{transcript_path}>)", ""])
    return "\n".join(lines).rstrip() + "\n"


def summarize_items(items: list[TriageConversation]) -> tuple[list[str], list[str], list[str], list[str]]:
    summary_counter = Counter()
    key_point_counter = Counter()
    topic_counter = Counter()
    entity_counter = Counter()
    for item in items:
        summary_counter.update([item.one_line_summary])
        key_point_counter.update(item.key_points[:3])
        topic_counter.update(item.topic_candidates)
        entity_counter.update(item.central_entities or item.entity_candidates[:2])
    summaries = [text for text, _ in summary_counter.most_common(3)]
    key_points = [text for text, _ in key_point_counter.most_common(6)]
    topics = [text for text, _ in topic_counter.most_common(8)]
    entities = [text for text, _ in entity_counter.most_common(8)]
    return summaries, key_points, topics, entities


def render_topic_page(label: str, items: list[TriageConversation], full_note_items: list[TriageConversation]) -> str:
    summaries, key_points, _, entities = summarize_items(items)
    source_links = [f"- [[../04 Source Notes/{source_note_name(item)[:-3]}|{item.date or 'unknown'} - {item.title}]]" for item in full_note_items[:20]]
    lines = [
        "---",
        f"topic_label: {yaml_string(label)}",
        "note_type: topic",
        "---",
        "",
        f"# {display_label(label)}",
        "",
        f"Synthesized from {len(items)} kept conversations, including {len(full_note_items)} full source notes.",
        "",
        "## Summary",
        "",
    ]
    for item in summaries or [f"{display_label(label)} appears across several promoted conversations."]:
        lines.append(f"- {item}")
    lines.extend(["", "## What Repeats", ""])
    for point in key_points or ["No repeated pattern extracted yet."]:
        lines.append(f"- {point}")
    lines.extend(["", "## Related Entities", ""])
    for entity in entities or ["No stable entity signal yet."]:
        lines.append(f"- [[../03 Entities/{entity_name(entity)[:-3]}|{entity}]]")
    lines.extend(["", "## Supporting Source Notes", ""])
    lines.extend(source_links or [f"- No full source notes yet. This page is synthesized from {len(items)} kept conversations."])
    lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def render_entity_page(label: str, items: list[TriageConversation], full_note_items: list[TriageConversation]) -> str:
    summaries, key_points, topics, _ = summarize_items(items)
    source_links = [f"- [[../04 Source Notes/{source_note_name(item)[:-3]}|{item.date or 'unknown'} - {item.title}]]" for item in full_note_items[:20]]
    lines = [
        "---",
        f"entity_label: {yaml_string(label)}",
        "note_type: entity",
        "---",
        "",
        f"# {label}",
        "",
        f"Referenced in {len(items)} kept conversations, including {len(full_note_items)} full source notes.",
        "",
        "## Summary",
        "",
    ]
    for item in summaries or [f"{label} is a recurring named entity in the promoted conversations."]:
        lines.append(f"- {item}")
    lines.extend(["", "## Why It Matters", ""])
    for point in key_points or ["No recurring usage extracted yet."]:
        lines.append(f"- {point}")
    lines.extend(["", "## Connected Topics", ""])
    for topic in topics or ["none"]:
        lines.append(f"- [[../02 Topics/{topic_name(topic)[:-3]}|{display_label(topic)}]]")
    lines.extend(["", "## Supporting Source Notes", ""])
    lines.extend(source_links or [f"- No full source notes yet. This page is synthesized from {len(items)} kept conversations."])
    lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def render_domain_page(domain: str, items: list[TriageConversation], full_note_items: list[TriageConversation]) -> str:
    summaries, key_points, topics, entities = summarize_items(items)
    source_links = [f"- [[../04 Source Notes/{source_note_name(item)[:-3]}|{item.date or 'unknown'} - {item.title}]]" for item in full_note_items[:15]]
    lines = [
        "---",
        f"domain: {yaml_string(domain)}",
        "note_type: domain",
        "---",
        "",
        f"# {domain}",
        "",
        f"Kept conversations in this domain: {len(items)}",
        "",
        f"Full source notes in this domain: {len(full_note_items)}",
        "",
        "## Summary",
        "",
    ]
    for item in summaries or [f"{domain} contains the most reusable material from the last-year archive."]:
        lines.append(f"- {item}")
    lines.extend(["", "## Repeated Patterns", ""])
    for point in key_points or ["No repeated pattern extracted yet."]:
        lines.append(f"- {point}")
    lines.extend(["", "## Active Topics", ""])
    for label in topics or ["none"]:
        lines.append(f"- [[../02 Topics/{topic_name(label)[:-3]}|{display_label(label)}]]")
    lines.extend(["", "## Key Entities", ""])
    for label in entities or ["none"]:
        lines.append(f"- [[../03 Entities/{entity_name(label)[:-3]}|{label}]]")
    lines.extend(["", "## Recent Source Notes", ""])
    lines.extend(source_links or [f"- No full source notes yet. This page is synthesized from {len(items)} kept conversations."])
    lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def append_log_entry(wiki_root: Path, run_label: str, summary_lines: list[str]) -> None:
    system_root = wiki_index_root(wiki_root)
    system_root.mkdir(parents=True, exist_ok=True)
    log_path = system_root / "log.md"
    existing = log_path.read_text(encoding="utf-8") if log_path.exists() else "# Log\n\n"
    lines = [f"## [{datetime.now(tz=timezone.utc).date().isoformat()}] ingest | {run_label}", "", *summary_lines, ""]
    if existing and not existing.endswith("\n"):
        existing += "\n"
    log_path.write_text(existing + "\n".join(lines), encoding="utf-8")


def promote_stage(
    normalized_records: list[NormalizedConversation],
    triage_records: list[TriageConversation],
    output_root: Path,
    wiki_root: Path,
    *,
    rebuild: bool,
) -> dict[str, Any]:
    if rebuild:
        reset_dir(wiki_root)
    else:
        wiki_root.mkdir(parents=True, exist_ok=True)

    promoted = [record for record in triage_records if record.worth_porting == "yes"]
    review_items = [record for record in triage_records if record.worth_porting == "review"]
    normalized_by_id = {record.id: record for record in normalized_records}
    source_note_tiers = {
        record.id: compute_source_note_tier(record, normalized_by_id.get(record.id))
        for record in promoted
    }
    full_source_note_records = [record for record in promoted if source_note_tiers.get(record.id) == "full"]
    synthesis_only_records = [record for record in promoted if source_note_tiers.get(record.id) == "synthesis_only"]
    full_source_note_ids = {record.id for record in full_source_note_records}

    domain_groups: dict[str, list[TriageConversation]] = defaultdict(list)
    full_domain_groups: dict[str, list[TriageConversation]] = defaultdict(list)
    topic_groups: dict[str, list[TriageConversation]] = defaultdict(list)
    full_topic_groups: dict[str, list[TriageConversation]] = defaultdict(list)
    entity_groups: dict[str, list[TriageConversation]] = defaultdict(list)
    full_entity_groups: dict[str, list[TriageConversation]] = defaultdict(list)
    for record in promoted:
        domain_groups[record.primary_domain].append(record)
        if record.id in full_source_note_ids:
            full_domain_groups[record.primary_domain].append(record)
        for topic in record.topic_candidates:
            topic_groups[topic].append(record)
            if record.id in full_source_note_ids:
                full_topic_groups[topic].append(record)
        for entity in dedupe_preserve_order([*record.entity_candidates, *record.central_entities]):
            entity_groups[entity].append(record)
            if record.id in full_source_note_ids:
                full_entity_groups[entity].append(record)

    topic_groups = {label: items for label, items in topic_groups.items() if len(items) >= 3 or any(item.seed_topic for item in items)}
    entity_groups = {label: items for label, items in entity_groups.items() if len(items) >= 2 or any(label in item.central_entities for item in items)}

    home_dir = wiki_root / "00 Home"
    domains_dir = wiki_root / "01 Domains"
    topics_dir = wiki_root / "02 Topics"
    entities_dir = wiki_root / "03 Entities"
    source_notes_dir = wiki_root / "04 Source Notes"
    system_dir = wiki_root / "99 System"
    for directory in (home_dir, domains_dir, topics_dir, entities_dir, source_notes_dir, system_dir):
        directory.mkdir(parents=True, exist_ok=True)

    for record in full_source_note_records:
        normalized = normalized_by_id[record.id]
        (source_notes_dir / source_note_name(record)).write_text(render_source_note(record, normalized.transcript_path), encoding="utf-8")

    for topic_label, items in sorted(topic_groups.items(), key=lambda item: (-len(item[1]), item[0])):
        (topics_dir / topic_name(topic_label)).write_text(
            render_topic_page(topic_label, items, full_topic_groups.get(topic_label, [])),
            encoding="utf-8",
        )

    for entity_label, items in sorted(entity_groups.items(), key=lambda item: (-len(item[1]), item[0])):
        (entities_dir / entity_name(entity_label)).write_text(
            render_entity_page(entity_label, items, full_entity_groups.get(entity_label, [])),
            encoding="utf-8",
        )

    for domain in PRIMARY_DOMAINS:
        (domains_dir / domain_note_name(domain)).write_text(
            render_domain_page(domain, domain_groups.get(domain, []), full_domain_groups.get(domain, [])),
            encoding="utf-8",
        )

    recent_promoted = sorted(full_source_note_records, key=lambda item: (item.date or "9999-99-99", item.id), reverse=True)[:20]
    recent_topics = sorted(topic_groups.items(), key=lambda item: (-len(item[1]), item[0]))[:12]
    recent_entities = sorted(entity_groups.items(), key=lambda item: (-len(item[1]), item[0]))[:12]

    home_lines = [
        "---",
        "note_type: home",
        "---",
        "",
        "# Home",
        "",
        "## Overview",
        "",
        f"- Kept conversations: {len(promoted)}",
        f"- Full source notes: {len(full_source_note_records)}",
        f"- Synthesis-only kept conversations: {len(synthesis_only_records)}",
        f"- Review queue: {len(review_items)}",
        f"- Topic pages: {len(topic_groups)}",
        f"- Entity pages: {len(entity_groups)}",
        "",
        "## Start Here",
        "",
        "- [[../99 System/index|Open the system index]]",
        "- [[../99 System/review-queue|Open the review queue]]",
        "- Browse a domain page first, then drill into topics, entities, and source notes.",
        "",
        "## Domains",
        "",
    ]
    for domain in PRIMARY_DOMAINS:
        home_lines.append(f"- [[../01 Domains/{domain_note_name(domain)[:-3]}|{domain}]] ({len(domain_groups.get(domain, []))})")
    home_lines.extend(["", "## Recent High-Value Source Notes", ""])
    for record in recent_promoted:
        home_lines.append(f"- [[../04 Source Notes/{source_note_name(record)[:-3]}|{record.date or 'unknown'} - {record.title}]]")
    home_lines.extend(["", "## Top Topics", ""])
    for topic_label, items in recent_topics:
        home_lines.append(f"- [[../02 Topics/{topic_name(topic_label)[:-3]}|{display_label(topic_label)}]] ({len(items)})")
    home_lines.extend(["", "## Top Entities", ""])
    for entity_label, items in recent_entities:
        home_lines.append(f"- [[../03 Entities/{entity_name(entity_label)[:-3]}|{entity_label}]] ({len(items)})")
    home_lines.extend(["", "## Review Queue", "", f"- See [[../99 System/review-queue|review queue]] ({len(review_items)})", ""])
    (home_dir / "Home.md").write_text("\n".join(home_lines).rstrip() + "\n", encoding="utf-8")

    index_lines = [
        "---",
        "note_type: index",
        "---",
        "",
        "# Index",
        "",
        "## Overview",
        "",
        f"- Kept conversations: {len(promoted)}",
        f"- Full source notes: {len(full_source_note_records)}",
        f"- Synthesis-only kept conversations: {len(synthesis_only_records)}",
        f"- Review queue: {len(review_items)}",
        "",
        "## Domains",
        "",
    ]
    for domain in PRIMARY_DOMAINS:
        index_lines.append(f"- [[../01 Domains/{domain_note_name(domain)[:-3]}|{domain}]] ({len(domain_groups.get(domain, []))})")
    index_lines.extend(["", "## Topics", ""])
    for label, items in sorted(topic_groups.items(), key=lambda item: (-len(item[1]), item[0])):
        index_lines.append(f"- [[../02 Topics/{topic_name(label)[:-3]}|{display_label(label)}]] ({len(items)})")
    index_lines.extend(["", "## Entities", ""])
    for label, items in sorted(entity_groups.items(), key=lambda item: (-len(item[1]), item[0])):
        index_lines.append(f"- [[../03 Entities/{entity_name(label)[:-3]}|{label}]] ({len(items)})")
    index_lines.extend(["", "## Full Source Notes", ""])
    for record in sorted(full_source_note_records, key=lambda item: (item.date or "9999-99-99", item.id)):
        index_lines.append(f"- [[../04 Source Notes/{source_note_name(record)[:-3]}|{record.date or 'unknown'} - {record.title}]]")
    index_lines.extend(["", "## Review Queue", "", f"- [[review-queue|Open review queue]] ({len(review_items)})", ""])
    (system_dir / "index.md").write_text("\n".join(index_lines).rstrip() + "\n", encoding="utf-8")

    review_lines = ["---", "note_type: review_queue", "---", "", "# Review Queue", "", f"- Items: {len(review_items)}", ""]
    for record in review_items:
        review_lines.append(f"- `{record.date or 'unknown'}` {record.title} [Open transcript](<{record.transcript_path}>) - {record.worth_reason}")
    (system_dir / "review-queue.md").write_text("\n".join(review_lines).rstrip() + "\n", encoding="utf-8")

    append_log_entry(
        wiki_root,
        "last-year-chat-api-rebuild",
        [
            f"- Normalized conversations: {len(normalized_records)}",
            f"- Triaged conversations: {len(triage_records)}",
            f"- Kept conversations: {len(promoted)}",
            f"- Full source notes: {len(full_source_note_records)}",
            f"- Synthesis-only kept conversations: {len(synthesis_only_records)}",
            f"- Review items: {len(review_items)}",
            f"- Topic pages: {len(topic_groups)}",
            f"- Entity pages: {len(entity_groups)}",
        ],
    )

    written_topic_page_count = len(list(topics_dir.glob("*.md")))
    written_entity_page_count = len(list(entities_dir.glob("*.md")))
    written_source_note_count = len(list(source_notes_dir.glob("*.md")))

    report = {
        "generated_at": datetime.now(tz=timezone.utc).isoformat(timespec="seconds"),
        "wiki_root": str(wiki_root),
        "normalized_count": len(normalized_records),
        "triage_count": len(triage_records),
        "promoted_count": len(promoted),
        "full_source_note_count": written_source_note_count,
        "synthesis_only_count": len(synthesis_only_records),
        "review_count": len(review_items),
        "topic_page_count": written_topic_page_count,
        "entity_page_count": written_entity_page_count,
        "domain_page_count": len(PRIMARY_DOMAINS),
    }
    write_json(output_root / "wiki_report.json", report)
    return report


def update_manifest(args: argparse.Namespace, raw_root: Path) -> None:
    manifest = load_manifest(args.manifest)
    manifest.update(
        {
            "raw_source_path": str(raw_root),
            "raw_inventory": raw_file_inventory(raw_root),
            "last_year_output_root": str(args.output_root.expanduser()),
            "wiki_root": str(args.wiki_root.expanduser()),
            "pipeline_version": 4,
            "last_year_api_mode": "openai_batch_api",
        }
    )
    write_json(args.manifest, manifest)


def write_run_report(output_root: Path, payload: dict[str, Any]) -> None:
    write_json(output_root / "run_report.json", payload)


def run() -> None:
    args = parse_cli()
    raw_root = resolve_raw_root(args.raw_root, args.manifest)
    if not raw_root.exists():
        raise FileNotFoundError(f"Raw archive does not exist: {raw_root}")

    output_root = args.output_root.expanduser()
    wiki_root = args.wiki_root.expanduser()
    output_root.mkdir(parents=True, exist_ok=True)
    update_manifest(args, raw_root)

    report: dict[str, Any] = {
        "generated_at": datetime.now(tz=timezone.utc).isoformat(timespec="seconds"),
        "stage": args.stage,
        "output_root": str(output_root),
        "wiki_root": str(wiki_root),
        "raw_root": str(raw_root),
        "model": args.model,
        "mode": "openai_batch_api",
    }

    if args.stage == "normalize":
        _, stage_report = normalize_stage(
            raw_root,
            output_root,
            tz_name=args.timezone,
            rebuild=args.rebuild,
            start_date=args.start_date,
            limit=args.limit,
        )
        report["stages"] = {"normalize": stage_report}

    elif args.stage == "plan":
        stage_report = plan_stage(output_root, model=args.model, batch_count=args.batch_count, rebuild=args.rebuild)
        report["stages"] = {"plan": stage_report}

    elif args.stage == "prepare":
        if args.rebuild or not (normalized_root(output_root) / "conversations.ndjson").exists():
            _, normalize_report = normalize_stage(
                raw_root,
                output_root,
                tz_name=args.timezone,
                rebuild=args.rebuild,
                start_date=args.start_date,
                limit=args.limit,
            )
        else:
            normalize_report = {"normalized_count": len(load_normalized_records(output_root))}
        plan_report = plan_stage(output_root, model=args.model, batch_count=args.batch_count, rebuild=args.rebuild)
        report["stages"] = {"normalize": normalize_report, "plan": plan_report}

    elif args.stage == "submit-pilot":
        tracker = submit_pilot_stage(output_root, args.base_url, args.model)
        report["stages"] = {"submit_pilot": tracker}

    elif args.stage == "submit-wave":
        tracker = submit_wave_stage(output_root, args.base_url, args.model)
        report["stages"] = {"submit_wave": tracker}

    elif args.stage == "sync-batch":
        if not args.batch_id:
            raise RuntimeError("--batch-id is required for sync-batch")
        tracker = sync_batch_stage(output_root, args.base_url, args.batch_id)
        report["stages"] = {"sync_batch": tracker}

    elif args.stage == "sync-all":
        tracker = sync_all_stage(output_root, args.base_url)
        report["stages"] = {"sync_all": tracker}

    elif args.stage == "repair-batch":
        if not args.batch_id:
            raise RuntimeError("--batch-id is required for repair-batch")
        tracker = repair_batch_stage(output_root, args.base_url, args.model, args.batch_id)
        report["stages"] = {"repair_batch": tracker}

    elif args.stage == "merge":
        stage_report = merge_triage_stage(output_root, args.model)
        report["stages"] = {"merge": stage_report}

    elif args.stage == "promote":
        normalized_records = load_normalized_records(output_root)
        triage_records = load_triage_records(output_root)
        stage_report = promote_stage(normalized_records, triage_records, output_root, wiki_root, rebuild=args.rebuild)
        report["stages"] = {"promote": stage_report}

    write_run_report(output_root, report)


if __name__ == "__main__":
    run()
