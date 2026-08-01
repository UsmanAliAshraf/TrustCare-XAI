from __future__ import annotations

import time

from fastapi import APIRouter, HTTPException

from schemas.models import AnalyzeRequest
from services import store
from services.analysis import analyze_patient

router = APIRouter(prefix="/analyze", tags=["analyze"])


@router.post("")
def analyze(payload: AnalyzeRequest) -> dict:
    """Return a mock adherence-risk prediction.

    Accepts either an existing patientId or a full patient object. A short
    server-side delay simulates real inference latency (the frontend also
    shows its own loading animation).
    """
    if payload.patientId:
        patient = store.get_patient(payload.patientId)
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
    elif payload.patient:
        patient = payload.patient.model_dump()
    else:
        raise HTTPException(status_code=422, detail="Provide patientId or patient")

    time.sleep(0.8)  # simulate inference latency
    return analyze_patient(patient)
