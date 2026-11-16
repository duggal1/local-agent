# Local Agent

**A private, local AI agent that runs entirely on your machine — the best way to learn small local models.**

No cloud. No API keys. No per-token billing. A chat UI, tool calling, real file generation (code, PDF, Markdown, HTML, CSV, XLSX, PPTX), web search, skills, and a live preview panel — all on your own hardware.

---

## Why

- **Private** — everything runs locally; nothing leaves your machine.
- **Free** — no API costs; only electricity.
- **Learn by doing** — a clean, hackable codebase for understanding local LLMs: tokenization, samplers, tool calling, streaming, and Apple Silicon / CUDA performance.

---

## Features

- **Streaming chat** with live tokens/sec meter.
- **Tool calling** — `create_file`, `create_html`, `create_markdown`, `create_csv`, `create_xlsx`, `create_pptx`, `create_pdf`, `create_site`, `web_search`, `read_url`, `load_skill`.
- **Live preview panel** — HTML (sandboxed iframe), CSV/XLSX (table), PPTX (slides), PDF, Markdown, code.
- **Skills** — markdown playbooks loaded on demand (`load_skill`).
- **Web search** — Brave → Jina → DuckDuckGo (keyless) with page reading.
- **Thinking / reasoning** toggle with effort levels.
- **Multiple models** — Ternary-Bonsai-2 (4B), LiquidAI LFM3 (1.7B), and more.

---

## Architecture

```
backend/   FastAPI + llama.cpp (local inference, WebSocket streaming, tool loop)
web/       React + Vite (chat UI, tool cards, live preview panel)
server     one-command launcher
```

- **Backend**: Python (FastAPI), talks to a local `llama-server` (llama.cpp / PrismML fork), runs the agent loop (sampler → tools → loop).
- **Frontend**: React + TypeScript, WebSocket streaming, `react-markdown`, syntax highlighting, live preview.

---

## Models & performance

Estimated tokens/sec (decode) on a single model, no batching. Lower is a smaller/quantized model = more tok/s. These are **bandwidth-bound** estimates (`tok/s ≈ memory bandwidth ÷ model bytes`); your real numbers vary with thermals and context length.

| Model | M1 (8GB) | M2 (8GB) | M3 (16GB) | M4 (24GB) | M5 | M5 Max | RTX 4090 | RTX 5090 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| **Ternary-Bonsai-2-4B** (PQ2_0, 1.1 GB) | ~25 | ~35 | ~50 | ~60 | ~70 | ~140 | ~100 | ~180 |
| **LFM3-1.7B** (Q4_K_M, 1.1 GB) | ~47 | ~65 | ~95 | ~110 | ~130 | ~260 | ~250 | ~450 |
| **LFM3-1.7B** (Q5_K_M, 1.26 GB) | ~33 | ~48 | ~70 | ~80 | ~95 | ~190 | ~200 | ~350 |

> M1 numbers are measured on a MacBook Air (fanless — expect a drop under sustained load). Everything else is a **bandwidth-model estimate** (`tok/s ≈ bandwidth ÷ model bytes × efficiency`); real numbers vary with thermals, context length, and runtime. **RTX figures are untested CUDA upper bounds** — real-world is often 30–50% lower, and the ternary (PQ2_0) CUDA path isn't validated. Treat the GPU columns as rough, not gospel.

---

## Quick start

```bash
# 1. Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python run.py            # serves on http://127.0.0.1:8000

# 2. Frontend (optional — backend serves the built UI too)
cd ../web
npm install && npm run dev   # http://localhost:5173
```

Then open **http://127.0.0.1:8000/** and start chatting.

---

## License

Apache 2.0 (see each model's license for its weights).