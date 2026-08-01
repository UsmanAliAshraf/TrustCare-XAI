import * as React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Loader2, Save, X } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { PatientForm, EMPTY_PATIENT } from '@/components/PatientForm'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/api/client'
import type { PatientInput } from '@/api/types'

export default function PatientRegister() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const [value, setValue] = React.useState<PatientInput>(EMPTY_PATIENT)
  const [loading, setLoading] = React.useState(isEdit)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!id) return
    api.getPatient(id).then((p) => {
      if (p) {
        // strip id/createdAt into the input shape
        const { id: _id, createdAt, ...rest } = p
        setValue({ ...rest, createdAt })
      }
      setLoading(false)
    })
  }, [id])

  const save = async () => {
    if (!value.firstName || !value.lastName) {
      toast.error('First and last name are required.')
      return
    }
    if (!value.primaryDisease) {
      toast.error('Please select a primary disease.')
      return
    }
    setSaving(true)
    try {
      if (isEdit && id) {
        await api.updatePatient(id, value)
        toast.success('Patient updated successfully.')
        navigate(`/patients/${id}`)
      } else {
        const created = await api.createPatient(value)
        toast.success('Patient registered successfully.')
        navigate(`/patients/${created.id}`)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Edit Patient' : 'Register New Patient'}
        description={
          isEdit
            ? 'Update the patient record below.'
            : 'Capture patient information to enable adherence risk analysis.'
        }
        crumbs={[
          { label: 'Home', to: '/dashboard' },
          { label: 'Patients', to: '/patients' },
          { label: isEdit ? 'Edit' : 'New' },
        ]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(-1)}>
              <X /> Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />}
              {isEdit ? 'Save Changes' : 'Save Patient'}
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <PatientForm value={value} onChange={setValue} />
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => navigate(-1)}>
              <X /> Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />}
              {isEdit ? 'Save Changes' : 'Save Patient'}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
