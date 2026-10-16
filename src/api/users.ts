import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AppError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import type { Profile, Role } from '@/lib/types'
import { keys } from './reference'

export interface NewUser {
  email: string
  password: string
  full_name: string
  role: Role
  manager_id: string | null
  daily_target_minutes: number
}

export interface UserPatch {
  id: string
  email?: string
  full_name?: string
  role?: Role
  manager_id?: string | null
  daily_target_minutes?: number
  active?: boolean
}

type AdminAction =
  | ({ action: 'create' } & NewUser)
  | ({ action: 'update' } & UserPatch)
  | { action: 'set_password'; id: string; password: string }

/** Call the admin-users edge function and turn its errors into AppErrors. */
async function adminUsers<T>(body: AdminAction): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('admin-users', { body })
  if (!error) return data as T
  if (error instanceof FunctionsHttpError) {
    const payload = await (error.context as Response).json().catch(() => null)
    throw new AppError(payload?.error ?? 'generic', payload?.message)
  }
  if (error instanceof FunctionsFetchError || error instanceof FunctionsRelayError) {
    throw new AppError('function_unavailable')
  }
  throw error
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: NewUser) => adminUsers<{ profile: Profile }>({ action: 'create', ...input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.profiles }),
  })
}

export function useUpdateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: UserPatch) => adminUsers<{ profile: Profile }>({ action: 'update', ...patch }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.profiles })
      void qc.invalidateQueries({ queryKey: ['me'] })
    },
  })
}

export function useSetPassword() {
  return useMutation({
    mutationFn: (input: { id: string; password: string }) => adminUsers({ action: 'set_password', ...input }),
  })
}
