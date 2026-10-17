import { daysInRange, workingDays, type DateRange, type ISODate } from '@/lib/dates'
import { logsTime, type Profile, type RollupRow } from '@/lib/types'

export type Dimension = 'user' | 'client' | 'category' | 'task' | 'exercise' | 'day'

export interface RollupFilters {
  userId?: string
  clientId?: string
  categoryId?: string
  taskId?: string
  exerciseId?: string
}

/** task id → category id; the roll-up rows carry the task, not its category. */
export type TaskCategories = Map<string, string>

export interface Group {
  key: string
  minutes: number
  entries: number
  days: number
}

function keyOf(r: RollupRow, dim: Dimension, taskCategories: TaskCategories): string {
  switch (dim) {
    case 'user':
      return r.user_id
    case 'client':
      return r.client_id
    case 'category':
      return taskCategories.get(r.task_id) ?? ''
    case 'task':
      return r.task_id
    case 'exercise':
      return r.exercise_id
    case 'day':
      return r.work_date
  }
}

export function filterRollup(rows: RollupRow[], f: RollupFilters, taskCategories: TaskCategories = new Map()): RollupRow[] {
  return rows.filter(
    (r) =>
      (!f.userId || r.user_id === f.userId) &&
      (!f.clientId || r.client_id === f.clientId) &&
      (!f.categoryId || taskCategories.get(r.task_id) === f.categoryId) &&
      (!f.taskId || r.task_id === f.taskId) &&
      (!f.exerciseId || r.exercise_id === f.exerciseId),
  )
}

export const totalMinutes = (rows: RollupRow[]) => rows.reduce((sum, r) => sum + Number(r.minutes), 0)

/** Totals per dimension value; days sort chronologically, everything else by time spent. */
export function groupRollup(rows: RollupRow[], dim: Dimension, taskCategories: TaskCategories = new Map()): Group[] {
  const acc = new Map<string, { minutes: number; entries: number; days: Set<string> }>()
  for (const r of rows) {
    const key = keyOf(r, dim, taskCategories)
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
  /** Share of working days with at least one entry; null when no day was expected. */
  fillRate: number | null
  avgPerDay: number
  missingDays: ISODate[]
  clients: number
}

/**
 * Per-collaborator activity over the range. Working days are Monday–Friday up
 * to `today` (future days are not "missing"). Admins are only listed once they
 * have logged time, and never have missing days.
 */
export function performanceByUser(
  rows: RollupRow[],
  profiles: Profile[],
  range: DateRange,
  today: ISODate,
): Performance[] {
  const allWorkingDays = workingDays(range, today)
  return profiles
    .filter((p) => logsTime(p) || rows.some((r) => r.user_id === p.id))
    .map((profile) => {
      const mine = rows.filter((r) => r.user_id === profile.id)
      const minutes = totalMinutes(mine)
      const worked = new Set(mine.map((r) => r.work_date))
      const expectedDays = logsTime(profile) ? allWorkingDays : []
      const missingDays = expectedDays.filter((d) => !worked.has(d))
      return {
        profile,
        minutes,
        daysWorked: worked.size,
        workingDays: expectedDays.length,
        fillRate: expectedDays.length ? (expectedDays.length - missingDays.length) / expectedDays.length : null,
        avgPerDay: worked.size ? minutes / worked.size : 0,
        missingDays,
        clients: new Set(mine.map((r) => r.client_id)).size,
      }
    })
    .sort((a, b) => b.minutes - a.minutes)
}
