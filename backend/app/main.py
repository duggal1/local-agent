from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import OUTPUTS_DIR, ROOT
from .hub import Session
from .runtime import runtime
from . import preview


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield
    await runtime.shutdown()


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.websocket("/ws")
async def ws(ws: WebSocket):
    await Session(ws).serve()


@app.get("/health")
@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/v1/models")
def v1_models():
    return {"object": "list", "data": []}


@app.get("/api/files")
def list_files():
    return [
        {"name": p.name, "size": p.stat().st_size}
        for p in sorted(OUTPUTS_DIR.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True)
        if p.is_file()
    ]


@app.get("/api/files/{name}")
def get_file(name: str, download: int = 0):
    p = OUTPUTS_DIR / Path(name).name
    if not p.is_file():
        raise HTTPException(404)
    return FileResponse(p, filename=p.name) if download else FileResponse(p)


# Generated HTML runs in an opaque origin: it can't touch /api or /ws.
SANDBOX = "sandbox allow-scripts allow-popups allow-forms allow-modals allow-downloads"


@app.get("/api/view")
def view(file: str):
    p = OUTPUTS_DIR / Path(file).name
    if p.suffix.lower() not in {".html", ".htm"} or not p.is_file():
        raise HTTPException(404)
    return FileResponse(
        p, media_type="text/html; charset=utf-8",
        headers={"Content-Security-Policy": SANDBOX, "Cache-Control": "no-store"},
    )


@app.get("/api/table")
def table(file: str, sheet: str | None = None):
    try:
        return preview.read_table(file, sheet)
    except FileNotFoundError:
        raise HTTPException(404, "File not found")
    except Exception as e:
        raise HTTPException(400, str(e))


@app.get("/api/slides")
def slides(file: str):
    try:
        return preview.read_slides(file)
    except FileNotFoundError:
        raise HTTPException(404, "File not found")
    except Exception as e:
        raise HTTPException(400, str(e))


# Serve the built frontend if it exists (npm run build)
for _name in ("web", "frontend"):
    _dist = ROOT.parent / _name / "dist"
    if _dist.exists():
        app.mount("/", StaticFiles(directory=_dist, html=True), name="ui")
        break