from __future__ import annotations

from ..config import SKILLS_DIR
from .registry import Result, need, tool


def _parse(path) -> tuple[dict, str]:
    raw = path.read_text(encoding="utf-8")
    meta, body = {}, raw
    if raw.startswith("---"):
        _, fm, body = raw.split("---", 2)
        for line in fm.strip().splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                meta[k.strip()] = v.strip()
    return meta, body.strip()


def catalog() -> dict[str, dict]:
    out = {}
    for p in sorted(SKILLS_DIR.glob("*/SKILL.md")):
        m, body = _parse(p)
        out[m.get("name") or p.parent.name] = {"description": m.get("description", ""), "body": body}
    return out


def index() -> str:
    """One line per skill. This is ALL the model sees until it loads one."""
    return "\n".join(f"- {n}: {s['description']}" for n, s in catalog().items()) or "(none)"


@tool(
    "load_skill",
    "Load an expert playbook by name from the Skills list. Do this FIRST when the task matches a skill, then follow it.",
    {"name": {"type": "string", "description": "Skill name exactly as listed, e.g. html-website"}},
    ["name"],
)
def load_skill(args: dict) -> Result:
    need(args, "name")
    cat = catalog()
    name = args["name"].strip()
    if name not in cat:
        return Result(f"No skill named '{name}'. Available: {', '.join(cat) or 'none'}", ok=False)
    s = cat[name]
    return Result(
        f"Skill loaded: {name}. Follow these instructions.\n\n{s['body']}",
        meta={"skill": {"name": name, "description": s["description"]}},
    )