#!/usr/bin/env python3
"""
Aether Industries — Flyer Watcher
Monitors output/flyers/ and auto-fires outreach.py on any new image.

Usage:
  python3 watch_flyers.py
"""

import subprocess
import sys
import time
from pathlib import Path

try:
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler
except ImportError:
    print("ERROR: watchdog not installed. Run: pip install watchdog")
    sys.exit(1)

WATCH_DIR   = Path("output/flyers")
IMAGE_EXTS  = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
COOLDOWN_S  = 3  # seconds to wait after file appears before processing (allow full write)

_recently_processed: set = set()


class FlyerHandler(FileSystemEventHandler):

    def on_created(self, event):
        if event.is_directory:
            return
        path = Path(event.src_path)
        if path.suffix.lower() not in IMAGE_EXTS:
            return
        if str(path) in _recently_processed:
            return

        print(f"\n[watcher] New flyer detected: {path.name}")
        print(f"[watcher] Waiting {COOLDOWN_S}s for file to finish writing…")
        time.sleep(COOLDOWN_S)

        if not path.exists():
            print(f"[watcher] File disappeared before processing: {path.name}")
            return

        _recently_processed.add(str(path))

        print(f"[watcher] Firing pipeline for: {path.name}")
        result = subprocess.run(
            [sys.executable, "outreach.py", str(path)],
            capture_output=False,
        )

        if result.returncode == 0:
            print(f"[watcher] ✓ Pipeline complete for {path.name}")
        else:
            print(f"[watcher] ✗ Pipeline failed for {path.name} (exit {result.returncode})")


def main():
    WATCH_DIR.mkdir(parents=True, exist_ok=True)

    handler  = FlyerHandler()
    observer = Observer()
    observer.schedule(handler, str(WATCH_DIR), recursive=False)
    observer.start()

    print(f"[watcher] Watching: {WATCH_DIR.resolve()}")
    print(f"[watcher] Drop any .jpg/.png/.webp flyer image there to auto-generate the full funnel.")
    print(f"[watcher] Press Ctrl+C to stop.\n")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[watcher] Stopping…")
        observer.stop()

    observer.join()
    print("[watcher] Done.")


if __name__ == "__main__":
    main()
