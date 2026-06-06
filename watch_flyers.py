#!/usr/bin/env python3
"""
watch_flyers.py — Auto-trigger outreach.py on new images in output/flyers/

Usage:
    python watch_flyers.py
    python watch_flyers.py --dir output/flyers --db output/racing.db --out output/

Drop any image (jpg/jpeg/png/webp/gif) into output/flyers/ and the full
pipeline runs automatically within 1 second.
"""

import sys
import os
import time
import argparse
import subprocess
from pathlib import Path


def _pip(pkg):
    subprocess.check_call([sys.executable, "-m", "pip", "install", pkg, "-q"])


try:
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler
except ImportError:
    _pip("watchdog")
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler


SUPPORTED = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


class FlyerHandler(FileSystemEventHandler):
    def __init__(self, db_path: str, out_dir: str):
        self.db_path = db_path
        self.out_dir = out_dir
        self._seen: set = set()

    def on_created(self, event):
        if event.is_directory:
            return
        self._process(event.src_path)

    def on_moved(self, event):
        if event.is_directory:
            return
        self._process(event.dest_path)

    def _process(self, path: str):
        p = Path(path)
        if p.suffix.lower() not in SUPPORTED:
            return
        if path in self._seen:
            return
        self._seen.add(path)

        # Wait briefly for file write to complete
        time.sleep(0.5)
        if not p.exists() or p.stat().st_size == 0:
            return

        print(f"\n[watch] New flyer detected: {p.name}")
        print("[watch] Launching pipeline …\n")

        script = Path(__file__).parent / "outreach.py"
        cmd = [
            sys.executable, str(script),
            str(p),
            "--db", self.db_path,
            "--out", self.out_dir,
        ]

        result = subprocess.run(cmd)
        if result.returncode == 0:
            print(f"\n[watch] ✓ Pipeline complete for {p.name}")
        else:
            print(f"\n[watch] ✗ Pipeline failed for {p.name} (exit {result.returncode})")

        print(f"[watch] Waiting for next image in {Path(self.db_path).parent / 'flyers'} …\n")


def main():
    parser = argparse.ArgumentParser(description="Watch output/flyers/ and auto-run outreach.py")
    parser.add_argument("--dir", default="output/flyers", help="Directory to watch")
    parser.add_argument("--db",  default="output/racing.db", help="SQLite database path")
    parser.add_argument("--out", default="output/",           help="Output directory for generated files")
    args = parser.parse_args()

    watch_dir = Path(args.dir)
    watch_dir.mkdir(parents=True, exist_ok=True)

    print(f"{'='*52}")
    print("  FLYER WATCHER")
    print(f"{'='*52}")
    print(f"  Watching : {watch_dir.resolve()}")
    print(f"  DB       : {args.db}")
    print(f"  Out      : {args.out}")
    print(f"{'='*52}")
    print(f"\n  Drop a .jpg / .png / .webp into:")
    print(f"  {watch_dir.resolve()}")
    print(f"\n  Pipeline fires automatically.\n")
    print("  Press Ctrl+C to stop.\n")

    handler = FlyerHandler(db_path=args.db, out_dir=args.out)
    observer = Observer()
    observer.schedule(handler, str(watch_dir), recursive=False)
    observer.start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[watch] Stopping …")
        observer.stop()

    observer.join()
    print("[watch] Done.")


if __name__ == "__main__":
    main()
