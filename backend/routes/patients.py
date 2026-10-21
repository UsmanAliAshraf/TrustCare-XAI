from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Response

from schemas.models import Patient, PatientCreate
from services import store
from services.search import QueryError, search_patients
from services.search import config as search_config

router = APIRouter(prefix="/patients", tags=["patients"])


@router.get("")
def list_patients() -> list[dict]:
    return store.list_patients()


@router.get("/search")
def search(
    q: str = Query("", description="Search text. Supports AND, OR, NOT, ( ), quotes and filters such as age>60."),
    limit: int = Query(search_config.DEFAULT_LIMIT, ge=1, le=search_config.MAX_LIMIT),
) -> list[dict]:
    """Ranked patient search (fuzzy + Extended Boolean IR model).

    Returns patient records in the same shape as GET /patients, most relevant
    first. Relevance scores stay internal and are never part of the response.
    """
    # Search only the records this caller may list. The prototype has no
    # per-doctor access control yet, so that is the same set GET /patients
    # returns; once it exists, pass the doctor's permitted patients here.
    visible = store.list_patients()
    try:
        hits = search_patients(q, visible, limit=limit)
    except QueryError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from None
    return [hit.patient for hit in hits]


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
