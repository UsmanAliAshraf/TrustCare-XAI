"""Tunable settings for patient search.

All thresholds and weights live here so the retrieval behaviour can be tuned
in one place. The values are design choices (see SEARCH_IR.md for the
rationale), not constants mandated by IR theory.
"""

from __future__ import annotations

# ---- Input limits -------------------------------------------------------------
MAX_QUERY_LENGTH = 200   # characters; longer queries are rejected
MAX_TERMS = 12           # search terms + filters per query
DEFAULT_LIMIT = 50       # results returned when the caller gives no limit
MAX_LIMIT = 100

# ---- Result selection ---------------------------------------------------------
# A patient is returned only if its membership in the query is at least this.
RELEVANCE_THRESHOLD = 0.5
# A patient is removed by an explicit exclusion (top-level NOT) when its
# membership in the excluded term reaches this. Deliberately lower than the
# relevance threshold, so doubtful matches are excluded rather than kept.
EXCLUSION_THRESHOLD = 0.35

# ---- Token matching (scores are evidence strengths in [0, 1]) -----------------
SCORE_EXACT = 1.0
PREFIX_BASE = 0.75        # prefix score = PREFIX_BASE + PREFIX_COVERAGE * len(q)/len(t)
PREFIX_COVERAGE = 0.2
SCORE_INFIX = 0.6         # query appears inside a word, not at its start
FUZZY_SCALE = 0.8         # fuzzy score = FUZZY_SCALE * similarity
FUZZY_MIN_SIMILARITY = 0.75

MIN_PREFIX_LEN = 3        # shorter query words must match a whole word exactly
MIN_INFIX_LEN = 4
MIN_FUZZY_LEN = 4

# ---- Field weights ------------------------------------------------------------
# How strongly a match in each field indicates the patient is what the doctor
# is looking for. Identification fields and the primary diagnosis rank first.
FIELD_WEIGHTS: dict[str, float] = {
    "id": 1.0,
    "name": 1.0,
    "primaryDisease": 1.0,
    "secondaryDisease": 0.85,
    "concept": 0.9,          # adherence attributes reached through CONCEPTS
    "doctorNotes": 0.7,
    "occupation": 0.6,
    "gender": 0.6,
}

# ---- Structured numeric filters (e.g. age>60) ---------------------------------
NUMERIC_FILTERS: dict[str, str] = {
    "age": "age",
    "meds": "medicationCount",
    "medications": "medicationCount",
    "medication": "medicationCount",
    "missed": "missedAppointments",
    "hospitalizations": "hospitalizations",
    "hospitalisations": "hospitalizations",
    "hosp": "hospitalizations",
    "duration": "medicationDurationMonths",
    "months": "medicationDurationMonths",
    "hours": "dailyWorkingHours",
}
