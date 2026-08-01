import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { RiskLevel } from '@/api/types'

const MAP: Record<RiskLevel, { variant: 'success' | 'warning' | 'destructive'; label: string }> = {
  Low: { variant: 'success', label: 'Low Risk' },
  Medium: { variant: 'warning', label: 'Medium Risk' },
  High: { variant: 'destructive', label: 'High Risk' },
}

export function RiskBadge({ risk, className }: { risk: RiskLevel; className?: string }) {
  const { variant, label } = MAP[risk]
  return (
    <Badge variant={variant} className={cn('gap-1.5', className)}>
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          risk === 'Low' && 'bg-success',
          risk === 'Medium' && 'bg-warning',
          risk === 'High' && 'bg-destructive',
        )}
      />
      {label}
    </Badge>
  )
}
