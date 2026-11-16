from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any, Callable


@dataclass
class Result:
    text: str
    file: dict | None = None
    ok: bool = True
    meta: dict | None = None


_TOOLS: dict[str, tuple[dict, Callable[[dict], Result]]] = {}


def tool(name: str, description: str, properties: dict[str, Any], required: list[str]):
    def deco(fn: Callable[[dict], Result]):
        schema = {
            "type": "function",
            "function": {
                "name": name,
                "description": description,
                "parameters": {"type": "object", "properties": properties, "required": required},
            },
        }
        _TOOLS[name] = (schema, fn)
        return fn

    return deco


def schemas() -> list[dict]:
    return [s for s, _ in _TOOLS.values()]


def need(args: dict, *keys: str) -> None:
    missing = [k for k in keys if not isinstance(args.get(k), str) or not args[k]]
    if missing:
        raise ValueError(f"missing required string argument(s): {', '.join(missing)}")


async def run(name: str, args: dict, truncated: bool = False) -> Result:
    if name not in _TOOLS:
        return Result(f"Unknown tool: {name}", ok=False)
    try:
        res = await asyncio.to_thread(_TOOLS[name][1], args)
    except Exception as e:
        return Result(f"Error: {e}", ok=False)
    if truncated and res.ok and res.file:
        res.text = res.text + " (Note: output hit the token limit; the file may be incomplete.)"
    return res