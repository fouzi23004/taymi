import { describe, expect, it } from 'vitest'
import type { Profile, RollupRow } from '@/lib/types'
import { dailySeries, filterRollup, groupRollup, performanceByUser, totalMinutes } from './rollup'

const row = (work_date: string, user_id: string, client_id: string, task_id: string, minutes: number): RollupRow => ({
  work_date,
  user_id,
  client_id,
  task_id,
  minutes,
  entry_count: 1,
})

// Mon 2026-10-12 … Fri 2026-10-16
const rows: RollupRow[] = [
  row('2026-10-12', 'u1', 'c1', 't1', 240),
  row('2026-10-12', 'u1', 'c2', 't1', 240),
  row('2026-10-13', 'u1', 'c1', 't2', 120),
  row('2026-10-12', 'u2', 'c1', 't1', 60),
]

const profile = (id: string, target = 480): Profile => ({
  id,
  email: `${id}@x.test`,
  full_name: id,
  role: 'collaborator',
  manager_id: null,
  daily_target_minutes: target,
  active: true,
  created_at: '',
  updated_at: '',
})

describe('groupRollup', () => {
  it('totals by client, largest first', () => {
    expect(groupRollup(rows, 'client')).toEqual([
      { key: 'c1', minutes: 420, entries: 3, days: 2 },
      { key: 'c2', minutes: 240, entries: 1, days: 1 },
    ])
  })

  it('sorts days chronologically', () => {
    expect(groupRollup(rows, 'day').map((g) => g.key)).toEqual(['2026-10-12', '2026-10-13'])
  })
})

describe('filterRollup', () => {
  it('combines filters', () => {
    expect(totalMinutes(filterRollup(rows, { userId: 'u1', clientId: 'c1' }))).toBe(360)
  })
})

describe('dailySeries', () => {
  it('zero-fills empty days', () => {
    const s = dailySeries(rows, { from: '2026-10-12', to: '2026-10-14' })
    expect(s).toEqual([
      { date: '2026-10-12', minutes: 540 },
      { date: '2026-10-13', minutes: 120 },
      { date: '2026-10-14', minutes: 0 },
    ])
  })
})

describe('performanceByUser', () => {
  it('compares logged time with the daily target up to today', () => {
    const [u1, u2] = performanceByUser(
      rows,
      [profile('u1'), profile('u2', 240)],
      { from: '2026-10-12', to: '2026-10-18' },
      '2026-10-14',
    )
    expect(u1.profile.id).toBe('u1')
    expect(u1.minutes).toBe(600)
    expect(u1.workingDays).toBe(3)
    expect(u1.expectedMinutes).toBe(1440)
    expect(u1.missingDays).toEqual(['2026-10-14'])
    expect(u1.avgPerDay).toBe(300)
    expect(u1.clients).toBe(2)
    expect(u2.utilization).toBeCloseTo(60 / 720)
  })

  it('leaves out people with no daily target unless they logged time', () => {
    const perf = performanceByUser(rows, [profile('u1', 0), profile('u9', 0)], { from: '2026-10-12', to: '2026-10-14' }, '2026-10-14')
    expect(perf.map((p) => p.profile.id)).toEqual(['u1'])
    expect(perf[0].missingDays).toEqual([])
    expect(perf[0].utilization).toBeNull()
  })
})
