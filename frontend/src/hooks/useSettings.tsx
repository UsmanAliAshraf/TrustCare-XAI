import * as React from 'react'

export interface Settings {
  hospitalName: string
  doctorName: string
  department: string
  theme: 'light' | 'dark'
  notifications: boolean
}

const DEFAULTS: Settings = {
  hospitalName: 'St. Mary General Hospital',
  doctorName: 'Dr. A. Clinician',
  department: 'Internal Medicine',
  theme: 'light',
  notifications: true,
}

const LS_KEY = 'trustcare.settings'

interface SettingsContextValue {
  settings: Settings
  update: (patch: Partial<Settings>) => void
}

const SettingsContext = React.createContext<SettingsContextValue | undefined>(undefined)

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = React.useState<Settings>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS
    } catch {
      return DEFAULTS
    }
  })

  React.useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', settings.theme === 'dark')
  }, [settings.theme])

  const update = React.useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      localStorage.setItem(LS_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return (
    <SettingsContext.Provider value={{ settings, update }}>{children}</SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = React.useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
