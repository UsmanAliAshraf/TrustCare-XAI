"""Text normalisation and token-level matching.

Normalisation is applied to copies used for comparison only; stored patient
records are never modified.
"""

from __future__ import annotations

import re
import unicodedata

from . import config

_APOSTROPHES = re.compile(r"['‘’`]")
_NON_ALNUM = re.compile(r"[^a-z0-9]+")


def normalize(text: str) -> str:
    """Lowercase, strip accents, drop apostrophes, turn other punctuation into
    spaces and collapse whitespace. "O'Connor" -> "oconnor", "Type-2" -> "type 2"."""
    text = unicodedata.normalize("NFKD", str(text or ""))
    text = "".join(c for c in text if not unicodedata.combining(c)).lower()
    text = _APOSTROPHES.sub("", text)
    return _NON_ALNUM.sub(" ", text).strip()


def tokenize(text: str) -> list[str]:
    return normalize(text).split()


def compact(text: str) -> str:
    """Letters and digits only, for identifier comparison: "P-1001" -> "p1001"."""
    return normalize(text).replace(" ", "")


def levenshtein(a: str, b: str) -> int:
    """Edit distance (insertions, deletions, substitutions), two-row DP."""
    if a == b:
        return 0
    if len(a) < len(b):
        a, b = b, a
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def similarity(a: str, b: str) -> float:
    """Normalised Levenshtein similarity: 1 - distance / max(len(a), len(b)).

    Both empty -> 1.0 (identical); exactly one empty -> 0.0. This avoids the
    division by zero the bare formula has.
    """
    if not a and not b:
        return 1.0
    if not a or not b:
        return 0.0
    return 1.0 - levenshtein(a, b) / max(len(a), len(b))


def token_score(q: str, t: str) -> float:
    """Evidence that query word `q` refers to field word `t`, in [0, 1].

    exact (1.0) > prefix (0.75-0.95) > infix (0.6) / fuzzy spelling (0.6-0.8).
    Short query words get stricter rules so inputs like "de" don't match
    half the dataset.
    """
    if q == t:
        return config.SCORE_EXACT
    n = len(q)
    if n < config.MIN_PREFIX_LEN:
        return 0.0
    if t.startswith(q):
        return config.PREFIX_BASE + config.PREFIX_COVERAGE * n / len(t)
    best = 0.0
    if n >= config.MIN_INFIX_LEN and q in t:
        best = config.SCORE_INFIX
    if n >= config.MIN_FUZZY_LEN:
        sim = similarity(q, t)
        if sim >= config.FUZZY_MIN_SIMILARITY:
            best = max(best, config.FUZZY_SCALE * sim)
    return best


def phrase_score(query_tokens: tuple[str, ...], field_tokens: tuple[str, ...]) -> float:
    """How well a (possibly multi-word) term matches one field.

    Each query word takes its best match among the field's words; the phrase
    scores the minimum over its words, so every word must be found
    ("type 2 diabetes" does not match "Type 1 Diabetes").
    """
    if not query_tokens or not field_tokens:
        return 0.0
    return min(max(token_score(q, t) for t in field_tokens) for q in query_tokens)
