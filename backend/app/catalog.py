from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Awaitable, Callable

import httpx

from .config import MODELS_DIR


@dataclass(frozen=True)
class Spec:
    id: str
    label: str
    repo: str
    file: str

    @property
    def path(self):
        return MODELS_DIR / self.file

    @property
    def part(self):
        return MODELS_DIR / (self.file + ".part")

    @property
    def installed(self) -> bool:
        return self.path.exists()

    @property
    def bytes(self) -> int:
        if self.path.exists():
            return self.path.stat().st_size
        return self.part.stat().st_size if self.part.exists() else 0


def _spec(size: str) -> Spec:
    return Spec(
        id=size.lower(),
        label=size,
        repo=f"prism-ml/Ternary-Bonsai-2-{size}-gguf",
        file=f"Ternary-Bonsai-2-{size}-PQ2_0.gguf",
    )


SPECS = {
    **{s.id: s for s in (_spec("2B"), _spec("4B"), _spec("9B"))},
    "lfm3": Spec(
        id="lfm3",
        label="LFM3 1.7B",
        repo="LiquidAI/LFM3-1.7B-GGUF",
        file="LFM3-1.7B-Q5_K_M.gguf",
    ),
}

Progress = Callable[[int, int, float], Awaitable[None]]


async def download(spec: Spec, on_progress: Progress) -> None:
    """Streams to a .part file, resumes with Range, renames on completion."""
    url = f"https://huggingface.co/{spec.repo}/resolve/main/{spec.file}"
    done = spec.part.stat().st_size if spec.part.exists() else 0
    headers = {"Range": f"bytes={done}-"} if done else {}
    timeout = httpx.Timeout(30.0, read=60.0)
    async with httpx.AsyncClient(follow_redirects=True, timeout=timeout) as c:
        async with c.stream("GET", url, headers=headers) as r:
            if r.status_code == 416:  # .part is already complete
                spec.part.replace(spec.path)
                return
            r.raise_for_status()
            resumed = r.status_code == 206
            if not resumed:
                done = 0
            total = done + int(r.headers.get("content-length", 0))
            speed, last, last_done = 0.0, time.monotonic(), done
            with open(spec.part, "ab" if resumed else "wb") as f:
                async for chunk in r.aiter_bytes(1 << 20):
                    f.write(chunk)
                    done += len(chunk)
                    now = time.monotonic()
                    if now - last >= 0.1:
                        inst = (done - last_done) / (now - last)
                        speed = inst if speed == 0 else 0.8 * speed + 0.2 * inst
                        last, last_done = now, done
                        await on_progress(done, total, speed)
    spec.part.replace(spec.path)