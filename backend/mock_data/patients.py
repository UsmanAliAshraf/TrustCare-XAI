"""Seed data for the TrustCare XAI prototype.

Patients are loaded from the synthetic dataset in `data/synthetic_patients.json`
(repository root) rather than written out by hand here. The dataset is produced
by `data/generate_synthetic_patients.py`; regenerate it with:

    python data/generate_synthetic_patients.py --count 120 --seed 42

Every record mirrors the fields collected on the Patient Registration form, so
the mock backend behaves like the real one. No real people are described.
"""

from __future__ import annotations

import json
from pathlib import Path

DATASET = Path(__file__).resolve().parents[2] / "data" / "synthetic_patients.json"


def load_patients(path: Path = DATASET) -> list[dict]:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


PATIENTS: list[dict] = load_patients()
