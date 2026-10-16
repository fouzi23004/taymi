import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { DateRange } from '@/lib/dates'
import { fetchAll, supabase } from '@/lib/supabase'
import type { RollupRow } from '@/lib/types'
import { keys } from './reference'

/** (day, collaborator, client, task) totals for the period — the raw material of every report. */
export function useRollup(range: DateRange) {
  return useQuery({
    queryKey: [...keys.rollup, range.from, range.to],
    placeholderData: keepPreviousData,
    queryFn: () =>
      fetchAll<RollupRow>((from, to) =>
        supabase.rpc('report_rollup', { p_from: range.from, p_to: range.to }).range(from, to),
      ),
  })
}
