// Local development only: create the accounts in scripts/dev-users.json and
// a few weeks of sample time entries, so every screen has something to show.
//
//   npm run db:start
//   node scripts/seed-dev.mjs            (reads keys from `supabase status`)
//
// Passwords are generated on first run and written to
// scripts/dev-credentials.json (gitignored) — no password lives in the repo.
// Never point this at a production project.

import { execSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const CREDENTIALS = new URL('./dev-credentials.json', import.meta.url)

const status = JSON.parse(execSync('npx supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }))
const url = status.API_URL
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(url)) throw new Error(`Refusing to seed a non-local instance: ${url}`)

const admin = createClient(url, status.SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const users = JSON.parse(readFileSync(new URL('./dev-users.json', import.meta.url), 'utf8'))
const passwords = existsSync(CREDENTIALS) ? JSON.parse(readFileSync(CREDENTIALS, 'utf8')) : {}
for (const u of users) passwords[u.email] ??= `Dev-${randomBytes(6).toString('base64url')}`

const ids = {}
for (const u of users) {
  const { data, error } = await admin.auth.admin.createUser({
    email: u.email,
    password: passwords[u.email],
    email_confirm: true,
    user_metadata: { full_name: u.full_name },
  })
  if (error && !/already/i.test(error.message)) throw error
  const id = data?.user?.id ?? (await admin.from('profiles').select('id').eq('email', u.email).single()).data.id
  ids[u.email] = id
  if (!data?.user) {
    // Existing account: make sure it matches the stored password.
    const { error: pwError } = await admin.auth.admin.updateUserById(id, { password: passwords[u.email] })
    if (pwError) throw pwError
  }
}
writeFileSync(CREDENTIALS, JSON.stringify(passwords, null, 2) + '\n')
console.log(`Test account passwords: ${CREDENTIALS.pathname.replace(/^\/([A-Z]:)/, '$1')}`)
for (const u of users) {
  const { error } = await admin
    .from('profiles')
    .update({ full_name: u.full_name, role: u.role, manager_id: u.manager ? ids[u.manager] : null, daily_target_minutes: u.daily_target_minutes ?? 480, active: true })
    .eq('id', ids[u.email])
  if (error) throw error
}

const { count } = await admin.from('time_entries').select('*', { count: 'exact', head: true })
if (count) {
  console.log(`Users ready; ${count} entries already present, skipping sample entries.`)
  process.exit(0)
}

const { data: clients } = await admin.from('clients').select('id, reference')
const { data: tasks } = await admin.from('tasks').select('id, client_id')
const generic = tasks.filter((t) => !t.client_id)

// Deterministic pseudo-random so reruns after a reset look the same.
let seed = 42
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)
const pick = (a) => a[Math.floor(rand() * a.length)]
const COMMENTS = [null, null, 'Relance pièces manquantes', 'Rapprochement bancaire', 'Échange téléphonique avec le gérant', null, 'Préparation du dossier']

const entries = []
const today = new Date()
for (let back = 40; back >= 0; back--) {
  const d = new Date(today)
  d.setDate(d.getDate() - back)
  if (d.getDay() === 0 || d.getDay() === 6) continue
  const work_date = d.toISOString().slice(0, 10)
  for (const u of users.filter((x) => x.role !== 'admin')) {
    if (back === 0 && rand() < 0.5) continue // some people haven't filled today yet
    if (rand() < 0.08) continue // the odd missing day
    let left = 420 + Math.round(rand() * 4) * 15
    while (left > 0) {
      const minutes = Math.min(left, (2 + Math.floor(rand() * 10)) * 15)
      const client = pick(clients)
      const task = client.reference === 'CLI-001' && rand() < 0.3 ? tasks.find((t) => t.client_id === client.id) : pick(generic)
      entries.push({ user_id: ids[u.email], client_id: client.id, task_id: task.id, work_date, minutes, comment: pick(COMMENTS) })
      left -= minutes
    }
  }
}

const { error } = await admin.from('time_entries').insert(entries)
if (error) throw error
console.log(`Created ${users.length} users and ${entries.length} time entries.`)
