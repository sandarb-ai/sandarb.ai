#!/usr/bin/env python3
"""
Run FastAPI backend (uvicorn). Used by npm run dev:backend and npm run dev.
Requires: Python 3 with uvicorn (pip install -r backend/requirements.txt).
"""
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"


def main() -> None:
    env = os.environ.copy()
    env["PYTHONUNBUFFERED"] = "1"
    try:
        proc = subprocess.Popen(
            ["uvicorn", "backend.main:app", "--reload", "--port", "8000"],
            cwd=ROOT,
            env=env,
            stdin=sys.stdin,
            stdout=sys.stdout,
            stderr=sys.stderr,
            shell=os.name == "nt",
        )
    except FileNotFoundError as e:
        print("Failed to start backend:", e, file=sys.stderr)
        print("Ensure Python 3 and uvicorn are installed: pip install -r backend/requirements.txt", file=sys.stderr)
        sys.exit(1)
    code = proc.wait()
    sys.exit(code if code is not None else 0)


if __name__ == "__main__":
    main()
