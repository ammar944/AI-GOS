from __future__ import annotations

from pathlib import Path
from typing import Iterable

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, Preformatted, SimpleDocTemplate, Spacer


ROOT = Path("/Users/ammar/Dev-Projects/AI-GOS-main")
SOURCE = ROOT / "docs" / "2026-03-12-journey-research-assessment.md"
OUTPUT = ROOT / "output" / "pdf" / "2026-03-12-journey-research-assessment.pdf"


def build_styles() -> dict[str, ParagraphStyle]:
    styles = getSampleStyleSheet()

    return {
        "title": ParagraphStyle(
            "AssessmentTitle",
            parent=styles["Title"],
            fontName="Helvetica-Bold",
            fontSize=22,
            leading=28,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#111827"),
            spaceAfter=20,
        ),
        "heading1": ParagraphStyle(
            "AssessmentHeading1",
            parent=styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=15,
            leading=20,
            textColor=colors.HexColor("#111827"),
            spaceBefore=12,
            spaceAfter=8,
        ),
        "heading2": ParagraphStyle(
            "AssessmentHeading2",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=12,
            leading=16,
            textColor=colors.HexColor("#1f2937"),
            spaceBefore=10,
            spaceAfter=6,
        ),
        "body": ParagraphStyle(
            "AssessmentBody",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=9.25,
            leading=13,
            textColor=colors.HexColor("#1f2937"),
            spaceAfter=6,
        ),
        "bullet": ParagraphStyle(
            "AssessmentBullet",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=9.25,
            leading=13,
            leftIndent=14,
            firstLineIndent=-8,
            bulletIndent=0,
            textColor=colors.HexColor("#1f2937"),
            spaceAfter=4,
        ),
        "table": ParagraphStyle(
            "AssessmentTable",
            parent=styles["Code"],
            fontName="Courier",
            fontSize=7.3,
            leading=9.4,
            leftIndent=8,
            textColor=colors.HexColor("#111827"),
            backColor=colors.HexColor("#f3f4f6"),
            borderPadding=6,
            borderWidth=0.5,
            borderColor=colors.HexColor("#d1d5db"),
            borderRadius=4,
            spaceAfter=8,
        ),
    }


def escape(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def add_page_number(canvas, doc) -> None:
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#6b7280"))
    canvas.drawRightString(doc.pagesize[0] - 0.55 * inch, 0.45 * inch, f"Page {doc.page}")
    canvas.restoreState()


def flush_paragraph(paragraph_lines: list[str], story, styles: dict[str, ParagraphStyle]) -> None:
    if not paragraph_lines:
        return

    text = " ".join(line.strip() for line in paragraph_lines if line.strip())
    if text:
        story.append(Paragraph(escape(text), styles["body"]))
    paragraph_lines.clear()


def flush_table(table_lines: list[str], story, styles: dict[str, ParagraphStyle]) -> None:
    if not table_lines:
        return

    cleaned = "\n".join(table_lines)
    story.append(Preformatted(cleaned, styles["table"]))
    table_lines.clear()


def render_markdown(lines: Iterable[str], story, styles: dict[str, ParagraphStyle]) -> None:
    paragraph_lines: list[str] = []
    table_lines: list[str] = []
    saw_title = False

    for raw_line in lines:
        line = raw_line.rstrip("\n")
        stripped = line.strip()

        if stripped.startswith("|"):
            flush_paragraph(paragraph_lines, story, styles)
            table_lines.append(line)
            continue

        if table_lines:
            flush_table(table_lines, story, styles)

        if not stripped:
            flush_paragraph(paragraph_lines, story, styles)
            story.append(Spacer(1, 0.08 * inch))
            continue

        if stripped.startswith("# "):
            flush_paragraph(paragraph_lines, story, styles)
            text = stripped[2:].strip()
            style = styles["title"] if not saw_title else styles["heading1"]
            story.append(Paragraph(escape(text), style))
            if not saw_title:
                story.append(Spacer(1, 0.08 * inch))
                saw_title = True
            continue

        if stripped.startswith("## "):
            flush_paragraph(paragraph_lines, story, styles)
            story.append(Paragraph(escape(stripped[3:].strip()), styles["heading1"]))
            continue

        if stripped.startswith("### "):
            flush_paragraph(paragraph_lines, story, styles)
            story.append(Paragraph(escape(stripped[4:].strip()), styles["heading2"]))
            continue

        if stripped.startswith("- "):
            flush_paragraph(paragraph_lines, story, styles)
            story.append(
                Paragraph(escape(stripped[2:].strip()), styles["bullet"], bulletText="•")
            )
            continue

        paragraph_lines.append(line)

    flush_paragraph(paragraph_lines, story, styles)
    flush_table(table_lines, story, styles)


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    styles = build_styles()
    story = []

    render_markdown(SOURCE.read_text(encoding="utf-8").splitlines(), story, styles)

    document = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=LETTER,
        leftMargin=0.68 * inch,
        rightMargin=0.68 * inch,
        topMargin=0.72 * inch,
        bottomMargin=0.7 * inch,
        title="AI-GOS Journey Research Assessment",
        author="OpenAI Codex",
    )
    document.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)


if __name__ == "__main__":
    main()
