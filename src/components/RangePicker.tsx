import { clsx } from 'clsx'
import { useTranslation } from 'react-i18next'
import { presetRange, RANGE_PRESETS, type DateRange, type RangePreset } from '@/lib/dates'

export type RangeValue = { preset: RangePreset | 'custom' } & DateRange

export function rangeFromPreset(preset: RangePreset): RangeValue {
  return { preset, ...presetRange(preset) }
}

/** Preset chips + explicit from/to dates. */
export function RangePicker({
  value,
  onChange,
  presets = RANGE_PRESETS,
}: {
  value: RangeValue
  onChange: (v: RangeValue) => void
  presets?: RangePreset[]
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex flex-wrap gap-1 rounded-xl border border-rule bg-card/70 p-1" role="group" aria-label={t('common.period')}>
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={value.preset === p}
            onClick={() => onChange(rangeFromPreset(p))}
            className={clsx(
              'rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition',
              value.preset === p ? 'bg-ink text-paper shadow-sm' : 'text-ink-2 hover:bg-paper-2 hover:text-ink',
            )}
          >
            {t(`ranges.${p}`)}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 text-sm text-ink-3">
        <input
          type="date"
          aria-label={t('common.from')}
          className="input num w-auto py-1.5 text-[13px]"
          value={value.from}
          max={value.to}
          onChange={(e) => e.target.value && onChange({ preset: 'custom', from: e.target.value, to: value.to })}
        />
        <span>→</span>
        <input
          type="date"
          aria-label={t('common.to')}
          className="input num w-auto py-1.5 text-[13px]"
          value={value.to}
          min={value.from}
          onChange={(e) => e.target.value && onChange({ preset: 'custom', from: value.from, to: e.target.value })}
        />
      </div>
    </div>
  )
}
