import { cn } from '@/lib/utils'
import type { Factor } from '@/api/types'

// SHAP-style horizontal contribution bars. Purely visual - the importance
// values come from the mock engine, not a real SHAP computation.
export function ShapBars({ factors, animate = true }: { factors: Factor[]; animate?: boolean }) {
  const max = Math.max(...factors.map((f) => f.importance), 1)
  return (
    <div className="space-y-4">
      {factors.map((f, i) => (
        <div key={f.feature} className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">{f.feature}</span>
            <span className="tabular-nums font-semibold text-muted-foreground">{f.importance}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-[width] duration-700 ease-out',
              )}
              style={{
                width: animate ? `${(f.importance / max) * 100}%` : `${(f.importance / max) * 100}%`,
                transitionDelay: `${i * 90}ms`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
