import sys
import threading
from listener import listen_once
from vision import capture_elements
from decider import decide
from executor import execute
from watcher import watch
from config import WATCH_MODE


def voice_loop():
    print("[Jarvis Voice] Running — say 'Jarvis [command]' or 'kill' to stop.\n")
    while True:
        voice = listen_once()
        if not voice:
            continue

        print(f"[heard] {voice}")

        elements = capture_elements()
        action = decide(voice, elements)

        print(f"[action] {action.kind} — {action.reason}")
        execute(action)


def run():
    if WATCH_MODE:
        # Watch mode runs in background, voice runs in foreground
        t = threading.Thread(target=watch, daemon=True)
        t.start()

    voice_loop()


if __name__ == "__main__":
    try:
        run()
    except (KeyboardInterrupt, SystemExit) as e:
        print(f"\n[Jarvis] Stopped. {e}")
        sys.exit(0)
