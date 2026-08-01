// Shared API types. The frontend consumes these exactly as it would from the
// real ML-backed service; only the implementation in `client.ts` would change.

export type RiskLevel = 'Low' | 'Medium' | 'High'

export interface Patient {
  id: string
  firstName: string
  lastName: string
  age: number
  gender: string
  phone: string
  maritalStatus: string
  occupation: string
  education: string
  religion: string
  caregiver: string
  address: string

  primaryDisease: string
  secondaryDisease: string
  medicationCount: number
  missedAppointments: number
  hospitalizations: number
  medicationDurationMonths: number

  smoking: string
  alcohol: string
  exercise: string
  phoneOwnership: string
  smsReminders: string
  dailyWorkingHours: number

  forgetfulness: string
  transportationIssues: string
  financialDifficulty: string
  familySupport: string

  doctorNotes: string
  createdAt: string
}

export type PatientInput = Omit<Patient, 'id' | 'createdAt'> & { createdAt?: string }

export interface Factor {
  feature: string
  importance: number
}

export interface Recommendation {
  title: string
  description: string
  icon: string
}

export interface AnalysisResult {
  risk: RiskLevel
  probability: number
  prediction: string
  confidence: number
  factors: Factor[]
  recommendations: Recommendation[]
  disclaimer: string
}

export interface DashboardStats {
  patientsToday: number
  highRiskPatients: number
  averageAdherenceRisk: number
  recentAnalyses: number
  recentPatients: {
    id: string
    name: string
    age: number
    disease: string
    risk: RiskLevel
    probability: number
    date: string
  }[]
  riskDistribution: { name: string; value: number }[]
}

export interface Report {
  id: string
  patientId: string
  patientName: string
  disease: string
  risk: RiskLevel
  confidence: number
  probability: number
  doctorNotes: string
  factors: Factor[]
  createdAt: string
}

export type ReportInput = Omit<Report, 'id' | 'createdAt'>
