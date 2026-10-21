// Client-side mock engine.
//
// This mirrors the FastAPI mock backend so the frontend runs completely
// standalone (no Python required) for demos. The API layer (`client.ts`)
// prefers the live backend and transparently falls back to this engine when
// the backend is unreachable. There is NO ML model here - risk is derived
// from recorded risk factors, identical in spirit to `backend/services`.

import type {
  AnalysisResult,
  DashboardStats,
  Factor,
  Patient,
  PatientInput,
  Recommendation,
  Report,
  ReportInput,
  RiskLevel,
} from './types'
import syntheticPatients from '@data/synthetic_patients.json'

const DEFAULTS: Omit<Patient, 'id' | 'createdAt'> = {
  firstName: '', lastName: '', age: 0, gender: 'Female', phone: '',
  maritalStatus: 'Single', occupation: '', education: 'High School',
  religion: 'None', caregiver: 'None', address: '',
  primaryDisease: '', secondaryDisease: 'None', medicationCount: 0,
  missedAppointments: 0, hospitalizations: 0, medicationDurationMonths: 0,
  smoking: 'No', alcohol: 'No', exercise: 'Sometimes', phoneOwnership: 'Smartphone',
  smsReminders: 'No', dailyWorkingHours: 0, forgetfulness: 'Rarely',
  transportationIssues: 'No', financialDifficulty: 'No', familySupport: 'Medium',
  doctorNotes: '',
}

// Seed records come from the shared synthetic dataset (data/synthetic_patients.json
// at the repository root, produced by data/generate_synthetic_patients.py), the
// same file the FastAPI backend loads.
export const SEED_PATIENTS: Patient[] = (syntheticPatients as Partial<Patient>[]).map((p) => ({
  ...DEFAULTS,
  ...p,
})) as Patient[]

// ---- Mock 'model' -----------------------------------------------------------
type RawFactor = { feature: string; raw: number }

function factorWeights(p: Partial<Patient>): { factors: RawFactor[]; protective: number } {
  const factors: RawFactor[] = []
  const s = (v: unknown) => String(v ?? '').trim().toLowerCase()

  const med = Number(p.medicationCount ?? 0)
  if (med >= 3) factors.push({ feature: 'Medication Count', raw: Math.min(med * 4, 24) })

  const missed = Number(p.missedAppointments ?? 0)
  if (missed >= 1) factors.push({ feature: 'Previous Missed Appointments', raw: Math.min(missed * 6, 24) })

  if (s(p.caregiver) === '' || s(p.caregiver) === 'none')
    factors.push({ feature: 'No Caregiver', raw: 18 })

  const hours = Number(p.dailyWorkingHours ?? 0)
  if (hours >= 10) factors.push({ feature: 'Long Working Hours', raw: 14 })

  if (s(p.financialDifficulty) === 'yes') factors.push({ feature: 'Financial Difficulty', raw: 15 })

  const forget = s(p.forgetfulness)
  if (forget === 'often' || forget === 'sometimes')
    factors.push({ feature: 'Medication Forgetfulness', raw: forget === 'often' ? 20 : 11 })

  if (s(p.transportationIssues) === 'yes') factors.push({ feature: 'Transportation Issues', raw: 12 })
  if (s(p.familySupport) === 'low') factors.push({ feature: 'Low Family Support', raw: 13 })
  if (s(p.smsReminders) === 'no') factors.push({ feature: 'No SMS Reminders', raw: 8 })

  const hosp = Number(p.hospitalizations ?? 0)
  if (hosp >= 2) factors.push({ feature: 'Prior Hospitalizations', raw: 10 })
  if (Number(p.age ?? 0) >= 65) factors.push({ feature: 'Advanced Age', raw: 9 })

  let protective = 0
  if (s(p.familySupport) === 'high') protective += 10
  if (s(p.smsReminders) === 'yes') protective += 8
  if (forget === 'rarely') protective += 8
  if (s(p.exercise) === 'regularly') protective += 5

  return { factors, protective }
}

function recommend(p: Partial<Patient>, top: Set<string>): Recommendation[] {
  const recs: Recommendation[] = []
  const s = (v: unknown) => String(v ?? '').trim().toLowerCase()
  if (top.has('No SMS Reminders') || s(p.smsReminders) === 'no')
    recs.push({ title: 'Medication Reminder', description: 'Enable SMS or app-based reminders to prompt each dose.', icon: 'bell' })
  if (top.has('No Caregiver') || top.has('Low Family Support'))
    recs.push({ title: 'Caregiver Support', description: 'Encourage a family member to supervise and support medications.', icon: 'users' })
  if (top.has('Medication Count'))
    recs.push({ title: 'Medication Review', description: 'Consider simplifying or consolidating the medication schedule.', icon: 'clipboard' })
  if (top.has('Financial Difficulty'))
    recs.push({ title: 'Financial Assistance', description: 'Discuss generic alternatives and patient assistance programs.', icon: 'wallet' })
  if (top.has('Transportation Issues'))
    recs.push({ title: 'Delivery / Telehealth', description: 'Arrange pharmacy delivery or telehealth follow-ups.', icon: 'truck' })
  recs.push({ title: 'Follow-up Visit', description: 'Schedule a review within one week to reassess adherence.', icon: 'calendar' })
  return recs
}

export function analyzePatient(p: Partial<Patient>): AnalysisResult {
  const { factors, protective } = factorWeights(p)
  const rawTotal = factors.reduce((a, f) => a + f.raw, 0)
  // Tuned scale/offset so scores spread across the range rather than saturating.
  const net = rawTotal - protective
  const probability = Math.max(4, Math.min(96, Math.round(net * 0.45 + 22)))

  let risk: RiskLevel
  let prediction: string
  if (probability >= 66) { risk = 'High'; prediction = 'Likely Non-Adherent' }
  else if (probability >= 38) { risk = 'Medium'; prediction = 'Possibly Non-Adherent' }
  else { risk = 'Low'; prediction = 'Likely Adherent' }

  factors.sort((a, b) => b.raw - a.raw)
  const top = factors.slice(0, 5)
  const totalTop = top.reduce((a, f) => a + f.raw, 0) || 1
  const contributions: Factor[] = top.map((f) => ({
    feature: f.feature,
    importance: Math.round((f.raw / totalTop) * 100),
  }))
  if (contributions.length) {
    const drift = 100 - contributions.reduce((a, c) => a + c.importance, 0)
    contributions[0].importance += drift
  }

  const distance = Math.min(
    Math.abs(probability - 38), Math.abs(probability - 66), probability, 100 - probability,
  )
  const confidence = Math.max(72, Math.min(97, 74 + distance))

  return {
    risk,
    probability,
    prediction,
    confidence,
    factors: contributions,
    recommendations: recommend(p, new Set(contributions.map((c) => c.feature))),
    disclaimer:
      'Prediction generated by a mock engine for demonstration only. No machine-learning model is used in this prototype.',
  }
}

export function buildDashboard(patients: Patient[], reportCount: number): DashboardStats {
  const results = patients.map((p) => ({ p, r: analyzePatient(p) }))
  const probs = results.map((x) => x.r.probability)
  const high = results.filter((x) => x.r.risk === 'High')
  const avg = probs.length ? Math.round(probs.reduce((a, b) => a + b, 0) / probs.length) : 0

  return {
    patientsToday: patients.length,
    highRiskPatients: high.length,
    averageAdherenceRisk: avg,
    recentAnalyses: reportCount + 14,
    recentPatients: results.slice(0, 8).map(({ p, r }) => ({
      id: p.id,
      name: `${p.firstName} ${p.lastName}`,
      age: p.age,
      disease: p.primaryDisease,
      risk: r.risk,
      probability: r.probability,
      date: p.createdAt,
    })),
    riskDistribution: [
      { name: 'Low', value: results.filter((x) => x.r.risk === 'Low').length },
      { name: 'Medium', value: results.filter((x) => x.r.risk === 'Medium').length },
      { name: 'High', value: high.length },
    ],
  }
}

// ---- In-memory store (persisted to localStorage so demos survive reloads) ---
// Versioned so browsers holding the old hand-written seed pick up the dataset.
const LS_PATIENTS = 'trustcare.patients.synthetic-v1'
const LS_REPORTS = 'trustcare.reports'

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function save<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

let patients: Patient[] = load<Patient[]>(LS_PATIENTS, SEED_PATIENTS)
let reports: Report[] = load<Report[]>(LS_REPORTS, [])
let patientSeq = Math.max(...patients.map((p) => Number(p.id.split('-')[1]) || 0), 1000) + 1
let reportSeq = 1

export const mockStore = {
  listPatients(): Patient[] {
    return [...patients].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  },
  getPatient(id: string): Patient | undefined {
    return patients.find((p) => p.id === id)
  },
  createPatient(data: PatientInput): Patient {
    const record: Patient = {
      ...(DEFAULTS as Patient),
      ...data,
      id: `P-${patientSeq++}`,
      createdAt: data.createdAt || new Date().toISOString().slice(0, 10),
    }
    patients = [record, ...patients]
    save(LS_PATIENTS, patients)
    return record
  },
  updatePatient(id: string, data: PatientInput): Patient | undefined {
    const idx = patients.findIndex((p) => p.id === id)
    if (idx < 0) return undefined
    patients[idx] = { ...patients[idx], ...data, id }
    save(LS_PATIENTS, patients)
    return patients[idx]
  },
  deletePatient(id: string): boolean {
    const before = patients.length
    patients = patients.filter((p) => p.id !== id)
    save(LS_PATIENTS, patients)
    return patients.length < before
  },
  listReports(): Report[] {
    return [...reports].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  },
  createReport(data: ReportInput): Report {
    const record: Report = {
      ...data,
      id: `R-${String(reportSeq++).padStart(4, '0')}`,
      createdAt: new Date().toISOString().slice(0, 10),
    }
    reports = [record, ...reports]
    save(LS_REPORTS, reports)
    return record
  },
  deleteReport(id: string): boolean {
    const before = reports.length
    reports = reports.filter((r) => r.id !== id)
    save(LS_REPORTS, reports)
    return reports.length < before
  },
  reportCount(): number {
    return reports.length
  },
}
