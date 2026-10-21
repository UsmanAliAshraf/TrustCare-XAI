"""Query parsing: text -> abstract syntax tree.

Grammar (operators are case-insensitive; precedence NOT > AND > OR):

    query    := or_expr
    or_expr  := and_expr ( OR and_expr )*
    and_expr := not_expr ( [AND] not_expr )*      adjacency = implicit AND
    not_expr := NOT not_expr | primary
    primary  := "(" or_expr ")" | TERM | "quoted phrase" | FILTER

    TERM     := consecutive plain words, matched together as one phrase
    FILTER   := field (> | >= | < | <= | =) number, e.g. age>60, missed>=2

Malformed input raises QueryError with a message safe to show the user. The
query is only ever interpreted by this parser; it never reaches eval, SQL or
any other interpreter.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Union

from . import config
from .text import normalize


class QueryError(ValueError):
    """The query is malformed; the message explains why."""


# ---- AST ---------------------------------------------------------------------
@dataclass(frozen=True)
class Term:
    tokens: tuple[str, ...]


@dataclass(frozen=True)
class Filter:
    field: str      # patient attribute, e.g. "age"
    op: str         # one of > >= < <= =
    value: int


@dataclass(frozen=True)
class Not:
    child: "Node"


@dataclass(frozen=True)
class And:
    children: tuple["Node", ...]


@dataclass(frozen=True)
class Or:
    children: tuple["Node", ...]


Node = Union[Term, Filter, Not, And, Or]


# ---- Lexer -------------------------------------------------------------------
_TOKEN = re.compile(
    r"""
    (?P<space>\s+)
  | (?P<lparen>\()
  | (?P<rparen>\))
  | (?P<quote>"[^"]*")
  | (?P<filter>[A-Za-z]+\s*(?:>=|<=|>|<|=)\s*\d{1,5}(?![\w.]))
  | (?P<word>[^\s()"]+)
    """,
    re.VERBOSE,
)
_FILTER = re.compile(r"([A-Za-z]+)\s*(>=|<=|>|<|=)\s*(\d+)")
_OPERATORS = {"and": "AND", "or": "OR", "not": "NOT"}


def _lex(text: str) -> list[tuple[str, object]]:
    tokens: list[tuple[str, object]] = []
    pos = 0
    while pos < len(text):
        m = _TOKEN.match(text, pos)
        if not m:  # only an unmatched quote can get here
            raise QueryError('Unclosed quotation mark (").')
        pos = m.end()
        kind, value = m.lastgroup, m.group()
        if kind == "space":
            continue
        if kind in ("lparen", "rparen"):
            tokens.append((kind, value))
        elif kind == "quote":
            words = tuple(normalize(value[1:-1]).split())
            if not words:
                raise QueryError("Quoted phrase is empty.")
            tokens.append(("phrase", words))
        elif kind == "filter":
            name, op, number = _FILTER.fullmatch(value).groups()
            field = config.NUMERIC_FILTERS.get(name.lower())
            if not field:
                names = ", ".join(sorted(set(config.NUMERIC_FILTERS)))
                raise QueryError(f"Unknown filter '{name}'. Filters available: {names}.")
            tokens.append(("filter", Filter(field, op, int(number))))
        else:
            if any(c in value for c in "<>="):
                raise QueryError(f"Malformed filter '{value}'. Use the form age>60.")
            op = _OPERATORS.get(value.lower())
            if op:
                tokens.append(("op", op))
            else:
                words = normalize(value).split()
                if words:  # pure punctuation is ignored
                    tokens.append(("word", tuple(words)))
    return tokens


# ---- Parser ------------------------------------------------------------------
class _Parser:
    def __init__(self, tokens: list[tuple[str, object]]):
        self.tokens = tokens
        self.i = 0
        self.terms = 0

    def peek(self) -> tuple[str, object] | None:
        return self.tokens[self.i] if self.i < len(self.tokens) else None

    def is_op(self, name: str) -> bool:
        tok = self.peek()
        return tok is not None and tok == ("op", name)

    def starts_operand(self) -> bool:
        tok = self.peek()
        return tok is not None and (tok[0] in ("lparen", "word", "phrase", "filter") or tok == ("op", "NOT"))

    def parse(self) -> Node:
        node = self.or_expr()
        tok = self.peek()
        if tok is not None:
            raise QueryError("Unexpected ')'." if tok[0] == "rparen" else "Unexpected operator.")
        return node

    def or_expr(self) -> Node:
        children = [self.and_expr()]
        while self.is_op("OR"):
            self.i += 1
            if not self.starts_operand():
                raise QueryError("OR must be followed by a search term.")
            children.append(self.and_expr())
        return children[0] if len(children) == 1 else Or(tuple(children))

    def and_expr(self) -> Node:
        children = [self.not_expr()]
        while True:
            if self.is_op("AND"):
                self.i += 1
                if not self.starts_operand():
                    raise QueryError("AND must be followed by a search term.")
            elif not self.starts_operand():
                break
            children.append(self.not_expr())
        return children[0] if len(children) == 1 else And(tuple(children))

    def not_expr(self) -> Node:
        if self.is_op("NOT"):
            self.i += 1
            if not self.starts_operand():
                raise QueryError("NOT must be followed by a search term.")
            return Not(self.not_expr())
        return self.primary()

    def primary(self) -> Node:
        tok = self.peek()
        if tok is None:
            raise QueryError("Query is incomplete.")
        kind, value = tok
        if kind == "lparen":
            self.i += 1
            if self.peek() is not None and self.peek()[0] == "rparen":
                raise QueryError("Empty parentheses.")
            node = self.or_expr()
            if self.peek() is None or self.peek()[0] != "rparen":
                raise QueryError("Missing closing parenthesis.")
            self.i += 1
            return node
        if kind == "rparen":
            raise QueryError("Unexpected ')'.")
        if kind == "op":
            raise QueryError(f"{value} must come between two search terms.")
        self.count_term()
        self.i += 1
        if kind == "filter":
            return value  # type: ignore[return-value]
        if kind == "phrase":
            return Term(value)  # type: ignore[arg-type]
        # Consecutive plain words form one phrase term.
        words = list(value)  # type: ignore[arg-type]
        while self.peek() is not None and self.peek()[0] == "word":
            words.extend(self.peek()[1])  # type: ignore[arg-type]
            self.i += 1
        return Term(tuple(words))

    def count_term(self) -> None:
        self.terms += 1
        if self.terms > config.MAX_TERMS:
            raise QueryError(f"Too many search terms (maximum {config.MAX_TERMS}).")


def parse_query(text: str) -> Node | None:
    """Parse a query. Returns None for an empty query; raises QueryError if malformed."""
    if len(text) > config.MAX_QUERY_LENGTH:
        raise QueryError(f"Query is too long (maximum {config.MAX_QUERY_LENGTH} characters).")
    tokens = _lex(text)
    if not tokens:
        return None
    return _Parser(tokens).parse()
