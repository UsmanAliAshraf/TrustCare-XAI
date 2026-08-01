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

const mk = (id: string, createdAt: string, o: Partial<Patient>): Patient => ({
  ...DEFAULTS, id, createdAt, ...o,
})

export const SEED_PATIENTS: Patient[] = [
  mk('P-1001', '2026-07-28', { firstName: 'Amelia', lastName: 'Hughes', age: 67, gender: 'Female', phone: '+1 202 555 0143', maritalStatus: 'Widowed', occupation: 'Retired', religion: 'Christianity', caregiver: 'None', address: '14 Maple Street, Springfield', primaryDisease: 'Type 2 Diabetes', secondaryDisease: 'Hypertension', medicationCount: 6, missedAppointments: 4, hospitalizations: 2, medicationDurationMonths: 48, exercise: 'Rarely', phoneOwnership: 'Basic phone', forgetfulness: 'Often', transportationIssues: 'Yes', financialDifficulty: 'Yes', familySupport: 'Low', doctorNotes: 'Lives alone, struggles to keep track of a complex regimen.' }),
  mk('P-1002', '2026-07-30', { firstName: 'Daniel', lastName: 'Foster', age: 34, gender: 'Male', phone: '+1 202 555 0111', maritalStatus: 'Married', occupation: 'Software Engineer', education: "Master's", caregiver: 'Spouse', address: '88 Oakwood Avenue, Portland', primaryDisease: 'Asthma', medicationCount: 2, medicationDurationMonths: 12, alcohol: 'Occasionally', exercise: 'Regularly', smsReminders: 'Yes', dailyWorkingHours: 8, familySupport: 'High', doctorNotes: 'Well controlled, uses a reminder app.' }),
  mk('P-1003', '2026-07-29', { firstName: 'Sofia', lastName: 'Martinez', age: 52, gender: 'Female', phone: '+1 202 555 0190', maritalStatus: 'Divorced', occupation: 'Nurse', education: "Bachelor's", religion: 'Christianity', caregiver: 'None', address: '5 Riverbend Road, Austin', primaryDisease: 'Hypertension', secondaryDisease: 'High Cholesterol', medicationCount: 4, missedAppointments: 2, hospitalizations: 1, medicationDurationMonths: 30, alcohol: 'Occasionally', dailyWorkingHours: 12, forgetfulness: 'Sometimes', doctorNotes: 'Long shifts make timing doses difficult.' }),
  mk('P-1004', '2026-07-27', { firstName: 'Mohammed', lastName: 'Rahman', age: 71, gender: 'Male', phone: '+1 202 555 0177', maritalStatus: 'Married', occupation: 'Retired', education: 'Primary', religion: 'Islam', caregiver: 'Daughter', address: '23 Cedar Lane, Detroit', primaryDisease: 'Congestive Heart Failure', secondaryDisease: 'Type 2 Diabetes', medicationCount: 8, missedAppointments: 5, hospitalizations: 3, medicationDurationMonths: 60, smoking: 'Former', exercise: 'Rarely', phoneOwnership: 'None', forgetfulness: 'Often', transportationIssues: 'Yes', financialDifficulty: 'Yes', doctorNotes: 'Polypharmacy; daughter assists but works full time.' }),
  mk('P-1005', '2026-08-01', { firstName: 'Grace', lastName: 'Nguyen', age: 28, gender: 'Female', phone: '+1 202 555 0122', occupation: 'Graphic Designer', education: "Bachelor's", religion: 'Buddhism', address: '9 Sunset Blvd, San Diego', primaryDisease: 'Migraine', medicationCount: 1, missedAppointments: 1, medicationDurationMonths: 6, alcohol: 'Occasionally', exercise: 'Regularly', smsReminders: 'Yes', dailyWorkingHours: 8, familySupport: 'High', doctorNotes: 'Occasional missed dose during travel.' }),
  mk('P-1006', '2026-07-25', { firstName: 'James', lastName: "O'Connor", age: 59, gender: 'Male', phone: '+1 202 555 0155', maritalStatus: 'Married', occupation: 'Truck Driver', religion: 'Christianity', caregiver: 'Spouse', address: '41 Industrial Way, Cleveland', primaryDisease: 'COPD', secondaryDisease: 'Hypertension', medicationCount: 5, missedAppointments: 3, hospitalizations: 2, medicationDurationMonths: 36, smoking: 'Yes', alcohol: 'Regularly', exercise: 'Rarely', dailyWorkingHours: 14, forgetfulness: 'Often', financialDifficulty: 'Yes', doctorNotes: 'On the road for long stretches; irregular schedule.' }),
  mk('P-1007', '2026-07-31', { firstName: 'Priya', lastName: 'Patel', age: 45, gender: 'Female', phone: '+1 202 555 0166', maritalStatus: 'Married', occupation: 'Teacher', education: "Master's", religion: 'Hinduism', caregiver: 'Spouse', address: '12 Elm Court, Raleigh', primaryDisease: 'Hypothyroidism', medicationCount: 1, medicationDurationMonths: 24, exercise: 'Regularly', smsReminders: 'Yes', dailyWorkingHours: 7, familySupport: 'High', doctorNotes: 'Highly adherent, stable on levothyroxine.' }),
  mk('P-1008', '2026-07-26', { firstName: 'Robert', lastName: 'Kim', age: 63, gender: 'Male', phone: '+1 202 555 0188', maritalStatus: 'Widowed', occupation: 'Retired', education: "Bachelor's", religion: 'Christianity', caregiver: 'None', address: '77 Hillcrest Drive, Denver', primaryDisease: "Parkinson's Disease", secondaryDisease: 'Depression', medicationCount: 7, missedAppointments: 4, hospitalizations: 1, medicationDurationMonths: 42, exercise: 'Rarely', phoneOwnership: 'Basic phone', forgetfulness: 'Often', transportationIssues: 'Yes', familySupport: 'Low', doctorNotes: 'Complex timing-sensitive regimen; lives alone.' }),
  mk('P-1009', '2026-07-30', { firstName: 'Emily', lastName: 'Carter', age: 39, gender: 'Female', phone: '+1 202 555 0133', occupation: 'Accountant', education: "Bachelor's", address: '3 Birch Street, Boston', primaryDisease: 'Epilepsy', secondaryDisease: 'Anxiety', medicationCount: 3, missedAppointments: 1, hospitalizations: 1, medicationDurationMonths: 18, alcohol: 'Occasionally', smsReminders: 'Yes', dailyWorkingHours: 9, forgetfulness: 'Sometimes', doctorNotes: 'Generally adherent, occasional lapses under stress.' }),
  mk('P-1010', '2026-07-24', { firstName: 'Carlos', lastName: 'Reyes', age: 55, gender: 'Male', phone: '+1 202 555 0144', maritalStatus: 'Married', occupation: 'Construction Worker', education: 'Primary', religion: 'Christianity', caregiver: 'Spouse', address: '60 Valley Road, Phoenix', primaryDisease: 'Type 2 Diabetes', secondaryDisease: 'Chronic Kidney Disease', medicationCount: 6, missedAppointments: 3, hospitalizations: 2, medicationDurationMonths: 40, smoking: 'Yes', alcohol: 'Regularly', dailyWorkingHours: 11, forgetfulness: 'Sometimes', transportationIssues: 'Yes', financialDifficulty: 'Yes', doctorNotes: 'Cost of insulin is a recurring barrier.' }),
  mk('P-1011', '2026-08-01', { firstName: 'Hannah', lastName: 'Lee', age: 31, gender: 'Female', phone: '+1 202 555 0199', maritalStatus: 'Married', occupation: 'Pharmacist', education: 'Doctorate', religion: 'Christianity', caregiver: 'Spouse', address: '18 Garden Terrace, Seattle', primaryDisease: 'Rheumatoid Arthritis', medicationCount: 2, medicationDurationMonths: 15, exercise: 'Regularly', smsReminders: 'Yes', dailyWorkingHours: 8, familySupport: 'High', doctorNotes: 'Excellent health literacy and adherence.' }),
  mk('P-1012', '2026-07-28', { firstName: 'William', lastName: 'Turner', age: 74, gender: 'Male', phone: '+1 202 555 0101', maritalStatus: 'Married', occupation: 'Retired', religion: 'Christianity', caregiver: 'Spouse', address: '29 Lakeview Drive, Orlando', primaryDisease: 'Atrial Fibrillation', secondaryDisease: 'Hypertension', medicationCount: 5, missedAppointments: 2, hospitalizations: 1, medicationDurationMonths: 50, smoking: 'Former', alcohol: 'Occasionally', phoneOwnership: 'Basic phone', forgetfulness: 'Sometimes', familySupport: 'High', doctorNotes: 'Spouse manages a pill organizer; mostly adherent.' }),
  mk('P-1013', '2026-07-26', { firstName: 'Fatima', lastName: 'Al-Sayed', age: 48, gender: 'Female', phone: '+1 202 555 0102', maritalStatus: 'Married', occupation: 'Homemaker', religion: 'Islam', caregiver: 'Spouse', address: '7 Rosewood Ave, Houston', primaryDisease: 'Type 2 Diabetes', secondaryDisease: 'Depression', medicationCount: 5, missedAppointments: 3, medicationDurationMonths: 28, exercise: 'Rarely', forgetfulness: 'Often', transportationIssues: 'Yes', financialDifficulty: 'Yes', familySupport: 'Low', doctorNotes: 'Low mood affecting motivation for self-care.' }),
  mk('P-1014', '2026-07-29', { firstName: 'Noah', lastName: 'Bennett', age: 22, gender: 'Male', phone: '+1 202 555 0103', occupation: 'Student', education: "Bachelor's", caregiver: 'Parent', address: '34 College Road, Ann Arbor', primaryDisease: 'Type 1 Diabetes', medicationCount: 3, missedAppointments: 2, hospitalizations: 1, medicationDurationMonths: 20, alcohol: 'Occasionally', exercise: 'Regularly', smsReminders: 'Yes', dailyWorkingHours: 4, forgetfulness: 'Sometimes', doctorNotes: 'Busy campus life; occasional missed boluses.' }),
  mk('P-1015', '2026-07-27', { firstName: 'Olivia', lastName: 'Scott', age: 66, gender: 'Female', phone: '+1 202 555 0104', maritalStatus: 'Widowed', occupation: 'Retired', education: "Bachelor's", religion: 'Christianity', caregiver: 'None', address: '51 Meadow Lane, Columbus', primaryDisease: 'Osteoporosis', secondaryDisease: 'Hypertension', medicationCount: 4, missedAppointments: 3, hospitalizations: 1, medicationDurationMonths: 33, exercise: 'Rarely', phoneOwnership: 'Basic phone', forgetfulness: 'Often', transportationIssues: 'Yes', familySupport: 'Low', doctorNotes: 'Isolated; misses weekly bisphosphonate dosing.' }),
  mk('P-1016', '2026-07-30', { firstName: 'Ethan', lastName: 'Walsh', age: 41, gender: 'Male', phone: '+1 202 555 0105', maritalStatus: 'Divorced', occupation: 'Sales Manager', education: "Bachelor's", caregiver: 'None', address: '22 Commerce St, Chicago', primaryDisease: 'Hypertension', secondaryDisease: 'Anxiety', medicationCount: 3, missedAppointments: 2, medicationDurationMonths: 16, smoking: 'Yes', alcohol: 'Regularly', dailyWorkingHours: 10, forgetfulness: 'Sometimes', familySupport: 'Low', doctorNotes: 'Frequent travel for work disrupts routine.' }),
  mk('P-1017', '2026-07-31', { firstName: 'Isabella', lastName: 'Rossi', age: 58, gender: 'Female', phone: '+1 202 555 0106', maritalStatus: 'Married', occupation: 'Chef', religion: 'Christianity', caregiver: 'Spouse', address: '13 Harbor View, San Francisco', primaryDisease: 'High Cholesterol', secondaryDisease: 'Type 2 Diabetes', medicationCount: 4, missedAppointments: 1, medicationDurationMonths: 26, alcohol: 'Occasionally', smsReminders: 'Yes', dailyWorkingHours: 12, familySupport: 'High', doctorNotes: 'Long kitchen hours but consistent with statin.' }),
  mk('P-1018', '2026-07-25', { firstName: 'Lucas', lastName: 'Meyer', age: 69, gender: 'Male', phone: '+1 202 555 0107', maritalStatus: 'Married', occupation: 'Retired', education: "Master's", caregiver: 'Spouse', address: '8 Pinehurst Rd, Minneapolis', primaryDisease: 'Chronic Kidney Disease', secondaryDisease: 'Hypertension', medicationCount: 7, missedAppointments: 3, hospitalizations: 2, medicationDurationMonths: 44, smoking: 'Former', exercise: 'Rarely', forgetfulness: 'Sometimes', financialDifficulty: 'Yes', doctorNotes: 'Dietary and medication load is burdensome.' }),
  mk('P-1019', '2026-08-01', { firstName: 'Chloe', lastName: 'Adams', age: 36, gender: 'Female', phone: '+1 202 555 0108', occupation: 'Marketing Lead', education: "Master's", address: '45 Union Square, New York', primaryDisease: 'Depression', medicationCount: 2, missedAppointments: 2, medicationDurationMonths: 10, alcohol: 'Occasionally', smsReminders: 'Yes', dailyWorkingHours: 10, forgetfulness: 'Sometimes', familySupport: 'Low', doctorNotes: 'Ambivalence about long-term SSRI use.' }),
  mk('P-1020', '2026-07-23', { firstName: 'Benjamin', lastName: 'Clarke', age: 62, gender: 'Male', phone: '+1 202 555 0109', maritalStatus: 'Married', occupation: 'Farmer', religion: 'Christianity', caregiver: 'Spouse', address: '2 Country Road, Des Moines', primaryDisease: 'Type 2 Diabetes', secondaryDisease: 'Hypertension', medicationCount: 5, missedAppointments: 4, hospitalizations: 1, medicationDurationMonths: 38, smoking: 'Former', alcohol: 'Occasionally', exercise: 'Regularly', phoneOwnership: 'Basic phone', dailyWorkingHours: 13, forgetfulness: 'Often', transportationIssues: 'Yes', financialDifficulty: 'Yes', doctorNotes: 'Remote location; pharmacy is 40 minutes away.' }),
]

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
const LS_PATIENTS = 'trustcare.patients'
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
let patientSeq = 1021
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
