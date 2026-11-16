from __future__ import annotations

import re

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

from ..config import OUTPUTS_DIR
from .files import clean_name, meta
from .registry import Result, need, tool

_NUM = re.compile(r"^-?\$?\s?[\d,]+(\.\d+)?%?$")


def _cell(v):
    """Models often quote numbers. Turn '$1,200' / '12%' / '3.5' into real numbers + a format."""
    if not isinstance(v, str):
        return v, None
    s = v.strip()
    if s.startswith("=") or re.match(r"^0\d", s) or not _NUM.match(s):
        return v, None
    pct = s.endswith("%")
    raw = s.replace("$", "").replace(",", "").replace("%", "").strip()
    try:
        x = float(raw)
    except ValueError:
        return v, None
    if pct:
        return x / 100, "0.0%"
    x = int(x) if "." not in raw else x
    return x, ("$#,##0.00" if "$" in s else None)


@tool(
    "create_xlsx",
    "Create an Excel workbook (.xlsx) with one or more sheets. Cells starting with '=' are live Excel formulas. First row of each sheet is the header row. Opens in the preview panel.",
    {
        "filename": {"type": "string", "description": "e.g. model.xlsx"},
        "sheets": {
            "type": "array",
            "description": "Sheets in order.",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Sheet name, no spaces (e.g. Assumptions)."},
                    "rows": {"type": "array", "description": "Array of rows, each an array of cells.", "items": {"type": "array", "items": {}}},
                    "formats": {"type": "object", "description": "Optional: column letter -> Excel number format, e.g. {\"C\": \"0.0%\", \"D\": \"$#,##0\"}"},
                },
                "required": ["name", "rows"],
            },
        },
    },
    ["filename", "sheets"],
)
def create_xlsx(args: dict) -> Result:
    need(args, "filename")
    sheets = args.get("sheets")
    if not isinstance(sheets, list) or not sheets:
        raise ValueError("sheets must be a non-empty array")
    wb = Workbook()
    wb.remove(wb.active)
    for i, s in enumerate(sheets, start=1):
        if not isinstance(s, dict):
            continue
        name = re.sub(r"[\\/*?:\[\]]", "", str(s.get("name") or f"Sheet{i}")).strip()[:31] or f"Sheet{i}"
        ws = wb.create_sheet(name)
        for r_i, row in enumerate(s.get("rows") or [], start=1):
            for c_i, v in enumerate(row if isinstance(row, list) else [row], start=1):
                val, nf = _cell(v)
                c = ws.cell(row=r_i, column=c_i, value=val)
                if nf and r_i > 1:
                    c.number_format = nf
        for c in ws[1]:
            c.font = Font(bold=True)
            c.fill = PatternFill("solid", fgColor="F1F2F5")
            c.alignment = Alignment(vertical="center")
        for col, nf in (s.get("formats") or {}).items():
            col = str(col).upper()
            if re.fullmatch(r"[A-Z]{1,3}", col):
                for r in range(2, ws.max_row + 1):
                    ws[f"{col}{r}"].number_format = str(nf)
        for ci in range(1, ws.max_column + 1):
            letter = get_column_letter(ci)
            widest = max(
                (len(str(c.value)) if c.value is not None and not str(c.value).startswith("=") else 10)
                for c in ws[letter]
            )
            ws.column_dimensions[letter].width = min(max(widest + 3, 10), 48)
        ws.freeze_panes = "A2"
    if not wb.sheetnames:
        raise ValueError("no valid sheets")
    p = OUTPUTS_DIR / clean_name(args["filename"], ".xlsx")
    wb.save(p)
    m = meta(p)
    return Result(f"Created {m['name']} ({m['size']} bytes, {len(wb.sheetnames)} sheet(s)). It is open in the preview panel.", m)