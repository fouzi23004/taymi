import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { FullPageSpinner } from '@/components/ui/Spinner'
import type { Role } from '@/lib/types'
import { useAuth } from './AuthProvider'

/** Signed-in, active users only. A deactivated or profile-less session is signed out. */
export function RequireAuth() {
  const { session, profile, loading, signOut } = useAuth()
  const location = useLocation()
  const orphan = Boolean(session) && !loading && (!profile || !profile.active)

  useEffect(() => {
    if (orphan) void signOut()
  }, [orphan, signOut])

  if (loading || orphan) return <FullPageSpinner />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

export function RequireRole({ roles }: { roles: Role[] }) {
  const { profile } = useAuth()
  if (!profile || !roles.includes(profile.role)) return <Navigate to="/" replace />
  return <Outlet />
}

export const StaffOnly = () => <RequireRole roles={['admin', 'manager']} />
export const AdminOnly = () => <RequireRole roles={['admin']} />
