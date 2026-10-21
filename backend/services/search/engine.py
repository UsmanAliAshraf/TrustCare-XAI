"""Fuzzy Boolean evaluation, Extended Boolean exclusion and ranking.

Search relevance is unrelated to the adherence-risk model: these scores only
order search results and are never returned, stored, or shown as clinical risk.
"""

from __future__ import annotations

import operator
from dataclasses import dataclass

from . import config
from .fields import PatientIndex, index_patient, term_membership
from .query import And, Filter, Node, Not, Or, Term, parse_query

_COMPARE = {">": operator.gt, ">=": operator.ge, "<": operator.lt, "<=": operator.le, "=": operator.eq}


# ---- Fuzzy set operators (Week 6) -------------------------------------------
def fuzzy_and(*values: float) -> float:
    """mu(A AND B) = min(a, b)"""
    return min(values)


def fuzzy_or(*values: float) -> float:
    """mu(A OR B) = max(a, b)"""
    return max(values)


def fuzzy_not(value: float) -> float:
    """mu(NOT A) = 1 - a"""
    return 1.0 - value


def membership(node: Node, ix: PatientIndex) -> float:
    """mu_q(P) in [0, 1] for any query node."""
    if isinstance(node, Term):
        return term_membership(node.tokens, ix)
    if isinstance(node, Filter):
        try:
            value = float(ix.patient.get(node.field) or 0)
        except (TypeError, ValueError):
            return 0.0
        return 1.0 if _COMPARE[node.op](value, node.value) else 0.0
    if isinstance(node, Not):
        return fuzzy_not(membership(node.child, ix))
    if isinstance(node, And):
        return fuzzy_and(*(membership(c, ix) for c in node.children))
    if isinstance(node, Or):
        return fuzzy_or(*(membership(c, ix) for c in node.children))
    raise TypeError(f"Unknown query node: {node!r}")


# ---- Extended Boolean exclusion ---------------------------------------------
def exclusion_clauses(root: Node) -> list[Node]:
    """Clauses the doctor explicitly excluded: a NOT at the top level of the
    query, either on its own or as one of the top-level AND operands.

    "(A OR B) AND NOT C" -> [C], giving the set (A u B) - C. A NOT nested
    elsewhere, e.g. "A OR NOT B", stays a pure fuzzy complement (1 - mu).
    """
    if isinstance(root, Not):
        return [root.child]
    if isinstance(root, And):
        return [c.child for c in root.children if isinstance(c, Not)]
    return []


@dataclass(frozen=True)
class SearchHit:
    """Internal ranking record. `score` must never leave the service layer."""

    patient: dict
    score: float


def search_patients(query: str, patients: list[dict], limit: int = config.DEFAULT_LIMIT) -> list[SearchHit]:
    """Rank `patients` against `query`.

    `patients` must already be limited to the records the caller may see:
    search never looks beyond the list it is given. Its order is the
    tie-breaker for equal scores, so passing the existing list order keeps
    ties stable and deterministic.

    Raises QueryError for malformed queries; an empty query returns [].
    """
    root = parse_query(query.strip())
    if root is None:
        return []
    limit = max(1, min(limit, config.MAX_LIMIT))
    exclusions = exclusion_clauses(root)

    ranked: list[tuple[float, int, dict]] = []
    for position, patient in enumerate(patients):
        ix = index_patient(patient)
        # Strict exclusion first: an excluded patient is dropped outright,
        # whatever its fuzzy score would have been.
        if any(membership(c, ix) >= config.EXCLUSION_THRESHOLD for c in exclusions):
            continue
        score = membership(root, ix)
        if score >= config.RELEVANCE_THRESHOLD:
            ranked.append((round(score, 9), position, patient))

    ranked.sort(key=lambda r: (-r[0], r[1]))
    return [SearchHit(patient=p, score=s) for s, _, p in ranked[:limit]]
