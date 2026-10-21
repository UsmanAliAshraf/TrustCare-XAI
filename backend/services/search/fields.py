"""Which patient fields are searchable, and how a term scores against a patient.

Free-text and identification fields are matched with the token scores in
`text.py`. Categorical and numeric adherence attributes (forgetfulness,
missed appointments, ...) are not turned into searchable text. They are
reached through CONCEPTS: a controlled vocabulary of query words, each paired
with a membership function over the patient's recorded value. For example,
"forgetful" matches forgetfulness = Often fully (1.0), Sometimes partially
(0.6) and Rarely not at all.

Phone, address, religion, marital status and education are deliberately not
searchable: they serve no patient-finding workflow, and matching on them
would expose sensitive attributes through search.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from . import config
from .text import compact, phrase_score, tokenize


def ramp(x: float, lo: float, hi: float) -> float:
    """Linear membership function: 0 at or below lo, 1 at or above hi."""
    if x <= lo:
        return 0.0
    if x >= hi:
        return 1.0
    return (x - lo) / (hi - lo)


def _level(field: str, levels: dict[str, float]) -> Callable[[dict], float]:
    return lambda p: levels.get(str(p.get(field, "")).strip().lower(), 0.0)


def _num(field: str) -> Callable[[dict], float]:
    def get(p: dict) -> float:
        try:
            return float(p.get(field) or 0)
        except (TypeError, ValueError):
            return 0.0
    return get


@dataclass(frozen=True)
class Concept:
    name: str
    keywords: tuple[str, ...]
    membership: Callable[[dict], float]


# Controlled vocabulary for adherence-related attributes. Keywords are matched
# with the same exact/prefix/fuzzy rules as text, so "forgetfullness" still works.
CONCEPTS: tuple[Concept, ...] = (
    Concept("forgetfulness", ("forgetful", "forgetfulness", "forgets", "forgetting"),
            _level("forgetfulness", {"often": 1.0, "sometimes": 0.6})),
    Concept("financial difficulty", ("financial difficulty", "financial", "finances", "cost"),
            _level("financialDifficulty", {"yes": 1.0})),
    Concept("transportation issues", ("transportation issues", "transportation", "transport"),
            _level("transportationIssues", {"yes": 1.0})),
    Concept("low family support", ("low family support", "low support", "poor support"),
            _level("familySupport", {"low": 1.0, "medium": 0.4})),
    Concept("no caregiver", ("no caregiver", "lives alone", "alone"),
            _level("caregiver", {"none": 1.0, "": 1.0})),
    Concept("smoker", ("smoker", "smokers", "smoking", "smokes"),
            _level("smoking", {"yes": 1.0, "former": 0.5})),
    Concept("alcohol use", ("alcohol", "drinker", "drinking"),
            _level("alcohol", {"regularly": 1.0, "occasionally": 0.5})),
    Concept("physically inactive", ("inactive", "sedentary", "no exercise"),
            _level("exercise", {"rarely": 1.0, "sometimes": 0.4})),
    Concept("no sms reminders", ("no reminders", "no sms", "no sms reminders"),
            _level("smsReminders", {"no": 1.0})),
    Concept("missed appointments", ("missed appointments", "missed", "no show"),
            lambda p: ramp(_num("missedAppointments")(p), 0, 4)),
    Concept("prior hospitalizations", ("hospitalized", "hospitalised", "hospitalization",
                                       "hospitalisation", "hospitalizations", "admissions"),
            lambda p: ramp(_num("hospitalizations")(p), 0, 3)),
    Concept("polypharmacy", ("polypharmacy", "many medications"),
            lambda p: ramp(_num("medicationCount")(p), 3, 6)),
    Concept("elderly", ("elderly", "older", "senior"),
            lambda p: ramp(_num("age")(p), 60, 75)),
    Concept("long working hours", ("long hours", "long working hours", "overworked"),
            lambda p: ramp(_num("dailyWorkingHours")(p), 8, 12)),
)

_CONCEPT_KEYWORDS = [(c, tuple(tuple(tokenize(k)) for k in c.keywords)) for c in CONCEPTS]


def concept_match(term: tuple[str, ...], keyword: tuple[str, ...]) -> float:
    """Word-by-word match of a term against one concept keyword of equal length."""
    if len(term) != len(keyword):
        return 0.0
    return min(phrase_score((q,), (k,)) for q, k in zip(term, keyword))


@dataclass
class PatientIndex:
    """Normalised, comparison-only view of one patient (the record is untouched)."""

    patient: dict
    id_compact: str
    id_digits: str
    text: dict[str, tuple[str, ...]]


def index_patient(p: dict) -> PatientIndex:
    pid = compact(p.get("id", ""))
    return PatientIndex(
        patient=p,
        id_compact=pid,
        id_digits="".join(c for c in pid if c.isdigit()),
        text={
            "name": tuple(tokenize(f"{p.get('firstName', '')} {p.get('lastName', '')}")),
            "primaryDisease": tuple(tokenize(p.get("primaryDisease", ""))),
            "secondaryDisease": tuple(t for t in tokenize(p.get("secondaryDisease", "")) if t != "none"),
            "doctorNotes": tuple(tokenize(p.get("doctorNotes", ""))),
            "occupation": tuple(tokenize(p.get("occupation", ""))),
            "gender": tuple(tokenize(p.get("gender", ""))),
        },
    )


def _id_score(term: tuple[str, ...], ix: PatientIndex) -> float:
    """Identifiers match exactly or by prefix, never fuzzily: a near-miss
    patient ID is a different patient."""
    q = "".join(term)
    if not q or not ix.id_compact:
        return 0.0
    for target in (ix.id_compact, ix.id_digits):
        if q == target:
            return config.SCORE_EXACT
    for target in (ix.id_compact, ix.id_digits):
        if len(q) >= config.MIN_PREFIX_LEN and target.startswith(q):
            return config.PREFIX_BASE + config.PREFIX_COVERAGE * len(q) / len(target)
    return 0.0


def term_membership(term: tuple[str, ...], ix: PatientIndex) -> float:
    """mu_term(P): weighted maximum of the evidence across fields.

    Taking the maximum (a fuzzy OR across fields) means the same evidence is
    never counted twice, e.g. "forgets" found in both the notes and the
    forgetfulness attribute.
    """
    w = config.FIELD_WEIGHTS
    best = w["id"] * _id_score(term, ix)
    for field, tokens in ix.text.items():
        if best >= w[field]:
            continue  # this field cannot raise the score any further
        best = max(best, w[field] * phrase_score(term, tokens))
    for concept, keywords in _CONCEPT_KEYWORDS:
        match = max(concept_match(term, k) for k in keywords)
        if match > 0:
            best = max(best, w["concept"] * match * concept.membership(ix.patient))
    return best
