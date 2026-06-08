import re
from dataclasses import dataclass
from typing import Optional
from difflib import SequenceMatcher

from config import (
    APPROVE_WORDS, DENY_WORDS, KILL_WORDS,
    DANGER_PATTERNS, MATCH_THRESHOLD, TRIGGER_WORD,
)


@dataclass
class ScreenElement:
    text: str
    x: int
    y: int
    w: int
    h: int

    @property
    def center(self):
        return (self.x + self.w // 2, self.y + self.h // 2)


@dataclass
class Action:
    kind: str          # "click", "deny", "kill", "escalate", "none"
    target: Optional[ScreenElement] = None
    reason: str = ""


def _has_word(word: str, text: str) -> bool:
    return bool(re.search(r"\b" + re.escape(word) + r"\b", text, re.IGNORECASE))


def _similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


def _is_dangerous(elements: list[ScreenElement]) -> bool:
    all_text = " ".join(e.text.lower() for e in elements)
    return any(pattern in all_text for pattern in DANGER_PATTERNS)


def _intent_type(voice: str) -> str:
    v = voice.lower().strip()
    if any(_has_word(k, v) for k in KILL_WORDS):
        return "kill"
    if any(_has_word(w, v) for w in APPROVE_WORDS):
        return "approve"
    if any(_has_word(w, v) for w in DENY_WORDS):
        return "deny"
    return "unknown"


def _find_button(elements: list[ScreenElement], target_words: set[str]) -> Optional[ScreenElement]:
    best_score = 0.0
    best_elem = None
    for elem in elements:
        for word in target_words:
            score = _similarity(elem.text, word)
            if score > best_score:
                best_score = score
                best_elem = elem
    if best_score >= MATCH_THRESHOLD:
        return best_elem
    return None


def decide(voice: str, elements: list[ScreenElement]) -> Action:
    # Require trigger word unless it's a kill command
    if TRIGGER_WORD and not _has_word(TRIGGER_WORD, voice):
        intent = _intent_type(voice)
        if intent != "kill":
            return Action(kind="none", reason=f"no trigger word '{TRIGGER_WORD}' heard")

    intent = _intent_type(voice)

    if intent == "kill":
        return Action(kind="kill", reason="kill switch triggered")

    if _is_dangerous(elements):
        return Action(kind="escalate", reason="dangerous dialog detected — manual approval required")

    if intent == "approve":
        btn = _find_button(elements, {"yes", "allow", "approve", "ok", "confirm", "accept", "continue"})
        if btn:
            return Action(kind="click", target=btn, reason=f"matched '{btn.text}'")
        return Action(kind="none", reason="approve intent but no matching button found")

    if intent == "deny":
        btn = _find_button(elements, {"no", "cancel", "deny", "reject", "abort"})
        if btn:
            return Action(kind="click", target=btn, reason=f"matched '{btn.text}'")
        return Action(kind="none", reason="deny intent but no matching button found")

    return Action(kind="none", reason=f"unknown intent: '{voice}'")
