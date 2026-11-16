import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
MODELS_DIR = DATA / "models"
OUTPUTS_DIR = DATA / "outputs"
SKILLS_DIR = ROOT / "skills"
for _d in (MODELS_DIR, OUTPUTS_DIR):
    _d.mkdir(parents=True, exist_ok=True)

# Must be PrismML's fork. Stock llama-server cannot run PTQ1_0.
# Windows: set LLAMA_SERVER to ...\build\bin\Release\llama-server.exe
LLAMA_SERVER = os.environ.get("LLAMA_SERVER") or str(
    ROOT / "bin" / "llama.cpp" / "build" / "bin" / "llama-server"
)
# Upstream llama.cpp (supports LFM3 and other newer architectures the PrismML fork can't load)
LLAMA_SERVER_UPSTREAM = os.environ.get("LLAMA_SERVER_UPSTREAM") or str(
    ROOT / "bin" / "llama-upstream" / "llama-server"
)
LLAMA_PORT = int(os.environ.get("LLAMA_PORT", "8081"))
LLAMA_URL = f"http://127.0.0.1:{LLAMA_PORT}"
CTX = os.environ.get("BONSAI_CTX", "16384")
NGL = os.environ.get("BONSAI_NGL", "99")
FA = os.environ.get("BONSAI_FA", "auto")
MAX_STEPS = 12
MAX_TOKENS = int(os.environ.get("BONSAI_MAX_TOKENS", "8192"))
_p = os.environ.get("BONSAI_PRESENCE")
PRESENCE = float(_p) if _p else None   # optional override of the official presence_penalty

# LFM3 reasons by default and ignores per-request reasoning_budget; cap it server-side.
LFM3_BUDGET = int(os.environ.get("BONSAI_LFM3_BUDGET", "512"))

# Optional MTP (multi-token prediction) for the 4B — same model, extra heads inside
# the file. Enables speculative decoding (draft-mtp) which raises tok/s on code.
# MTP (multi-token prediction) — OFF by default: it sped up code but slowed prose.
# Opt back in with BONSAI_MTP=1 (requires the MTP GGUF present).
USE_MTP = os.environ.get("BONSAI_MTP", "0") == "1"
MTP_FILE = "Ternary-Bonsai-2-4B-PQ2_0-MTP-Q8_0.gguf"
MTP_N_MAX = os.environ.get("BONSAI_MTP_N_MAX", "4")

# Optional search keys. Without them the chain uses DuckDuckGo (keyless).
JINA_API_KEY = os.environ.get("JINA_API_KEY", "")     # free at jina.ai — enables s.jina.ai search
BRAVE_API_KEY = os.environ.get("BRAVE_API_KEY", "")   # optional