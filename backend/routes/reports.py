from __future__ import annotations

from fastapi import APIRouter, HTTPException, Response

from schemas.models import ReportCreate
from services import store

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("")
def list_reports() -> list[dict]:
    return store.list_reports()


@router.post("", status_code=201)
def create_report(payload: ReportCreate) -> dict:
    """Persist a saved analysis. Returns report metadata (a real backend would
    also return a generated PDF URL - here the PDF is produced client-side)."""
    record = store.create_report(payload.model_dump())
    return {**record, "pdfUrl": f"/reports/{record['id']}/download"}


@router.delete("/{report_id}", status_code=204, response_class=Response)
def delete_report(report_id: str) -> Response:
    if not store.delete_report(report_id):
        raise HTTPException(status_code=404, detail="Report not found")
    return Response(status_code=204)
