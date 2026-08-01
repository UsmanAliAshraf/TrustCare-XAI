import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface Props {
  label: string
  value: string | number
  icon: LucideIcon
  tone?: 'primary' | 'success' | 'warning' | 'destructive'
  hint?: string
}

const TONES: Record<NonNullable<Props['tone']>, string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
}

export function StatCard({ label, value, icon: Icon, tone = 'primary', hint }: Props) {
  return (
    <Card className="hover:shadow-md">
      <CardContent className="flex items-center gap-4 p-5">
        <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl', TONES[tone])}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-bold leading-tight tabular-nums text-foreground">{value}</div>
          <div className="truncate text-sm text-muted-foreground">{label}</div>
          {hint && <div className="mt-0.5 text-xs text-muted-foreground/70">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  )
}
