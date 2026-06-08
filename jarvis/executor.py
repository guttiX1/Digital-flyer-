import pyautogui
from decider import Action

pyautogui.FAILSAFE = True  # move mouse to corner to emergency stop
pyautogui.PAUSE = 0.1


def execute(action: Action) -> bool:
    if action.kind == "click" and action.target:
        x, y = action.target.center
        pyautogui.click(x, y)
        return True

    if action.kind == "kill":
        raise SystemExit("Jarvis stopped by voice command.")

    if action.kind == "escalate":
        _notify(f"ESCALATED: {action.reason}")
        return False

    return False


def _notify(message: str):
    # Cross-platform desktop notification (best-effort)
    try:
        import platform
        if platform.system() == "Darwin":
            import subprocess
            subprocess.run(["osascript", "-e", f'display notification "{message}" with title "Jarvis"'])
        elif platform.system() == "Windows":
            from win10toast import ToastNotifier
            ToastNotifier().show_toast("Jarvis", message, duration=3)
        else:
            print(f"[Jarvis] {message}")
    except Exception:
        print(f"[Jarvis] {message}")
