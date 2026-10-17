// admin-users — user management for admins.
//
// Creating auth users, changing their e-mail/password and blocking sign-in
// needs the secret (service role) key, so it cannot run in the browser.
// The gateway's JWT check is off (config.toml): requireAdmin() validates the
// caller's session itself, which also works with asymmetric JWT signing keys.
//
// POST body (JSON):
//   { action: "create", email, password, full_name, role, manager_id? }
//   { action: "update", id, full_name?, role?, manager_id?, active?, email? }
//   { action: "set_password", id, password }

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

type Role = 'admin' | 'manager' | 'collaborator'
const ROLES: Role[] = ['admin', 'manager', 'collaborator']
const BANNED_FOREVER = '876000h' // ~100 years

class HttpError extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message ?? code)
  }
}

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: corsHeaders })

function env(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new HttpError(500, 'server_misconfigured', `Missing ${name}`)
  return value
}

/** The default secret key (new API keys), falling back to the legacy service_role key. */
function secretKey(): string {
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>
    if (keys.default) return keys.default
  } catch {
    // fall through to the legacy key
  }
  return env('SUPABASE_SERVICE_ROLE_KEY')
}

function str(value: unknown, field: string, { optional = false, max = 200 } = {}): string | undefined {
  if (value === undefined || value === null) {
    if (optional) return undefined
    throw new HttpError(400, 'invalid_input', `${field} is required`)
  }
  if (typeof value !== 'string') throw new HttpError(400, 'invalid_input', `${field} must be a string`)
  const trimmed = value.trim()
  if (!optional && trimmed.length === 0) throw new HttpError(400, 'invalid_input', `${field} is required`)
  if (trimmed.length > max) throw new HttpError(400, 'invalid_input', `${field} is too long`)
  return trimmed
}

function email(value: unknown, optional = false): string | undefined {
  const v = str(value, 'email', { optional, max: 254 })
  if (v === undefined) return undefined
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new HttpError(400, 'invalid_email')
  return v.toLowerCase()
}

function password(value: unknown): string {
  if (typeof value !== 'string' || value.length < 8) throw new HttpError(400, 'weak_password')
  if (value.length > 72) throw new HttpError(400, 'invalid_input', 'password is too long')
  return value
}

function role(value: unknown, optional = false): Role | undefined {
  if (value === undefined && optional) return undefined
  if (!ROLES.includes(value as Role)) throw new HttpError(400, 'invalid_input', 'invalid role')
  return value as Role
}

function uuidOrNull(value: unknown, field: string): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (typeof value !== 'string' || !/^[0-9a-f-]{36}$/i.test(value)) {
    throw new HttpError(400, 'invalid_input', `${field} must be a uuid`)
  }
  return value
}

/** Translate Postgres / GoTrue errors into stable codes the UI can translate. */
function fromDbError(error: { message?: string; code?: string; hint?: string }): HttpError {
  if (error.hint === 'last_admin') return new HttpError(409, 'last_admin')
  if (error.code === '23505' || /already (been )?registered|already exists/i.test(error.message ?? '')) {
    return new HttpError(409, 'email_taken')
  }
  return new HttpError(400, 'database_error', error.message)
}

async function requireAdmin(req: Request, admin: SupabaseClient): Promise<string> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) throw new HttpError(401, 'unauthenticated')

  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) throw new HttpError(401, 'unauthenticated')

  const { data: profile } = await admin
    .from('profiles')
    .select('role, active')
    .eq('id', data.user.id)
    .maybeSingle()

  if (!profile || !profile.active || profile.role !== 'admin') throw new HttpError(403, 'forbidden')
  return data.user.id
}

async function createUser(admin: SupabaseClient, body: Record<string, unknown>) {
  const input = {
    email: email(body.email)!,
    password: password(body.password),
    full_name: str(body.full_name, 'full_name')!,
    role: role(body.role)!,
    manager_id: uuidOrNull(body.manager_id, 'manager_id') ?? null,
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.full_name },
  })
  if (error || !data.user) throw fromDbError(error ?? {})

  // The on_auth_user_created trigger inserted the profile; apply the rest.
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .update({
      full_name: input.full_name,
      role: input.role,
      manager_id: input.manager_id,
      active: true, // profiles start inactive unless an admin created them
    })
    .eq('id', data.user.id)
    .select()
    .single()

  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id)
    throw fromDbError(profileError)
  }
  return profile
}

async function updateUser(admin: SupabaseClient, callerId: string, body: Record<string, unknown>) {
  const id = uuidOrNull(body.id, 'id')
  if (!id) throw new HttpError(400, 'invalid_input', 'id is required')

  const patch: Record<string, unknown> = {}
  const fullName = str(body.full_name, 'full_name', { optional: true })
  if (fullName !== undefined) patch.full_name = fullName
  const newRole = role(body.role, true)
  if (newRole !== undefined) patch.role = newRole
  const managerId = uuidOrNull(body.manager_id, 'manager_id')
  if (managerId !== undefined) patch.manager_id = managerId
  if (body.active !== undefined) {
    if (typeof body.active !== 'boolean') throw new HttpError(400, 'invalid_input', 'active must be boolean')
    if (!body.active && id === callerId) throw new HttpError(409, 'cannot_deactivate_self')
    patch.active = body.active
  }
  const newEmail = email(body.email, true)

  if (newEmail !== undefined) {
    const { error } = await admin.auth.admin.updateUserById(id, { email: newEmail, email_confirm: true })
    if (error) throw fromDbError(error)
    patch.email = newEmail
  }

  const { data: profile, error } = await admin
    .from('profiles')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw fromDbError(error)

  if (patch.active !== undefined) {
    const { error: banError } = await admin.auth.admin.updateUserById(id, {
      ban_duration: patch.active ? 'none' : BANNED_FOREVER,
    })
    if (banError) throw fromDbError(banError)
  }
  return profile
}

async function setPassword(admin: SupabaseClient, body: Record<string, unknown>) {
  const id = uuidOrNull(body.id, 'id')
  if (!id) throw new HttpError(400, 'invalid_input', 'id is required')
  const { error } = await admin.auth.admin.updateUserById(id, { password: password(body.password) })
  if (error) throw fromDbError(error)
  return { ok: true }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  try {
    const admin = createClient(env('SUPABASE_URL'), secretKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const callerId = await requireAdmin(req, admin)

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    if (!body || typeof body !== 'object') throw new HttpError(400, 'invalid_input')

    switch (body.action) {
      case 'create':
        return json({ profile: await createUser(admin, body) }, 201)
      case 'update':
        return json({ profile: await updateUser(admin, callerId, body) })
      case 'set_password':
        return json(await setPassword(admin, body))
      default:
        throw new HttpError(400, 'invalid_input', 'unknown action')
    }
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.code, message: err.message }, err.status)
    console.error(err)
    return json({ error: 'internal_error' }, 500)
  }
})
