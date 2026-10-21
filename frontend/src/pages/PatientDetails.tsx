import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Activity, Pencil, FileText, Phone, MapPin, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { BrowsingTrail } from '@/components/BrowsingTrail'
import { RelatedPatients } from '@/components/RelatedPatients'
import { DiseaseLink } from '@/components/DiseaseLink'
import { RiskBadge } from '@/components/RiskBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { api } from '@/api/client'
import { analyzePatient } from '@/api/mockEngine'
import type { Patient } from '@/api/types'
import { formatDate, initials } from '@/lib/utils'
import { categoryOf, categoryPath, diseasePath, pushTrail } from '@/lib/browse'
import { toast } from 'sonner'

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value || '—'}</span>
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3 lg:grid-cols-4">
        {children}
      </CardContent>
    </Card>
  )
}

export default function PatientDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [patient, setPatient] = React.useState<Patient | null | undefined>(undefined)
  const [allPatients, setAllPatients] = React.useState<Patient[] | null>(null)
  const [confirmDelete, setConfirmDelete] = React.useState(false)

  React.useEffect(() => {
    if (id) api.getPatient(id).then((p) => setPatient(p ?? null))
  }, [id])

  React.useEffect(() => {
    api.listPatients().then(setAllPatients)
  }, [])

  React.useEffect(() => {
    if (patient) pushTrail({ label: `${patient.firstName} ${patient.lastName}`, to: `/patients/${patient.id}` })
  }, [patient])

  if (patient === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }

  if (patient === null) {
    return (
      <div className="py-20 text-center">
        <p className="text-lg font-semibold">Patient not found</p>
        <Button className="mt-4" asChild>
          <Link to="/patients">Back to patients</Link>
        </Button>
      </div>
    )
  }

  const risk = analyzePatient(patient).risk
  const fullName = `${patient.firstName} ${patient.lastName}`
  const category = categoryOf(patient.primaryDisease)

  const del = async () => {
    await api.deletePatient(patient.id)
    toast.success('Patient record deleted.')
    navigate('/patients')
  }

  return (
    <div>
      <PageHeader
        title="Patient Details"
        crumbs={[
          { label: 'Home', to: '/dashboard' },
          { label: 'Browse', to: '/browse' },
          { label: category.name, to: categoryPath(category) },
          ...(patient.primaryDisease && patient.primaryDisease !== 'None'
            ? [{ label: patient.primaryDisease, to: diseasePath(patient.primaryDisease) }]
            : []),
          { label: fullName },
        ]}
      />

      <div className="mb-4">
        <BrowsingTrail />
      </div>

      {/* Profile header card */}
      <Card className="mb-6">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-lg">{initials(fullName)}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-foreground">{fullName}</h2>
                <RiskBadge risk={risk} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span>{patient.id}</span>
                <span>
                  {patient.age} yrs · {patient.gender}
                </span>
                <span className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" /> {patient.phone || '—'}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {patient.address || '—'}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {patient.primaryDisease && patient.primaryDisease !== 'None' && (
                  <Link to={diseasePath(patient.primaryDisease)}>
                    <Badge variant="secondary" className="hover:bg-primary/15">
                      {patient.primaryDisease}
                    </Badge>
                  </Link>
                )}
                {patient.secondaryDisease && patient.secondaryDisease !== 'None' && (
                  <Link to={diseasePath(patient.secondaryDisease)}>
                    <Badge variant="outline" className="hover:border-primary/50">
                      {patient.secondaryDisease}
                    </Badge>
                  </Link>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to={`/patients/${patient.id}/edit`}>
                <Pencil /> Edit
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/reports">
                <FileText /> Previous Reports
              </Link>
            </Button>
            <Button asChild>
              <Link to={`/analysis/${patient.id}`}>
                <Activity /> Analyze Adherence
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-5">
        <Group title="Demographics">
          <Field label="Marital Status" value={patient.maritalStatus} />
          <Field label="Occupation" value={patient.occupation} />
          <Field label="Education" value={patient.education} />
          <Field label="Religion" value={patient.religion} />
          <Field label="Caregiver" value={patient.caregiver} />
        </Group>

        <Group title="Medical">
          <Field label="Primary Disease" value={<DiseaseLink disease={patient.primaryDisease} className="text-primary" />} />
          <Field label="Secondary Disease" value={<DiseaseLink disease={patient.secondaryDisease} className="text-primary" />} />
          <Field label="Medication Count" value={patient.medicationCount} />
          <Field label="Missed Appointments" value={patient.missedAppointments} />
          <Field label="Hospitalizations" value={patient.hospitalizations} />
          <Field label="Medication Duration" value={`${patient.medicationDurationMonths} months`} />
        </Group>

        <Group title="Lifestyle">
          <Field label="Smoking" value={patient.smoking} />
          <Field label="Alcohol" value={patient.alcohol} />
          <Field label="Exercise" value={patient.exercise} />
          <Field label="Phone Ownership" value={patient.phoneOwnership} />
          <Field label="SMS Reminders" value={patient.smsReminders} />
          <Field label="Daily Working Hours" value={patient.dailyWorkingHours} />
        </Group>

        <Group title="Adherence History">
          <Field label="Forgetfulness" value={patient.forgetfulness} />
          <Field label="Transportation Issues" value={patient.transportationIssues} />
          <Field label="Financial Difficulty" value={patient.financialDifficulty} />
          <Field label="Family Support" value={patient.familySupport} />
        </Group>

        <RelatedPatients patient={patient} all={allPatients} />

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Doctor Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {patient.doctorNotes || 'No notes recorded.'}
            </p>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between rounded-xl border border-dashed p-4">
          <div>
            <div className="text-sm font-medium text-foreground">Registered</div>
            <div className="text-xs text-muted-foreground">{formatDate(patient.createdAt)}</div>
          </div>
          <Button
            variant="ghost"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 /> Delete Record
          </Button>
        </div>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete patient record?</DialogTitle>
            <DialogDescription>
              This will permanently remove {fullName} from the prototype dataset. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={del}>
              <Trash2 /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
