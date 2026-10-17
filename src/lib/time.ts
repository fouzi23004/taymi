/** Durations are stored as integer minutes everywhere. */

/** 450 → "7h30", 60 → "1h00", 0 → "0h00" */
export function formatHM(minutes: number): string {
  const sign = minutes < 0 ? '−' : ''
  const m = Math.abs(Math.round(minutes))
  return `${sign}${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`
}

/** 450 → "7.5" (en) / "7,5" (fr). Used for invoicing exports. */
export function formatDecimalHours(minutes: number, locale: string, fractionDigits = 2): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).format(minutes / 60)
}

export const QUICK_DURATIONS = [15, 30, 60, 90, 120, 180, 240] as const
