"""Pydantic schemas for request/response bodies.

Kept intentionally permissive so the mock accepts the full registration form
without rejecting partially-filled demo data.
"""

from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field


class PatientBase(BaseModel):
    firstName: str = ""
    lastName: str = ""
    age: int = 0
    gender: str = ""
    phone: str = ""
    maritalStatus: str = ""
    occupation: str = ""
    education: str = ""
    religion: str = ""
    caregiver: str = "None"
    address: str = ""

    primaryDisease: str = ""
    secondaryDisease: str = "None"
    medicationCount: int = 0
    missedAppointments: int = 0
    hospitalizations: int = 0
    medicationDurationMonths: int = 0

    smoking: str = "No"
    alcohol: str = "No"
    exercise: str = "Sometimes"
    phoneOwnership: str = "Smartphone"
    smsReminders: str = "No"
    dailyWorkingHours: int = 0

    forgetfulness: str = "Rarely"
    transportationIssues: str = "No"
    financialDifficulty: str = "No"
    familySupport: str = "Medium"

    doctorNotes: str = ""


class PatientCreate(PatientBase):
    createdAt: Optional[str] = None


class Patient(PatientBase):
    id: str
    createdAt: str


class AnalyzeRequest(BaseModel):
    patientId: Optional[str] = None
    patient: Optional[PatientBase] = None


class Factor(BaseModel):
    feature: str
    importance: int


class Recommendation(BaseModel):
    title: str
    description: str
    icon: str = "check"


class AnalyzeResponse(BaseModel):
    risk: str
    probability: int
    prediction: str
    confidence: int
    factors: list[Factor]
    recommendations: list[Recommendation]
    disclaimer: str


class ReportCreate(BaseModel):
    patientId: str
    patientName: str
    disease: str
    risk: str
    confidence: int
    probability: int
    doctorNotes: str = ""
    factors: list[Factor] = Field(default_factory=list)


class Report(ReportCreate):
    id: str
    createdAt: str
