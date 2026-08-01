from __future__ import annotations

from fastapi import APIRouter, HTTPException, Response

from schemas.models import Patient, PatientCreate
from services import store

router = APIRouter(prefix="/patients", tags=["patients"])


@router.get("")
def list_patients() -> list[dict]:
    return store.list_patients()


@router.get("/{patient_id}")
def get_patient(patient_id: str) -> dict:
    patient = store.get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


@router.post("", status_code=201)
def create_patient(payload: PatientCreate) -> dict:
    return store.create_patient(payload.model_dump())


@router.put("/{patient_id}")
def update_patient(patient_id: str, payload: PatientCreate) -> dict:
    updated = store.update_patient(patient_id, payload.model_dump())
    if not updated:
        raise HTTPException(status_code=404, detail="Patient not found")
    return updated


@router.delete("/{patient_id}", status_code=204, response_class=Response)
def delete_patient(patient_id: str) -> Response:
    if not store.delete_patient(patient_id):
        raise HTTPException(status_code=404, detail="Patient not found")
    return Response(status_code=204)
