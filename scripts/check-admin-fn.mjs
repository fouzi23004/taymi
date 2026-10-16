// Local only: exercises the admin-users edge function (create, update, deactivate, permissions).
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
const env = Object.fromEntries(readFileSync('.env', 'utf8').trim().split('\n').map((l) => l.split('=')))
const users = JSON.parse(readFileSync('scripts/dev-users.json', 'utf8'))
if (!['http://127.0.0.1', 'http://localhost'].some((p) => env.VITE_SUPABASE_URL.startsWith(p))) throw new Error('Local Supabase only')
const creds = JSON.parse(readFileSync('scripts/dev-credentials.json', 'utf8'))
const client = async (email) => {
  const c = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  const { error } = await c.auth.signInWithPassword({ email, password: creds[email] })
  if (error) throw error
  return c
}
const call = async (c, body) => {
  const { data, error } = await c.functions.invoke('admin-users', { body })
  if (!error) return { ok: data }
  const payload = await error.context?.json?.().catch(() => null)
  return { err: payload?.error ?? error.message }
}
const admin = await client('admin@timeledger.test')
const collab = await client('amine@timeledger.test')
const email = `temp.${Date.now()}@timeledger.test`
const pw1 = `Tmp-${randomBytes(6).toString('base64url')}`
const pw2 = `Tmp-${randomBytes(6).toString('base64url')}`

console.log('collab creates user ->', (await call(collab, { action: 'create', email, password: pw1, full_name: 'X', role: 'collaborator' })).err)
const created = await call(admin, { action: 'create', email, password: pw1, full_name: 'Temp User', role: 'collaborator', daily_target_minutes: 420 })
console.log('admin creates user ->', created.ok?.profile?.role, created.ok?.profile?.daily_target_minutes, 'active:', created.ok?.profile?.active, created.err ?? '')
console.log('duplicate email ->', (await call(admin, { action: 'create', email, password: pw1, full_name: 'Dup', role: 'collaborator' })).err)
console.log('weak password ->', (await call(admin, { action: 'create', email: 'w' + email, password: 'short', full_name: 'W', role: 'collaborator' })).err)
const id = created.ok.profile.id
console.log('promote to manager ->', (await call(admin, { action: 'update', id, role: 'manager' })).ok?.profile?.role)
console.log('deactivate ->', (await call(admin, { action: 'update', id, active: false })).ok?.profile?.active)
const t = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
console.log('deactivated user signs in ->', (await t.auth.signInWithPassword({ email, password: pw1 })).error?.code)
console.log('reactivate ->', (await call(admin, { action: 'update', id, active: true })).ok?.profile?.active)
console.log('reset password ->', JSON.stringify((await call(admin, { action: 'set_password', id, password: pw2 })).ok))
console.log('signs in with new password ->', !(await t.auth.signInWithPassword({ email, password: pw2 })).error)
const meId = (await admin.auth.getUser()).data.user.id
console.log('admin deactivates self ->', (await call(admin, { action: 'update', id: meId, active: false })).err)
console.log('demote last admin ->', (await call(admin, { action: 'update', id: meId, role: 'collaborator' })).err)
console.log('cleanup deactivate ->', (await call(admin, { action: 'update', id, active: false })).ok?.profile?.active)
