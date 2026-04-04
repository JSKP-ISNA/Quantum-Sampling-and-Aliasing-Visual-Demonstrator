from __future__ import annotations

import argparse
import importlib.util
import os
import shutil
import signal
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent
BACKEND_DIR = REPO_ROOT / "backend"
FRONTEND_DIR = REPO_ROOT / "frontend"
BACKEND_HEALTH_URL = "http://127.0.0.1:8000/health"
FRONTEND_DEV_URL = "http://127.0.0.1:5173"
BACKEND_STARTUP_TIMEOUT = 45
FRONTEND_STARTUP_TIMEOUT = 90


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Launch Quantum Signal Studio from a single root-level Python entrypoint."
    )
    parser.add_argument(
        "--browser",
        action="store_true",
        help="Use the browser dev server instead of the default desktop webview shell.",
    )
    parser.add_argument(
        "--no-reload",
        action="store_true",
        help="Run the backend without uvicorn auto-reload.",
    )
    return parser.parse_args()


def command_name(base: str) -> str:
    return f"{base}.cmd" if os.name == "nt" else base


def require_command(command: str, friendly_name: str) -> None:
    if shutil.which(command):
        return

    print(f"[launcher] Missing {friendly_name}: '{command}' was not found on PATH.", file=sys.stderr)
    raise SystemExit(1)


def require_python_modules(*module_names: str) -> None:
    missing = [module for module in module_names if importlib.util.find_spec(module) is None]
    if not missing:
        return

    joined = ", ".join(missing)
    print(
        f"[launcher] Missing Python dependencies for the backend: {joined}. "
        f"Install the backend requirements first.",
        file=sys.stderr,
    )
    raise SystemExit(1)


def stream_output(name: str, pipe) -> None:
    try:
        for line in iter(pipe.readline, ""):
            print(f"[{name}] {line}", end="")
    finally:
        pipe.close()


def start_process(name: str, command: list[str], cwd: Path) -> subprocess.Popen[str]:
    creationflags = 0
    popen_kwargs: dict[str, object] = {}

    if os.name == "nt":
        creationflags = subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        popen_kwargs["preexec_fn"] = os.setsid

    env = os.environ.copy()
    env.setdefault("PYTHONUNBUFFERED", "1")

    process = subprocess.Popen(
        command,
        cwd=str(cwd),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        bufsize=1,
        env=env,
        creationflags=creationflags,
        **popen_kwargs,
    )

    thread = threading.Thread(target=stream_output, args=(name, process.stdout), daemon=True)
    thread.start()
    return process


def wait_for_url(url: str, timeout_seconds: int, process: subprocess.Popen[str]) -> bool:
    deadline = time.time() + timeout_seconds

    while time.time() < deadline:
        if process.poll() is not None:
            return False

        try:
            with urllib.request.urlopen(url, timeout=2) as response:
                if 200 <= response.status < 500:
                    return True
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            time.sleep(0.5)

    return False


def stop_process(name: str, process: subprocess.Popen[str]) -> None:
    if process.poll() is not None:
        return

    print(f"[launcher] Stopping {name}...")

    if os.name == "nt":
        subprocess.run(
            ["taskkill", "/PID", str(process.pid), "/T", "/F"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
        return

    try:
        os.killpg(process.pid, signal.SIGTERM)
    except ProcessLookupError:
        return

    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass


def main() -> int:
    args = parse_args()

    if not BACKEND_DIR.exists() or not FRONTEND_DIR.exists():
        print("[launcher] Could not find the expected backend/frontend directories.", file=sys.stderr)
        return 1

    npm_command = command_name("npm")
    require_command(npm_command, "Node.js/npm")
    require_python_modules("uvicorn", "fastapi", "numpy", "scipy")

    frontend_script = "dev:web" if args.browser else "dev"
    backend_command = [sys.executable, "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000"]
    if not args.no_reload:
        backend_command.append("--reload")

    frontend_command = [npm_command, "run", frontend_script]

    print("[launcher] Starting backend...")
    backend_process = start_process("backend", backend_command, BACKEND_DIR)

    if not wait_for_url(BACKEND_HEALTH_URL, BACKEND_STARTUP_TIMEOUT, backend_process):
        print(
            f"[launcher] Backend did not become ready at {BACKEND_HEALTH_URL}. "
            f"Check the backend logs above.",
            file=sys.stderr,
        )
        stop_process("backend", backend_process)
        return backend_process.poll() or 1

    print(f"[launcher] Backend is healthy at {BACKEND_HEALTH_URL}.")
    print(
        "[launcher] Starting frontend in "
        f"{'browser' if args.browser else 'desktop webview'} mode..."
    )
    frontend_process = start_process("frontend", frontend_command, FRONTEND_DIR)

    if wait_for_url(FRONTEND_DEV_URL, FRONTEND_STARTUP_TIMEOUT, frontend_process):
        print(f"[launcher] Frontend dev server is responding at {FRONTEND_DEV_URL}.")
    else:
        print(
            f"[launcher] Frontend did not confirm on {FRONTEND_DEV_URL} within "
            f"{FRONTEND_STARTUP_TIMEOUT}s. The desktop shell may still be starting.",
            file=sys.stderr,
        )

    print("[launcher] Quantum Signal Studio is running. Press Ctrl+C to stop both services.")

    try:
        while True:
            backend_code = backend_process.poll()
            frontend_code = frontend_process.poll()

            if backend_code is not None:
                print(f"[launcher] Backend exited with code {backend_code}.")
                stop_process("frontend", frontend_process)
                return backend_code

            if frontend_code is not None:
                print(f"[launcher] Frontend exited with code {frontend_code}.")
                stop_process("backend", backend_process)
                return frontend_code

            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\n[launcher] Shutdown requested.")
        stop_process("frontend", frontend_process)
        stop_process("backend", backend_process)
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
