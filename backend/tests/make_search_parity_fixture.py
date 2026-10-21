"""Write the expected results the frontend search port is checked against.

The Python search package is the reference implementation. This script runs a
set of queries over the synthetic dataset and saves the ranked patient IDs (or
the error message) to frontend/tests/search-parity.json. The Node test
frontend/tests/search-parity.test.ts asserts the TypeScript port in
frontend/src/lib/search.ts returns exactly the same output.

Regenerate after changing the search logic or the dataset:

    python tests/make_search_parity_fixture.py      (from the backend folder)
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from mock_data.patients import load_patients  # noqa: E402
from services.search import QueryError, search_patients  # noqa: E402

QUERIES = [
    "kwame walsh", "kwam", "KWAME", "o'connor", "P-1001", "1001", "p-10",
    "diabetes", "diabetis", "type 2 diabetes", "hypertensoin", "dep", "de", "2",
    "forgets", "forgetful", "forgetfullness", "financial", "transport", "missed appointments",
    "low support", "no caregiver", "smoker", "elderly", "polypharmacy", "hospitalized",
    '"pill organiser"', "pharmacy", "nurse", "retired", "female",
    "diabetes AND forgetfulness", "diabetes forgetful", "diabetes OR hypertension",
    "diabetes AND NOT hypertension", "(diabetes OR hypertension) AND NOT type 1",
    "(diabetes OR hypertension) AND forgetfulness", "copd OR asthma AND smoker",
    "NOT hypertension", "depression OR NOT anxiety", "age>80", "diabetes age>70",
    "missed>=3 AND financial", "xylophone", "", "   ",
    "(diabetes", "diabetes)", "AND diabetes", "diabetes AND", "()", '"open',
    "age>>5", "weight>80",
]


def main() -> None:
    patients = load_patients()
    cases = []
    for q in QUERIES:
        try:
            cases.append({"query": q, "ids": [h.patient["id"] for h in search_patients(q, patients)]})
        except QueryError as exc:
            cases.append({"query": q, "error": str(exc)})
    out = ROOT / "frontend" / "tests" / "search-parity.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(cases, indent=1) + "\n", encoding="utf-8")
    print(f"Wrote {len(cases)} cases to {out}")


if __name__ == "__main__":
    main()
