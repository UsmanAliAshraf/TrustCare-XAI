import * as React from 'react'

interface User {
  name: string
  email: string
}

interface AuthContextValue {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined)
const LS_KEY = 'trustcare.auth'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      return raw ? (JSON.parse(raw) as User) : null
    } catch {
      return null
    }
  })

  const login = React.useCallback(async (email: string, _password: string) => {
    // Mock authentication - accepts any credentials.
    await new Promise((r) => setTimeout(r, 600))
    const name = email
      .split('@')[0]
      .split(/[.\-_]/)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(' ')
    const u: User = { name: `Dr. ${name || 'Clinician'}`, email }
    localStorage.setItem(LS_KEY, JSON.stringify(u))
    setUser(u)
  }, [])

  const logout = React.useCallback(() => {
    localStorage.removeItem(LS_KEY)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
