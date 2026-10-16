import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchAll, supabase, unwrap } from '@/lib/supabase'
import type { Client, ClientInput, Profile, Task, TaskInput } from '@/lib/types'

export const keys = {
  profiles: ['profiles'] as const,
  clients: ['clients'] as const,
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

/** Tasks a collaborator can pick for a client: generic ones plus that client's own. */
export function tasksForClient(tasks: Task[], clientId: string | null | undefined): Task[] {
  if (!clientId) return []
  return tasks.filter((t) => t.active && (t.client_id === null || t.client_id === clientId))
}

const blankToNull = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null)

export function useSaveClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: ClientInput & { id?: string }) => {
      const row = {
        name: input.name?.trim(),
        reference: blankToNull(input.reference),
        contact_name: blankToNull(input.contact_name),
        contact_email: blankToNull(input.contact_email),
        notes: blankToNull(input.notes),
        active: input.active,
      }
      if (id) return unwrap(await supabase.from('clients').update(row).eq('id', id).select().single())
      return unwrap(await supabase.from('clients').insert({ ...row, name: row.name ?? '' }).select().single())
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.clients }),
  })
}

export function useDeleteClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('clients').delete().eq('id', id)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.clients })
      void qc.invalidateQueries({ queryKey: keys.tasks })
    },
  })
}

export function useSaveTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: TaskInput & { id?: string }) => {
      const row = {
        name: input.name?.trim(),
        description: blankToNull(input.description),
        client_id: input.client_id || null,
        active: input.active,
      }
      if (id) return unwrap(await supabase.from('tasks').update(row).eq('id', id).select().single())
      return unwrap(await supabase.from('tasks').insert({ ...row, name: row.name ?? '' }).select().single())
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
