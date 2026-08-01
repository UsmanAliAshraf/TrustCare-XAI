import { ShieldPlus } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Logo({ collapsed = false, className }: { collapsed?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <ShieldPlus className="h-5 w-5" />
      </div>
      {!collapsed && (
        <div className="leading-tight">
          <div className="text-[15px] font-bold tracking-tight text-foreground">TrustCare XAI</div>
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Adherence Intelligence
          </div>
        </div>
      )}
    </div>
  )
}
