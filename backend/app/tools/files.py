from __future__ import annotations

import csv
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

from ..config import OUTPUTS_DIR
from ..guard import looping
from .registry import Result, need, tool

TEXT_EXT = {
    ".md", ".txt", ".py", ".js", ".ts", ".tsx", ".jsx", ".json", ".html", ".htm", ".css", ".csv",
    ".yaml", ".yml", ".toml", ".sh", ".sql", ".rs", ".go", ".java", ".c", ".cpp", ".h", ".xml",
}


def clean_name(name: str, ext: str = "", default_ext: str = ".txt") -> str:
    n = Path(str(name)).name.strip().replace(" ", "_")
    n = re.sub(r"[^A-Za-z0-9._-]", "", n).lstrip(".") or "untitled"
    if ext and not n.lower().endswith(ext):
        n += ext
    elif not ext and "." not in n:
        n += default_ext
    return n[:96]


def meta(path: Path) -> dict:
    ext = path.suffix.lower()
    return {
        "name": path.name,
        "size": path.stat().st_size,
        "kind": ext.lstrip(".").upper() or "FILE",
        "url": f"/api/files/{path.name}",
        "text": ext in TEXT_EXT,
    }


def done(p: Path, note: str = "") -> Result:
    m = meta(p)
    return Result(f"Created {m['name']} ({m['size']} bytes).{note}", m)


@tool(
    "create_markdown",
    "Create a Markdown (.md) file the user can download.",
    {
        "filename": {"type": "string", "description": "File name, e.g. notes.md"},
        "content": {"type": "string", "description": "Full Markdown content."},
    },
    ["filename", "content"],
)
def create_markdown(args: dict) -> Result:
    need(args, "filename", "content")
    p = OUTPUTS_DIR / clean_name(args["filename"], ".md")
    p.write_text(args["content"], encoding="utf-8")
    return done(p)


@tool(
    "create_file",
    "Create any text or code file (py, js, json, sh, sql, ...). Use the right extension. Write the complete file.",
    {
        "filename": {"type": "string", "description": "File name with extension, e.g. app.py"},
        "content": {"type": "string", "description": "Full file content."},
    },
    ["filename", "content"],
)
def create_file(args: dict) -> Result:
    need(args, "filename", "content")
    p = OUTPUTS_DIR / clean_name(args["filename"])
    p.write_text(args["content"], encoding="utf-8")
    return done(p)


def _check_js(doc: str) -> str | None:
    """Real syntax check of inline <script> blocks via `node --check` (you have node for Vite)."""
    node = shutil.which("node")
    if not node:
        return None
    for m in re.finditer(r"<script([^>]*)>(.*?)</script>", doc, re.S | re.I):
        attrs, code = m.group(1).lower(), m.group(2).strip()
        if not code or "src=" in attrs or "importmap" in attrs or "json" in attrs:
            continue
        with tempfile.NamedTemporaryFile("w", suffix=".mjs" if "module" in attrs else ".js", delete=False) as f:
            f.write(code)
            path = f.name
        try:
            r = subprocess.run([node, "--check", path], capture_output=True, text=True, timeout=10)
        finally:
            os.unlink(path)
        if r.returncode != 0:
            lines = [l.replace(path, "script") for l in r.stderr.splitlines() if l.strip()]
            err = next((l for l in lines if l.startswith("SyntaxError")), lines[-1] if lines else "unknown")
            return f"JavaScript syntax error at {lines[0] if lines else 'script'}: {err}"[:300]
    return None


def check_html(doc: str) -> str | None:
    low = doc.lower()
    if "```" in doc:
        return "it contains markdown code fences (```); a file must be raw HTML only"
    if len(doc) > 70_000:
        return "it is too long (over 70k characters)"
    if looping(doc):
        return "it repeats the same text over and over"
    if "</html>" not in low:
        return "it is cut off (no closing </html>)"
    if low.count("<script") != low.count("</script>"):
        return "unbalanced <script> tags"
    return _check_js(doc)


@tool(
    "create_html",
    "Create a single-file HTML page for games, 3D, canvas, calculators or custom interactive pages. For normal websites and landing pages use create_site instead. Keep it under 120 lines. Renders live in the preview panel.",
    {
        "filename": {"type": "string", "description": "e.g. game.html"},
        "content": {"type": "string", "description": "The full HTML document, raw, no markdown fences."},
    },
    ["filename", "content"],
)
def create_html(args: dict) -> Result:
    need(args, "filename", "content")
    p = OUTPUTS_DIR / clean_name(args["filename"], ".html")
    c = args["content"]
    low = c.lower()
    if "<html" not in low:
        c = (
            '<!doctype html><html lang="en"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1">'
            f"<title>{p.stem}</title></head><body>{c}</body></html>"
        )
    elif "<!doctype" not in low:
        c = "<!doctype html>\n" + c
    problem = check_html(c)
    if problem:
        return Result(
            f"Rejected, nothing saved: {problem}. Start over with a shorter, simpler file under 120 lines. "
            "For a website or landing page, call create_site instead.",
            ok=False,
        )
    p.write_text(c, encoding="utf-8")
    return done(p, " It is open in the preview panel.")


@tool(
    "create_csv",
    "Create a CSV file of raw tabular data. Pass rows as an array of arrays (first row = headers), or raw CSV text in content.",
    {
        "filename": {"type": "string", "description": "e.g. leads.csv"},
        "rows": {"type": "array", "description": "Array of rows; each row is an array of cell values.", "items": {"type": "array", "items": {}}},
        "content": {"type": "string", "description": "Alternative to rows: raw CSV text."},
    },
    ["filename"],
)
def create_csv(args: dict) -> Result:
    need(args, "filename")
    p = OUTPUTS_DIR / clean_name(args["filename"], ".csv")
    rows = args.get("rows")
    if isinstance(rows, list) and rows:
        with p.open("w", newline="", encoding="utf-8-sig") as f:
            csv.writer(f).writerows([r if isinstance(r, list) else [r] for r in rows])
    elif isinstance(args.get("content"), str) and args["content"].strip():
        p.write_text(args["content"], encoding="utf-8-sig")
    else:
        raise ValueError("provide rows or content")
    return done(p, " It is open in the preview panel.")