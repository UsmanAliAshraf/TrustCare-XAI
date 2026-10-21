import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search, Users, ChevronLeft, ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { RiskBadge } from '@/components/RiskBadge'
import { EmptyState } from '@/components/EmptyState'
import { DiseaseLink } from '@/components/DiseaseLink'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api, QueryError } from '@/api/client'
import { SEARCH_CONFIG } from '@/lib/search'
import { analyzePatient } from '@/api/mockEngine'
import type { Patient, RiskLevel } from '@/api/types'
import { formatDate, initials } from '@/lib/utils'

const PAGE_SIZE = 8
const SEARCH_DELAY_MS = 250

export default function Patients() {
  const [patients, setPatients] = React.useState<Patient[] | null>(null)
  const [query, setQuery] = React.useState('')
  const [filter, setFilter] = React.useState<'All' | RiskLevel>('All')
  const [page, setPage] = React.useState(1)
  // Ranked search results for the current query; null when no query is active.
  const [results, setResults] = React.useState<Patient[] | null>(null)
  const [searching, setSearching] = React.useState(false)
  const [queryError, setQueryError] = React.useState<string | null>(null)
  const navigate = useNavigate()

  React.useEffect(() => {
    api.listPatients().then(setPatients)
  }, [])

  React.useEffect(() => setPage(1), [query, filter])

  // Debounced ranked search; results arrive most relevant first.
  React.useEffect(() => {
    const q = query.trim()
    if (!q) {
      setResults(null)
      setQueryError(null)
      setSearching(false)
      return
    }
    setSearching(true)
    let cancelled = false
    const timer = setTimeout(() => {
      api
        .searchPatients(q, SEARCH_CONFIG.MAX_LIMIT)
        .then((found) => {
          if (cancelled) return
          setResults(found)
          setQueryError(null)
        })
        .catch((err) => {
          if (cancelled) return
          setResults([])
          setQueryError(err instanceof QueryError ? err.message : 'Search is unavailable right now.')
        })
        .finally(() => {
          if (!cancelled) setSearching(false)
        })
    }, SEARCH_DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query])

  const withRisk = React.useMemo(
    () => (results ?? patients ?? []).map((p) => ({ p, risk: analyzePatient(p).risk })),
    [results, patients],
  )

  const filtered = withRisk.filter(({ risk }) => filter === 'All' || risk === filter)
  const loading = !patients || (searching && results === null)

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div>
      <PageHeader
        title="Patients"
        description="Browse, search and manage patient records."
        crumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Patients' }]}
        actions={
          <Button asChild>
            <Link to="/patients/new">
              <Plus /> New Patient
            </Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-sm flex-1">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name, ID, disease or notes…"
                  className="pl-9"
                  aria-describedby="patient-search-help"
                  aria-invalid={queryError ? true : undefined}
                  maxLength={SEARCH_CONFIG.MAX_QUERY_LENGTH}
                />
              </div>
              <p
                id="patient-search-help"
                className={`mt-1.5 text-xs ${queryError ? 'text-destructive' : 'text-muted-foreground'}`}
                role={queryError ? 'alert' : undefined}
              >
                {queryError ?? 'Combine terms with AND, OR, NOT and ( ), e.g. diabetes AND NOT type 1'}
              </p>
            </div>
            <div className="flex rounded-lg border p-0.5">
              {(['All', 'Low', 'Medium', 'High'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    filter === f
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Users}
              title={query.trim() ? 'No matching patients found' : 'No patients found'}
              description={
                queryError
                  ? 'Check the search syntax and try again.'
                  : 'Try adjusting your search or add a new patient record.'
              }
              action={
                <Button asChild>
                  <Link to="/patients/new">
                    <Plus /> New Patient
                  </Link>
                </Button>
              }
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Age</TableHead>
                    <TableHead>Gender</TableHead>
                    <TableHead>Primary Disease</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Registered</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageItems.map(({ p, risk }) => (
                    <TableRow
                      key={p.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/patients/${p.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="text-xs">
                              {initials(`${p.firstName} ${p.lastName}`)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-foreground">
                              {p.firstName} {p.lastName}
                            </div>
                            <div className="text-xs text-muted-foreground">{p.id}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.age}</TableCell>
                      <TableCell className="text-muted-foreground">{p.gender}</TableCell>
                      <TableCell className="text-muted-foreground">
                        <DiseaseLink disease={p.primaryDisease} />
                      </TableCell>
                      <TableCell>
                        <RiskBadge risk={risk} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(p.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of{' '}
                  {filtered.length}
                  {results && results.length >= SEARCH_CONFIG.MAX_LIMIT && ' top matches. Refine the search to narrow them down'}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft /> Prev
                  </Button>
                  <span className="tabular-nums">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next <ChevronRight />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
