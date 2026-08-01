import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Users,
  AlertTriangle,
  Gauge,
  FileBarChart,
  Plus,
  Search,
  ArrowRight,
} from 'lucide-react'
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { RiskBadge } from '@/components/RiskBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { api } from '@/api/client'
import type { DashboardStats, RiskLevel } from '@/api/types'
import { formatDate, initials } from '@/lib/utils'

const RISK_COLORS: Record<string, string> = {
  Low: 'hsl(152 60% 40%)',
  Medium: 'hsl(38 92% 50%)',
  High: 'hsl(0 72% 51%)',
}

export default function Dashboard() {
  const [stats, setStats] = React.useState<DashboardStats | null>(null)
  const [query, setQuery] = React.useState('')
  const [filter, setFilter] = React.useState<'All' | RiskLevel>('All')
  const navigate = useNavigate()

  React.useEffect(() => {
    api.getDashboard().then(setStats)
  }, [])

  const recent = stats?.recentPatients ?? []
  const filtered = recent.filter((p) => {
    const matchesQuery =
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.disease.toLowerCase().includes(query.toLowerCase())
    const matchesFilter = filter === 'All' || p.risk === filter
    return matchesQuery && matchesFilter
  })

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Overview of adherence risk across your patient population."
        actions={
          <Button asChild>
            <Link to="/patients/new">
              <Plus /> New Patient
            </Link>
          </Button>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats ? (
          <>
            <StatCard label="Patients Today" value={stats.patientsToday} icon={Users} tone="primary" />
            <StatCard
              label="High Risk Patients"
              value={stats.highRiskPatients}
              icon={AlertTriangle}
              tone="destructive"
            />
            <StatCard
              label="Average Adherence Risk"
              value={`${stats.averageAdherenceRisk}%`}
              icon={Gauge}
              tone="warning"
            />
            <StatCard
              label="Recent Analyses"
              value={stats.recentAnalyses}
              icon={FileBarChart}
              tone="success"
            />
          </>
        ) : (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[92px] rounded-xl" />)
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent patients */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Recent Patients</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search…"
                  className="h-9 w-40 pl-9 sm:w-52"
                />
              </div>
              <div className="flex rounded-lg border p-0.5">
                {(['All', 'Low', 'Medium', 'High'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
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
          </CardHeader>
          <CardContent className="pt-0">
            {!stats ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Age</TableHead>
                    <TableHead>Disease</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow
                      key={p.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/patients/${p.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">{initials(p.name)}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-foreground">{p.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.age}</TableCell>
                      <TableCell className="text-muted-foreground">{p.disease}</TableCell>
                      <TableCell>
                        <RiskBadge risk={p.risk} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(p.date)}</TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                        No patients match your search.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
            <div className="mt-3 flex justify-end">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/patients">
                  View all patients <ArrowRight />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Risk distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Risk Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {!stats ? (
              <Skeleton className="mx-auto h-52 w-52 rounded-full" />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={stats.riskDistribution}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {stats.riskDistribution.map((entry) => (
                        <Cell key={entry.name} fill={RISK_COLORS[entry.name]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: '1px solid hsl(var(--border))',
                        fontSize: 13,
                      }}
                    />
                    <Legend iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
                <p className="mt-2 text-center text-sm text-muted-foreground">
                  {stats.highRiskPatients} of {stats.patientsToday} patients are high risk.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
