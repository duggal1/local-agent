from __future__ import annotations

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.util import Inches, Pt

from ..config import OUTPUTS_DIR
from .files import clean_name, meta
from .registry import Result, need, tool

INK = RGBColor(0x11, 0x11, 0x14)
MUTE = RGBColor(0x5B, 0x5D, 0x66)
ACCENT = RGBColor(0xE8, 0x48, 0x0C)


def _box(slide, x, y, w, h, paras, size, color, bold=False, gap=0):
    tb = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame
    tf.word_wrap = True
    for i, t in enumerate(paras):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.text = str(t)
        p.space_after = Pt(gap)
        for r in p.runs:
            r.font.size, r.font.bold, r.font.color.rgb, r.font.name = Pt(size), bold, color, "Calibri"


def _bar(slide, x, y, w, h):
    s = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(h))
    s.fill.solid()
    s.fill.fore_color.rgb = ACCENT
    s.line.fill.background()


@tool(
    "create_pptx",
    "Create a PowerPoint deck (.pptx). A title slide is added from title/subtitle, then one slide per entry in slides.",
    {
        "filename": {"type": "string", "description": "e.g. pitch.pptx"},
        "title": {"type": "string", "description": "Deck title."},
        "subtitle": {"type": "string", "description": "Optional subtitle."},
        "slides": {
            "type": "array",
            "description": "Content slides.",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "The takeaway as a sentence."},
                    "bullets": {"type": "array", "items": {"type": "string"}, "description": "3-5 short bullets."},
                    "notes": {"type": "string", "description": "Optional speaker notes."},
                },
                "required": ["title", "bullets"],
            },
        },
    },
    ["filename", "title", "slides"],
)
def create_pptx(args: dict) -> Result:
    need(args, "filename", "title")
    slides = args.get("slides")
    if not isinstance(slides, list) or not slides:
        raise ValueError("slides must be a non-empty array")
    prs = Presentation()
    prs.slide_width, prs.slide_height = Inches(13.333), Inches(7.5)
    blank = prs.slide_layouts[6]

    s = prs.slides.add_slide(blank)
    _bar(s, 0.9, 2.55, 0.9, 0.08)
    _box(s, 0.9, 2.8, 11.5, 1.8, [args["title"]], 48, INK, True)
    if args.get("subtitle"):
        _box(s, 0.9, 4.6, 11.5, 1.0, [args["subtitle"]], 22, MUTE)

    for i, sl in enumerate(slides, start=2):
        if not isinstance(sl, dict):
            continue
        s = prs.slides.add_slide(blank)
        _bar(s, 0.9, 0.75, 0.6, 0.06)
        _box(s, 0.9, 0.95, 11.5, 1.2, [sl.get("title", "")], 34, INK, True)
        bullets = [str(b) for b in (sl.get("bullets") or [])][:8]
        _box(s, 0.9, 2.3, 11.5, 4.4, bullets, 22, INK, gap=14)
        _box(s, 12.0, 6.9, 0.8, 0.4, [str(i)], 12, MUTE)
        if sl.get("notes"):
            s.notes_slide.notes_text_frame.text = str(sl["notes"])

    p = OUTPUTS_DIR / clean_name(args["filename"], ".pptx")
    prs.save(p)
    m = meta(p)
    return Result(f"Created {m['name']} ({len(prs.slides)} slides). It is open in the preview panel.", m)