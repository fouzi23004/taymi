import { clsx } from 'clsx'
import { useState } from 'react'
import { formatHM, parseDuration, QUICK_DURATIONS } from '@/lib/time'

interface Props {
  id?: string
  value: number | null
  onChange: (minutes: number | null) => void
  presets?: readonly number[]
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

/**
 * Free-text duration ("1h30", "1,5", "90m") with one-tap quick picks.
 * The text stays as typed while focused and is normalised on blur.
 */
export function DurationInput({ id, value, onChange, presets = QUICK_DURATIONS, ...aria }: Props) {
  const [text, setText] = useState(value !== null && value >= 0 ? formatHM(value) : '')
  const [focused, setFocused] = useState(false)
  const shown = focused ? text : value !== null && value >= 0 ? formatHM(value) : text

  return (
    <div className="flex flex-col gap-2">
      <input
        id={id}
        {...aria}
        inputMode="decimal"
        autoComplete="off"
        placeholder="1h30"
        className="input num text-lg tracking-tight"
        value={shown}
        onFocus={() => {
          setFocused(true)
          setText(value !== null && value >= 0 ? formatHM(value) : text)
        }}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          setText(e.target.value)
          onChange(e.target.value.trim() ? parseDuration(e.target.value) ?? -1 : null)
        }}
      />
      <div className="flex flex-wrap gap-1.5">
        {presets.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setText(formatHM(m))
              onChange(m)
            }}
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
