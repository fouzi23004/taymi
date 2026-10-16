import { daysInRange, workingDays, type DateRange, type ISODate } from '@/lib/dates'
import type { Profile, RollupRow } from '@/lib/types'

export type Dimension = 'user' | 'client' | 'task' | 'day'

export interface RollupFilters {
  userId?: string
  clientId?: string
  taskId?: string
}

export interface Group {
  key: string
  minutes: number
  entries: number
  days: number
}

const FIELD: Record<Dimension, keyof Pick<RollupRow, 'user_id' | 'client_id' | 'task_id' | 'work_date'>> = {
  user: 'user_id',
  client: 'client_id',
  task: 'task_id',
  day: 'work_date',
}

export function filterRollup(rows: RollupRow[], f: RollupFilters): RollupRow[] {
  return rows.filter(
    (r) =>
      (!f.userId || r.user_id === f.userId) &&
      (!f.clientId || r.client_id === f.clientId) &&
      (!f.taskId || r.task_id === f.taskId),
  )
}

export const totalMinutes = (rows: RollupRow[]) => rows.reduce((sum, r) => sum + Number(r.minutes), 0)

/** Totals per dimension value; days sort chronologically, everything else by time spent. */
export function groupRollup(rows: RollupRow[], dim: Dimension): Group[] {
  const field = FIELD[dim]
  const acc = new Map<string, { minutes: number; entries: number; days: Set<string> }>()
  for (const r of rows) {
    const key = String(r[field])
    const g = acc.get(key) ?? { minutes: 0, entries: 0, days: new Set<string>() }
    g.minutes += Number(r.minutes)
    g.entries += Number(r.entry_count)
    g.days.add(r.work_date)
    acc.set(key, g)
  }
  const groups = [...acc].map(([key, g]) => ({ key, minutes: g.minutes, entries: g.entries, days: g.days.size }))
  return dim === 'day'
    ? groups.sort((a, b) => a.key.localeCompare(b.key))
    : groups.sort((a, b) => b.minutes - a.minutes)
}

/** One point per calendar day of the range, zero-filled. */
export function dailySeries(rows: RollupRow[], range: DateRange): { date: ISODate; minutes: number }[] {
  const byDay = new Map(groupRollup(rows, 'day').map((g) => [g.key, g.minutes]))
  return daysInRange(range).map((date) => ({ date, minutes: byDay.get(date) ?? 0 }))
}

export interface Performance {
  profile: Profile
  minutes: number
  daysWorked: number
  workingDays: number
  expectedMinutes: number
  /** minutes / expectedMinutes, null when nothing was expected (e.g. future range). */
  utilization: number | null
  avgPerDay: number
  missingDays: ISODate[]
  clients: number
}

/**
 * Per-collaborator performance over the range. Expected time is the daily
 * target × Monday–Friday days up to `today` (future days are not "missing").
 */
export function performanceByUser(
  rows: RollupRow[],
  profiles: Profile[],
  range: DateRange,
  today: ISODate,
): Performance[] {
  const allWorkingDays = workingDays(range, today)
  // A daily target of 0 means "doesn't log time" (e.g. an admin): only listed if they did log some.
  const tracked = (p: Profile) => p.active && p.daily_target_minutes > 0
  return profiles
    .filter((p) => tracked(p) || rows.some((r) => r.user_id === p.id))
    .map((profile) => {
      const mine = rows.filter((r) => r.user_id === profile.id)
      const minutes = totalMinutes(mine)
      const worked = new Set(mine.map((r) => r.work_date))
      const expectedDays = tracked(profile) ? allWorkingDays : []
      const expectedMinutes = expectedDays.length * profile.daily_target_minutes
      return {
        profile,
        minutes,
        daysWorked: worked.size,
        workingDays: expectedDays.length,
        expectedMinutes,
        utilization: expectedMinutes > 0 ? minutes / expectedMinutes : null,
        avgPerDay: worked.size ? minutes / worked.size : 0,
        missingDays: expectedDays.filter((d) => !worked.has(d)),
        clients: new Set(mine.map((r) => r.client_id)).size,
      }
    })
    .sort((a, b) => b.minutes - a.minutes)
}
