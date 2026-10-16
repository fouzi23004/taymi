import type { Session } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/types'

interface AuthState {
  session: Session | null
  profile: Profile | null
  /** True until the session (and its profile, if signed in) is known. */
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: 'invalid' | 'deactivated' | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      if (!next) queryClient.clear()
    })
    return () => data.subscription.unsubscribe()
  }, [queryClient])

  const userId = session?.user.id
  const profileQuery = useQuery({
    queryKey: ['me', userId],
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId!).maybeSingle()
      if (error) throw error
      return data
    },
  })

  const signIn = useCallback<AuthState['signIn']>(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error) return { error: null }
    return { error: /banned/i.test(error.message) || error.code === 'user_banned' ? 'deactivated' : 'invalid' }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    queryClient.clear()
  }, [queryClient])

  const value = useMemo<AuthState>(
    () => ({
      session,
      profile: profileQuery.data ?? null,
      loading: sessionLoading || (Boolean(userId) && profileQuery.isPending),
      signIn,
      signOut,
    }),
    [session, profileQuery.data, profileQuery.isPending, sessionLoading, userId, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

/** The signed-in, active profile. Only use under <RequireAuth>. */
export function useMe(): Profile {
  const { profile } = useAuth()
  if (!profile) throw new Error('useMe used without a signed-in profile')
  return profile
}
