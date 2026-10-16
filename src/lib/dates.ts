import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isWeekend,
  parseISO,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subMonths,
  subWeeks,
} from 'date-fns'
import { enGB, fr } from 'date-fns/locale'

/** Calendar dates travel as "YYYY-MM-DD" strings (Postgres `date`). */
export type ISODate = string

export const toISODate = (d: Date): ISODate => format(d, 'yyyy-MM-dd')
export const fromISODate = (s: ISODate): Date => parseISO(s)
export const todayISO = (): ISODate => toISODate(new Date())
export const shiftISODate = (s: ISODate, days: number): ISODate => toISODate(addDays(fromISODate(s), days))

export const dateLocale = (lang: string) => (lang.startsWith('fr') ? fr : enGB)

export function formatDate(s: ISODate, lang: string, pattern = 'EEE d MMM yyyy'): string {
  return format(fromISODate(s), pattern, { locale: dateLocale(lang) })
}

export interface DateRange {
  from: ISODate
  to: ISODate
}

export type RangePreset =
  | 'today'
  | 'yesterday'
  | 'thisWeek'
  | 'lastWeek'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisYear'

export const RANGE_PRESETS: RangePreset[] = [
  'today',
  'yesterday',
  'thisWeek',
  'lastWeek',
  'thisMonth',
  'lastMonth',
  'thisYear',
]

export function presetRange(preset: RangePreset, now = new Date()): DateRange {
  const week = { weekStartsOn: 1 as const }
  const r = (a: Date, b: Date): DateRange => ({ from: toISODate(a), to: toISODate(b) })
  switch (preset) {
    case 'today':
      return r(now, now)
    case 'yesterday':
      return r(addDays(now, -1), addDays(now, -1))
    case 'thisWeek':
      return r(startOfWeek(now, week), endOfWeek(now, week))
    case 'lastWeek': {
      const d = subWeeks(now, 1)
      return r(startOfWeek(d, week), endOfWeek(d, week))
    }
    case 'thisMonth':
      return r(startOfMonth(now), endOfMonth(now))
    case 'lastMonth': {
      const d = subMonths(now, 1)
      return r(startOfMonth(d), endOfMonth(d))
    }
    case 'thisYear':
      return r(startOfYear(now), endOfYear(now))
  }
}

/** Every calendar day in the range, inclusive. */
export function daysInRange({ from, to }: DateRange): ISODate[] {
  if (from > to) return []
  return eachDayOfInterval({ start: fromISODate(from), end: fromISODate(to) }).map(toISODate)
}

/** Monday–Friday days in the range, capped at `until` (usually today) so future days don't count as missing. */
export function workingDays(range: DateRange, until: ISODate = todayISO()): ISODate[] {
  const to = range.to < until ? range.to : until
  return daysInRange({ from: range.from, to }).filter((d) => !isWeekend(fromISODate(d)))
}
