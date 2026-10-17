import { clsx } from 'clsx'
import { Gauge } from '@/components/ui/misc'

/** Share of working days filled in. ≥ 95 % reads as fine, < 70 % as a concern. */
export function FillRateCell({ value }: { value: number | null }) {
  if (value === null) return <span className="text-ink-3">—</span>
  const tone = value >= 0.95 ? 'green' : value >= 0.7 ? 'brass' : 'stamp'
  return (
    <div className="flex items-center gap-3">
      <Gauge value={value} tone={tone} className="flex-1" />
      <span
        className={clsx(
          'num w-11 text-right text-xs font-medium',
          tone === 'green' ? 'text-ledger' : tone === 'brass' ? 'text-[#7a5410]' : 'text-stamp',
        )}
      >
        {Math.round(value * 100)}%
      </span>
    </div>
  )
}
