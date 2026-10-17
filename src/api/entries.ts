import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { DateRange, ISODate } from '@/lib/dates'
import { fetchAll, supabase, unwrap } from '@/lib/supabase'
import type { TimeEntry } from '@/lib/types'
import { keys } from './reference'

/** Entries of one person over a date range (the timesheet uses a week). */
export function useMyEntries(userId: string, range: DateRange) {
  return useQuery({
    queryKey: [...keys.entries, 'user', userId, range.from, range.to],
    placeholderData: keepPreviousData,
    queryFn: () =>
      fetchAll<TimeEntry>((from, to) =>
        supabase
          .from('time_entries')
          .select('*')
          .eq('user_id', userId)
          .gte('work_date', range.from)
          .lte('work_date', range.to)
          .order('work_date')
          .order('created_at')
          .order('id')
          .range(from, to),
      ),
  })
}

export interface EntryFilters {
  userId?: string
  clientId?: string
  taskId?: string
  exerciseId?: string
  /** A category filter, resolved by the caller to the ids of its tasks. */
  categoryTaskIds?: string[]
}

/** Entries of the period matching the report filters (not yet ordered or paged). */
export function filteredEntries(range: DateRange, filters: EntryFilters, count?: 'exact') {
  let q = supabase
    .from('time_entries')
    .select('*', { count })
    .gte('work_date', range.from)
    .lte('work_date', range.to)
  if (filters.userId) q = q.eq('user_id', filters.userId)
  if (filters.clientId) q = q.eq('client_id', filters.clientId)
  if (filters.taskId) q = q.eq('task_id', filters.taskId)
  if (filters.exerciseId) q = q.eq('exercise_id', filters.exerciseId)
  if (filters.categoryTaskIds) q = q.in('task_id', filters.categoryTaskIds)
  return q
}

/** Detailed entries for reports, one page at a time. */
export function useEntryDetails(range: DateRange, filters: EntryFilters, limit: number) {
  return useQuery({
    queryKey: [...keys.entries, 'details', range.from, range.to, filters, limit],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, count, error } = await filteredEntries(range, filters, 'exact')
        .order('work_date', { ascending: false })
        .order('created_at', { ascending: false })
        .order('id')
        .range(0, limit - 1)
      if (error) throw error
      return { rows: data ?? [], total: count ?? 0 }
    },
  })
}

export interface EntryDraft {
  id?: string
  client_id: string
  task_id: string
  exercise_id: string
  work_date: ISODate
  minutes: number
  comment: string | null
}

export function useSaveEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...draft }: EntryDraft) => {
      const row = { ...draft, comment: draft.comment?.trim() || null }
      if (id) return unwrap(await supabase.from('time_entries').update(row).eq('id', id).select().single())
      return unwrap(await supabase.from('time_entries').insert(row).select().single())
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.entries })
      void qc.invalidateQueries({ queryKey: keys.rollup })
    },
  })
}

export function useDeleteEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('time_entries').delete().eq('id', id)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.entries })
      void qc.invalidateQueries({ queryKey: keys.rollup })
    },
  })
}
