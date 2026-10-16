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

/**
 * Parse what a person types into a duration field.
 *   "1:30" "1h30" "1h" "1.5" "1,5" "2"  → hours
 *   "90m" "90min" "45 mn"               → minutes
 *   a bare integer above 24 is read as minutes ("90" → 90)
 * Returns null when the text is not a duration.
 */
export function parseDuration(input: string): number | null {
  const s = input.trim().toLowerCase().replace(/\s+/g, '')
  if (!s) return null

  let m = s.match(/^(\d{1,2})[:h](\d{1,2})?$/)
  if (m) {
    const minutes = m[2] ? Number(m[2]) : 0
    if (minutes >= 60) return null
    return Number(m[1]) * 60 + minutes
  }

  m = s.match(/^(\d{1,4})(m|min|mn|mins|minutes?)$/)
  if (m) return Number(m[1])

  m = s.match(/^(\d{1,2})(?:[.,](\d{1,2}))?$/)
  if (m) {
    if (!m[2] && Number(m[1]) > 24) return Number(m[1])
    const hours = Number(`${m[1]}.${m[2] ?? '0'}`)
    return Math.round(hours * 60)
  }

  m = s.match(/^(\d{2,4})$/)
  if (m) return Number(m[1])

  return null
}

export const QUICK_DURATIONS = [15, 30, 60, 90, 120, 180, 240] as const
