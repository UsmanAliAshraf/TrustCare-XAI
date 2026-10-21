import * as React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { History } from 'lucide-react'
import { readTrail, type TrailEntry } from '@/lib/browse'

// Recently visited nodes (patients and hierarchy branches) for this session,
// so the user can backtrack along the path they followed.
export function BrowsingTrail() {
  const { pathname } = useLocation()
  const [trail, setTrail] = React.useState<TrailEntry[]>([])

  // Re-read after the page records its own visit.
  React.useEffect(() => {
    const t = setTimeout(() => setTrail(readTrail()), 0)
    return () => clearTimeout(t)
  }, [pathname])

  const others = trail.filter((e) => e.to !== pathname)
  if (others.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="flex items-center gap-1 text-muted-foreground">
        <History className="h-3.5 w-3.5" /> Recently visited:
      </span>
      {others.map((e) => (
        <Link
          key={e.to}
          to={e.to}
          className="rounded-full border px-2.5 py-0.5 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
        >
          {e.label}
        </Link>
      ))}
    </div>
  )
}
