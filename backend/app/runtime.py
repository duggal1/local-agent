from __future__ import annotations

import asyncio
import os
from collections import deque
from pathlib import Path
from typing import Callable

import httpx

from .catalog import Spec
from .config import (
    CTX, FA, LLAMA_PORT, LLAMA_SERVER, LLAMA_SERVER_UPSTREAM, LLAMA_URL, LFM3_BUDGET, MTP_FILE, MTP_N_MAX, NGL, USE_MTP,
)


class Runtime:
    """Owns one llama-server subprocess. Switching models restarts it."""

    def __init__(self) -> None:
        self.proc: asyncio.subprocess.Process | None = None
        self.model: str | None = None
        self.state = "idle"  # idle | loading | ready | error
        self.error: str | None = None
        self.log: deque[str] = deque(maxlen=40)
        self.lock = asyncio.Lock()
        self.on_change: Callable[[], None] | None = None

    def snapshot(self) -> dict:
        return {"state": self.state, "model": self.model, "error": self.error}

    def _set(self, state: str, model: str | None = None, error: str | None = None) -> None:
        self.state, self.model, self.error = state, model, error
        if self.on_change:
            self.on_change()

    def alive(self) -> bool:
        return self.proc is not None and self.proc.returncode is None

    def _model_path(self, spec: Spec) -> Path:
        """The 4B uses the MTP-head file (same model) when present, for speculative decoding."""
        if USE_MTP and spec.id == "4b":
            mtp = spec.path.parent / MTP_FILE
            if mtp.exists():
                return mtp
        return spec.path

    def _server_binary(self, spec: Spec) -> str:
        """LFM3 needs upstream llama.cpp; the PrismML fork only loads Ternary-Bonsai."""
        if spec.id == "lfm3":
            return LLAMA_SERVER_UPSTREAM
        return LLAMA_SERVER

    async def _existing_ready(self, spec: Spec) -> bool:
        """True if a healthy llama-server is already serving this spec on LLAMA_URL.

        Lets a fresh/reloaded process adopt a server left running by a previous
        one instead of failing to bind the same port.
        """
        model_path = self._model_path(spec)
        try:
            async with httpx.AsyncClient() as c:
                h = await c.get(f"{LLAMA_URL}/health", timeout=2)
                if h.status_code != 200:
                    return False
                m = await c.get(f"{LLAMA_URL}/v1/models", timeout=2)
                if m.status_code == 200 and (model_path.name in m.text or str(model_path) in m.text):
                    return True
        except Exception:
            pass
        return False

    async def load(self, spec: Spec) -> None:
        async with self.lock:
            if self.alive() and self.model == spec.id and self.state == "ready":
                return
            # Adopt an already-running server (previous process / reload / manual start).
            if not self.alive() and await self._existing_ready(spec):
                self.log.clear()
                self._set("ready", spec.id)
                return
            await self._stop()
            server_bin = self._server_binary(spec)
            if not Path(server_bin).exists():
                msg = (
                    f"llama-server not found at {server_bin}. "
                    "Run scripts/setup_llama.sh or set LLAMA_SERVER."
                )
                self._set("error", spec.id, msg)
                raise RuntimeError(msg)
            self.log.clear()
            self._set("loading", spec.id)
            self._free_port()
            model_path = self._model_path(spec)
            spec_flags: list[str] = []
            env = None
            if spec.id == "lfm3":
                # LFM3 reasons unbounded by default; cap it server-side (per-request budget is ignored).
                # Metal throughput flags: q8_0 KV cache, bigger prefill batch, lock weights resident.
                spec_flags = [
                    "--reasoning-budget", str(LFM3_BUDGET),
                    "-ctk", "q8_0", "-ctv", "q8_0",
                    "-b", "2048", "-ub", "2048",
                ]
            elif USE_MTP and model_path.name == MTP_FILE:
                spec_flags = ["--spec-type", "draft-mtp", "--spec-draft-n-max", str(MTP_N_MAX), "--spec-draft-n-min", "0"]
                env = {**os.environ, "LLAMA_MTP_CHAIN": "1"}
            self.proc = await asyncio.create_subprocess_exec(
                server_bin, "-m", str(model_path), "--jinja",
                "--host", "127.0.0.1", "--port", str(LLAMA_PORT),
                "-c", CTX, "-ngl", NGL, "-fa", FA, *spec_flags,
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT, env=env,
            )
            asyncio.create_task(self._pump(self.proc))
            try:
                await self._wait_ready()
            except Exception as e:
                await self._stop()
                self._set("error", spec.id, str(e))
                raise RuntimeError(str(e)) from e
            self._set("ready", spec.id)

    async def _pump(self, proc: asyncio.subprocess.Process) -> None:
        assert proc.stdout
        async for line in proc.stdout:
            self.log.append(line.decode(errors="replace").rstrip())

    async def _wait_ready(self) -> None:
        async with httpx.AsyncClient() as c:
            for _ in range(480):  # ~4 min
                if self.proc is None or self.proc.returncode is not None:
                    tail = "\n".join(list(self.log)[-8:])
                    raise RuntimeError(f"llama-server exited while loading.\n{tail}")
                try:
                    r = await c.get(f"{LLAMA_URL}/health", timeout=2)
                    if r.status_code == 200:
                        return
                except httpx.HTTPError:
                    pass
                await asyncio.sleep(0.5)
        raise RuntimeError("llama-server timed out loading the model.")

    async def _stop(self) -> None:
        p, self.proc = self.proc, None
        if p and p.returncode is None:
            p.terminate()
            try:
                await asyncio.wait_for(p.wait(), 8)
            except asyncio.TimeoutError:
                p.kill()
                await p.wait()

    def _free_port(self) -> None:
        """Kill any orphaned llama-server holding the port (e.g. a previous process on reload)."""
        try:
            import subprocess
            out = subprocess.run(["lsof", "-ti", f":{LLAMA_PORT}"], capture_output=True, text=True, timeout=5)
            for pid in out.stdout.split():
                try:
                    os.kill(int(pid), 15)
                except Exception:
                    pass
        except Exception:
            pass

    async def shutdown(self) -> None:
        await self._stop()


runtime = Runtime()