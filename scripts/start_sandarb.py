#!/usr/bin/env python3
"""
Driver script to bring up Sandarb (UI on 3000, backend on 8000).
Usage: python scripts/start_sandarb.py   OR   npm run sandarb
For Postgres check + port cleanup, run ./scripts/start-sandarb.sh instead.
"""
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def check_node() -> None:
    try:
        r = subprocess.run(["node", "-v"], capture_output=True, text=True, cwd=ROOT)
        if r.returncode != 0:
            sys.exit(1)
        ver = r.stdout.strip().lstrip("v").split(".")
        if int(ver[0]) < 18:
            sys.exit(1)
    except (FileNotFoundError, ValueError):
        sys.exit(1)


def ensure_env() -> None:
    env_path = ROOT / ".env"
    example_path = ROOT / ".env.example"
    if not env_path.exists() and example_path.exists():
        env_path.write_text(example_path.read_text())


def ensure_deps() -> None:
    node_modules = ROOT / "node_modules"
    if not node_modules.exists():
        r = subprocess.run(["npm", "install"], cwd=ROOT)
        if r.returncode != 0:
            sys.exit(r.returncode or 1)


def main() -> None:
    check_node()
    ensure_env()
    ensure_deps()
    proc = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=ROOT,
        stdin=sys.stdin,
        stdout=sys.stdout,
        stderr=sys.stderr,
        shell=os.name == "nt",
    )

    def on_sig(signum, _):
        proc.terminate()
        if signum == 2:  # SIGINT
            sys.exit(130)
        sys.exit(128 + (15 if signum == 15 else 0))

    try:
        import signal
        signal.signal(signal.SIGINT, on_sig)
        signal.signal(signal.SIGTERM, on_sig)
    except AttributeError:
        pass
    code = proc.wait()
    sys.exit(code if code is not None else 0)


if __name__ == "__main__":
    main()
