from __future__ import annotations

import ast
import math
import operator as op
from datetime import datetime
from pathlib import Path

from ..config import OUTPUTS_DIR
from .registry import Result, need, tool

_OPS = {ast.Add: op.add, ast.Sub: op.sub, ast.Mult: op.mul, ast.Div: op.truediv,
        ast.FloorDiv: op.floordiv, ast.Mod: op.mod, ast.Pow: op.pow}
_FN = {"sqrt": math.sqrt, "sin": math.sin, "cos": math.cos, "tan": math.tan, "log": math.log,
       "log10": math.log10, "exp": math.exp, "abs": abs, "round": round,
       "floor": math.floor, "ceil": math.ceil}
_CONST = {"pi": math.pi, "e": math.e}


def _ev(n):
    if isinstance(n, ast.Expression):
        return _ev(n.body)
    if isinstance(n, ast.Constant) and isinstance(n.value, (int, float)):
        return n.value
    if isinstance(n, ast.BinOp) and type(n.op) in _OPS:
        a, b = _ev(n.left), _ev(n.right)
        if isinstance(n.op, ast.Pow) and abs(b) > 1000:
            raise ValueError("exponent too large")
        return _OPS[type(n.op)](a, b)
    if isinstance(n, ast.UnaryOp) and isinstance(n.op, (ast.UAdd, ast.USub)):
        v = _ev(n.operand)
        return v if isinstance(n.op, ast.UAdd) else -v
    if isinstance(n, ast.Name) and n.id in _CONST:
        return _CONST[n.id]
    if isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id in _FN and not n.keywords:
        return _FN[n.func.id](*[_ev(a) for a in n.args])
    raise ValueError("unsupported expression")


@tool("calculate", "Evaluate a math expression exactly. Supports + - * / // % **, sqrt, sin, cos, tan, log, exp, pi, e.",
      {"expression": {"type": "string", "description": "e.g. (3.5 * 12) ** 2 / 7"}}, ["expression"])
def calculate(args: dict) -> Result:
    need(args, "expression")
    return Result(f"= {_ev(ast.parse(args['expression'], mode='eval'))}")


@tool("current_time", "Get the user's current local date and time.", {}, [])
def current_time(_: dict) -> Result:
    now = datetime.now().astimezone()
    return Result(now.strftime("%A, %Y-%m-%d %H:%M:%S %Z"))


@tool("list_files", "List files previously created for the user.", {}, [])
def list_files(_: dict) -> Result:
    rows = [f"{p.name} ({p.stat().st_size} bytes)" for p in sorted(OUTPUTS_DIR.iterdir()) if p.is_file()]
    return Result("\n".join(rows) or "No files yet.")


@tool("read_file", "Read a text file previously created for the user (up to 20,000 characters).",
      {"filename": {"type": "string"}}, ["filename"])
def read_file(args: dict) -> Result:
    need(args, "filename")
    p = OUTPUTS_DIR / Path(args["filename"]).name
    if not p.is_file():
        return Result(f"No such file: {p.name}", ok=False)
    return Result(p.read_text(encoding="utf-8", errors="replace")[:20000])