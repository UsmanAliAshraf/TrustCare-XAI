"""Fuzzy / Extended Boolean patient search (Week 6 IR models).

    text.py    normalisation, Levenshtein similarity, token matching
    query.py   lexer + recursive-descent parser for AND / OR / NOT / ( )
    fields.py  searchable fields, adherence concepts, membership functions
    engine.py  fuzzy operators, exclusion, thresholding and ranking
    config.py  thresholds and weights

See SEARCH_IR.md at the repository root for the full description.
"""

from .engine import SearchHit, fuzzy_and, fuzzy_not, fuzzy_or, search_patients
from .query import QueryError, parse_query

__all__ = [
    "QueryError",
    "SearchHit",
    "fuzzy_and",
    "fuzzy_not",
    "fuzzy_or",
    "parse_query",
    "search_patients",
]
