// Data-access layer.
//
// Every call first attempts the live FastAPI backend (via the Vite `/api`
// proxy) and transparently falls back to the in-browser mock engine when the
// backend is unreachable. This means the prototype runs with OR without the
// Python service, while the component code stays agnostic about the source.
//
// To go fully live against a real ML model, delete the fallbacks (or set
// FORCE_MOCK = false and ensure the backend is running) - the function
// signatures and return shapes never change.

import {
  analyzePatient as mockAnalyze,
  buildDashboard,
  mockStore,
} from './mockEngine'
import type {
  AnalysisResult,
  DashboardStats,
  Patient,
  PatientInput,
  Report,
  ReportInput,
} from './types'

const API_BASE = '/api'
const TIMEOUT_MS = 2500

async function live<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    if (res.status === 204) return undefined as T
    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

// Wrap a live call with a mock fallback. Logs once per fallback for visibility.
async function withFallback<T>(liveCall: () => Promise<T>, mock: () => T | Promise<T>): Promise<T> {
  try {
    return await liveCall()
  } catch (err) {
    if (import.meta.env.DEV) {
      console.info('[TrustCare] backend unavailable, using local mock engine:', (err as Error).message)
    }
    return await mock()
  }
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const api = {
  getDashboard(): Promise<DashboardStats> {
    return withFallback(
      () => live<DashboardStats>('/dashboard'),
      () => buildDashboard(mockStore.listPatients(), mockStore.reportCount()),
    )
  },

  listPatients(): Promise<Patient[]> {
    return withFallback(
      () => live<Patient[]>('/patients'),
      () => mockStore.listPatients(),
    )
  },

  getPatient(id: string): Promise<Patient | undefined> {
    return withFallback(
      () => live<Patient>(`/patients/${id}`),
      () => mockStore.getPatient(id),
    )
  },

  createPatient(data: PatientInput): Promise<Patient> {
    return withFallback(
      () => live<Patient>('/patients', { method: 'POST', body: JSON.stringify(data) }),
      () => mockStore.createPatient(data),
    )
  },

  updatePatient(id: string, data: PatientInput): Promise<Patient> {
    return withFallback(
      () => live<Patient>(`/patients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
      () => mockStore.updatePatient(id, data)!,
    )
  },

  deletePatient(id: string): Promise<void> {
    return withFallback(
      () => live<void>(`/patients/${id}`, { method: 'DELETE' }),
      () => void mockStore.deletePatient(id),
    )
  },

  analyze(input: { patientId?: string; patient?: Partial<Patient> }): Promise<AnalysisResult> {
    return withFallback(
      () => live<AnalysisResult>('/analyze', { method: 'POST', body: JSON.stringify(input) }),
      async () => {
        await delay(800) // simulate inference latency
        const patient = input.patientId ? mockStore.getPatient(input.patientId) : input.patient
        return mockAnalyze(patient || {})
      },
    )
  },

  listReports(): Promise<Report[]> {
    return withFallback(
      () => live<Report[]>('/reports'),
      () => mockStore.listReports(),
    )
  },

  createReport(data: ReportInput): Promise<Report> {
    return withFallback(
      () => live<Report>('/reports', { method: 'POST', body: JSON.stringify(data) }),
      () => mockStore.createReport(data),
    )
  },

  deleteReport(id: string): Promise<void> {
    return withFallback(
      () => live<void>(`/reports/${id}`, { method: 'DELETE' }),
      () => void mockStore.deleteReport(id),
    )
  },
}
