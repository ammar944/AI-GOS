#!/usr/bin/env python3

from __future__ import annotations

import csv
import json
import re
import shutil
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable
from zoneinfo import ZoneInfo

DEFAULT_TRACKER_JSON = Path("./triage/batch-tracker.json")
DEFAULT_TRACKER_MARKDOWN = Path("./SECOND_BRAIN_BATCH_TRACKER.md")
DEFAULT_MANIFEST_JSON = Path("./triage/corpus_manifest.json")
DEFAULT_RAW_ROOT = Path("./raw")
DEFAULT_RAW_ARCHIVE_ROOT = Path("./archive")
BATCH_TARGET_COUNT = 20
BATCH_CHAR_LIMIT = 120_000
RESUME_COMMAND = (
    'codex -C ./ "Read ./AGENT.md and '
    './SECOND_BRAIN_BATCH_TRACKER.md, then inspect '
    './triage/batch-tracker.json. Continue the next pending '
    'second-brain batch for the Obsidian vault at ./wiki. Process only '
    'one batch, update the tracker files, refine the relevant theme/subtheme/evergreen/conversation '
    'essence notes, and stop with a concise summary of what changed and which batch is next."'
)


TEXT_FILE_NAMES = {
    "chat.html",
    "shared_conversations.json",
    "export_manifest.json",
    "message_feedback.json",
    "user.json",
    "user_settings.json",
}

SKIP_CONTENT_TYPES = {
    "thoughts",
    "reasoning_recap",
    "execution_output",
    "user_editable_context",
    "tether_browsing_display",
    "tether_quote",
    "system_error",
}

STOPWORDS = {
    "a",
    "about",
    "above",
    "across",
    "after",
    "again",
    "all",
    "also",
    "an",
    "and",
    "another",
    "any",
    "app",
    "are",
    "around",
    "as",
    "at",
    "be",
    "because",
    "below",
    "both",
    "branch",
    "breakdown",
    "but",
    "by",
    "can",
    "chat",
    "clarification",
    "compare",
    "comparison",
    "context",
    "could",
    "create",
    "current",
    "data",
    "decision",
    "details",
    "difference",
    "do",
    "document",
    "draft",
    "email",
    "example",
    "explain",
    "explanation",
    "feature",
    "feedback",
    "for",
    "format",
    "formatted",
    "from",
    "get",
    "guide",
    "had",
    "has",
    "have",
    "help",
    "how",
    "i",
    "idea",
    "ideas",
    "if",
    "improve",
    "in",
    "into",
    "is",
    "it",
    "item",
    "just",
    "keep",
    "key",
    "like",
    "list",
    "make",
    "me",
    "message",
    "metadata",
    "more",
    "my",
    "name",
    "need",
    "new",
    "next",
    "no",
    "note",
    "not",
    "of",
    "on",
    "one",
    "open",
    "or",
    "other",
    "our",
    "outline",
    "overview",
    "please",
    "potential",
    "product",
    "project",
    "question",
    "random",
    "really",
    "related",
    "request",
    "response",
    "review",
    "rewrite",
    "same",
    "should",
    "so",
    "some",
    "strategy",
    "structured",
    "sub",
    "summary",
    "takeaways",
    "task",
    "text",
    "that",
    "the",
    "theme",
    "this",
    "through",
    "to",
    "use",
    "useful",
    "using",
    "want",
    "was",
    "we",
    "what",
    "when",
    "with",
    "work",
    "write",
    "would",
    "you",
    "your",
}

NOISE_PHRASES = [
    "format into proper grammar",
    "rewrite this",
    "rewrite in",
    "rewrite for",
    "make this sound",
    "fix grammar",
    "improve grammar",
    "point form",
    "bullet form",
    "one sentence",
    "shorter version",
    "longer version",
    "say this better",
    "can you rewrite",
    "write this better",
]

LOW_VALUE_TITLE_PATTERNS = [
    "new chat",
    "summary",
    "comparison",
    "response",
    "request",
    "clarification",
    "grammar",
    "rewrite",
    "rephrase",
    "wording",
]

THEME_RULES: dict[str, dict[str, Any]] = {
    "Work": {
        "keywords": {
            "client",
            "clients",
            "founder",
            "company",
            "startup",
            "sales",
            "manager",
            "product",
            "roadmap",
            "hiring",
            "team",
            "proposal",
            "pitch",
            "market",
            "b2b",
            "business",
            "customer",
            "cofounder",
            "career",
            "employee",
            "employees",
        },
        "subthemes": {
            "Clients": {"client", "clients", "customer", "customers", "agency"},
            "Strategy": {"strategy", "market", "positioning", "go-to-market", "growth"},
            "Product": {"product", "roadmap", "feature", "mvp", "users"},
            "Hiring & People": {"hiring", "manager", "employee", "employees", "team", "career"},
            "Startups": {"startup", "founder", "cofounder", "b2b", "saas"},
        },
    },
    "Money": {
        "keywords": {
            "tax",
            "taxes",
            "salary",
            "equity",
            "rrsp",
            "tfsa",
            "resp",
            "pricing",
            "payment",
            "invoice",
            "budget",
            "cost",
            "revenue",
            "valuation",
            "finance",
            "financial",
            "money",
        },
        "subthemes": {
            "Taxes": {"tax", "taxes", "sred", "rrsp", "tfsa", "resp"},
            "Compensation & Equity": {"salary", "equity", "compensation", "vest", "valuation"},
            "Pricing & Revenue": {"pricing", "price", "revenue", "invoice", "payment"},
            "Personal Finance": {"budget", "money", "financial", "savings"},
        },
    },
    "Health": {
        "keywords": {
            "health",
            "medical",
            "doctor",
            "surgery",
            "pain",
            "neck",
            "spine",
            "nutrition",
            "diet",
            "sleep",
            "treatment",
            "symptoms",
            "diagnosis",
            "exercise",
            "therapy",
        },
        "subthemes": {
            "Medical": {"medical", "doctor", "surgery", "treatment", "diagnosis", "symptoms"},
            "Nutrition": {"nutrition", "diet", "supplement", "food"},
            "Sleep": {"sleep", "fatigue"},
            "Fitness": {"exercise", "workout", "training"},
        },
    },
    "Relationships": {
        "keywords": {
            "relationship",
            "partner",
            "dating",
            "friend",
            "family",
            "husband",
            "wife",
            "kids",
            "kid",
            "baby",
            "toddler",
            "parent",
            "parents",
            "marriage",
        },
        "subthemes": {
            "Family": {"family", "parent", "parents", "kids", "kid", "baby", "toddler"},
            "Partner": {"partner", "husband", "wife", "marriage", "dating", "relationship"},
            "Friends": {"friend", "friends"},
        },
    },
    "Learning": {
        "keywords": {
            "lesson",
            "learn",
            "understand",
            "teaching",
            "study",
            "research",
            "explain",
            "education",
            "language",
            "spelling",
            "translation",
            "chinese",
        },
        "subthemes": {
            "Teaching": {"lesson", "teaching", "education"},
            "Research": {"research", "understand", "explain", "study"},
            "Languages": {"language", "translation", "spelling", "chinese"},
        },
    },
    "Legal": {
        "keywords": {
            "contract",
            "legal",
            "clause",
            "agreement",
            "nda",
            "mnda",
            "dispute",
            "terms",
            "privacy",
            "compliance",
            "hipaa",
            "policy",
            "lawsuit",
            "employment",
        },
        "subthemes": {
            "Contracts": {"contract", "clause", "agreement", "nda", "mnda", "terms"},
            "Compliance": {"privacy", "compliance", "hipaa", "policy"},
            "Disputes": {"dispute", "lawsuit", "settlement"},
            "Employment": {"employment", "consultant", "termination"},
        },
    },
    "Home": {
        "keywords": {
            "home",
            "house",
            "apartment",
            "condo",
            "fridge",
            "kitchen",
            "moving",
            "cleaning",
            "landlord",
            "renovation",
        },
        "subthemes": {
            "Housing": {"home", "house", "apartment", "condo", "landlord", "moving"},
            "Home Ops": {"fridge", "kitchen", "cleaning", "renovation"},
        },
    },
    "Travel": {
        "keywords": {
            "travel",
            "trip",
            "flight",
            "hotel",
            "visa",
            "itinerary",
            "vacation",
            "airport",
        },
        "subthemes": {
            "Trip Planning": {"trip", "travel", "itinerary", "hotel", "flight", "visa"},
        },
    },
    "Creative": {
        "keywords": {
            "video",
            "tiktok",
            "instagram",
            "reel",
            "script",
            "design",
            "brand",
            "caption",
            "copy",
            "creative",
            "ghibli",
            "image",
            "writing",
        },
        "subthemes": {
            "Content": {"video", "tiktok", "instagram", "reel", "caption", "script"},
            "Design": {"design", "image", "visual", "ghibli"},
            "Writing": {"copy", "writing", "brand"},
        },
    },
    "Personal Admin": {
        "keywords": {
            "calendar",
            "schedule",
            "email",
            "document",
            "documents",
            "form",
            "forms",
            "resume",
            "admin",
            "checklist",
        },
        "subthemes": {
            "Email & Documents": {"email", "document", "documents", "form", "forms", "resume"},
            "Planning": {"calendar", "schedule", "checklist", "admin"},
        },
    },
    "Technology": {
        "keywords": {
            "api",
            "firebase",
            "react",
            "database",
            "sql",
            "clickhouse",
            "auth",
            "backend",
            "frontend",
            "repo",
            "chrome",
            "extension",
            "python",
            "javascript",
            "typescript",
            "openai",
            "chatgpt",
            "prompt",
            "ai",
            "llm",
            "code",
            "coding",
            "app",
        },
        "subthemes": {
            "Firebase": {"firebase", "firestore"},
            "Frontend": {"react", "frontend", "chrome", "extension"},
            "Backend & APIs": {"api", "backend", "auth", "server"},
            "Data & Databases": {"database", "sql", "clickhouse", "query"},
            "AI & LLMs": {"openai", "chatgpt", "prompt", "ai", "llm"},
            "Engineering": {"python", "javascript", "typescript", "repo", "code", "coding"},
        },
    },
    "Ideas": {
        "keywords": {
            "idea",
            "ideas",
            "brainstorm",
            "naming",
            "concept",
            "startup",
            "product",
            "thesis",
        },
        "subthemes": {
            "Startup Ideas": {"startup", "ideas", "idea", "brainstorm"},
            "Naming": {"name", "names", "naming"},
            "Concepts": {"concept", "thesis"},
        },
    },
}

KNOWN_ENTITIES = {
    "Firebase": {"firebase", "firestore"},
    "React": {"react"},
    "Stripe": {"stripe"},
    "ClickHouse": {"clickhouse"},
    "OpenAI": {"openai", "chatgpt", "gpt-3", "gpt", "llm"},
    "TikTok": {"tiktok"},
    "Instagram": {"instagram", "reel", "reels"},
    "Google": {"google"},
    "Chrome": {"chrome"},
    "Obsidian": {"obsidian"},
    "SR&ED": {"sred", "sr&ed"},
    "HIPAA": {"hipaa"},
    "RRSP": {"rrsp"},
    "TFSA": {"tfsa"},
    "RESP": {"resp"},
}

CATEGORY_ORDER = [
    "Life Ops",
    "Relationships",
    "Projects & Work",
    "Code & AI",
    "Money",
    "Health",
    "Learning & Ideas",
]

THEME_TO_CATEGORY = {
    "Technology": "Code & AI",
    "Work": "Projects & Work",
    "Creative": "Projects & Work",
    "Money": "Money",
    "Health": "Health",
    "Relationships": "Relationships",
    "Home": "Life Ops",
    "Personal Admin": "Life Ops",
    "Travel": "Life Ops",
    "Learning": "Learning & Ideas",
    "Ideas": "Learning & Ideas",
    "Legal": "Projects & Work",
}

TOKEN_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9'&/_-]{1,}")
SENTENCE_RE = re.compile(r"(?<=[.!?])\s+")
MULTIBLANK_RE = re.compile(r"\n{3,}")


@dataclass
class MessageRecord:
    role: str
    author: str
    create_time: str | None
    date: str | None
    content_type: str
    text: str


@dataclass
class ConversationRecord:
    id: str
    title: str
    title_slug: str
    source_shard: str
    create_time: str | None
    update_time: str | None
    date: str | None
    year: str | None
    month: str | None
    char_count: int
    message_count: int
    user_message_count: int
    assistant_message_count: int
    keyword_topics: list[str]
    entities: list[str]
    primary_themes: list[str]
    secondary_themes: list[str]
    subthemes: list[str]
    durable_value_score: float
    durable_value: bool
    archive_only: bool
    what_this_was_about: str
    essence_summary: str
    key_takeaways: list[str]
    decisions: list[str]
    open_questions: list[str]
    possible_actions: list[str]
    related_themes: list[str]
    transcript_preview: str
    messages: list[MessageRecord]


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def default_manifest() -> dict[str, Any]:
    return {
        "raw_source_path": str(DEFAULT_RAW_ROOT),
        "raw_archive_path": "",
        "raw_inventory": [],
        "parsed_root": "",
        "vault_root": "",
        "conversation_count": 0,
        "parsed_at": "",
        "raw_moved_at": "",
        "pipeline_version": 2,
    }


def load_manifest(path: Path = DEFAULT_MANIFEST_JSON) -> dict[str, Any]:
    if not path.exists():
        return default_manifest()
    payload = default_manifest()
    payload.update(load_json(path))
    return payload


def write_manifest(path: Path, payload: dict[str, Any]) -> dict[str, Any]:
    merged = default_manifest()
    if path.exists():
        merged.update(load_json(path))
    merged.update(payload)
    write_json(path, merged)
    return merged


def raw_file_inventory(raw_root: Path) -> list[dict[str, Any]]:
    inventory: list[dict[str, Any]] = []
    if not raw_root.exists():
        return inventory
    for path in sorted(raw_root.rglob("*")):
        if not path.is_file():
            continue
        stat = path.stat()
        inventory.append(
            {
                "path": path.relative_to(raw_root).as_posix(),
                "size": stat.st_size,
                "modified_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(timespec="seconds"),
            }
        )
    return inventory


def resolve_raw_root(raw_root: Path | None = None, manifest_path: Path = DEFAULT_MANIFEST_JSON) -> Path:
    if raw_root is not None:
        return raw_root.expanduser()
    manifest = load_manifest(manifest_path)
    candidate = (manifest.get("raw_source_path") or "").strip()
    if candidate:
        return Path(candidate).expanduser()
    return DEFAULT_RAW_ROOT


def update_manifest_after_parse(
    manifest_path: Path,
    *,
    raw_root: Path,
    parsed_root: Path,
    conversation_count: int,
) -> dict[str, Any]:
    manifest = load_manifest(manifest_path)
    manifest.update(
        {
            "raw_source_path": str(raw_root),
            "raw_inventory": raw_file_inventory(raw_root),
            "parsed_root": str(parsed_root),
            "conversation_count": conversation_count,
            "parsed_at": datetime.now(tz=timezone.utc).isoformat(timespec="seconds"),
            "pipeline_version": 2,
        }
    )
    return write_manifest(manifest_path, manifest)


def archive_raw_sources(
    raw_root: Path,
    *,
    archive_root: Path,
    manifest_path: Path = DEFAULT_MANIFEST_JSON,
    archive_name: str | None = None,
) -> dict[str, Any]:
    raw_root = raw_root.expanduser()
    archive_root = archive_root.expanduser()
    if not raw_root.exists():
        raise FileNotFoundError(f"Raw source directory does not exist: {raw_root}")

    archive_name = archive_name or f"general-chatgpt-export-{datetime.now().date().isoformat()}"
    destination = archive_root / archive_name
    if destination.exists():
        raise FileExistsError(f"Archive destination already exists: {destination}")

    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(raw_root), str(destination))

    manifest = load_manifest(manifest_path)
    manifest.update(
        {
            "raw_source_path": str(destination),
            "raw_archive_path": str(destination),
            "raw_inventory": raw_file_inventory(destination),
            "raw_moved_at": datetime.now(tz=timezone.utc).isoformat(timespec="seconds"),
            "pipeline_version": 2,
        }
    )
    write_manifest(manifest_path, manifest)
    return {
        "archive_path": str(destination),
        "file_count": len(manifest["raw_inventory"]),
    }


def reset_dir(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True, exist_ok=True)


def slugify(value: str, *, max_length: int = 80) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9_-]+", "-", value)
    value = re.sub(r"-{2,}", "-", value).strip("-")
    return value[:max_length] or "item"


def human_title(title: str) -> str:
    cleaned = (title or "").strip()
    return cleaned or "Untitled Conversation"


def obsidian_safe_title(title: str) -> str:
    title = human_title(title)
    title = re.sub(r'[\\/:*?"<>|#^\[\]]+', " ", title)
    title = re.sub(r"\s{2,}", " ", title).strip()
    return title[:120] or "Untitled Conversation"


def normalize_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = MULTIBLANK_RE.sub("\n\n", text)
    return text.strip()


def clip_text(text: str, limit: int = 220) -> str:
    compact = " ".join(text.split())
    if len(compact) <= limit:
        return compact
    return compact[: limit - 3].rstrip() + "..."


def format_timestamp(timestamp: Any, tz: ZoneInfo) -> tuple[str | None, str | None]:
    if timestamp in (None, ""):
        return None, None
    try:
        dt = datetime.fromtimestamp(float(timestamp), tz=timezone.utc).astimezone(tz)
    except (TypeError, ValueError, OSError):
        return None, None
    return dt.isoformat(timespec="seconds"), dt.date().isoformat()


def iter_text_sources(source_root: Path) -> tuple[list[Path], Counter[str]]:
    selected: list[Path] = []
    skipped = Counter[str]()
    for path in sorted(source_root.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(source_root)
        if "audio" in rel.parts:
            skipped["audio"] += 1
            continue
        if path.name.startswith("conversations-") and path.suffix == ".json":
            selected.append(path)
            continue
        if path.name in TEXT_FILE_NAMES:
            selected.append(path)
            continue
        if path.suffix.lower() == ".txt":
            selected.append(path)
            continue
        skipped[path.suffix.lower() or "no_extension"] += 1
    return selected, skipped


def copy_text_sources(
    source_root: Path,
    destination_root: Path,
    *,
    rebuild: bool = False,
) -> dict[str, Any]:
    if rebuild:
        reset_dir(destination_root)
    else:
        destination_root.mkdir(parents=True, exist_ok=True)

    selected, skipped = iter_text_sources(source_root)
    copied: list[str] = []
    for source_path in selected:
        rel = source_path.relative_to(source_root)
        target_path = destination_root / rel
        target_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source_path, target_path)
        copied.append(rel.as_posix())

    manifest = {
        "source_root": str(source_root),
        "destination_root": str(destination_root),
        "imported_at": datetime.now(tz=timezone.utc).isoformat(timespec="seconds"),
        "copied_files": copied,
        "copied_count": len(copied),
        "skipped_counts": dict(skipped),
    }
    write_json(destination_root / "import_manifest.json", manifest)
    return manifest


def selected_nodes_from_current_path(conversation: dict[str, Any]) -> list[dict[str, Any]]:
    mapping = conversation.get("mapping") or {}
    current_node_id = conversation.get("current_node")
    ordered_ids: list[str] = []
    seen: set[str] = set()
    node_id = current_node_id

    while node_id and node_id not in seen:
        seen.add(node_id)
        node = mapping.get(node_id)
        if not node:
            break
        ordered_ids.append(node_id)
        node_id = node.get("parent")

    ordered_ids.reverse()
    if not ordered_ids:
        ordered_ids = list(mapping.keys())

    nodes: list[dict[str, Any]] = []
    for node_id in ordered_ids:
        node = mapping.get(node_id)
        if node:
            nodes.append(node)
    return nodes


def extract_message_text(content: dict[str, Any]) -> str:
    content_type = content.get("content_type")
    if content_type == "text":
        parts = content.get("parts") or []
        return normalize_text("\n\n".join(part for part in parts if isinstance(part, str)))
    if content_type == "multimodal_text":
        parts = content.get("parts") or []
        text_parts = [part for part in parts if isinstance(part, str)]
        return normalize_text("\n\n".join(text_parts))
    if content_type == "code":
        return normalize_text(content.get("text") or "")
    return ""


def message_author_name(message: dict[str, Any]) -> str:
    author = message.get("author") or {}
    return author.get("name") or author.get("role") or "unknown"


def tokenize(text: str) -> list[str]:
    tokens: list[str] = []
    for token in TOKEN_RE.findall(text):
        lowered = token.lower().strip("'")
        if lowered in STOPWORDS or len(lowered) <= 2:
            continue
        if not lowered[0].isalpha():
            continue
        if not any(ch.isalpha() for ch in lowered):
            continue
        tokens.append(lowered)
    return tokens


def dedupe_preserve_order(values: Iterable[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for value in values:
        clean = value.strip()
        if not clean or clean in seen:
            continue
        out.append(clean)
        seen.add(clean)
    return out


def strip_noise_sentences(text: str) -> str:
    cleaned = normalize_text(text)
    lines: list[str] = []
    for line in cleaned.splitlines():
        lowered = line.lower().strip()
        if any(phrase in lowered for phrase in NOISE_PHRASES):
            continue
        if lowered.startswith("role:") or lowered.startswith("goal:") or lowered.startswith("instructions:"):
            continue
        lines.append(line)
    return normalize_text("\n".join(lines))


def parse_message(message: dict[str, Any], tz: ZoneInfo) -> MessageRecord | None:
    content = message.get("content") or {}
    content_type = content.get("content_type") or "unknown"
    if content_type in SKIP_CONTENT_TYPES:
        return None

    text = strip_noise_sentences(extract_message_text(content))
    if not text:
        return None

    create_time, date = format_timestamp(message.get("create_time"), tz)
    role = (message.get("author") or {}).get("role") or "unknown"
    return MessageRecord(
        role=role,
        author=message_author_name(message),
        create_time=create_time,
        date=date,
        content_type=content_type,
        text=text,
    )


def extract_keywords(title: str, messages: Iterable[MessageRecord]) -> list[str]:
    title_tokens = tokenize(title)
    counter = Counter(title_tokens)
    for message in messages:
        weight = 2 if message.role == "user" else 1
        counter.update(tokenize(message.text) * weight)

    ordered = sorted(counter.items(), key=lambda item: (-item[1], item[0]))
    keywords: list[str] = []
    for token, count in ordered:
        if count < 2 and keywords:
            continue
        keywords.append(token)
        if len(keywords) == 8:
            break

    if title_tokens:
        return dedupe_preserve_order(title_tokens + keywords)[:8]
    return keywords[:8]


def extract_sentences(messages: Iterable[MessageRecord], roles: set[str]) -> list[str]:
    sentences: list[str] = []
    for message in messages:
        if message.role not in roles:
            continue
        for sentence in SENTENCE_RE.split(message.text):
            sentence = " ".join(sentence.split()).strip()
            if len(sentence) < 20:
                continue
            if any(phrase in sentence.lower() for phrase in NOISE_PHRASES):
                continue
            sentences.append(sentence)
    return dedupe_preserve_order(sentences)


def infer_entities(title: str, messages: list[MessageRecord], keywords: list[str]) -> list[str]:
    joined = " ".join([title, *keywords, *(message.text for message in messages[:8])]).lower()
    entities: list[str] = []
    for name, hints in KNOWN_ENTITIES.items():
        if any(hint in joined for hint in hints):
            entities.append(name)
    return entities


def score_theme(tokens: set[str], theme: str) -> tuple[int, list[str]]:
    config = THEME_RULES[theme]
    hits = sorted(token for token in config["keywords"] if token in tokens)
    return len(hits), hits


def infer_themes(title: str, keywords: list[str], messages: list[MessageRecord]) -> tuple[list[str], list[str], list[str]]:
    tokens = set(tokenize(title))
    tokens.update(keywords)
    for message in messages[:12]:
        tokens.update(tokenize(message.text))

    theme_scores: list[tuple[int, str]] = []
    for theme in THEME_RULES:
        score, _ = score_theme(tokens, theme)
        if score > 0:
            theme_scores.append((score, theme))
    theme_scores.sort(key=lambda item: (-item[0], item[1]))

    if not theme_scores:
        theme_scores = [(1, "Learning")]

    primary_themes = [theme_scores[0][1]]
    secondary_themes = [theme for score, theme in theme_scores[1:4] if score >= max(1, theme_scores[0][0] - 1)]

    subthemes: list[str] = []
    chosen_themes = primary_themes + secondary_themes
    for theme in chosen_themes:
        subtheme_rules = THEME_RULES[theme]["subthemes"]
        matched = False
        for subtheme, hints in subtheme_rules.items():
            if any(hint in tokens for hint in hints):
                subthemes.append(f"{theme}/{subtheme}")
                matched = True
        if not matched:
            subthemes.append(f"{theme}/General")

    return primary_themes, secondary_themes, dedupe_preserve_order(subthemes)


def classify_durable_value(title: str, messages: list[MessageRecord], keywords: list[str], themes: list[str]) -> tuple[float, bool, bool]:
    title_lower = title.lower()
    title_wording_only = any(token in title_lower for token in ("grammar", "rewrite", "rephrase", "wording", "correction request"))
    score = 0.0
    if len(messages) >= 2:
        score += 0.25
    if any(message.role == "assistant" for message in messages) and any(message.role == "user" for message in messages):
        score += 0.2
    if keywords:
        score += min(0.25, 0.05 * len(keywords))
    if themes:
        score += 0.15
    if title_lower and title_lower not in {"new chat", "untitled conversation"}:
        score += 0.1

    lowered_joined = " ".join(message.text.lower() for message in messages[:6])
    wording_only = any(phrase in lowered_joined for phrase in ("rewrite", "rephrase", "grammar", "format into", "make this sound", "shorter version"))
    if any(pattern in title_lower for pattern in LOW_VALUE_TITLE_PATTERNS):
        score -= 0.15
    if title_wording_only and len(messages) <= 4:
        score -= 0.4
    if any(phrase in lowered_joined for phrase in NOISE_PHRASES):
        score -= 0.3
    if len(messages) <= 3 and wording_only:
        score -= 0.45
    elif len(messages) <= 5 and wording_only:
        score -= 0.3

    score = max(0.0, min(1.0, score))
    durable = score >= 0.5
    archive_only = not durable
    return round(score, 2), durable, archive_only


def build_essence(title: str, messages: list[MessageRecord], keywords: list[str], themes: list[str]) -> tuple[str, str, list[str], list[str], list[str], list[str]]:
    user_sentences = extract_sentences(messages, {"user"})
    assistant_sentences = extract_sentences(messages, {"assistant"})

    if title.lower() == "new chat":
        about = clip_text(user_sentences[0] if user_sentences else ", ".join(keywords[:4]) or "General discussion", 180)
    else:
        about = clip_text(title, 180)

    if user_sentences:
        essence_summary = clip_text(user_sentences[0], 220)
    elif assistant_sentences:
        essence_summary = clip_text(assistant_sentences[0], 220)
    else:
        essence_summary = clip_text(about, 220)

    takeaways = dedupe_preserve_order(
        [clip_text(sentence, 220) for sentence in assistant_sentences[:3] + user_sentences[:2]]
    )[:4]

    decisions = []
    for sentence in assistant_sentences + user_sentences:
        lowered = sentence.lower()
        if any(marker in lowered for marker in ("should", "recommend", "best", "use ", "need to", "worth", "do not", "avoid")):
            decisions.append(clip_text(sentence, 220))
    decisions = dedupe_preserve_order(decisions)[:4]

    open_questions = []
    for sentence in user_sentences:
        lowered = sentence.lower()
        if sentence.endswith("?") or lowered.startswith(("how ", "what ", "why ", "when ", "can ", "should ")):
            open_questions.append(clip_text(sentence, 220))
    open_questions = dedupe_preserve_order(open_questions)[:4]

    possible_actions = []
    for sentence in assistant_sentences + user_sentences:
        lowered = sentence.lower()
        if any(marker in lowered for marker in ("next", "follow up", "plan", "action", "send", "build", "draft", "implement", "create")):
            possible_actions.append(clip_text(sentence, 220))
    possible_actions = dedupe_preserve_order(possible_actions)[:4]

    if not takeaways:
        takeaways = [essence_summary]
    return about, essence_summary, takeaways, decisions, open_questions, possible_actions


def parse_conversations(
    raw_root: Path,
    parsed_root: Path,
    *,
    timezone_name: str,
    rebuild: bool = False,
    limit: int | None = None,
) -> dict[str, Any]:
    if rebuild:
        reset_dir(parsed_root)
    else:
        parsed_root.mkdir(parents=True, exist_ok=True)

    tz = ZoneInfo(timezone_name)
    conversations: list[ConversationRecord] = []
    shard_paths = sorted(raw_root.glob("conversations-*.json"))

    skipped = Counter[str]()
    content_types = Counter[str]()
    included_content_types = Counter[str]()
    theme_counter = Counter[str]()
    subtheme_counter = Counter[str]()
    durable_counter = Counter[str]()

    for shard_path in shard_paths:
        shard_data = load_json(shard_path)
        for conversation in shard_data:
            if limit is not None and len(conversations) >= limit:
                break

            mapping = conversation.get("mapping")
            if not mapping:
                skipped["null_mapping"] += 1
                continue

            selected_nodes = selected_nodes_from_current_path(conversation)
            preferred_messages: list[MessageRecord] = []
            fallback_messages: list[MessageRecord] = []

            for node in selected_nodes:
                message = node.get("message")
                if not message:
                    continue

                content = message.get("content") or {}
                content_type = content.get("content_type") or "unknown"
                content_types[content_type] += 1

                parsed_message = parse_message(message, tz)
                if not parsed_message:
                    continue

                included_content_types[parsed_message.content_type] += 1
                fallback_messages.append(parsed_message)
                if parsed_message.role in {"user", "assistant"}:
                    preferred_messages.append(parsed_message)

            chosen_messages = preferred_messages or fallback_messages
            if not chosen_messages:
                skipped["no_readable_messages"] += 1
                continue

            created_iso, created_date = format_timestamp(conversation.get("create_time"), tz)
            updated_iso, _ = format_timestamp(conversation.get("update_time"), tz)
            if not created_date and chosen_messages[0].date:
                created_date = chosen_messages[0].date

            year = created_date[:4] if created_date else None
            month = created_date[:7] if created_date else None
            title = human_title(conversation.get("title") or "")
            title_slug = slugify(title)
            keywords = extract_keywords(title, chosen_messages)
            entities = infer_entities(title, chosen_messages, keywords)
            primary_themes, secondary_themes, subthemes = infer_themes(title, keywords, chosen_messages)
            related_themes = dedupe_preserve_order(primary_themes + secondary_themes)
            score, durable, archive_only = classify_durable_value(title, chosen_messages, keywords, related_themes)
            about, essence_summary, takeaways, decisions, open_questions, possible_actions = build_essence(
                title,
                chosen_messages,
                keywords,
                related_themes,
            )
            transcript_preview = clip_text("\n\n".join(message.text for message in chosen_messages[:4]), 280)

            record = ConversationRecord(
                id=conversation.get("id") or title_slug,
                title=title,
                title_slug=title_slug,
                source_shard=shard_path.name,
                create_time=created_iso,
                update_time=updated_iso,
                date=created_date,
                year=year,
                month=month,
                char_count=sum(len(message.text) for message in chosen_messages),
                message_count=len(chosen_messages),
                user_message_count=sum(1 for msg in chosen_messages if msg.role == "user"),
                assistant_message_count=sum(1 for msg in chosen_messages if msg.role == "assistant"),
                keyword_topics=keywords,
                entities=entities,
                primary_themes=primary_themes,
                secondary_themes=secondary_themes,
                subthemes=subthemes,
                durable_value_score=score,
                durable_value=durable,
                archive_only=archive_only,
                what_this_was_about=about,
                essence_summary=essence_summary,
                key_takeaways=takeaways,
                decisions=decisions,
                open_questions=open_questions,
                possible_actions=possible_actions,
                related_themes=related_themes,
                transcript_preview=transcript_preview,
                messages=chosen_messages,
            )
            conversations.append(record)

            for theme in related_themes:
                theme_counter[theme] += 1
            for subtheme in subthemes:
                subtheme_counter[subtheme] += 1
            durable_counter["durable" if durable else "archive_only"] += 1

        if limit is not None and len(conversations) >= limit:
            break

    parsed = [conversation_to_dict(record) for record in conversations]
    write_json(parsed_root / "conversations.json", parsed)

    with (parsed_root / "conversations.ndjson").open("w", encoding="utf-8") as handle:
        for record in parsed:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")

    with (parsed_root / "conversation_index.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "id",
                "title",
                "date",
                "primary_themes",
                "secondary_themes",
                "subthemes",
                "entities",
                "durable_value_score",
                "durable_value",
                "archive_only",
                "essence_summary",
            ],
        )
        writer.writeheader()
        for record in conversations:
            writer.writerow(
                {
                    "id": record.id,
                    "title": record.title,
                    "date": record.date or "",
                    "primary_themes": ",".join(record.primary_themes),
                    "secondary_themes": ",".join(record.secondary_themes),
                    "subthemes": ",".join(record.subthemes),
                    "entities": ",".join(record.entities),
                    "durable_value_score": record.durable_value_score,
                    "durable_value": record.durable_value,
                    "archive_only": record.archive_only,
                    "essence_summary": record.essence_summary,
                }
            )

    report = {
        "raw_root": str(raw_root),
        "parsed_root": str(parsed_root),
        "timezone": timezone_name,
        "parsed_at": datetime.now(tz=timezone.utc).isoformat(timespec="seconds"),
        "conversation_count": len(conversations),
        "skipped_counts": dict(skipped),
        "content_types_seen": dict(content_types),
        "content_types_included": dict(included_content_types),
        "theme_counts": dict(theme_counter),
        "subtheme_counts": dict(subtheme_counter),
        "durable_counts": dict(durable_counter),
    }
    write_json(parsed_root / "parse_report.json", report)
    return {"conversations": conversations, "report": report}


def conversation_to_dict(record: ConversationRecord) -> dict[str, Any]:
    data = asdict(record)
    data["messages"] = [asdict(message) for message in record.messages]
    return data


def load_parsed_conversations(parsed_root: Path) -> list[ConversationRecord]:
    data = load_json(parsed_root / "conversations.json")
    conversations: list[ConversationRecord] = []
    for item in data:
        messages = [MessageRecord(**message) for message in item["messages"]]
        payload = dict(item)
        payload["messages"] = messages
        conversations.append(ConversationRecord(**payload))
    return conversations


def yaml_list(values: Iterable[str]) -> list[str]:
    unique = dedupe_preserve_order(values)
    if not unique:
        return ["  - none"]
    return [f"  - {value}" for value in unique]


def note_file_name(conversation: ConversationRecord) -> str:
    prefix = conversation.date or "undated"
    title = slugify(obsidian_safe_title(conversation.title), max_length=70)
    return f"{prefix} {title} [{conversation.id[:8]}].md"


def cluster_file_name(cluster_id: str, title: str) -> str:
    return f"{cluster_id} {slugify(title, max_length=70)}.md"


def category_file_name(category: str) -> str:
    return f"{slugify(category, max_length=70)}.md"


def theme_hub_name(theme: str) -> str:
    return "Hub.md"


def subtheme_note_name(subtheme: str) -> str:
    _, leaf = subtheme.split("/", 1)
    return f"{slugify(leaf, max_length=60)}.md"


def theme_folder(theme: str) -> str:
    return theme


def level3_summary_line(conversation: ConversationRecord) -> str:
    base = conversation.essence_summary or conversation.what_this_was_about or conversation.title
    if not base.endswith((".", "!", "?")):
        base = f"{base}."
    return clip_text(base, 180)


def level3_key_facts(conversation: ConversationRecord) -> list[str]:
    facts = dedupe_preserve_order(
        [*conversation.key_takeaways, *conversation.decisions, *conversation.possible_actions]
    )
    if not facts:
        facts = [conversation.transcript_preview]
    return [clip_text(item, 220) for item in facts[:5]]


def category_candidates_for_conversation(conversation: ConversationRecord) -> list[str]:
    categories = [THEME_TO_CATEGORY[theme] for theme in conversation.related_themes if theme in THEME_TO_CATEGORY]
    if not categories:
        categories = ["Learning & Ideas"]
    return dedupe_preserve_order(categories)


def primary_category_for_conversation(conversation: ConversationRecord) -> str:
    return category_candidates_for_conversation(conversation)[0]


def cluster_similarity(left: ConversationRecord, right: ConversationRecord) -> float:
    if left.id == right.id:
        return 0.0

    score = 0.0
    left_categories = set(category_candidates_for_conversation(left))
    right_categories = set(category_candidates_for_conversation(right))
    score += len(left_categories & right_categories) * 3.0
    score += len(set(left.related_themes) & set(right.related_themes)) * 2.5
    score += len(set(left.subthemes) & set(right.subthemes)) * 3.5
    score += len(set(left.entities) & set(right.entities)) * 4.0
    score += len(set(left.keyword_topics) & set(right.keyword_topics)) * 1.2

    title_overlap = set(tokenize(left.title)) & set(tokenize(right.title))
    score += len(title_overlap) * 1.5
    return score


def build_conversation_clusters(conversations: list[ConversationRecord]) -> list[dict[str, Any]]:
    eligible = [item for item in conversations if item.durable_value and item.durable_value_score >= 0.6]
    by_id = {item.id: item for item in eligible}
    key_members: dict[str, list[str]] = defaultdict(list)

    for conversation in eligible:
        category = primary_category_for_conversation(conversation)
        for subtheme in conversation.subthemes:
            leaf = subtheme.split("/", 1)[1]
            if leaf.lower() == "general":
                continue
            key_members[f"subtheme::{category}::{leaf}"].append(conversation.id)
        for entity in conversation.entities:
            key_members[f"entity::{category}::{entity}"].append(conversation.id)

    valid_keys = {
        key: member_ids
        for key, member_ids in key_members.items()
        if 2 <= len(member_ids) <= 80
    }
    assigned_key: dict[str, str] = {}

    def key_sort_tuple(key: str) -> tuple[int, int, str]:
        kind, _, label = key.split("::", 2)
        return (0 if kind == "subtheme" else 1, len(valid_keys[key]), label.lower())

    for conversation in eligible:
        category = primary_category_for_conversation(conversation)
        candidate_keys: list[str] = []
        for subtheme in conversation.subthemes:
            leaf = subtheme.split("/", 1)[1]
            key = f"subtheme::{category}::{leaf}"
            if key in valid_keys:
                candidate_keys.append(key)
        for entity in conversation.entities:
            key = f"entity::{category}::{entity}"
            if key in valid_keys:
                candidate_keys.append(key)
        if candidate_keys:
            assigned_key[conversation.id] = sorted(set(candidate_keys), key=key_sort_tuple)[0]

    grouped_ids: dict[str, list[str]] = defaultdict(list)
    for conversation_id, key in assigned_key.items():
        grouped_ids[key].append(conversation_id)

    clusters: list[dict[str, Any]] = []
    cluster_counter = 1
    for key, member_ids in sorted(grouped_ids.items(), key=lambda item: (-len(item[1]), item[0])):
        members = sorted(
            [by_id[item_id] for item_id in dedupe_preserve_order(member_ids)],
            key=lambda item: (item.date or "9999-99-99", item.title.lower(), item.id),
        )
        if len(members) < 2:
            continue

        kind, category, label = key.split("::", 2)
        title = label

        clusters.append(
            {
                "cluster_id": f"C{cluster_counter:04d}",
                "title": title,
                "category": category,
                "conversation_ids": [item.id for item in members],
                "member_count": len(members),
                "members": members,
            }
        )
        cluster_counter += 1
    return clusters


def related_note_map(conversations: list[ConversationRecord]) -> dict[str, list[ConversationRecord]]:
    durable = [conversation for conversation in conversations if conversation.durable_value]
    related: dict[str, list[ConversationRecord]] = {}
    for conversation in durable:
        scored: list[tuple[int, ConversationRecord]] = []
        current_themes = set(conversation.related_themes)
        current_subthemes = set(conversation.subthemes)
        current_entities = set(conversation.entities)
        for other in durable:
            if other.id == conversation.id:
                continue
            score = 0
            score += len(current_themes & set(other.related_themes)) * 2
            score += len(current_subthemes & set(other.subthemes)) * 3
            score += len(current_entities & set(other.entities)) * 4
            if score > 0:
                scored.append((score, other))
        scored.sort(key=lambda item: (-item[0], item[1].date or "9999-99-99", item[1].title.lower()))
        related[conversation.id] = [item[1] for item in scored[:5]]
    return related


def archive_markdown(conversation: ConversationRecord) -> str:
    lines = [
        "---",
        f"id: {conversation.id}",
        f'title: "{conversation.title.replace(chr(34), chr(39))}"',
        f"date: {conversation.date or ''}",
        f"created: {conversation.create_time or ''}",
        f"updated: {conversation.update_time or ''}",
        f"source_shard: {conversation.source_shard}",
        "note_type: archive_transcript",
        "primary_themes:",
        *yaml_list(conversation.primary_themes),
        "secondary_themes:",
        *yaml_list(conversation.secondary_themes),
        "subthemes:",
        *yaml_list(conversation.subthemes),
        "entities:",
        *yaml_list(conversation.entities),
        "tags:",
        "  - ai-chat",
        "  - archive",
        "  - transcript",
        "---",
        "",
        f"# Archive: {obsidian_safe_title(conversation.title)}",
        "",
        f"- Essence note: [[03 Conversation Essence/{note_file_name(conversation)}|Open essence note]]" if conversation.durable_value else "- Essence note: not created",
        "",
        "## Transcript",
        "",
    ]
    for message in conversation.messages:
        lines.extend(
            [
                f"### {message.role.title()} | {message.create_time or 'unknown'}",
                "",
                message.text,
                "",
            ]
        )
    return "\n".join(lines).rstrip() + "\n"


def essence_markdown(
    conversation: ConversationRecord,
    related_notes: list[ConversationRecord],
) -> str:
    categories = category_candidates_for_conversation(conversation)
    lines = [
        "---",
        f"id: {conversation.id}",
        f'title: "{conversation.title.replace(chr(34), chr(39))}"',
        f"date: {conversation.date or ''}",
        "note_type: conversation_essence",
        f"durable_value_score: {conversation.durable_value_score}",
        "categories:",
        *yaml_list(categories),
        "primary_themes:",
        *yaml_list(conversation.primary_themes),
        "secondary_themes:",
        *yaml_list(conversation.secondary_themes),
        "subthemes:",
        *yaml_list(conversation.subthemes),
        "entities:",
        *yaml_list(conversation.entities),
        "tags:",
        "  - ai-chat",
        "  - essence",
        "---",
        "",
        f"# {obsidian_safe_title(conversation.title)}",
        "",
        "## Level 3",
        "",
        f"1-line summary: {level3_summary_line(conversation)}",
        "",
        "## Takeaways",
        "",
    ]
    for takeaway in level3_key_facts(conversation):
        lines.append(f"- {takeaway}")
    lines.extend(["", "## Categories", ""])
    for category in categories:
        lines.append(f"- [[05 Category Summaries/{category_file_name(category)[:-3]}|{category}]]")
    lines.extend(["", "## What This Was About", "", conversation.what_this_was_about, "", "## Useful Essence", "", conversation.essence_summary, "", "## Decisions / Conclusions", ""])
    for decision in conversation.decisions or ["No clear decision captured."]:
        lines.append(f"- {decision}")
    lines.extend(["", "## Open Questions", ""])
    for question in conversation.open_questions or ["No major open questions captured."]:
        lines.append(f"- {question}")
    lines.extend(["", "## Potential Actions", ""])
    for action in conversation.possible_actions or ["No action items clearly surfaced."]:
        lines.append(f"- {action}")
    lines.extend(["", "## Related Themes", ""])
    for theme in conversation.related_themes:
        lines.append(f"- [[01 Themes/{theme_folder(theme)}/Hub|{theme}]]")
    lines.extend(["", "## Related Subthemes", ""])
    for subtheme in conversation.subthemes:
        theme, _ = subtheme.split("/", 1)
        lines.append(f"- [[01 Themes/{theme_folder(theme)}/{subtheme_note_name(subtheme)[:-3]}|{subtheme}]]")
    lines.extend(["", "## Related Notes", ""])
    for other in related_notes:
        lines.append(f"- [[03 Conversation Essence/{note_file_name(other)}|{other.title}]]")
    if not related_notes:
        lines.append("- No closely related durable notes identified yet.")
    lines.extend(
        [
            "",
            "## Source",
            "",
            f"- Archive transcript: [[90 Archive/Conversations/{note_file_name(conversation)}|Open transcript]]",
            "",
        ]
    )
    return "\n".join(lines).rstrip() + "\n"


def build_theme_groupings(conversations: list[ConversationRecord]) -> tuple[dict[str, list[ConversationRecord]], dict[str, list[ConversationRecord]]]:
    theme_groups: dict[str, list[ConversationRecord]] = defaultdict(list)
    subtheme_groups: dict[str, list[ConversationRecord]] = defaultdict(list)
    for conversation in conversations:
        if not conversation.durable_value:
            continue
        for theme in conversation.related_themes:
            theme_groups[theme].append(conversation)
        for subtheme in conversation.subthemes:
            subtheme_groups[subtheme].append(conversation)
    return theme_groups, subtheme_groups


def evergreen_note_name(subtheme: str) -> str:
    theme, leaf = subtheme.split("/", 1)
    return f"{slugify(theme, max_length=30)}--{slugify(leaf, max_length=50)}.md"


def synthesize_group_overview(conversations: list[ConversationRecord]) -> tuple[list[str], list[str], list[str], list[str]]:
    takeaway_counter = Counter()
    decision_counter = Counter()
    question_counter = Counter()
    entity_counter = Counter()

    for conversation in conversations:
        takeaway_counter.update(conversation.key_takeaways[:3])
        decision_counter.update(conversation.decisions[:3])
        question_counter.update(conversation.open_questions[:3])
        entity_counter.update(conversation.entities)

    takeaways = [text for text, _ in takeaway_counter.most_common(6)]
    decisions = [text for text, _ in decision_counter.most_common(6)]
    questions = [text for text, _ in question_counter.most_common(6)]
    entities = [text for text, _ in entity_counter.most_common(8)]
    return takeaways, decisions, questions, entities


def theme_hub_markdown(theme: str, conversations: list[ConversationRecord], subthemes: list[str]) -> str:
    takeaways, decisions, questions, entities = synthesize_group_overview(conversations)
    lines = [
        "---",
        f'theme: "{theme}"',
        "note_type: theme_hub",
        "tags:",
        "  - ai-chat",
        "  - theme-hub",
        "---",
        "",
        f"# {theme}",
        "",
        f"Curated hub for {len(conversations)} durable conversations.",
        "",
        "## Main Patterns",
        "",
    ]
    for item in takeaways[:5] or [f"Repeated discussions cluster around {theme.lower()} topics."]:
        lines.append(f"- {item}")
    lines.extend(["", "## Subthemes", ""])
    for subtheme in sorted(subthemes):
        lines.append(f"- [[{subtheme_note_name(subtheme)[:-3]}|{subtheme.split('/', 1)[1]}]]")
    lines.extend(["", "## Decisions / Conclusions", ""])
    for item in decisions[:5] or ["No strong recurring conclusions extracted yet."]:
        lines.append(f"- {item}")
    lines.extend(["", "## Open Questions", ""])
    for item in questions[:5] or ["No recurring open questions extracted yet."]:
        lines.append(f"- {item}")
    lines.extend(["", "## Key Entities", ""])
    for entity in entities[:8] or ["No recurring named entities detected."]:
        lines.append(f"- {entity}")
    lines.extend(["", "## Related Evergreen Notes", ""])
    for subtheme in sorted(subthemes):
        lines.append(f"- [[02 Evergreen Notes/{evergreen_note_name(subtheme)[:-3]}|{subtheme}]]")
    lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def subtheme_markdown(subtheme: str, conversations: list[ConversationRecord]) -> str:
    theme, leaf = subtheme.split("/", 1)
    takeaways, decisions, questions, entities = synthesize_group_overview(conversations)
    lines = [
        "---",
        f'theme: "{theme}"',
        f'subtheme: "{leaf}"',
        "note_type: subtheme_note",
        "tags:",
        "  - ai-chat",
        "  - subtheme",
        "---",
        "",
        f"# {leaf}",
        "",
        f"Subtheme note covering {len(conversations)} durable conversations.",
        "",
        "## What Keeps Coming Up",
        "",
    ]
    for item in takeaways[:6] or ["No repeated themes extracted yet."]:
        lines.append(f"- {item}")
    lines.extend(["", "## Decisions / Conclusions", ""])
    for item in decisions[:6] or ["No recurring conclusions extracted yet."]:
        lines.append(f"- {item}")
    lines.extend(["", "## Open Questions", ""])
    for item in questions[:6] or ["No recurring open questions extracted yet."]:
        lines.append(f"- {item}")
    lines.extend(["", "## Related Entities", ""])
    for entity in entities[:8] or ["No recurring entities detected."]:
        lines.append(f"- {entity}")
    lines.extend(["", "## Related Evergreen Note", ""])
    lines.append(f"- [[02 Evergreen Notes/{evergreen_note_name(subtheme)[:-3]}|{subtheme}]]")
    lines.extend(["", "## Supporting Conversation Essence Notes", ""])
    for conversation in sorted(conversations, key=lambda item: (item.date or "9999-99-99", item.title.lower(), item.id))[:20]:
        lines.append(f"- [[03 Conversation Essence/{note_file_name(conversation)}|{conversation.date or 'unknown'} - {conversation.title}]]")
    lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def evergreen_markdown(subtheme: str, conversations: list[ConversationRecord]) -> str:
    theme, leaf = subtheme.split("/", 1)
    takeaways, decisions, questions, entities = synthesize_group_overview(conversations)
    lines = [
        "---",
        f'theme: "{theme}"',
        f'subtheme: "{leaf}"',
        "note_type: evergreen_note",
        "tags:",
        "  - ai-chat",
        "  - evergreen",
        "---",
        "",
        f"# {subtheme}",
        "",
        f"Evergreen synthesis across {len(conversations)} conversations.",
        "",
        "## Synthesized Understanding",
        "",
    ]
    for item in takeaways[:8] or ["No synthesized takeaways available yet."]:
        lines.append(f"- {item}")
    lines.extend(["", "## Decisions / Conclusions", ""])
    for item in decisions[:8] or ["No recurring conclusions extracted yet."]:
        lines.append(f"- {item}")
    lines.extend(["", "## Open Questions", ""])
    for item in questions[:8] or ["No recurring open questions extracted yet."]:
        lines.append(f"- {item}")
    lines.extend(["", "## Entities / Projects", ""])
    for entity in entities[:10] or ["No recurring entities detected."]:
        lines.append(f"- {entity}")
    lines.extend(["", "## Chronology", ""])
    for conversation in sorted(conversations, key=lambda item: (item.date or "9999-99-99", item.title.lower(), item.id))[:30]:
        lines.append(f"- {conversation.date or 'unknown'} [[03 Conversation Essence/{note_file_name(conversation)}|{conversation.title}]]")
    lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def cluster_markdown(cluster: dict[str, Any]) -> str:
    members: list[ConversationRecord] = cluster["members"]
    takeaways, decisions, questions, entities = synthesize_group_overview(members)
    lines = [
        "---",
        f"cluster_id: {cluster['cluster_id']}",
        f'title: "{cluster["title"].replace(chr(34), chr(39))}"',
        f'category: "{cluster["category"]}"',
        "note_type: topic_cluster",
        "tags:",
        "  - ai-chat",
        "  - level-2",
        "  - topic-cluster",
        "---",
        "",
        f"# {cluster['title']}",
        "",
        f"Clustered synthesis across {cluster['member_count']} Level 3 notes.",
        "",
        "## Canonical Summary",
        "",
    ]
    summary = takeaways[0] if takeaways else f"Repeated conversations cluster around {cluster['title']}."
    lines.append(f"- {summary}")
    lines.extend(["", "## Deduplicated Takeaways", ""])
    for takeaway in takeaways[:8] or ["No stable cluster takeaways extracted yet."]:
        lines.append(f"- {takeaway}")
    lines.extend(["", "## Stable Decisions", ""])
    for decision in decisions[:6] or ["No recurring decisions extracted yet."]:
        lines.append(f"- {decision}")
    lines.extend(["", "## Open Loops", ""])
    for question in questions[:6] or ["No recurring open loops extracted yet."]:
        lines.append(f"- {question}")
    lines.extend(["", "## Entities", ""])
    for entity in entities[:8] or ["No stable entities extracted yet."]:
        lines.append(f"- {entity}")
    lines.extend(["", "## Source Level 3 Notes", ""])
    for member in members[:20]:
        lines.append(f"- [[03 Conversation Essence/{note_file_name(member)}|{member.date or 'unknown'} - {member.title}]]")
    lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def category_markdown(category: str, clusters: list[dict[str, Any]]) -> str:
    members = [member for cluster in clusters for member in cluster["members"]]
    takeaways, decisions, questions, entities = synthesize_group_overview(members)
    lines = [
        "---",
        f'category: "{category}"',
        "note_type: category_summary",
        "tags:",
        "  - ai-chat",
        "  - level-1",
        "  - category-summary",
        "---",
        "",
        f"# {category}",
        "",
        f"Level 1 synthesis from {len(clusters)} clusters and {len(members)} supporting conversations.",
        "",
        "## What Keeps Recurring",
        "",
    ]
    for takeaway in takeaways[:8] or [f"No recurring synthesis is strong enough yet for {category}."]:
        lines.append(f"- {takeaway}")
    lines.extend(["", "## Stable Conclusions", ""])
    for decision in decisions[:6] or ["No stable conclusions extracted yet."]:
        lines.append(f"- {decision}")
    lines.extend(["", "## Active Open Loops", ""])
    for question in questions[:6] or ["No major open loops extracted yet."]:
        lines.append(f"- {question}")
    lines.extend(["", "## Key Entities", ""])
    for entity in entities[:8] or ["No recurring entities extracted yet."]:
        lines.append(f"- {entity}")
    lines.extend(["", "## Strongest Level 2 Clusters", ""])
    for cluster in sorted(clusters, key=lambda item: (-item["member_count"], item["title"].lower()))[:20]:
        lines.append(
            f"- [[04 Topic Clusters/{cluster_file_name(cluster['cluster_id'], cluster['title'])[:-3]}|{cluster['title']}]] "
            f"({cluster['member_count']} notes)"
        )
    lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def index_markdown(title: str, items: list[str]) -> str:
    return "\n".join([f"# {title}", "", *items, ""]).rstrip() + "\n"


def stable_sort_conversations(conversations: list[ConversationRecord]) -> list[ConversationRecord]:
    return sorted(
        conversations,
        key=lambda item: (
            item.date or "9999-99-99",
            item.id,
        ),
    )


def theme_target_paths_for_conversation(conversation: ConversationRecord) -> list[str]:
    paths: list[str] = []
    for theme in conversation.related_themes:
        paths.append(f"01 Themes/{theme_folder(theme)}/Hub.md")
    for subtheme in conversation.subthemes:
        theme, _ = subtheme.split("/", 1)
        paths.append(f"01 Themes/{theme_folder(theme)}/{subtheme_note_name(subtheme)}")
    return dedupe_preserve_order(paths)


def existing_batch_map(tracker_json_path: Path) -> dict[tuple[str, ...], dict[str, Any]]:
    if not tracker_json_path.exists():
        return {}
    payload = load_json(tracker_json_path)
    mapping: dict[tuple[str, ...], dict[str, Any]] = {}
    for batch in payload.get("batches", []):
        key = tuple(batch.get("conversation_ids", []))
        if key:
            mapping[key] = batch
    return mapping


def summarize_batch_for_markdown(batch: dict[str, Any]) -> str:
    theme_targets = ", ".join(batch.get("theme_targets", [])[:3])
    if len(batch.get("theme_targets", [])) > 3:
        theme_targets += ", ..."
    return (
        f"| {batch['batch_id']} | {batch['status']} | {batch['date_start']} -> {batch['date_end']} | "
        f"{batch['conversation_count']} | {batch['char_count']} | {theme_targets or '-'} |"
    )


def build_batch_tracker_from_conversations(
    conversations: list[ConversationRecord],
    *,
    tracker_json_path: Path = DEFAULT_TRACKER_JSON,
    tracker_markdown_path: Path = DEFAULT_TRACKER_MARKDOWN,
    target_count: int = BATCH_TARGET_COUNT,
    char_limit: int = BATCH_CHAR_LIMIT,
) -> dict[str, Any]:
    ordered = stable_sort_conversations(conversations)
    previous = existing_batch_map(tracker_json_path)

    batches: list[dict[str, Any]] = []
    current: list[ConversationRecord] = []
    current_chars = 0

    def flush_batch() -> None:
        nonlocal current, current_chars
        if not current:
            return
        conversation_ids = [conversation.id for conversation in current]
        key = tuple(conversation_ids)
        preserved = previous.get(key, {})
        theme_targets = dedupe_preserve_order(
            target
            for conversation in current
            for target in theme_target_paths_for_conversation(conversation)
        )
        batch = {
            "batch_id": f"B{len(batches) + 1:04d}",
            "status": preserved.get("status", "pending"),
            "conversation_ids": conversation_ids,
            "date_start": current[0].date or "undated",
            "date_end": current[-1].date or "undated",
            "conversation_count": len(current),
            "char_count": current_chars,
            "theme_targets": theme_targets,
            "notes_touched": preserved.get("notes_touched", []),
            "started_at": preserved.get("started_at"),
            "finished_at": preserved.get("finished_at"),
            "session_summary": preserved.get("session_summary", ""),
            "open_followups": preserved.get("open_followups", []),
        }
        batches.append(batch)
        current = []
        current_chars = 0

    for conversation in ordered:
        conversation_chars = max(1, conversation.char_count)
        overflow_single = not current and conversation_chars > char_limit
        if current and (len(current) >= target_count or current_chars + conversation_chars > char_limit):
            flush_batch()
        current.append(conversation)
        current_chars += conversation_chars
        if overflow_single:
            flush_batch()

    flush_batch()

    next_pending = next((batch["batch_id"] for batch in batches if batch["status"] == "pending"), None)
    in_progress = next((batch["batch_id"] for batch in batches if batch["status"] == "in_progress"), None)
    completed = [batch for batch in batches if batch["status"] == "completed"]

    tracker_payload = {
        "generated_at": datetime.now(tz=timezone.utc).isoformat(timespec="seconds"),
        "conversation_count": len(ordered),
        "batch_count": len(batches),
        "target_conversations_per_batch": target_count,
        "char_limit_per_batch": char_limit,
        "next_pending_batch_id": next_pending,
        "active_batch_id": in_progress,
        "resume_command": RESUME_COMMAND,
        "batches": batches,
    }
    write_json(tracker_json_path, tracker_payload)

    status_counts = Counter(batch["status"] for batch in batches)
    md_lines = [
        "# Second Brain Batch Tracker",
        "",
        "This file tracks model-driven curation batches for the Obsidian vault.",
        "",
        "## Summary",
        "",
        f"- Total conversations: {len(ordered)}",
        f"- Total batches: {len(batches)}",
        f"- Pending: {status_counts.get('pending', 0)}",
        f"- In progress: {status_counts.get('in_progress', 0)}",
        f"- Completed: {status_counts.get('completed', 0)}",
        f"- Blocked: {status_counts.get('blocked', 0)}",
        f"- Next pending batch: `{next_pending or 'none'}`",
        f"- Current in-progress batch: `{in_progress or 'none'}`",
        "",
        "## Resume Command",
        "",
        "```bash",
        RESUME_COMMAND,
        "```",
        "",
        "## Workflow",
        "",
        "1. Read `AGENT.md`.",
        "2. Read this tracker and `data/chatgpt-export/batch-tracker.json`.",
        "3. Find the next pending batch.",
        "4. Review the listed theme/subtheme/evergreen notes before editing.",
        "5. Process only one batch unless explicitly told otherwise.",
        "6. Update both tracker files before finishing.",
        "",
        "## Batches",
        "",
        "| Batch | Status | Dates | Convos | Chars | Theme Targets |",
        "| --- | --- | --- | ---: | ---: | --- |",
    ]
    md_lines.extend(summarize_batch_for_markdown(batch) for batch in batches)
    md_lines.extend(["", "## Last Completed Sessions", ""])
    if completed:
        for batch in sorted(completed, key=lambda item: item.get("finished_at") or "", reverse=True)[:10]:
            md_lines.append(
                f"- `{batch['batch_id']}` finished `{batch.get('finished_at') or 'unknown'}`: "
                f"{batch.get('session_summary') or 'No summary recorded.'}"
            )
    else:
        md_lines.append("- No completed batches yet.")
    md_lines.append("")
    tracker_markdown_path.write_text("\n".join(md_lines), encoding="utf-8")
    return tracker_payload


def generate_batch_tracker(
    parsed_root: Path,
    *,
    tracker_json_path: Path = DEFAULT_TRACKER_JSON,
    tracker_markdown_path: Path = DEFAULT_TRACKER_MARKDOWN,
    target_count: int = BATCH_TARGET_COUNT,
    char_limit: int = BATCH_CHAR_LIMIT,
) -> dict[str, Any]:
    conversations = load_parsed_conversations(parsed_root)
    return build_batch_tracker_from_conversations(
        conversations,
        tracker_json_path=tracker_json_path,
        tracker_markdown_path=tracker_markdown_path,
        target_count=target_count,
        char_limit=char_limit,
    )


def describe_batch(
    tracker_json_path: Path,
    batch_id: str,
) -> dict[str, Any]:
    payload = load_json(tracker_json_path)
    for batch in payload.get("batches", []):
        if batch.get("batch_id") == batch_id:
            return batch
    raise ValueError(f"Unknown batch id: {batch_id}")


def build_obsidian_vault(
    parsed_root: Path,
    vault_root: Path,
    *,
    rebuild: bool = False,
) -> dict[str, Any]:
    conversations = load_parsed_conversations(parsed_root)
    durable_conversations = [conversation for conversation in conversations if conversation.durable_value]
    theme_groups, subtheme_groups = build_theme_groupings(conversations)
    related_notes = related_note_map(conversations)
    clusters = build_conversation_clusters(conversations)

    if rebuild:
        reset_dir(vault_root)
    else:
        vault_root.mkdir(parents=True, exist_ok=True)

    home_dir = vault_root / "00 Home"
    themes_dir = vault_root / "01 Themes"
    evergreen_dir = vault_root / "02 Evergreen Notes"
    essence_dir = vault_root / "03 Conversation Essence"
    clusters_dir = vault_root / "04 Topic Clusters"
    categories_dir = vault_root / "05 Category Summaries"
    archive_dir = vault_root / "90 Archive" / "Conversations"
    indexes_dir = vault_root / "99 Indexes"
    for directory in (home_dir, themes_dir, evergreen_dir, essence_dir, clusters_dir, categories_dir, archive_dir, indexes_dir):
        directory.mkdir(parents=True, exist_ok=True)

    for conversation in conversations:
        archive_path = archive_dir / note_file_name(conversation)
        archive_path.write_text(archive_markdown(conversation), encoding="utf-8")

    for conversation in durable_conversations:
        essence_path = essence_dir / note_file_name(conversation)
        essence_path.write_text(
            essence_markdown(conversation, related_notes.get(conversation.id, [])),
            encoding="utf-8",
        )

    category_groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for cluster in clusters:
        category_groups[cluster["category"]].append(cluster)
        (clusters_dir / cluster_file_name(cluster["cluster_id"], cluster["title"])).write_text(
            cluster_markdown(cluster),
            encoding="utf-8",
        )

    for category in CATEGORY_ORDER:
        items = category_groups.get(category, [])
        if not items:
            continue
        (categories_dir / category_file_name(category)).write_text(
            category_markdown(category, items),
            encoding="utf-8",
        )

    theme_to_subthemes: dict[str, list[str]] = defaultdict(list)
    for subtheme in sorted(subtheme_groups):
        theme, _ = subtheme.split("/", 1)
        theme_to_subthemes[theme].append(subtheme)

        subtheme_folder_path = themes_dir / theme_folder(theme)
        subtheme_folder_path.mkdir(parents=True, exist_ok=True)
        (subtheme_folder_path / subtheme_note_name(subtheme)).write_text(
            subtheme_markdown(subtheme, subtheme_groups[subtheme]),
            encoding="utf-8",
        )
        (evergreen_dir / evergreen_note_name(subtheme)).write_text(
            evergreen_markdown(subtheme, subtheme_groups[subtheme]),
            encoding="utf-8",
        )

    for theme, items in sorted(theme_groups.items()):
        theme_path = themes_dir / theme_folder(theme)
        theme_path.mkdir(parents=True, exist_ok=True)
        (theme_path / theme_hub_name(theme)).write_text(
            theme_hub_markdown(theme, items, theme_to_subthemes.get(theme, [])),
            encoding="utf-8",
        )

    year_groups: dict[str, list[ConversationRecord]] = defaultdict(list)
    entity_groups: dict[str, list[ConversationRecord]] = defaultdict(list)
    for conversation in durable_conversations:
        year_groups[conversation.year or "undated"].append(conversation)
        for entity in conversation.entities:
            entity_groups[entity].append(conversation)

    by_year_lines: list[str] = []
    for year, items in sorted(year_groups.items()):
        by_year_lines.append(f"## {year}")
        by_year_lines.append("")
        for conversation in sorted(items, key=lambda item: (item.date or "", item.title.lower(), item.id)):
            by_year_lines.append(f"- {conversation.date or 'unknown'} [[03 Conversation Essence/{note_file_name(conversation)}|{conversation.title}]]")
        by_year_lines.append("")
    (indexes_dir / "By Year.md").write_text(index_markdown("By Year", by_year_lines), encoding="utf-8")

    by_theme_lines: list[str] = []
    for theme, items in sorted(theme_groups.items()):
        by_theme_lines.append(f"- [[01 Themes/{theme_folder(theme)}/Hub|{theme}]] ({len(items)} durable notes)")
    (indexes_dir / "By Theme.md").write_text(index_markdown("By Theme", by_theme_lines), encoding="utf-8")

    by_category_lines: list[str] = []
    for category in CATEGORY_ORDER:
        items = category_groups.get(category, [])
        if not items:
            continue
        member_count = sum(item["member_count"] for item in items)
        by_category_lines.append(
            f"- [[05 Category Summaries/{category_file_name(category)[:-3]}|{category}]] "
            f"({len(items)} clusters, {member_count} supporting notes)"
        )
    (indexes_dir / "By Category.md").write_text(index_markdown("By Category", by_category_lines), encoding="utf-8")

    by_cluster_lines: list[str] = []
    for cluster in sorted(clusters, key=lambda item: (-item["member_count"], item["title"].lower())):
        by_cluster_lines.append(
            f"- [[04 Topic Clusters/{cluster_file_name(cluster['cluster_id'], cluster['title'])[:-3]}|{cluster['title']}]] "
            f"({cluster['member_count']} notes, {cluster['category']})"
        )
    (indexes_dir / "By Cluster.md").write_text(index_markdown("By Cluster", by_cluster_lines), encoding="utf-8")

    by_entity_lines: list[str] = []
    for entity, items in sorted(entity_groups.items()):
        by_entity_lines.append(f"## {entity}")
        by_entity_lines.append("")
        for conversation in sorted(items, key=lambda item: (item.date or "", item.title.lower(), item.id))[:20]:
            by_entity_lines.append(f"- [[03 Conversation Essence/{note_file_name(conversation)}|{conversation.title}]]")
        by_entity_lines.append("")
    (indexes_dir / "By Entity.md").write_text(index_markdown("By Entity", by_entity_lines), encoding="utf-8")

    note_type_lines = [
        "- `00 Home`: vault entry points and navigation",
        "- `01 Themes`: theme hubs and subtheme notes",
        "- `02 Evergreen Notes`: merged long-term understanding across repeated conversations",
        "- `03 Conversation Essence`: Level 3 per-conversation distilled notes",
        "- `04 Topic Clusters`: Level 2 deduplicated cluster syntheses",
        "- `05 Category Summaries`: Level 1 category syntheses",
        "- `90 Archive/Conversations`: cleaned transcripts kept for reference",
        "- `99 Indexes`: browse aids by year, category, cluster, theme, entity, and note type",
    ]
    (indexes_dir / "By Note Type.md").write_text(index_markdown("By Note Type", note_type_lines), encoding="utf-8")

    top_connected = sorted(
        durable_conversations,
        key=lambda item: (
            len(item.related_themes) + len(item.subthemes) + len(item.entities),
            item.date or "",
        ),
        reverse=True,
    )[:12]
    recent = sorted(durable_conversations, key=lambda item: item.date or "", reverse=True)[:15]

    home_lines = [
        "# AI Second Brain",
        "",
        "Curated, theme-first knowledge base generated from ChatGPT conversations.",
        "",
        "## Start Here",
        "",
        "- [[99 Indexes/By Category|Browse by category]]",
        "- [[99 Indexes/By Cluster|Browse by cluster]]",
        "- [[99 Indexes/By Theme|Browse by theme]]",
        "- [[99 Indexes/By Year|Browse by year]]",
        "- [[99 Indexes/By Entity|Browse by entity]]",
        "- [[99 Indexes/By Note Type|How this vault is organized]]",
        "",
        "## Level 1 Categories",
        "",
    ]
    for category in CATEGORY_ORDER:
        if category not in category_groups:
            continue
        home_lines.append(f"- [[05 Category Summaries/{category_file_name(category)[:-3]}|{category}]]")
    home_lines.extend([
        "",
        "## Strongest Level 2 Clusters",
        "",
    ])
    for cluster in sorted(clusters, key=lambda item: (-item["member_count"], item["title"].lower()))[:12]:
        home_lines.append(
            f"- [[04 Topic Clusters/{cluster_file_name(cluster['cluster_id'], cluster['title'])[:-3]}|{cluster['title']}]] "
            f"({cluster['member_count']} notes)"
        )
    home_lines.extend([
        "",
        "## Theme Hubs",
        "",
    ])
    for theme in sorted(theme_groups):
        home_lines.append(f"- [[01 Themes/{theme_folder(theme)}/Hub|{theme}]]")
    home_lines.extend(["", "## Most Connected Notes", ""])
    for conversation in top_connected:
        home_lines.append(f"- [[03 Conversation Essence/{note_file_name(conversation)}|{conversation.title}]]")
    home_lines.extend(["", "## Recent Durable Notes", ""])
    for conversation in recent:
        home_lines.append(f"- [[03 Conversation Essence/{note_file_name(conversation)}|{conversation.date or 'unknown'} - {conversation.title}]]")
    home_lines.extend(["", "## Archive", ""])
    home_lines.append("- [[90 Archive/README|Archive entry point]]")
    (home_dir / "Home.md").write_text("\n".join(home_lines).rstrip() + "\n", encoding="utf-8")

    archive_readme = [
        "# Archive",
        "",
        "Cleaned transcripts live in `90 Archive/Conversations`.",
        "",
        f"- Total archive transcripts: {len(conversations)}",
        f"- Durable essence notes: {len(durable_conversations)}",
        "",
        "Use the yearly index for browsing distilled notes, then jump into archive transcripts when needed.",
        "",
    ]
    (vault_root / "90 Archive" / "README.md").write_text("\n".join(archive_readme), encoding="utf-8")

    root_lines = [
        "# AI Second Brain",
        "",
        "- [[00 Home/Home]]",
        "- [[99 Indexes/By Category]]",
        "- [[99 Indexes/By Cluster]]",
        "- [[99 Indexes/By Theme]]",
        "- [[99 Indexes/By Year]]",
        "",
        f"- Total conversations parsed: {len(conversations)}",
        f"- Durable essence notes: {len(durable_conversations)}",
        f"- Topic clusters: {len(clusters)}",
        f"- Category summaries: {len(category_groups)}",
        f"- Archive-only conversations: {len(conversations) - len(durable_conversations)}",
        f"- Theme hubs: {len(theme_groups)}",
        f"- Subtheme notes: {len(subtheme_groups)}",
        f"- Evergreen notes: {len(subtheme_groups)}",
        "",
    ]
    (vault_root / "README.md").write_text("\n".join(root_lines), encoding="utf-8")

    report = {
        "vault_root": str(vault_root),
        "archive_note_count": len(conversations),
        "essence_note_count": len(durable_conversations),
        "cluster_note_count": len(clusters),
        "category_note_count": len(category_groups),
        "theme_hub_count": len(theme_groups),
        "subtheme_note_count": len(subtheme_groups),
        "evergreen_note_count": len(subtheme_groups),
        "built_at": datetime.now(tz=timezone.utc).isoformat(timespec="seconds"),
    }
    write_json(vault_root / "vault_report.json", report)
    write_json(
        parsed_root / "level2_clusters.json",
        [
            {
                "cluster_id": cluster["cluster_id"],
                "title": cluster["title"],
                "category": cluster["category"],
                "conversation_ids": cluster["conversation_ids"],
                "member_count": cluster["member_count"],
            }
            for cluster in clusters
        ],
    )
    write_json(
        parsed_root / "level1_categories.json",
        [
            {
                "category": category,
                "cluster_ids": [cluster["cluster_id"] for cluster in items],
                "cluster_count": len(items),
                "conversation_count": sum(cluster["member_count"] for cluster in items),
            }
            for category, items in sorted(category_groups.items())
        ],
    )
    write_json(
        parsed_root / "level3_index.json",
        [
            {
                "id": conversation.id,
                "date": conversation.date,
                "title": conversation.title,
                "one_line_summary": level3_summary_line(conversation),
                "key_facts": level3_key_facts(conversation),
                "categories": category_candidates_for_conversation(conversation),
                "themes": conversation.related_themes,
                "entities": conversation.entities,
                "durable_value_score": conversation.durable_value_score,
            }
            for conversation in conversations
        ],
    )
    return report
