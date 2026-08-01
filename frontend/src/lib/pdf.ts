import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { AnalysisResult, Patient } from '@/api/types'
import { formatDate } from '@/lib/utils'

interface ReportContext {
  patient: Patient
  result: AnalysisResult
  doctorNotes: string
  hospitalName: string
  doctorName: string
  department: string
}

const BLUE: [number, number, number] = [37, 99, 235]
const SLATE: [number, number, number] = [71, 85, 105]
const riskColor = (risk: string): [number, number, number] =>
  risk === 'Low' ? [22, 163, 74] : risk === 'Medium' ? [217, 119, 6] : [220, 38, 38]

export function generateReportPdf(ctx: ReportContext) {
  const { patient, result, doctorNotes, hospitalName, doctorName, department } = ctx
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 40
  let y = 46

  // ---- Header band with hospital "logo" mark ----
  doc.setFillColor(...BLUE)
  doc.roundedRect(margin, y - 22, 30, 30, 6, 6, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('T', margin + 15, y - 2, { align: 'center' })

  doc.setTextColor(15, 23, 42)
  doc.setFontSize(18)
  doc.text('TrustCare XAI', margin + 42, y - 8)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...SLATE)
  doc.text('Explainable AI  Medication Adherence Risk Report', margin + 42, y + 5)

  doc.setFontSize(9)
  doc.text(hospitalName, pageW - margin, y - 8, { align: 'right' })
  doc.text(`${doctorName}  ${department}`, pageW - margin, y + 4, { align: 'right' })

  y += 22
  doc.setDrawColor(226, 232, 240)
  doc.line(margin, y, pageW - margin, y)
  y += 22

  // ---- Patient details ----
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(15, 23, 42)
  doc.text('Patient Details', margin, y)
  y += 6

  autoTable(doc, {
    startY: y,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 3, textColor: [30, 41, 59] },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: SLATE, cellWidth: 120 },
      2: { fontStyle: 'bold', textColor: SLATE, cellWidth: 120 },
    },
    body: [
      ['Name', `${patient.firstName} ${patient.lastName}`, 'Patient ID', patient.id],
      ['Age / Gender', `${patient.age} / ${patient.gender}`, 'Phone', patient.phone || '—'],
      ['Primary Disease', patient.primaryDisease || '—', 'Secondary', patient.secondaryDisease || '—'],
      ['Medications', String(patient.medicationCount), 'Missed Appts', String(patient.missedAppointments)],
      ['Caregiver', patient.caregiver || 'None', 'Report Date', formatDate(new Date().toISOString())],
    ],
  })
  // @ts-expect-error lastAutoTable is added by the plugin at runtime
  y = doc.lastAutoTable.finalY + 22

  // ---- Prediction summary ----
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Prediction', margin, y)
  y += 10

  const boxW = (pageW - margin * 2 - 20) / 3
  const boxes = [
    { label: 'Risk Level', value: result.risk, color: riskColor(result.risk) },
    { label: 'Probability', value: `${result.probability}%`, color: BLUE },
    { label: 'Confidence', value: `${result.confidence}%`, color: BLUE },
  ]
  boxes.forEach((b, i) => {
    const x = margin + i * (boxW + 10)
    doc.setFillColor(248, 250, 252)
    doc.roundedRect(x, y, boxW, 48, 6, 6, 'F')
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...SLATE)
    doc.text(b.label.toUpperCase(), x + 12, y + 16)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(...b.color)
    doc.text(String(b.value), x + 12, y + 36)
  })
  y += 48
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(15, 23, 42)
  y += 22
  doc.text(`Prediction: ${result.prediction}`, margin, y)
  y += 18

  // ---- Risk factors ----
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Contributing Risk Factors', margin, y)
  y += 6
  autoTable(doc, {
    startY: y,
    head: [['Factor', 'Contribution']],
    body: result.factors.map((f) => [f.feature, `${f.importance}%`]),
    theme: 'striped',
    headStyles: { fillColor: BLUE, fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 5 },
    columnStyles: { 1: { halign: 'right', cellWidth: 100 } },
    margin: { left: margin, right: margin },
  })
  // @ts-expect-error plugin runtime property
  y = doc.lastAutoTable.finalY + 22

  // ---- Recommendations ----
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(15, 23, 42)
  doc.text('Recommended Interventions', margin, y)
  y += 6
  autoTable(doc, {
    startY: y,
    body: result.recommendations.map((r) => [`${r.title}: ${r.description}`]),
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 4, textColor: [30, 41, 59] },
    margin: { left: margin, right: margin },
  })
  // @ts-expect-error plugin runtime property
  y = doc.lastAutoTable.finalY + 22

  // ---- Doctor notes ----
  if (y > 700) {
    doc.addPage()
    y = 46
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Doctor Notes', margin, y)
  y += 14
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...SLATE)
  const notes = doctorNotes.trim() || 'No additional notes recorded.'
  doc.text(doc.splitTextToSize(notes, pageW - margin * 2), margin, y)

  // ---- Footer disclaimer ----
  const pageH = doc.internal.pageSize.getHeight()
  doc.setFontSize(7.5)
  doc.setTextColor(148, 163, 184)
  doc.text(
    doc.splitTextToSize(
      'Disclaimer: ' + result.disclaimer + ' This report is for demonstration purposes and must not be used for clinical decisions.',
      pageW - margin * 2,
    ),
    margin,
    pageH - 30,
  )

  doc.save(`TrustCare-Report-${patient.id}-${patient.lastName}.pdf`)
}
