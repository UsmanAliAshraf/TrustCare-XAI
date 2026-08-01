import { cn } from '@/lib/utils'
import type { RiskLevel } from '@/api/types'

interface Props {
  value: number // 0-100 probability of non-adherence
  risk: RiskLevel
  size?: number
  label?: string
}

// A semicircular gauge (green -> yellow -> red) with a needle at `value`.
export function RiskGauge({ value, risk, size = 220, label = 'Risk Probability' }: Props) {
  const r = 80
  const cx = 100
  const cy = 100
  const stroke = 16

  // Map 0-100 to a 180deg sweep (180deg at 0 -> 0deg at 100).
  const angle = 180 - (Math.min(100, Math.max(0, value)) / 100) * 180
  const rad = (angle * Math.PI) / 180
  const needleLen = r - 6
  const nx = cx + needleLen * Math.cos(rad)
  const ny = cy - needleLen * Math.sin(rad)

  const arc = (startPct: number, endPct: number) => {
    const a0 = 180 - startPct * 180
    const a1 = 180 - endPct * 180
    const p0 = { x: cx + r * Math.cos((a0 * Math.PI) / 180), y: cy - r * Math.sin((a0 * Math.PI) / 180) }
    const p1 = { x: cx + r * Math.cos((a1 * Math.PI) / 180), y: cy - r * Math.sin((a1 * Math.PI) / 180) }
    return `M ${p0.x} ${p0.y} A ${r} ${r} 0 0 1 ${p1.x} ${p1.y}`
  }

  const color =
    risk === 'Low' ? 'hsl(var(--success))' : risk === 'Medium' ? 'hsl(var(--warning))' : 'hsl(var(--destructive))'

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size * 0.62} viewBox="0 0 200 124" className="overflow-visible">
        {/* colored zones */}
        <path d={arc(0, 0.38)} fill="none" stroke="hsl(var(--success))" strokeWidth={stroke} strokeLinecap="round" />
        <path d={arc(0.38, 0.66)} fill="none" stroke="hsl(var(--warning))" strokeWidth={stroke} />
        <path d={arc(0.66, 1)} fill="none" stroke="hsl(var(--destructive))" strokeWidth={stroke} strokeLinecap="round" />

        {/* needle */}
        <line
          x1={cx}
          y1={cy}
          x2={nx}
          y2={ny}
          stroke="hsl(var(--foreground))"
          strokeWidth={3}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
        <circle cx={cx} cy={cy} r={7} fill="hsl(var(--foreground))" />
        <circle cx={cx} cy={cy} r={3} fill="hsl(var(--card))" />
      </svg>
      <div className="-mt-6 text-center">
        <div className="text-3xl font-bold tabular-nums" style={{ color }}>
          {value}%
        </div>
        <div className={cn('text-xs font-medium text-muted-foreground')}>{label}</div>
      </div>
      <div className="mt-3 flex w-full max-w-[220px] items-center justify-between px-2 text-[11px] font-medium text-muted-foreground">
        <span className="text-success">Low</span>
        <span className="text-warning">Medium</span>
        <span className="text-destructive">High</span>
      </div>
    </div>
  )
}
