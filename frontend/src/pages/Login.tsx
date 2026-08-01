import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Activity, Loader2, ShieldCheck, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Logo } from '@/components/Logo'
import { useAuth } from '@/hooks/useAuth'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = React.useState('doctor@trustcare.health')
  const [password, setPassword] = React.useState('demo1234')
  const [loading, setLoading] = React.useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Please enter your email and password.')
      return
    }
    setLoading(true)
    try {
      await login(email, password)
      toast.success('Welcome back to TrustCare XAI')
      navigate('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand / marketing panel */}
      <div className="relative hidden overflow-hidden bg-primary lg:flex lg:flex-col lg:justify-between lg:p-12 lg:text-primary-foreground">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 80% 60%, white 1px, transparent 1px)',
            backgroundSize: '40px 40px, 60px 60px',
          }}
        />
        <div className="relative flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold">TrustCare XAI</span>
        </div>

        <div className="relative max-w-md space-y-6">
          <h1 className="text-4xl font-bold leading-tight">
            Explainable AI for medication adherence risk.
          </h1>
          <p className="text-primary-foreground/80">
            Identify patients at risk of not following their prescriptions — and understand exactly
            why, with transparent, factor-level explanations.
          </p>
          <ul className="space-y-3 text-sm">
            {[
              ['Predict adherence risk in seconds', Activity],
              ['See the factors behind every prediction', Sparkles],
              ['Actionable, guideline-based interventions', ShieldCheck],
            ].map(([label, Icon]) => {
              const I = Icon as typeof Activity
              return (
                <li key={label as string} className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
                    <I className="h-4 w-4" />
                  </span>
                  {label as string}
                </li>
              )
            })}
          </ul>
        </div>

        <p className="relative text-xs text-primary-foreground/60">
          Prototype — predictions are simulated. No machine-learning model is in use.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm animate-fade-in">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Sign in</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Welcome back. Enter your credentials to continue.
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@hospital.org"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  onClick={() => toast.info('Password reset is disabled in this prototype.')}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Signing in…' : 'Login'}
            </Button>
          </form>

          <div className="mt-6 rounded-lg border border-dashed bg-secondary/40 p-3 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Demo mode:</span> any email and password
            will work. Credentials are pre-filled for you.
          </div>
        </div>
      </div>
    </div>
  )
}
