from __future__ import annotations

from fastapi import APIRouter

from services import store
from services.analysis import analyze_patient

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("")
def get_dashboard() -> dict:
    patients = store.list_patients()

    # Derive live stats from the mock 'model' so the numbers stay consistent
    # with what an analysis would produce.
    results = [(p, analyze_patient(p)) for p in patients]
    probs = [r["probability"] for _, r in results]
    high = [p for p, r in results if r["risk"] == "High"]

    avg_risk = round(sum(probs) / len(probs)) if probs else 0

    recent = [
        {
            "id": p["id"],
            "name": f'{p["firstName"]} {p["lastName"]}',
            "age": p["age"],
            "disease": p["primaryDisease"],
            "risk": r["risk"],
            "probability": r["probability"],
            "date": p.get("createdAt", ""),
        }
        for p, r in results[:8]
    ]

    return {
        "patientsToday": len(patients),
        "highRiskPatients": len(high),
        "averageAdherenceRisk": avg_risk,
        "recentAnalyses": len(store.list_reports()) + 14,
        "recentPatients": recent,
        "riskDistribution": [
            {"name": "Low", "value": sum(1 for _, r in results if r["risk"] == "Low")},
            {"name": "Medium", "value": sum(1 for _, r in results if r["risk"] == "Medium")},
            {"name": "High", "value": len(high)},
        ],
    }
