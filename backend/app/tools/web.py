from __future__ import annotations

import html
import ipaddress
import re
import socket
from urllib.parse import urljoin, urlparse

import httpx

from ..config import BRAVE_API_KEY, JINA_API_KEY
from .registry import Result, need, tool

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"


# ── search providers (tried in order; first with results wins) ─────────────
def _brave(q: str, n: int) -> list[dict]:
    r = httpx.get(
        "https://api.search.brave.com/res/v1/web/search",
        params={"q": q, "count": n},
        headers={"X-Subscription-Token": BRAVE_API_KEY, "Accept": "application/json"},
        timeout=15,
    )
    r.raise_for_status()
    return [
        {"title": x.get("title", ""), "url": x.get("url", ""), "snippet": re.sub(r"<[^>]+>", "", x.get("description", ""))}
        for x in r.json().get("web", {}).get("results", [])[:n]
    ]


def _jina(q: str, n: int) -> list[dict]:
    r = httpx.get(
        "https://s.jina.ai/",
        params={"q": q},
        headers={"Authorization": f"Bearer {JINA_API_KEY}", "Accept": "application/json", "X-Respond-With": "no-content"},
        timeout=25,
    )
    r.raise_for_status()
    return [
        {"title": x.get("title", ""), "url": x.get("url", ""), "snippet": (x.get("description") or x.get("content") or "")[:300]}
        for x in r.json().get("data", [])[:n]
    ]


def _ddg(q: str, n: int) -> list[dict]:
    from ddgs import DDGS

    # DuckDuckGo's HTML endpoint often returns 202 (anti-bot); fall back through
    # other keyless ddgs backends so zero-config search still returns results.
    last: Exception | None = None
    for be in ("duckduckgo", "bing", "google", "yandex"):
        try:
            res = DDGS().text(q, max_results=n, backend=be)
        except Exception as e:
            last = e
            continue
        if res:
            return [{"title": x.get("title", ""), "url": x.get("href", ""), "snippet": x.get("body", "")} for x in res]
    if last:
        raise last
    return []


@tool(
    "web_search",
    "Search the web. Use it on your own for anything current or that you're unsure of (news, prices, versions, people, companies, laws, scores). Short, specific queries.",
    {"query": {"type": "string", "description": "Search query, e.g. 'iPhone 17 price India 2026'"}},
    ["query"],
)
def web_search(args: dict) -> Result:
    need(args, "query")
    q = args["query"].strip()[:200]
    providers = (
        ([("brave", _brave)] if BRAVE_API_KEY else [])
        + ([("jina", _jina)] if JINA_API_KEY else [])
        + [("duckduckgo", _ddg)]
    )
    errs: list[str] = []
    for name, fn in providers:
        try:
            res = [r for r in fn(q, 5) if r["url"]]
            if res:
                break
        except Exception as e:
            errs.append(f"{name}: {e}")
    else:
        raise ValueError("No results. " + "; ".join(errs))
    lines = [f'Results for "{q}":']
    for i, r in enumerate(res, 1):
        lines.append(f"{i}. {r['title']}\n   {r['url']}\n   {r['snippet'][:300]}")
    lines.append("Use read_url on the best result if the snippets aren't enough.")
    return Result(
        "\n".join(lines),
        meta={"query": q, "sources": [{"title": r["title"], "url": r["url"]} for r in res]},
    )


# ── reading pages ──────────────────────────────────────────────────────────
def _public(url: str) -> None:
    u = urlparse(url)
    if u.scheme not in ("http", "https") or not u.hostname:
        raise ValueError("Only http(s) URLs are allowed.")
    for info in socket.getaddrinfo(u.hostname, None):
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            raise ValueError("Blocked: URL points at a private address.")


def _strip(h: str) -> str:
    h = re.sub(r"(?is)<(script|style|noscript|svg|header|footer|nav)[^>]*>.*?</\1>", " ", h)
    h = html.unescape(re.sub(r"(?s)<[^>]+>", " ", h))
    return re.sub(r"\s+", " ", h).strip()


def _jina_read(url: str) -> str:
    headers = {"Accept": "text/plain", "X-Return-Format": "markdown"}
    if JINA_API_KEY:
        headers["Authorization"] = f"Bearer {JINA_API_KEY}"
    r = httpx.get("https://r.jina.ai/" + url, headers=headers, timeout=30, follow_redirects=True)
    r.raise_for_status()
    return r.text


def _direct(url: str) -> str:
    cur = url
    with httpx.Client(timeout=15, headers={"User-Agent": UA}) as c:
        for _ in range(4):
            _public(cur)
            r = c.get(cur)
            if r.status_code in (301, 302, 303, 307, 308) and r.headers.get("location"):
                cur = urljoin(cur, r.headers["location"])
                continue
            r.raise_for_status()
            if "html" not in r.headers.get("content-type", "") and "text" not in r.headers.get("content-type", ""):
                raise ValueError("Not a text page.")
            return _strip(r.text)
    raise ValueError("Too many redirects.")


@tool(
    "read_url",
    "Read the full text of a web page (markdown). Use after web_search when snippets aren't enough.",
    {"url": {"type": "string", "description": "Full http(s) URL, taken from search results."}},
    ["url"],
)
def read_url(args: dict) -> Result:
    need(args, "url")
    url = args["url"].strip()
    _public(url)  # never send local/private URLs anywhere
    text = ""
    try:
        text = _jina_read(url)
    except Exception:
        pass
    if len(text.strip()) < 200:
        text = _direct(url)
    text = text.strip()
    if not text:
        raise ValueError("The page had no readable text.")
    out = text[:7000] + ("\n\n[truncated]" if len(text) > 7000 else "")
    host = (urlparse(url).hostname or url).removeprefix("www.")
    return Result(f"Content of {url}:\n\n{out}", meta={"read": {"url": url, "host": host, "chars": len(text)}})