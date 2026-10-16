import { clsx } from 'clsx'
import type { ReactNode } from 'react'

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 animate-rise">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="font-display text-[34px] leading-[1.1] font-medium tracking-[-0.01em] text-ink sm:text-[40px]">
          {title}
        </h1>
        {subtitle && <p className="mt-2 max-w-xl text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

type Tone = 'neutral' | 'green' | 'brass' | 'stamp'
const TONES: Record<Tone, string> = {
  neutral: 'bg-paper-2 text-ink-2 ring-rule-2',
  green: 'bg-ledger-soft text-ledger ring-ledger/20',
  brass: 'bg-brass-soft text-[#7a5410] ring-brass/30',
  stamp: 'bg-stamp-soft text-stamp ring-stamp/25',
}

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium whitespace-nowrap ring-1 ring-inset',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function EmptyState({ icon, title, hint, action }: { icon?: ReactNode; title: ReactNode; hint?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-4 grid size-12 place-items-center rounded-full bg-paper-2 text-ink-3">{icon}</div>}
      <p className="font-display text-lg text-ink">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-ink-3">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Stat({
  label,
  value,
  hint,
  accent,
  delay = 0,
}: {
  label: ReactNode
  value: ReactNode
  hint?: ReactNode
  accent?: boolean
  delay?: number
}) {
  return (
    <div
      className={clsx(
        'sheet relative overflow-hidden px-5 py-4 animate-rise',
        accent && 'border-ledger/30 bg-ledger text-paper',
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className={clsx('eyebrow', accent && 'text-paper/60')}>{label}</p>
      <p className="num mt-2 text-[28px] leading-none font-medium tracking-tight">{value}</p>
      {hint && <p className={clsx('mt-2 text-xs', accent ? 'text-paper/70' : 'text-ink-3')}>{hint}</p>}
    </div>
  )
}

/** Initials avatar with a stable tint per person. */
export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)
  return (
    <span
      aria-hidden
      className={clsx('grid size-8 shrink-0 place-items-center rounded-full font-mono text-[11px] font-medium', className)}
      style={{ background: `oklch(0.9 0.045 ${hue})`, color: `oklch(0.35 0.07 ${hue})` }}
    >
      {initials || '·'}
    </span>
  )
}

/** Thin horizontal gauge (0–1+), used for shares and target progress. */
export function Gauge({ value, tone = 'green', className }: { value: number; tone?: 'green' | 'brass' | 'stamp'; className?: string }) {
  const color = { green: 'bg-ledger-2', brass: 'bg-brass', stamp: 'bg-stamp' }[tone]
  return (
    <div className={clsx('h-1.5 w-full overflow-hidden rounded-full bg-paper-2', className)}>
      <div
        className={clsx('h-full rounded-full transition-[width] duration-500', color)}
        style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
      />
    </div>
  )
}
