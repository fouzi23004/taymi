import { clsx } from 'clsx'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatHM, QUICK_DURATIONS } from '@/lib/time'

interface Props {
  id?: string
  /** Total minutes; null when both boxes are empty, -1 when what is typed is not valid. */
  value: number | null
  onChange: (minutes: number | null) => void
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

const split = (m: number | null) =>
  m !== null && m >= 0 ? { h: String(Math.floor(m / 60)), m: String(m % 60) } : { h: '', m: '' }

/** Two boxes, hours and minutes, plus one-tap quick picks. Remount with a `key` to reset. */
export function DurationInput({ id, value, onChange, ...aria }: Props) {
  const { t } = useTranslation()
  const [parts, setParts] = useState(() => split(value))

  function update(next: { h: string; m: string }) {
    setParts(next)
    if (!next.h.trim() && !next.m.trim()) return onChange(null)
    const h = next.h.trim() ? Number(next.h) : 0
    const m = next.m.trim() ? Number(next.m) : 0
    const valid = Number.isInteger(h) && Number.isInteger(m) && h >= 0 && h <= 24 && m >= 0 && m <= 59
    onChange(valid ? h * 60 + m : -1)
  }

  const box = (key: 'h' | 'm', label: string, unit: string, max: number, extra?: object) => (
    <label className="relative flex-1">
      <span className="sr-only">{label}</span>
      <input
        {...extra}
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        step={key === 'm' ? 5 : 1}
        placeholder="0"
        className="input num pr-14 text-lg tracking-tight [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        value={parts[key]}
        onChange={(e) => update({ ...parts, [key]: e.target.value.replace(/\D/g, '').slice(0, 2) })}
        onFocus={(e) => e.target.select()}
      />
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-ink-3">{unit}</span>
    </label>
  )

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {box('h', t('timesheet.hours'), t('timesheet.hoursUnit'), 24, { id, ...aria })}
        {box('m', t('timesheet.minutes'), t('timesheet.minutesUnit'), 59, { 'aria-invalid': aria['aria-invalid'] })}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {QUICK_DURATIONS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => update(split(m))}
            className={clsx(
              'num rounded-md border px-2 py-1 text-xs transition',
              value === m
                ? 'border-ledger bg-ledger text-paper'
                : 'border-rule-2 bg-white/60 text-ink-2 hover:border-ledger-2 hover:text-ledger',
            )}
          >
            {formatHM(m)}
          </button>
        ))}
      </div>
    </div>
  )
}
