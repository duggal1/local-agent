from __future__ import annotations

import html
import re
from datetime import datetime
from string import Template

from ..config import OUTPUTS_DIR
from .files import clean_name, done
from .registry import Result, need, tool

DEFAULT_ACCENT = "#E8480C"

CSS = """
:root{--bg:#fff;--surface:#f4f5f8;--surface2:#e9ebf0;--text:#0d0d0f;--text2:#5b5d66;--text3:#8b8d96;--accent:%ACCENT%;--on:%ON%;--r:20px;--max:1120px;--ease:cubic-bezier(.2,.7,.2,1)}
@media (prefers-color-scheme:dark){:root{--bg:#0b0b0c;--surface:#141416;--surface2:#1d1d20;--text:#ececee;--text2:#a0a0a8;--text3:#6a6a72}}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.6 ui-sans-serif,"SF Pro Text",Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
.wrap{max-width:var(--max);margin:0 auto;padding:0 24px}
nav{position:sticky;top:0;z-index:10;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);background:color-mix(in srgb,var(--bg) 78%,transparent)}
.nav{display:flex;align-items:center;justify-content:space-between;height:64px;gap:16px}
.brand{font-weight:650;font-size:18px;letter-spacing:-.02em}
.links{display:flex;gap:28px;color:var(--text2);font-size:14px}
.links a{transition:color .15s var(--ease)}
.links a:hover{color:var(--text)}
.btn{display:inline-flex;align-items:center;justify-content:center;height:44px;padding:0 20px;border-radius:14px;background:var(--text);color:var(--bg);font-weight:600;font-size:15px;transition:transform .15s var(--ease),opacity .15s var(--ease)}
.btn:hover{opacity:.88}
.btn:active{transform:translateY(1px)}
.btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.btn.accent{background:var(--accent);color:var(--on)}
.btn.ghost{background:var(--surface2);color:var(--text)}
.btn.sm{height:36px;padding:0 16px;font-size:14px;border-radius:12px}
.hero{padding:112px 0 88px;text-align:center}
.hero h1{margin:0 auto 20px;max-width:16ch;font-size:clamp(40px,7vw,72px);line-height:1.04;letter-spacing:-.04em;font-weight:650}
.hero p{margin:0 auto;max-width:560px;font-size:20px;color:var(--text2)}
.cta-row{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:32px}
.dither{height:16px;background:var(--surface2);-webkit-mask:conic-gradient(#000 25%,#0000 0 50%,#000 0 75%,#0000 0) 0 0/4px 4px;mask:conic-gradient(#000 25%,#0000 0 50%,#000 0 75%,#0000 0) 0 0/4px 4px}
section{padding:80px 0}
h2{margin:0 0 12px;font-size:clamp(28px,4vw,44px);line-height:1.1;letter-spacing:-.03em;font-weight:650}
.lead{margin:0 0 48px;max-width:620px;color:var(--text2);font-size:18px}
.lead.centered{margin:0 auto 32px}
.grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
.card{background:var(--surface);border-radius:var(--r);padding:28px}
.card h3{margin:0 0 8px;font-size:18px;letter-spacing:-.01em}
.card p{margin:0;color:var(--text2)}
.stat .v{margin-bottom:8px;font-size:48px;line-height:1;font-weight:650;letter-spacing:-.04em}
.step .n{margin-bottom:12px;font:600 14px ui-monospace,Menlo,monospace;color:var(--accent)}
.plan .price{margin:8px 0 12px;font-size:40px;font-weight:650;letter-spacing:-.03em}
.plan ul{list-style:none;margin:16px 0 24px;padding:0;display:grid;gap:8px;color:var(--text2)}
.plan li::before{content:"";display:inline-block;width:6px;height:6px;margin-right:10px;vertical-align:middle;background:var(--accent)}
.faq details{margin-bottom:8px;padding:20px 24px;background:var(--surface);border-radius:var(--r)}
.faq summary{display:flex;justify-content:space-between;gap:16px;cursor:pointer;font-weight:600;list-style:none}
.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:"+";color:var(--text3);transition:transform .2s var(--ease)}
.faq details[open] summary::after{transform:rotate(45deg)}
.faq p{margin:12px 0 0;color:var(--text2)}
.band{padding:72px 24px;text-align:center;background:var(--surface);border-radius:32px}
.band h2{max-width:20ch;margin:0 auto 12px}
footer{padding:48px 0;text-align:center;color:var(--text3);font-size:14px}
.js .reveal{opacity:0;transform:translateY(12px);filter:blur(6px);transition:opacity .6s var(--ease),transform .6s var(--ease),filter .6s var(--ease)}
.js .reveal.in{opacity:1;transform:none;filter:none}
@supports (corner-shape:squircle){.card,.btn,.band,.faq details{corner-shape:squircle}}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}.js .reveal{opacity:1;transform:none;filter:none;transition:none}}
@media (max-width:720px){.links{display:none}.hero{padding:72px 0 56px}section{padding:56px 0}}
"""

PAGE = Template("""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>$title</title>
<meta name="description" content="$desc">
<script>document.documentElement.classList.add("js")</script>
<style>$css</style>
</head>
<body>
<nav><div class="wrap nav"><a class="brand" href="#top">$brand</a><div class="links">$links</div><a class="btn accent sm" href="$link">$cta</a></div></nav>
<header class="hero" id="top"><div class="wrap"><h1 class="reveal">$h1</h1><p class="reveal" style="transition-delay:60ms">$sub</p><div class="cta-row reveal" style="transition-delay:120ms"><a class="btn accent" href="$link">$cta</a>$secondary</div></div></header>
<div class="dither" aria-hidden="true"></div>
$sections
<footer><div class="wrap">$footer</div></footer>
<script>
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target)}}),{threshold:.12});
document.querySelectorAll(".reveal").forEach(el=>io.observe(el));
</script>
</body>
</html>
""")


def _e(x) -> str:
    return html.escape(str(x or "").strip(), quote=True)


def _link(v) -> str:
    v = str(v or "").strip()
    return html.escape(v if re.match(r"^(#|https?://|mailto:)", v) else "#", quote=True)


def _slug(s, i: int) -> str:
    return (re.sub(r"[^a-z0-9]+", "-", str(s or "").lower()).strip("-")[:28] or "section") + f"-{i}"


def _on(accent: str) -> str:
    r, g, b = (int(accent[i:i + 2], 16) for i in (1, 3, 5))
    return "#111114" if (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 else "#ffffff"


def _d(n: int) -> str:
    return f' style="transition-delay:{min(n, 8) * 60}ms"'


def _section(s: dict, i: int, cta: str, link: str) -> tuple[str, str]:
    kind = str(s.get("kind") or "text").lower()
    head, body = _e(s.get("heading")), _e(s.get("body"))
    sid = _slug(s.get("heading"), i)
    items = [x for x in (s.get("items") or []) if isinstance(x, dict)][:9] if isinstance(s.get("items"), list) else []
    top = (f"<h2>{head}</h2>" if head else "") + (f'<p class="lead">{body}</p>' if body else "")
    inner = ""
    if kind == "features":
        inner = '<div class="grid">' + "".join(
            f'<div class="card reveal"{_d(n)}><h3>{_e(x.get("title"))}</h3><p>{_e(x.get("text"))}</p></div>'
            for n, x in enumerate(items)) + "</div>"
    elif kind == "stats":
        inner = '<div class="grid">' + "".join(
            f'<div class="card stat reveal"{_d(n)}><div class="v">{_e(x.get("value"))}</div><p>{_e(x.get("title") or x.get("text"))}</p></div>'
            for n, x in enumerate(items)) + "</div>"
    elif kind == "steps":
        inner = '<div class="grid">' + "".join(
            f'<div class="card step reveal"{_d(n)}><div class="n">{n + 1:02d}</div><h3>{_e(x.get("title"))}</h3><p>{_e(x.get("text"))}</p></div>'
            for n, x in enumerate(items)) + "</div>"
    elif kind == "pricing":
        hl = 1 if len(items) == 3 else 0
        cards = []
        for n, x in enumerate(items):
            feats = x.get("list") if isinstance(x.get("list"), list) else []
            lis = "".join(f"<li>{_e(f)}</li>" for f in feats[:8])
            cards.append(
                f'<div class="card plan reveal"{_d(n)}><h3>{_e(x.get("title"))}</h3>'
                f'<div class="price">{_e(x.get("value"))}</div><p>{_e(x.get("text"))}</p><ul>{lis}</ul>'
                f'<a class="btn {"accent" if n == hl else "ghost"}" href="{link}">{cta}</a></div>')
        inner = '<div class="grid">' + "".join(cards) + "</div>"
    elif kind == "faq":
        inner = '<div class="faq">' + "".join(
            f'<details class="reveal"{_d(n)}><summary>{_e(x.get("title"))}</summary><p>{_e(x.get("text"))}</p></details>'
            for n, x in enumerate(items)) + "</div>"
    elif kind == "cta":
        btn = _e(s.get("button")) or cta
        lead = f'<p class="lead centered">{body}</p>' if body else ""
        return sid, (f'<section id="{sid}"><div class="wrap"><div class="band reveal"><h2>{head}</h2>{lead}'
                     f'<a class="btn accent" href="{link}">{btn}</a></div></div></section>')
    return sid, f'<section id="{sid}"><div class="wrap">{top}{inner}</div></section>'


@tool(
    "create_site",
    "Create a polished, responsive website or landing page from CONTENT ONLY. The design is fixed and proven (dark mode, motion, mobile). Use this for any website, landing page, product page, portfolio or event page. Opens in the preview panel.",
    {
        "filename": {"type": "string", "description": "e.g. roastery.html"},
        "brand": {"type": "string", "description": "Brand or product name."},
        "title": {"type": "string", "description": "Hero headline, max 10 words, concrete."},
        "subtitle": {"type": "string", "description": "One or two sentences under the headline."},
        "cta": {"type": "string", "description": "Main button label, e.g. 'Start free'."},
        "cta_link": {"type": "string", "description": "Optional: #anchor, https:// or mailto: link."},
        "secondary": {"type": "string", "description": "Optional second button label (scrolls to first section)."},
        "accent": {"type": "string", "description": "Optional brand color as #RRGGBB."},
        "footer": {"type": "string", "description": "Optional footer text."},
        "sections": {
            "type": "array",
            "description": "4-6 sections in order.",
            "items": {
                "type": "object",
                "properties": {
                    "kind": {"type": "string", "description": "features | stats | steps | pricing | faq | text | cta"},
                    "heading": {"type": "string"},
                    "body": {"type": "string", "description": "Optional intro paragraph."},
                    "button": {"type": "string", "description": "Button label (cta sections)."},
                    "items": {
                        "type": "array",
                        "description": "3-6 items. features/steps/faq: title+text. stats: value+title. pricing: title+value+text+list.",
                        "items": {
                            "type": "object",
                            "properties": {
                                "title": {"type": "string"},
                                "text": {"type": "string"},
                                "value": {"type": "string"},
                                "list": {"type": "array", "items": {"type": "string"}},
                            },
                        },
                    },
                },
                "required": ["kind", "heading"],
            },
        },
    },
    ["filename", "brand", "title", "subtitle", "sections"],
)
def create_site(args: dict) -> Result:
    need(args, "filename", "brand", "title")
    accent = str(args.get("accent") or "")
    if not re.fullmatch(r"#[0-9a-fA-F]{6}", accent):
        accent = DEFAULT_ACCENT
    cta, link = _e(args.get("cta")) or "Get started", _link(args.get("cta_link"))
    raw = args.get("sections")
    secs = [s for s in raw if isinstance(s, dict)][:8] if isinstance(raw, list) else []
    rendered = [_section(s, i, cta, link) for i, s in enumerate(secs)]
    nav = [
        f'<a href="#{sid}">{_e(s.get("heading"))}</a>'
        for (sid, _), s in zip(rendered, secs)
        if s.get("heading") and str(s.get("kind") or "").lower() != "cta"
    ][:4]
    sec_label = _e(args.get("secondary"))
    secondary = f'<a class="btn ghost" href="#{rendered[0][0]}">{sec_label}</a>' if sec_label and rendered else ""
    brand = _e(args["brand"])
    doc = PAGE.substitute(
        title=f"{brand} · {_e(args['title'])}",
        desc=_e(args.get("subtitle"))[:160],
        css=CSS.replace("%ACCENT%", accent).replace("%ON%", _on(accent)),
        brand=brand, links="".join(nav), link=link, cta=cta,
        h1=_e(args["title"]), sub=_e(args.get("subtitle")), secondary=secondary,
        sections="\n".join(h for _, h in rendered),
        footer=_e(args.get("footer")) or f"© {datetime.now().year} {brand}",
    )
    p = OUTPUTS_DIR / clean_name(args["filename"], ".html")
    p.write_text(doc, encoding="utf-8")
    return done(p, " It is open in the preview panel.")