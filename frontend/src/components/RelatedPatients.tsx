import * as React from 'react'
import { Link } from 'react-router-dom'
import { Link2 } from 'lucide-react'
import { RiskBadge } from '@/components/RiskBadge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { analyzePatient } from '@/api/mockEngine'
import type { Patient } from '@/api/types'
import { LINK_LABELS, relatedLinks, type LinkType } from '@/lib/browse'
import { cn, initials } from '@/lib/utils'

const LINK_STYLE: Record<LinkType, string> = {
  'same-disease': 'border-primary/40 text-primary',
  comorbidity: 'border-violet-500/40 text-violet-600 dark:text-violet-400',
  'same-risk': 'border-amber-500/40 text-amber-700 dark:text-amber-400',
  'similar-age': 'border-border text-muted-foreground',
}

// Outgoing hypertext links from this patient node to related records.
export function RelatedPatients({ patient, all }: { patient: Patient; all: Patient[] | null }) {
  const links = React.useMemo(
    () => (all ? relatedLinks(patient, all, (p) => analyzePatient(p).risk) : []),
    [patient, all],
  )

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="h-4 w-4" /> Related Patients
        </CardTitle>
        <CardDescription>
          Records linked to this one by shared condition, risk level or age. Follow a link to jump to that
          record.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!all ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : links.length === 0 ? (
          <p className="text-sm text-muted-foreground">No related records found.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {links.map(({ patient: p, risk, types }) => (
              <Link
                key={p.id}
                to={`/patients/${p.id}`}
                className="group flex items-start gap-3 rounded-lg border p-3 transition-colors hover:border-primary/50 hover:bg-accent/40"
              >
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="text-xs">{initials(`${p.firstName} ${p.lastName}`)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-foreground group-hover:text-primary">
                      {p.firstName} {p.lastName}
                    </span>
                    <RiskBadge risk={risk} />
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {p.primaryDisease || 'Unspecified'} · {p.age} yrs
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {types.map((t) => (
                      <span key={t} className={cn('rounded-full border px-2 py-px text-[10px] font-medium', LINK_STYLE[t])}>
                        {LINK_LABELS[t]}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
