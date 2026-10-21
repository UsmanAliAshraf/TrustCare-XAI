import * as React from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronDown, ChevronRight, Folder, FolderOpen, FolderTree, Stethoscope } from 'lucide-react'
import { PageHeader, type Crumb } from '@/components/PageHeader'
import { RiskBadge } from '@/components/RiskBadge'
import { EmptyState } from '@/components/EmptyState'
import { BrowsingTrail } from '@/components/BrowsingTrail'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { api } from '@/api/client'
import { analyzePatient } from '@/api/mockEngine'
import type { Patient, RiskLevel } from '@/api/types'
import {
  buildTree,
  categoryBySlug,
  categoryPath,
  diseasePath,
  pushTrail,
  slugify,
  type TreeNode,
} from '@/lib/browse'
import { cn, initials } from '@/lib/utils'

const RISKS: RiskLevel[] = ['High', 'Medium', 'Low']
const RISK_BAR: Record<RiskLevel, string> = {
  High: 'bg-red-500',
  Medium: 'bg-amber-500',
  Low: 'bg-emerald-500',
}

function riskCounts(patients: Patient[]) {
  const counts: Record<RiskLevel, number> = { High: 0, Medium: 0, Low: 0 }
  for (const p of patients) counts[analyzePatient(p).risk]++
  return counts
}

// Stacked bar summarising the risk mix under a node of the hierarchy.
function RiskMix({ patients }: { patients: Patient[] }) {
  if (patients.length === 0) return <div className="h-1.5 rounded-full bg-muted" />
  const counts = riskCounts(patients)
  return (
    <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
      {RISKS.map((r) => (
        <div
          key={r}
          className={RISK_BAR[r]}
          style={{ width: `${(counts[r] / patients.length) * 100}%` }}
          title={`${counts[r]} ${r}`}
        />
      ))}
    </div>
  )
}

// Collapsible directory tree: the whole hierarchy, with the current path open.
function Tree({ tree, category, disease }: { tree: TreeNode[]; category?: string; disease?: string }) {
  const [open, setOpen] = React.useState<Set<string>>(() => new Set(category ? [category] : []))

  React.useEffect(() => {
    if (category) setOpen((s) => new Set(s).add(category))
  }, [category])

  const toggle = (slug: string) =>
    setOpen((s) => {
      const next = new Set(s)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })

  return (
    <nav className="space-y-0.5 text-sm">
      <Link
        to="/browse"
        className={cn(
          'flex items-center gap-2 rounded-md px-2 py-1.5 font-medium',
          !category ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-accent',
        )}
      >
        <FolderTree className="h-4 w-4" /> All conditions
      </Link>
      {tree
        .filter((n) => n.diseases.length > 0)
        .map(({ category: c, diseases, total }) => {
          const isOpen = open.has(c.slug)
          const active = category === c.slug && !disease
          return (
            <div key={c.slug}>
              <div className="flex items-center">
                <button
                  onClick={() => toggle(c.slug)}
                  className="rounded p-1 text-muted-foreground hover:bg-accent"
                  aria-label={isOpen ? `Collapse ${c.name}` : `Expand ${c.name}`}
                >
                  {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>
                <Link
                  to={categoryPath(c)}
                  className={cn(
                    'flex flex-1 items-center justify-between rounded-md px-1.5 py-1.5',
                    active ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-accent',
                  )}
                >
                  <span className="flex items-center gap-2">
                    {isOpen ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />}
                    {c.name}
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">{total}</span>
                </Link>
              </div>
              {isOpen && (
                <div className="ml-6 space-y-0.5 border-l pl-2">
                  {diseases.map((d) => (
                    <Link
                      key={d.name}
                      to={diseasePath(d.name)}
                      className={cn(
                        'flex items-center justify-between rounded-md px-2 py-1 text-[13px]',
                        disease === slugify(d.name)
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                      )}
                    >
                      {d.name}
                      <span className="text-xs tabular-nums">{d.patients.length}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}
    </nav>
  )
}

function NodeCard({ to, title, subtitle, patients }: { to: string; title: string; subtitle?: string; patients: Patient[] }) {
  return (
    <Link to={to} className="group">
      <Card className="h-full transition-colors group-hover:border-primary/50">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Folder className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <div className="font-semibold text-foreground group-hover:text-primary">{title}</div>
                {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
              </div>
            </div>
            <span className="text-lg font-bold tabular-nums text-foreground">{patients.length}</span>
          </div>
          <RiskMix patients={patients} />
        </CardContent>
      </Card>
    </Link>
  )
}

function PatientList({ patients }: { patients: Patient[] }) {
  if (patients.length === 0) {
    return (
      <EmptyState
        icon={Stethoscope}
        title="No patients under this condition"
        description="Browse another branch of the hierarchy, or register a new patient."
      />
    )
  }
  return (
    <div className="divide-y rounded-xl border">
      {patients.map((p) => (
        <Link
          key={p.id}
          to={`/patients/${p.id}`}
          className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-accent/50"
        >
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="text-xs">{initials(`${p.firstName} ${p.lastName}`)}</AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium text-foreground">
                {p.firstName} {p.lastName}
              </div>
              <div className="text-xs text-muted-foreground">
                {p.id} · {p.age} yrs · {p.gender}
              </div>
            </div>
          </div>
          <RiskBadge risk={analyzePatient(p).risk} />
        </Link>
      ))}
    </div>
  )
}

export default function Browse() {
  const { category: catSlug, disease: diseaseSlug } = useParams()
  const [patients, setPatients] = React.useState<Patient[] | null>(null)

  React.useEffect(() => {
    api.listPatients().then(setPatients)
  }, [])

  const tree = React.useMemo(() => buildTree(patients ?? []), [patients])
  const node = tree.find((n) => n.category.slug === catSlug)
  const category = node?.category ?? categoryBySlug(catSlug)
  const disease = node?.diseases.find((d) => slugify(d.name) === diseaseSlug)

  // Record the visited hierarchy node in the browsing trail.
  React.useEffect(() => {
    if (!patients) return
    if (disease) pushTrail({ label: disease.name, to: diseasePath(disease.name) })
    else if (category) pushTrail({ label: category.name, to: categoryPath(category) })
  }, [patients, category, disease])

  const crumbs: Crumb[] = [{ label: 'Home', to: '/dashboard' }, { label: 'Browse', to: '/browse' }]
  if (category) crumbs.push({ label: category.name, to: disease ? categoryPath(category) : undefined })
  if (disease) crumbs.push({ label: disease.name })
  crumbs[crumbs.length - 1] = { label: crumbs[crumbs.length - 1].label }

  const notFound = patients && ((catSlug && !node) || (diseaseSlug && !disease))

  return (
    <div>
      <PageHeader
        title={disease?.name ?? category?.name ?? 'Browse by Condition'}
        description={
          disease
            ? `Patients whose primary condition is ${disease.name}.`
            : category
              ? category.description
              : 'Navigate patient records through the clinical condition hierarchy.'
        }
        crumbs={crumbs}
      />

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <Card className="h-fit lg:sticky lg:top-20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Condition hierarchy</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            {patients ? (
              <Tree tree={tree} category={catSlug} disease={diseaseSlug} />
            ) : (
              <div className="space-y-2">
                {Array.from({ length: 7 }).map((_, i) => (
                  <Skeleton key={i} className="h-7 w-full" />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="min-w-0 space-y-6">
          <BrowsingTrail />

          {!patients ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : notFound ? (
            <EmptyState
              icon={FolderTree}
              title="Category not found"
              description="This branch doesn't exist in the condition hierarchy."
            />
          ) : disease ? (
            <PatientList patients={disease.patients} />
          ) : node ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {node.diseases.map((d) => (
                <NodeCard
                  key={d.name}
                  to={diseasePath(d.name)}
                  title={d.name}
                  subtitle={`${d.patients.length} patient${d.patients.length === 1 ? '' : 's'}`}
                  patients={d.patients}
                />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {tree
                .filter((n) => n.diseases.length > 0)
                .map((n) => (
                  <NodeCard
                    key={n.category.slug}
                    to={categoryPath(n.category)}
                    title={n.category.name}
                    subtitle={`${n.diseases.length} condition${n.diseases.length === 1 ? '' : 's'}`}
                    patients={n.diseases.flatMap((d) => d.patients)}
                  />
                ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            {RISKS.map((r) => (
              <span key={r} className="flex items-center gap-1.5">
                <span className={cn('h-2 w-2 rounded-full', RISK_BAR[r])} /> {r} risk
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
