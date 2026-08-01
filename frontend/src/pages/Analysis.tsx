import * as React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Activity,
  Bell,
  Users,
  ClipboardList,
  Wallet,
  Truck,
  CalendarClock,
  CheckCircle2,
  Brain,
  Loader2,
  Save,
  FileDown,
  Info,
  Sparkles,
} from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { RiskBadge } from '@/components/RiskBadge'
import { RiskGauge } from '@/components/RiskGauge'
import { ShapBars } from '@/components/ShapBars'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { api } from '@/api/client'
import type { AnalysisResult, Patient } from '@/api/types'
import { generateReportPdf } from '@/lib/pdf'
import { useSettings } from '@/hooks/useSettings'
import { cn } from '@/lib/utils'

const REC_ICONS: Record<string, typeof Bell> = {
  bell: Bell,
  users: Users,
  clipboard: ClipboardList,
  wallet: Wallet,
  truck: Truck,
  calendar: CalendarClock,
  check: CheckCircle2,
}

const LOADING_STEPS = [
  'Collecting patient features…',
  'Evaluating adherence risk factors…',
  'Computing contribution weights…',
  'Generating explanation…',
]

// --- Patient picker (shown when no patient is selected) ---------------------
function PatientPicker() {
  const [patients, setPatients] = React.useState<Patient[]>([])
  const [selected, setSelected] = React.useState<string>('')
  const navigate = useNavigate()

  React.useEffect(() => {
    api.listPatients().then(setPatients)
  }, [])

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle>Select a patient to analyze</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger>
            <SelectValue placeholder="Choose an existing patient…" />
          </SelectTrigger>
          <SelectContent>
            {patients.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.firstName} {p.lastName} · {p.primaryDisease}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          className="w-full"
          disabled={!selected}
          onClick={() => navigate(`/analysis/${selected}`)}
        >
          <Activity /> Continue
        </Button>
      </CardContent>
    </Card>
  )
}

// --- Loading animation ------------------------------------------------------
function AnalyzingState() {
  const [step, setStep] = React.useState(0)
  React.useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1)), 500)
    return () => clearInterval(t)
  }, [])
  return (
    <Card className="mx-auto max-w-md">
      <CardContent className="flex flex-col items-center gap-5 py-12 text-center">
        <div className="relative flex h-20 w-20 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
          <span className="absolute inset-2 animate-pulse rounded-full bg-primary/10" />
          <Brain className="h-9 w-9 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Analyzing adherence risk</h3>
          <p className="mt-1 text-sm text-muted-foreground">This will only take a moment.</p>
        </div>
        <div className="w-full space-y-2 text-left">
          {LOADING_STEPS.map((s, i) => (
            <div
              key={s}
              className={cn(
                'flex items-center gap-2 text-sm transition-colors',
                i <= step ? 'text-foreground' : 'text-muted-foreground/50',
              )}
            >
              {i < step ? (
                <CheckCircle2 className="h-4 w-4 text-success" />
              ) : i === step ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <span className="h-4 w-4 rounded-full border" />
              )}
              {s}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default function Analysis() {
  const { id } = useParams()
  const { settings } = useSettings()
  const [patient, setPatient] = React.useState<Patient | null | undefined>(undefined)
  const [phase, setPhase] = React.useState<'idle' | 'loading' | 'done'>('idle')
  const [result, setResult] = React.useState<AnalysisResult | null>(null)
  const [notes, setNotes] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!id) return
    setPatient(undefined)
    api.getPatient(id).then((p) => {
      setPatient(p ?? null)
      setNotes(p?.doctorNotes ?? '')
    })
  }, [id])

  if (!id) {
    return (
      <div>
        <PageHeader
          title="Adherence Analysis"
          description="Run an explainable adherence-risk analysis for a patient."
          crumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Analysis' }]}
        />
        <PatientPicker />
      </div>
    )
  }

  if (patient === undefined) {
    return <Skeleton className="mx-auto h-64 max-w-md rounded-xl" />
  }
  if (patient === null) {
    return <p className="py-20 text-center text-muted-foreground">Patient not found.</p>
  }

  const fullName = `${patient.firstName} ${patient.lastName}`

  const runAnalysis = async () => {
    setPhase('loading')
    const started = Date.now()
    const res = await api.analyze({ patientId: patient.id })
    // Ensure the loading animation is visible for at least ~2s.
    const elapsed = Date.now() - started
    if (elapsed < 2000) await new Promise((r) => setTimeout(r, 2000 - elapsed))
    setResult(res)
    setPhase('done')
  }

  const saveReport = async () => {
    if (!result) return
    setSaving(true)
    try {
      await api.createReport({
        patientId: patient.id,
        patientName: fullName,
        disease: patient.primaryDisease,
        risk: result.risk,
        confidence: result.confidence,
        probability: result.probability,
        doctorNotes: notes,
        factors: result.factors,
      })
      toast.success('Report saved to Reports.')
    } finally {
      setSaving(false)
    }
  }

  const downloadPdf = () => {
    if (!result) return
    generateReportPdf({
      patient,
      result,
      doctorNotes: notes,
      hospitalName: settings.hospitalName,
      doctorName: settings.doctorName,
      department: settings.department,
    })
    toast.success('PDF report generated.')
  }

  return (
    <div>
      <PageHeader
        title="Adherence Analysis"
        crumbs={[
          { label: 'Home', to: '/dashboard' },
          { label: 'Patients', to: '/patients' },
          { label: fullName, to: `/patients/${patient.id}` },
          { label: 'Analysis' },
        ]}
      />

      {/* Patient summary + trigger */}
      <Card className="mb-6">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">{fullName}</h2>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Badge variant="secondary">{patient.primaryDisease}</Badge>
              <Badge variant="outline">{patient.medicationCount} medications</Badge>
              <Badge variant="outline">{patient.age} yrs</Badge>
            </div>
          </div>
          {phase !== 'loading' && (
            <Button size="lg" onClick={runAnalysis}>
              <Activity /> {phase === 'done' ? 'Re-run Analysis' : 'Analyze Adherence Risk'}
            </Button>
          )}
        </CardContent>
      </Card>

      {phase === 'idle' && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="h-7 w-7" />
            </div>
            <h3 className="text-base font-semibold">Ready to analyze</h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              Click “Analyze Adherence Risk” to generate an explainable prediction of this patient's
              likelihood of non-adherence.
            </p>
          </CardContent>
        </Card>
      )}

      {phase === 'loading' && <AnalyzingState />}

      {phase === 'done' && result && (
        <div className="space-y-6 animate-fade-in">
          {/* Result summary */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardContent className="p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Prediction</span>
                    <div className="mt-1 flex items-center gap-3">
                      <h2 className="text-2xl font-bold text-foreground">{result.prediction}</h2>
                      <RiskBadge risk={result.risk} />
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div className="rounded-xl bg-secondary/50 p-4">
                    <div className="text-sm text-muted-foreground">Probability of non-adherence</div>
                    <div className="mt-1 text-3xl font-bold tabular-nums text-foreground">
                      {result.probability}%
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-700"
                        style={{ width: `${result.probability}%` }}
                      />
                    </div>
                  </div>
                  <div className="rounded-xl bg-secondary/50 p-4">
                    <div className="text-sm text-muted-foreground">Model confidence</div>
                    <div className="mt-1 text-3xl font-bold tabular-nums text-foreground">
                      {result.confidence}%
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-success transition-[width] duration-700"
                        style={{ width: `${result.confidence}%` }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Gauge */}
            <Card>
              <CardHeader className="pb-0">
                <CardTitle className="text-base">Risk Gauge</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-center py-4">
                <RiskGauge value={result.probability} risk={result.risk} />
              </CardContent>
            </Card>
          </div>

          {/* Explainability */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                Why did the AI make this prediction?
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Each bar shows how much a factor contributed to this prediction (SHAP-style
                attribution).
              </p>
            </CardHeader>
            <CardContent>
              <ShapBars factors={result.factors} />
            </CardContent>
          </Card>

          {/* Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle>Recommended Interventions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {result.recommendations.map((rec) => {
                const Icon = REC_ICONS[rec.icon] ?? CheckCircle2
                return (
                  <div
                    key={rec.title}
                    className="flex gap-3 rounded-xl border bg-card p-4 transition-shadow hover:shadow-md"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-foreground">{rec.title}</div>
                      <div className="mt-0.5 text-sm text-muted-foreground">{rec.description}</div>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* Doctor notes + actions */}
          <Card>
            <CardHeader>
              <CardTitle>Doctor Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add your clinical observations for the report…"
              />
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={downloadPdf}>
                  <FileDown /> Generate PDF
                </Button>
                <Button onClick={saveReport} disabled={saving}>
                  {saving ? <Loader2 className="animate-spin" /> : <Save />} Save Report
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-start gap-2 rounded-lg border border-dashed bg-secondary/30 p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{result.disclaimer}</span>
          </div>
        </div>
      )}
    </div>
  )
}
