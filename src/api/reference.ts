import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchAll, supabase, unwrap } from '@/lib/supabase'
import type {
  Category,
  CategoryInput,
  Client,
  ClientCategory,
  ClientInput,
  Exercise,
  ExerciseInput,
  Profile,
  Task,
  TaskInput,
} from '@/lib/types'

export const keys = {
  profiles: ['profiles'] as const,
  clients: ['clients'] as const,
  categories: ['categories'] as const,
  clientCategories: ['client_categories'] as const,
  exercises: ['exercises'] as const,
  tasks: ['tasks'] as const,
  entries: ['entries'] as const,
  rollup: ['rollup'] as const,
}

const REFERENCE_STALE = 60_000

/** Profiles visible to the caller (RLS: self, team for managers, all for admins). */
export function useProfiles() {
  return useQuery({
    queryKey: keys.profiles,
    staleTime: REFERENCE_STALE,
    queryFn: () =>
      fetchAll<Profile>((from, to) =>
        supabase.from('profiles').select('*').order('full_name').order('id').range(from, to),
      ),
  })
}

/** All clients, archived included (reports must still show their names). */
export function useClients() {
  return useQuery({
    queryKey: keys.clients,
    staleTime: REFERENCE_STALE,
    queryFn: () =>
      fetchAll<Client>((from, to) => supabase.from('clients').select('*').order('name').order('id').range(from, to)),
  })
}

export function useCategories() {
  return useQuery({
    queryKey: keys.categories,
    staleTime: REFERENCE_STALE,
    queryFn: () =>
      fetchAll<Category>((from, to) =>
        supabase.from('categories').select('*').order('name').order('id').range(from, to),
      ),
  })
}

/** Which categories of work can be done for which client. */
export function useClientCategories() {
  return useQuery({
    queryKey: keys.clientCategories,
    staleTime: REFERENCE_STALE,
    queryFn: () =>
      fetchAll<ClientCategory>((from, to) =>
        supabase
          .from('client_categories')
          .select('*')
          .order('client_id')
          .order('category_id')
          .range(from, to),
      ),
  })
}

/** Exercises, most recent first ("2026" before "2025"). */
export function useExercises() {
  return useQuery({
    queryKey: keys.exercises,
    staleTime: REFERENCE_STALE,
    queryFn: () =>
      fetchAll<Exercise>((from, to) =>
        supabase.from('exercises').select('*').order('name', { ascending: false }).order('id').range(from, to),
      ),
  })
}

export function useTasks() {
  return useQuery({
    queryKey: keys.tasks,
    staleTime: REFERENCE_STALE,
    queryFn: () =>
      fetchAll<Task>((from, to) => supabase.from('tasks').select('*').order('name').order('id').range(from, to)),
  })
}

/** id → record lookup, handy for reports. */
export function indexById<T extends { id: string }>(rows: T[] | undefined): Map<string, T> {
  return new Map((rows ?? []).map((r) => [r.id, r]))
}

/** client id → set of category ids assigned to it. */
export function categoriesByClient(rows: ClientCategory[] | undefined): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  for (const r of rows ?? []) {
    const set = map.get(r.client_id) ?? new Set<string>()
    set.add(r.category_id)
    map.set(r.client_id, set)
  }
  return map
}

/** Active tasks a collaborator can pick for a client: those of the client's categories. */
export function tasksForClient(tasks: Task[], clientCategoryIds: Set<string> | undefined): Task[] {
  if (!clientCategoryIds?.size) return []
  return tasks.filter((t) => t.active && clientCategoryIds.has(t.category_id))
}

const blankToNull = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null)

export function useSaveClient() {
  const qc = useQueryClient()
  return useMutation({
    /** `categoryIds` replaces the client's categories when given; left untouched otherwise. */
    mutationFn: async ({ id, categoryIds, ...input }: ClientInput & { id?: string; categoryIds?: string[] }) => {
      const row = {
        name: input.name?.trim(),
        reference: blankToNull(input.reference),
        contact_name: blankToNull(input.contact_name),
        contact_email: blankToNull(input.contact_email),
        notes: blankToNull(input.notes),
        active: input.active,
      }
      const client = id
        ? unwrap(await supabase.from('clients').update(row).eq('id', id).select().single())
        : unwrap(await supabase.from('clients').insert({ ...row, name: row.name ?? '' }).select().single())
      if (!client) throw new Error('Client not saved')

      if (categoryIds) {
        const current = (
          unwrap(await supabase.from('client_categories').select('category_id').eq('client_id', client.id)) ?? []
        ).map((r) => r.category_id)
        const removed = current.filter((c) => !categoryIds.includes(c))
        const added = categoryIds.filter((c) => !current.includes(c))
        if (removed.length) {
          unwrap(await supabase.from('client_categories').delete().eq('client_id', client.id).in('category_id', removed))
        }
        if (added.length) {
          unwrap(await supabase.from('client_categories').insert(added.map((category_id) => ({ client_id: client.id, category_id }))))
        }
      }
      return client
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.clients })
      void qc.invalidateQueries({ queryKey: keys.clientCategories })
    },
  })
}

export function useDeleteClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('clients').delete().eq('id', id)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.clients })
      void qc.invalidateQueries({ queryKey: keys.clientCategories })
    },
  })
}

export function useSaveCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: CategoryInput & { id?: string }) => {
      const row = { name: input.name?.trim(), description: blankToNull(input.description), active: input.active }
      if (id) return unwrap(await supabase.from('categories').update(row).eq('id', id).select().single())
      return unwrap(await supabase.from('categories').insert({ ...row, name: row.name ?? '' }).select().single())
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.categories }),
  })
}

export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('categories').delete().eq('id', id)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.categories })
      void qc.invalidateQueries({ queryKey: keys.clientCategories })
    },
  })
}

export function useSaveExercise() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: ExerciseInput & { id?: string }) => {
      const row = { name: input.name?.trim(), active: input.active }
      if (id) return unwrap(await supabase.from('exercises').update(row).eq('id', id).select().single())
      return unwrap(await supabase.from('exercises').insert({ ...row, name: row.name ?? '' }).select().single())
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.exercises }),
  })
}

export function useDeleteExercise() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('exercises').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.exercises }),
  })
}

export function useSaveTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: TaskInput & { id?: string }) => {
      const row = {
        name: input.name?.trim(),
        description: blankToNull(input.description),
        category_id: input.category_id,
        active: input.active,
      }
      if (id) return unwrap(await supabase.from('tasks').update(row).eq('id', id).select().single())
      return unwrap(
        await supabase
          .from('tasks')
          .insert({ ...row, name: row.name ?? '', category_id: row.category_id ?? '' })
          .select()
          .single(),
      )
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.tasks }),
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('tasks').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.tasks }),
  })
}
