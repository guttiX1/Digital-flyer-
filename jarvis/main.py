import sys
from listener import listen_once
from vision import capture_elements
from decider import decide
from executor import execute


def run():
    print("[Jarvis] Running — say 'kill' or move mouse to corner to stop.\n")
    while True:
        voice = listen_once()
        if not voice:
            continue

        print(f"[heard] {voice}")

        elements = capture_elements()
        action = decide(voice, elements)

        print(f"[action] {action.kind} — {action.reason}")
        execute(action)


if __name__ == "__main__":
    try:
        run()
    except (KeyboardInterrupt, SystemExit) as e:
        print(f"\n[Jarvis] Stopped. {e}")
        sys.exit(0)
