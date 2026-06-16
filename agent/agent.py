#!/usr/bin/env python3
"""
Codex-Fleet node agent — runs on OMEN or VIVO.

Reads CPU / memory via psutil, tails log files, reads handoff-current.json,
then pushes the aggregated state to the relay server every N seconds.

Install:  pip install psutil websockets
Run:      python agent.py --node OMEN --server ws://localhost:8765

Full example with optional paths:
  python agent.py \\
    --node OMEN \\
    --server wss://xyz.trycloudflare.com \\
    --handoff ~/bridge/handoff-current.json \\
    --log /var/log/iads/extract.log \\
    --iads /var/log/iads/progress.txt \\
    --interval 2
"""

import asyncio
import json
import sys
import time
import argparse
from pathlib import Path


def _check_deps():
    missing = []
    try:
        import psutil  # noqa: F401
    except ImportError:
        missing.append("psutil")
    try:
        import websockets  # noqa: F401
    except ImportError:
        missing.append("websockets")
    if missing:
        print(f"[agent] missing deps — run:  pip install {' '.join(missing)}")
        sys.exit(1)


_check_deps()

import psutil          # noqa: E402
import websockets      # noqa: E402


# ── helpers ──────────────────────────────────────────────────────────────────

def _tail(path: str | None, n: int = 12) -> list[str]:
    """Return last n non-empty lines from a text file."""
    if not path:
        return []
    p = Path(path)
    if not p.exists():
        return []
    try:
        with open(p) as f:
            lines = f.readlines()
        return [l.rstrip() for l in lines[-n:] if l.strip()]
    except Exception:
        return []


def _read_json(path: str | None) -> dict | None:
    if not path:
        return None
    p = Path(path)
    if not p.exists():
        return None
    try:
        with open(p) as f:
            return json.load(f)
    except Exception:
        return None


def _read_int(path: str | None) -> int:
    if not path:
        return 0
    p = Path(path)
    if not p.exists():
        return 0
    try:
        return int(p.read_text().strip())
    except Exception:
        return 0


# ── state collection ─────────────────────────────────────────────────────────

def collect(node: str, handoff_path, log_path, iads_path) -> dict:
    cpu = psutil.cpu_percent(interval=0.5)
    mem = psutil.virtual_memory().percent

    return {
        "type":     "agent_update",
        "node":     node,
        "cpu":      round(cpu),
        "mem":      round(mem),
        "ts":       time.strftime("%H:%M:%S"),
        "handoff":  _read_json(handoff_path),
        "logs":     _tail(log_path),
        "iadsDone": _read_int(iads_path),
    }


# ── WebSocket loop ────────────────────────────────────────────────────────────

async def run(node: str, server_url: str, handoff_path, log_path, iads_path, interval: float):
    # Ensure ?role=agent is in the URL
    sep = "&" if "?" in server_url else "?"
    url = server_url if "role=" in server_url else f"{server_url}{sep}role=agent"

    backoff = 2.0
    while True:
        try:
            print(f"[{node}] connecting to {url} …")
            async with websockets.connect(url, ping_interval=20, ping_timeout=30) as ws:
                print(f"[{node}] connected — pushing every {interval}s")
                backoff = 2.0
                while True:
                    payload = collect(node, handoff_path, log_path, iads_path)
                    await ws.send(json.dumps(payload))
                    await asyncio.sleep(interval)

        except Exception as exc:
            print(f"[{node}] disconnected: {exc} — retry in {backoff:.0f}s")
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 60)


# ── entry point ───────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(
        description="Codex-Fleet node agent",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    ap.add_argument("--node",     required=True, help="Node name, e.g. OMEN or VIVO")
    ap.add_argument("--server",   required=True, help="Relay WebSocket URL")
    ap.add_argument("--handoff",  default=None,  help="Path to handoff-current.json")
    ap.add_argument("--log",      default=None,  help="Log file to tail for audit lines")
    ap.add_argument("--iads",     default=None,  help="File containing IADS processed-file count (integer)")
    ap.add_argument("--interval", type=float, default=2.0, help="Push interval in seconds (default: 2)")
    args = ap.parse_args()

    asyncio.run(run(
        args.node, args.server,
        args.handoff, args.log, args.iads,
        args.interval,
    ))


if __name__ == "__main__":
    main()
