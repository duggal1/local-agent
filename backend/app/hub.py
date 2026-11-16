from __future__ import annotations

import asyncio
from typing import Any, Optional

from . import agent
from .catalog import SPECS, download
from .runtime import runtime


DOWNLOADS: dict[str, dict[str, Any]] = {}
DOWNLOAD_TASKS: dict[str, asyncio.Task] = {}


class Session:
    """WebSocket session handler for /ws endpoint."""

    def __init__(self, ws) -> None:
        self.ws = ws
        self.cancel = asyncio.Event()
        self.chat: Optional[asyncio.Task] = None

    async def serve(self) -> None:
        await self.ws.accept()
        runtime.on_change = lambda: asyncio.ensure_future(self._send_state())
        try:
            await self._send_state()
            await self._handle_messages()
        finally:
            runtime.on_change = None
            await self.ws.close()

    async def send(self, obj: dict) -> None:
        try:
            await self.ws.send_json(obj)
        except Exception:
            try:
                import json as _j
                await self.ws.send_text(_j.dumps(obj))
            except Exception:
                pass

    async def _send_state(self) -> None:
        models = [
            {"id": s.id, "label": s.label, "installed": s.installed, "bytes": s.bytes}
            for s in SPECS.values()
        ]
        await self.send({
            "type": "state",
            "models": models,
            "downloads": {k: dict(v) for k, v in DOWNLOADS.items()},
            "runtime": runtime.snapshot(),
        })

    async def _handle_messages(self) -> None:
        while True:
            try:
                try:
                    data = await self.ws.receive_json()
                except AttributeError:
                    raw = await self.ws.receive_text()
                    import json as _j
                    data = _j.loads(raw)
            except Exception:
                break
            t = data.get("type")
            if t == "model.load":
                asyncio.ensure_future(self._load_model(data.get("id")))
            elif t == "model.download":
                asyncio.ensure_future(self._download_model(data.get("id")))
            elif t == "model.cancel":
                self._cancel_download(data.get("id"))
            elif t == "chat":
                if self.chat and not self.chat.done():
                    self.chat.cancel()  # e.g. still generating suggestions
                self.chat = asyncio.create_task(self.run_chat(data))
            elif t == "stop":
                self.cancel.set()
                if self.chat and not self.chat.done():
                    self.chat.cancel()

    async def _load_model(self, mid: str) -> None:
        spec = SPECS.get(mid)
        if spec is None:
            await self.send({"type": "error", "scope": "chat", "message": f"Unknown model: {mid}"})
            return
        if not spec.installed:
            await self.send({"type": "error", "scope": "chat", "message": f"Model {mid} is not downloaded."})
            await self._send_state()
            return
        try:
            await runtime.load(spec)
        except Exception as e:
            await self.send({"type": "error", "scope": "chat", "message": str(e)})
        await self._send_state()

    async def _download_model(self, mid: str) -> None:
        spec = SPECS.get(mid)
        if spec is None:
            await self.send({"type": "error", "scope": "notice", "message": f"Unknown model: {mid}"})
            return
        if spec.installed:
            await self._send_state()
            return
        # cancel any existing task for this model
        old = DOWNLOAD_TASKS.pop(mid, None)
        if old and not old.done():
            old.cancel()
        DOWNLOADS[mid] = {"done": spec.bytes, "total": 0, "speed": 0.0}

        async def on_progress(done: int, total: int, speed: float) -> None:
            DOWNLOADS[mid] = {"done": done, "total": total, "speed": speed}
            await self.send({"type": "dl", "id": mid, "done": done, "total": total, "speed": speed})

        async def runner() -> None:
            try:
                await download(spec, on_progress)
            except asyncio.CancelledError:
                raise
            except Exception as e:
                await self.send({"type": "error", "scope": "notice", "message": str(e)})
            finally:
                DOWNLOADS.pop(mid, None)
                DOWNLOAD_TASKS.pop(mid, None)
                await self._send_state()

        task = asyncio.ensure_future(runner())
        DOWNLOAD_TASKS[mid] = task
        await task

    def _cancel_download(self, mid: str) -> None:
        task = DOWNLOAD_TASKS.pop(mid, None)
        if task and not task.done():
            task.cancel()
        DOWNLOADS.pop(mid, None)
        asyncio.ensure_future(self._send_state())

    async def run_chat(self, msg: dict) -> None:
        self.cancel = asyncio.Event()
        spec = SPECS.get(msg.get("model", ""))
        history: list[dict] = []
        answer = ""
        try:
            if not spec or not spec.installed:
                raise RuntimeError("That model isn't downloaded yet.")
            await runtime.load(spec)
            history = [
                {"role": m["role"], "content": m["content"]}
                for m in msg.get("messages", [])
                if m.get("role") in ("user", "assistant") and isinstance(m.get("content"), str)
            ]
            level = msg.get("thinking_level")
            budget = msg.get("thinking_budget")
            if isinstance(budget, str):
                try:
                    budget = int(budget)
                except ValueError:
                    budget = None
            opts = msg.get("opts") if isinstance(msg.get("opts"), dict) else {}
            answer = await agent.run(history, bool(msg.get("thinking")), self.send, self.cancel, model=spec.id)
        except asyncio.CancelledError:
            raise
        except Exception as e:
            await self.send({"type": "error", "scope": "chat", "message": str(e)})
        finally:
            try:
                await self.send({"type": "done"})
            except Exception:
                pass
        if answer.strip() and not self.cancel.is_set():
            items = await agent.suggest(history, answer, model=spec.id)
            if items and not self.cancel.is_set():
                try:
                    await self.send({"type": "suggestions", "id": msg.get("id"), "items": items})
                except Exception:
                    pass
