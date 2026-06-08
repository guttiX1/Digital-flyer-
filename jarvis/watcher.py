import time
from vision import capture_elements
from decider import _is_dangerous, _find_button, Action
from executor import execute, _notify
from config import WATCH_INTERVAL, CLAUDE_CODE_PROMPT_SIGNATURES, DANGER_PATTERNS


def _screen_text(elements) -> str:
    return " ".join(e.text.lower() for e in elements)


def _is_claude_code_prompt(elements) -> bool:
    text = _screen_text(elements)
    return any(all(w in text for w in sig) for sig in CLAUDE_CODE_PROMPT_SIGNATURES)


def watch():
    print("[Jarvis Watch] Scanning for Claude Code prompts — say 'kill' or Ctrl+C to stop.\n")
    while True:
        try:
            elements = capture_elements()

            if _is_claude_code_prompt(elements):
                screen_text = _screen_text(elements)

                if any(p in screen_text for p in DANGER_PATTERNS):
                    _notify("DANGEROUS prompt detected — manual approval required")
                    print("[watch] ESCALATED — dangerous prompt, not auto-approving")
                else:
                    btn = _find_button(elements, {"yes", "allow", "approve", "ok", "confirm", "accept", "continue", "y"})
                    if btn:
                        print(f"[watch] Claude Code prompt detected — clicking '{btn.text}'")
                        execute(Action(kind="click", target=btn, reason="auto-approved"))
                        time.sleep(1.0)  # brief pause after clicking
                    else:
                        print("[watch] Prompt detected but no approve button found")

            time.sleep(WATCH_INTERVAL)

        except KeyboardInterrupt:
            print("\n[Jarvis Watch] Stopped.")
            break
