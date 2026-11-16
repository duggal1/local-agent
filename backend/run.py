#!/usr/bin/env python3
import os
import sys

# Ensure dependencies are available; bootstrap a venv on first run if needed.
try:
    import uvicorn  # noqa: F401
except ModuleNotFoundError:
    import subprocess
    here = os.path.dirname(os.path.abspath(__file__))
    venv = os.path.join(here, ".venv")
    py = os.path.join(venv, "bin", "python")
    if not os.path.exists(py):
        subprocess.check_call([sys.executable or "python3", "-m", "venv", venv])
    subprocess.check_call([os.path.join(venv, "bin", "pip"), "install", "-r", os.path.join(here, "requirements.txt")])
    os.execv(py, [py, os.path.abspath(__file__), *sys.argv[1:]])

import uvicorn

if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    # Auto-reload on code changes so edits actually take effect.
    # Disable with:  python run.py --no-reload   (or NO_RELOAD=1)
    no_reload = "--no-reload" in sys.argv or os.environ.get("NO_RELOAD") == "1"
    reload = not no_reload
    kwargs = dict(host="127.0.0.1", port=8000, ws="auto", log_level="info")
    if reload:
        kwargs.update(reload=True, reload_dirs=[os.path.join(here, "app")])
    uvicorn.run("app.main:app", **kwargs)