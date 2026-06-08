APPROVE_WORDS = {
    "yes", "yeah", "yep", "yup", "ok", "okay", "sure", "go",
    "run", "execute", "proceed", "confirm", "accept", "continue",
    "allow", "approve", "do it", "let it", "go ahead",
}

DENY_WORDS = {
    "no", "nope", "cancel", "deny", "reject",
    "abort", "don't", "dont", "skip",
}

KILL_WORDS = {
    "kill", "halt", "pause", "shut down", "shutdown",
    "stop everything", "stop jarvis", "exit",
}

# If any of these appear in the dialog text, never auto-approve
DANGER_PATTERNS = {
    "permanently",
    "cannot be undone",
    "irreversible",
    "rm -rf",
    "--force",
    "force push",
    "drop table",
    "delete all",
    "remove all",
    "hard reset",
}

# Confidence threshold: how closely voice must match screen element (0.0–1.0)
MATCH_THRESHOLD = 0.75

# Say this word before any command — set to "" to disable
TRIGGER_WORD = "jarvis"

# Seconds of silence before Whisper processes audio
SILENCE_TIMEOUT = 0.8

# Screenshot region: None = full screen, or (x, y, w, h)
CAPTURE_REGION = None

# Claude Code watch mode — auto-approve permission prompts without voice
WATCH_MODE = True
WATCH_INTERVAL = 1.0  # seconds between screen checks

# Claude Code prompt signatures — if ALL words in a set appear on screen, it's a prompt
CLAUDE_CODE_PROMPT_SIGNATURES = [
    {"allow", "tool"},
    {"allow", "bash"},
    {"allow", "read"},
    {"allow", "write"},
    {"allow", "edit"},
    {"do you want to", "proceed"},
    {"approve", "action"},
    {"grant", "permission"},
]
