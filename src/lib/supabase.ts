import { createClient, type PostgrestError } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && key)

export const supabase = createClient<Database>(url ?? 'http://localhost:54321', key ?? 'missing-key', {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'tl.auth' },
})

type PageResult<T> = PromiseLike<{ data: T[] | null; error: PostgrestError | null }>

/**
 * PostgREST caps every response (1000 rows by default). Walk the pages of an
 * ordered query until a short page comes back.
 */
export async function fetchAll<T>(page: (from: number, to: number) => PageResult<T>, pageSize = 1000): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < pageSize) return rows
  }
}

/** Unwrap a Supabase response, throwing its error. */
export function unwrap<T>(res: { data: T; error: PostgrestError | null }): T {
  if (res.error) throw res.error
  return res.data
}
