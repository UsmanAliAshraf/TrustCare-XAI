import * as React from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { FileText, Download, Trash2, FileBarChart } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { RiskBadge } from '@/components/RiskBadge'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api } from '@/api/client'
import { analyzePatient } from '@/api/mockEngine'
import type { Report } from '@/api/types'
import { formatDate } from '@/lib/utils'
import { generateReportPdf } from '@/lib/pdf'
import { useSettings } from '@/hooks/useSettings'

export default function Reports() {
  const [reports, setReports] = React.useState<Report[] | null>(null)
  const { settings } = useSettings()

  const load = React.useCallback(() => api.listReports().then(setReports), [])
  React.useEffect(() => {
    load()
  }, [load])

  const download = async (r: Report) => {
    const patient = await api.getPatient(r.patientId)
    if (!patient) {
      toast.error('Original patient record not found for this report.')
      return
    }
    // Re-derive the full analysis to reproduce the report contents.
    const result = analyzePatient(patient)
    generateReportPdf({
      patient,
      result,
      doctorNotes: r.doctorNotes,
      hospitalName: settings.hospitalName,
      doctorName: settings.doctorName,
      department: settings.department,
    })
    toast.success('PDF report downloaded.')
  }

  const remove = async (r: Report) => {
    await api.deleteReport(r.id)
    toast.success('Report deleted.')
    load()
  }

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Saved adherence analyses and generated reports."
        crumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Reports' }]}
      />

      <Card>
        <CardContent className="p-4 sm:p-6">
          {!reports ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : reports.length === 0 ? (
            <EmptyState
              icon={FileBarChart}
              title="No reports yet"
              description="Run an adherence analysis and save it to see reports here."
              action={
                <Button asChild>
                  <Link to="/analysis">
                    <FileText /> Start an Analysis
                  </Link>
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Disease</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link
                        to={`/patients/${r.patientId}`}
                        className="font-medium text-foreground hover:text-primary hover:underline"
                      >
                        {r.patientName}
                      </Link>
                      <div className="text-xs text-muted-foreground">{r.id}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.disease}</TableCell>
                    <TableCell>
                      <RiskBadge risk={r.risk} />
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {r.confidence}%
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(r.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => download(r)}>
                          <Download /> PDF
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => remove(r)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
