from __future__ import annotations

import html
import re

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, Preformatted, SimpleDocTemplate, Spacer

from ..config import OUTPUTS_DIR
from .files import clean_name, meta
from .registry import Result, need, tool

BODY = ParagraphStyle("body", fontName="Helvetica", fontSize=10.5, leading=15, spaceAfter=7)
LI = ParagraphStyle("li", parent=BODY, leftIndent=16, bulletIndent=4, spaceAfter=3)
CODE = ParagraphStyle("code", fontName="Courier", fontSize=8.5, leading=11.5, backColor=colors.HexColor("#F1F2F5"),
                      borderPadding=6, spaceBefore=4, spaceAfter=10)
H = {
    0: ParagraphStyle("t", fontName="Helvetica-Bold", fontSize=24, leading=29, spaceAfter=14),
    1: ParagraphStyle("h1", fontName="Helvetica-Bold", fontSize=18, leading=22, spaceBefore=14, spaceAfter=8),
    2: ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=14, leading=18, spaceBefore=12, spaceAfter=6),
    3: ParagraphStyle("h3", fontName="Helvetica-Bold", fontSize=11.5, leading=15, spaceBefore=10, spaceAfter=4),
}


def _inline(s: str) -> str:
    s = html.escape(s, quote=False)
    s = re.sub(r"`([^`]+)`", r'<font face="Courier">\1</font>', s)
    s = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", s)
    s = re.sub(r"(?<!\*)\*(?!\s)(.+?)(?<!\s)\*(?!\*)", r"<i>\1</i>", s)
    return s


def _para(text: str, style: ParagraphStyle, **kw) -> Paragraph:
    try:
        return Paragraph(_inline(text), style, **kw)
    except Exception:  # malformed inline markup -> plain text
        return Paragraph(html.escape(text, quote=False), style, **kw)


def _flow(md: str) -> list:
    out: list = []
    para: list[str] = []
    code: list[str] = []
    table: list[str] = []
    in_code = False

    def flush_para():
        if para:
            out.append(_para(" ".join(para), BODY))
            para.clear()

    def flush_table():
        if table:
            out.append(Preformatted("\n".join(table), CODE, maxLineLength=100))
            table.clear()

    for raw in md.splitlines():
        line = raw.rstrip()
        if line.strip().startswith("```"):
            if in_code:
                out.append(Preformatted("\n".join(code), CODE, maxLineLength=95))
                code.clear()
                in_code = False
            else:
                flush_para()
                flush_table()
                in_code = True
            continue
        if in_code:
            code.append(raw)
            continue
        if line.startswith("|"):
            flush_para()
            table.append(line)
            continue
        flush_table()
        if not line.strip():
            flush_para()
            continue
        m = re.match(r"^(#{1,3})\s+(.*)", line)
        if m:
            flush_para()
            out.append(_para(m.group(2), H[len(m.group(1))]))
            continue
        m = re.match(r"^\s*([-*+]|\d+\.)\s+(.*)", line)
        if m:
            flush_para()
            bullet = "•" if m.group(1) in {"-", "*", "+"} else m.group(1)
            out.append(_para(m.group(2), LI, bulletText=bullet))
            continue
        para.append(line.strip())
    flush_para()
    flush_table()
    if code:
        out.append(Preformatted("\n".join(code), CODE, maxLineLength=95))
    return out


@tool(
    "create_pdf",
    "Create a PDF document the user can download. Content is Markdown: # headings, paragraphs, - bullets, 1. lists, **bold**, *italic*, `code`, and fenced code blocks.",
    {
        "filename": {"type": "string", "description": "File name, e.g. report.pdf"},
        "title": {"type": "string", "description": "Optional title shown at the top."},
        "content": {"type": "string", "description": "Document body in Markdown."},
    },
    ["filename", "content"],
)
def create_pdf(args: dict) -> Result:
    need(args, "filename", "content")
    path = OUTPUTS_DIR / clean_name(args["filename"], ".pdf")
    flow: list = []
    title = (args.get("title") or "").strip()
    if title:
        flow.append(_para(title, H[0]))
    flow += _flow(args["content"]) or [Spacer(1, 1)]
    SimpleDocTemplate(
        str(path), pagesize=A4, leftMargin=2.2 * cm, rightMargin=2.2 * cm,
        topMargin=2 * cm, bottomMargin=2 * cm, title=title or path.stem,
    ).build(flow)
    m = meta(path)
    return Result(f"Created {m['name']} ({m['size']} bytes).", m)