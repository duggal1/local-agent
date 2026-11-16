from __future__ import annotations

import ast
import csv
import math
import operator as op
import re
from datetime import date, datetime
from pathlib import Path

from openpyxl.utils import column_index_from_string

from .config import OUTPUTS_DIR

LIMIT, MAXCOL = 300, 40


# ── tiny safe Excel evaluator (no eval) ────────────────────────────────────
def _n(x):
    if x is None:
        return 0
    if isinstance(x, (int, float, bool)):
        return x
    raise ValueError("not a number")


def _flat(args):
    out = []
    for a in args:
        for x in a if isinstance(a, list) else [a]:
            if isinstance(x, (int, float, bool)):
                out.append(x)
            elif x is None or (isinstance(x, str) and isinstance(a, list)):
                continue
            else:
                raise ValueError("not a number")
    return out


def _pow(a, b):
    if abs(b) > 1000:
        raise ValueError("exponent too large")
    return a**b


def _pmt(r, n, pv):
    r, n, pv = _n(r), _n(n), _n(pv)
    return -pv / n if r == 0 else -(pv * r) / (1 - (1 + r) ** -n)


def _npv(r, *vals):
    return sum(v / (1 + _n(r)) ** (i + 1) for i, v in enumerate(_flat(vals)))


FN = {
    "SUM": lambda *a: sum(_flat(a)),
    "AVERAGE": lambda *a: sum(_flat(a)) / len(_flat(a)),
    "MIN": lambda *a: min(_flat(a)),
    "MAX": lambda *a: max(_flat(a)),
    "COUNT": lambda *a: len(_flat(a)),
    "ROUND": lambda x, d=0: round(_n(x), int(_n(d))),
    "ABS": lambda x: abs(_n(x)),
    "SQRT": lambda x: math.sqrt(_n(x)),
    "IF": lambda c, a, b=0: a if c else b,
    "PMT": _pmt,
    "NPV": _npv,
}
_BIN = {ast.Add: op.add, ast.Sub: op.sub, ast.Mult: op.mul, ast.Div: op.truediv, ast.Mod: op.mod, ast.Pow: _pow}
_CMP = {ast.Eq: op.eq, ast.NotEq: op.ne, ast.Lt: op.lt, ast.LtE: op.le, ast.Gt: op.gt, ast.GtE: op.ge}

_RANGE = re.compile(r"\$?([A-Z]{1,3})\$?(\d+):\$?([A-Z]{1,3})\$?(\d+)")
_XREF = re.compile(r"\b([A-Za-z_]\w*)!\$?([A-Z]{1,3})\$?(\d+)")
_CELL = re.compile(r"(?<![A-Za-z_])\$?([A-Z]{1,3})\$?(\d+)(?![\w(])")


def _translate(f: str) -> str:
    f = f[1:]
    if '"' in f or "'" in f:
        raise ValueError("unsupported")
    f = _XREF.sub(r"X_\1__\2\3", f)
    if "!" in f:
        raise ValueError("unsupported")
    f = _RANGE.sub(r"R_\1\2_\3\4", f)
    f = _CELL.sub(r"C_\1\2", f)
    f = f.replace("^", "**").replace("<>", "!=")
    return re.sub(r"(?<![<>!=])=(?!=)", "==", f)


class Calc:
    def __init__(self, wb):
        self.wb, self.cache, self.stack = wb, {}, set()

    def val(self, ws, ref):
        key = (ws.title, ref)
        if key in self.cache:
            return self.cache[key]
        if key in self.stack:
            raise ValueError("circular")
        v = ws[ref].value
        if isinstance(v, str) and v.startswith("="):
            self.stack.add(key)
            try:
                v = self.ev(ast.parse(_translate(v), mode="eval").body, ws)
            finally:
                self.stack.discard(key)
        self.cache[key] = v
        return v

    def show(self, ws, ref):
        try:
            return self.val(ws, ref)
        except Exception:
            return ws[ref].value  # leave the formula text

    def rng(self, ws, c1, r1, c2, r2):
        a, b = column_index_from_string(c1), column_index_from_string(c2)
        if (int(r2) - int(r1) + 1) * (b - a + 1) > 5000:
            raise ValueError("range too large")
        out = []
        for row in ws.iter_rows(min_row=int(r1), max_row=int(r2), min_col=a, max_col=b):
            out += [self.val(ws, c.coordinate) for c in row]
        return out

    def ev(self, n, ws):
        if isinstance(n, ast.Constant) and isinstance(n.value, (int, float, bool)):
            return n.value
        if isinstance(n, ast.Name):
            if m := re.fullmatch(r"C_([A-Z]+\d+)", n.id):
                return self.val(ws, m.group(1))
            if m := re.fullmatch(r"R_([A-Z]+)(\d+)_([A-Z]+)(\d+)", n.id):
                return self.rng(ws, *m.groups())
            if m := re.fullmatch(r"X_(.+)__([A-Z]+\d+)", n.id):
                return self.val(self.wb[m.group(1)], m.group(2))
            raise ValueError(n.id)
        if isinstance(n, ast.UnaryOp):
            v = _n(self.ev(n.operand, ws))
            return -v if isinstance(n.op, ast.USub) else v if isinstance(n.op, ast.UAdd) else not v
        if isinstance(n, ast.BinOp) and type(n.op) in _BIN:
            return _BIN[type(n.op)](_n(self.ev(n.left, ws)), _n(self.ev(n.right, ws)))
        if isinstance(n, ast.Compare) and len(n.ops) == 1 and type(n.ops[0]) in _CMP:
            return _CMP[type(n.ops[0])](_n(self.ev(n.left, ws)), _n(self.ev(n.comparators[0], ws)))
        if isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and not n.keywords:
            if f := FN.get(n.func.id.upper()):
                return f(*[self.ev(a, ws) for a in n.args])
        raise ValueError("unsupported")


# ── display ────────────────────────────────────────────────────────────────
def _fmt(v, nf: str) -> str:
    if v is None:
        return ""
    if isinstance(v, (datetime, date)):
        return v.strftime("%Y-%m-%d")
    if isinstance(v, bool):
        return "TRUE" if v else "FALSE"
    if isinstance(v, (int, float)):
        if nf == "General":
            return str(int(v)) if float(v).is_integer() else f"{v:.6g}"
        m = re.search(r"\.(0+)", nf)
        d = len(m.group(1)) if m else 0
        x = v * 100 if "%" in nf else v
        s = f"{abs(x):,.{d}f}" if "," in nf or "$" in nf else f"{abs(x):.{d}f}"
        s = ("-" if x < 0 else "") + ("$" if "$" in nf else "") + s
        return s + ("%" if "%" in nf else "")
    return str(v)


def _is_num(vals: list[str]) -> bool:
    vs = [v.replace(" ", "") for v in vals if v.strip()]
    if not vs:
        return False
    ok = sum(bool(re.fullmatch(r"-?[$€£]?[\d,]*\.?\d+%?", v)) for v in vs)
    return ok / len(vs) >= 0.7


def read_table(name: str, sheet: str | None = None) -> dict:
    p = OUTPUTS_DIR / Path(name).name
    if not p.is_file():
        raise FileNotFoundError(name)
    ext = p.suffix.lower()
    sheets: list[str] = []
    if ext == ".csv":
        with p.open(newline="", encoding="utf-8-sig", errors="replace") as f:
            rows = list(csv.reader(f))
        total, grid = max(len(rows) - 1, 0), rows[: LIMIT + 1]
    elif ext in (".xlsx", ".xlsm"):
        from openpyxl import load_workbook

        wb = load_workbook(p)
        sheets = wb.sheetnames
        ws = wb[sheet] if sheet in sheets else wb[sheets[0]]
        calc = Calc(wb)
        total = max(ws.max_row - 1, 0)
        grid = [
            [_fmt(calc.show(ws, c.coordinate), c.number_format) for c in row]
            for row in ws.iter_rows(min_row=1, max_row=min(ws.max_row, LIMIT + 1), max_col=min(ws.max_column, MAXCOL))
        ]
        sheet = ws.title
    else:
        raise ValueError("Not a table file.")
    width = max((len(r) for r in grid), default=0)
    grid = [r + [""] * (width - len(r)) for r in grid]
    body = grid[1:]
    return {
        "kind": ext[1:].upper(),
        "sheets": sheets,
        "sheet": sheet,
        "columns": grid[0] if grid else [],
        "rows": body,
        "num": [_is_num([r[i] for r in body]) for i in range(width)],
        "total": total,
    }


def read_slides(name: str) -> dict:
    from pptx import Presentation

    p = OUTPUTS_DIR / Path(name).name
    if not p.is_file() or p.suffix.lower() != ".pptx":
        raise FileNotFoundError(name)
    out = []
    for s in Presentation(str(p)).slides:
        blocks = []
        for sh in s.shapes:
            if sh.has_text_frame:
                t = [x.text.strip() for x in sh.text_frame.paragraphs if x.text.strip() and not x.text.strip().isdigit()]
                if t:
                    blocks.append(t)
        flat = [x for b in blocks for x in b]
        out.append({
            "title": flat[0] if flat else "",
            "bullets": flat[1:],
            "notes": s.notes_slide.notes_text_frame.text if s.has_notes_slide else "",
        })
    return {"slides": out}