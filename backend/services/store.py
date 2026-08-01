"""In-memory data store for the prototype.

Holds patients and saved reports for the lifetime of the process. No database
required. Seeded from mock_data on import.
"""

from __future__ import annotations

import copy
import itertools
from datetime import date

from mock_data.patients import PATIENTS

_patients: dict[str, dict] = {p["id"]: copy.deepcopy(p) for p in PATIENTS}
_reports: dict[str, dict] = {}
_patient_seq = itertools.count(1021)
_report_seq = itertools.count(1)


# ----- Patients ---------------------------------------------------------------
def list_patients() -> list[dict]:
    return sorted(_patients.values(), key=lambda p: p.get("createdAt", ""), reverse=True)


def get_patient(patient_id: str) -> dict | None:
    return _patients.get(patient_id)


def create_patient(data: dict) -> dict:
    new_id = f"P-{next(_patient_seq)}"
    record = {**data, "id": new_id,
              "createdAt": data.get("createdAt") or date.today().isoformat()}
    _patients[new_id] = record
    return record


def update_patient(patient_id: str, data: dict) -> dict | None:
    if patient_id not in _patients:
        return None
    _patients[patient_id] = {**_patients[patient_id], **data, "id": patient_id}
    return _patients[patient_id]


def delete_patient(patient_id: str) -> bool:
    return _patients.pop(patient_id, None) is not None


# ----- Reports ----------------------------------------------------------------
def list_reports() -> list[dict]:
    return sorted(_reports.values(), key=lambda r: r.get("createdAt", ""), reverse=True)


def create_report(data: dict) -> dict:
    new_id = f"R-{next(_report_seq):04d}"
    record = {**data, "id": new_id, "createdAt": date.today().isoformat()}
    _reports[new_id] = record
    return record


def delete_report(report_id: str) -> bool:
    return _reports.pop(report_id, None) is not None
