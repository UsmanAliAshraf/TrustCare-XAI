import * as React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { PatientInput } from '@/api/types'
import {
  CAREGIVER,
  COMMON_DISEASES,
  EDUCATION,
  EXERCISE,
  FORGETFULNESS,
  FREQUENCY,
  GENDER,
  MARITAL,
  PHONE_OWNERSHIP,
  RELIGION,
  SMOKING,
  SUPPORT,
  YES_NO,
} from '@/lib/options'

export const EMPTY_PATIENT: PatientInput = {
  firstName: '', lastName: '', age: 0, gender: 'Female', phone: '',
  maritalStatus: 'Single', occupation: '', education: 'High School', religion: 'None',
  caregiver: 'None', address: '',
  primaryDisease: '', secondaryDisease: 'None', medicationCount: 0, missedAppointments: 0,
  hospitalizations: 0, medicationDurationMonths: 0,
  smoking: 'No', alcohol: 'No', exercise: 'Sometimes', phoneOwnership: 'Smartphone',
  smsReminders: 'No', dailyWorkingHours: 0,
  forgetfulness: 'Rarely', transportationIssues: 'No', financialDifficulty: 'No',
  familySupport: 'Medium', doctorNotes: '',
}

type SetFn = <K extends keyof PatientInput>(key: K, v: PatientInput[K]) => void

// Defined at module scope so they are not remounted on every keystroke
// (which would drop input focus).
function TextField({
  label,
  k,
  value,
  set,
  type = 'text',
  placeholder,
}: {
  label: string
  k: keyof PatientInput
  value: PatientInput
  set: SetFn
  type?: string
  placeholder?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={String(k)}>{label}</Label>
      <Input
        id={String(k)}
        type={type}
        placeholder={placeholder}
        value={value[k] as string | number}
        onChange={(e) =>
          set(k, (type === 'number' ? Number(e.target.value) : e.target.value) as never)
        }
      />
    </div>
  )
}

function SelectField({
  label,
  k,
  value,
  set,
  options,
}: {
  label: string
  k: keyof PatientInput
  value: PatientInput
  set: SetFn
  options: string[]
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={String(value[k])} onValueChange={(v) => set(k, v as never)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </CardContent>
    </Card>
  )
}

export function PatientForm({
  value,
  onChange,
}: {
  value: PatientInput
  onChange: (next: PatientInput) => void
}) {
  const set: SetFn = (key, v) => onChange({ ...value, [key]: v })
  const common = { value, set }

  return (
    <div className="space-y-5">
      <Section title="Patient Information">
        <TextField {...common} label="First Name" k="firstName" placeholder="Jane" />
        <TextField {...common} label="Last Name" k="lastName" placeholder="Doe" />
        <TextField {...common} label="Age" k="age" type="number" />
        <SelectField {...common} label="Gender" k="gender" options={GENDER} />
        <TextField {...common} label="Phone" k="phone" placeholder="+1 ..." />
        <SelectField {...common} label="Marital Status" k="maritalStatus" options={MARITAL} />
        <TextField {...common} label="Occupation" k="occupation" placeholder="e.g. Teacher" />
        <SelectField {...common} label="Education" k="education" options={EDUCATION} />
        <SelectField {...common} label="Religion" k="religion" options={RELIGION} />
        <SelectField {...common} label="Caregiver" k="caregiver" options={CAREGIVER} />
        <div className="sm:col-span-2 lg:col-span-3">
          <TextField {...common} label="Address" k="address" placeholder="Street, City" />
        </div>
      </Section>

      <Section title="Medical Information">
        <SelectField {...common} label="Primary Disease" k="primaryDisease" options={COMMON_DISEASES} />
        <SelectField {...common} label="Secondary Disease" k="secondaryDisease" options={COMMON_DISEASES} />
        <TextField {...common} label="Medication Count" k="medicationCount" type="number" />
        <TextField {...common} label="Previous Missed Appointments" k="missedAppointments" type="number" />
        <TextField {...common} label="Previous Hospitalizations" k="hospitalizations" type="number" />
        <TextField {...common} label="Medication Duration (months)" k="medicationDurationMonths" type="number" />
      </Section>

      <Section title="Lifestyle">
        <SelectField {...common} label="Smoking" k="smoking" options={SMOKING} />
        <SelectField {...common} label="Alcohol" k="alcohol" options={FREQUENCY} />
        <SelectField {...common} label="Exercise" k="exercise" options={EXERCISE} />
        <SelectField {...common} label="Phone Ownership" k="phoneOwnership" options={PHONE_OWNERSHIP} />
        <SelectField {...common} label="SMS Reminder Usage" k="smsReminders" options={YES_NO} />
        <TextField {...common} label="Daily Working Hours" k="dailyWorkingHours" type="number" />
      </Section>

      <Section title="Adherence History">
        <SelectField {...common} label="Medication Forgetfulness" k="forgetfulness" options={FORGETFULNESS} />
        <SelectField {...common} label="Transportation Issues" k="transportationIssues" options={YES_NO} />
        <SelectField {...common} label="Financial Difficulty" k="financialDifficulty" options={YES_NO} />
        <SelectField {...common} label="Family Support" k="familySupport" options={SUPPORT} />
      </Section>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Doctor Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            rows={4}
            placeholder="Observations, context, or anything relevant to adherence..."
            value={value.doctorNotes}
            onChange={(e) => set('doctorNotes', e.target.value)}
          />
        </CardContent>
      </Card>
    </div>
  )
}
