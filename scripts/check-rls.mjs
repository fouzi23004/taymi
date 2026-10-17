// Local only: checks that row-level security behaves per role. Run after `node scripts/seed-dev.mjs`.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
const env = Object.fromEntries(readFileSync('.env','utf8').trim().split('\n').map(l=>l.split('=')))
const users = JSON.parse(readFileSync('scripts/dev-users.json','utf8'))
if (!['http://127.0.0.1', 'http://localhost'].some((p) => env.VITE_SUPABASE_URL.startsWith(p))) throw new Error('Local Supabase only')
const creds = JSON.parse(readFileSync('scripts/dev-credentials.json', 'utf8'))
const login = async (email) => { const c = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {auth:{persistSession:false}}); const u = users.find(x=>x.email===email); const {data,error}=await c.auth.signInWithPassword({email,password:creds[email]}); if(error) throw error; return [c, data.user.id] }
for (const email of users.map(u=>u.email)) {
  const [c, id] = await login(email)
  const { count } = await c.from('time_entries').select('*', { count: 'exact', head: true })
  const { data: people } = await c.from('profiles').select('full_name')
  const { data: roll } = await c.rpc('report_rollup', { p_from: '2020-01-01', p_to: '2030-01-01' })
  console.log(email.padEnd(26), 'entries', String(count).padStart(4), 'profiles', people.length, 'rollupUsers', new Set(roll.map(r=>r.user_id)).size)
}
const [amine] = await login('amine@timeledger.test')
const { data: others } = await (await login('ines@timeledger.test'))[0].from('profiles').select('id').limit(1)
const { data: links } = await amine.from('client_categories').select('client_id, category_id')
const { data: allTasks } = await amine.from('tasks').select('id, category_id')
const { data: ex } = await amine.from('exercises').select('id').limit(1)
const cl = [{ id: links[0].client_id }]
const tk = allTasks.filter((t) => t.category_id === links[0].category_id)
const ines = (await login('ines@timeledger.test'))[1]
let r = await amine.from('time_entries').insert({ user_id: ines, client_id: cl[0].id, task_id: tk[0].id, exercise_id: ex[0].id, minutes: 30 })
console.log('collab inserts for someone else ->', r.error?.code ?? 'ALLOWED (bad)')
r = await amine.from('clients').insert({ name: 'Hack' })
console.log('collab creates client ->', r.error?.code ?? 'ALLOWED (bad)')
r = await amine.from('profiles').update({ role: 'admin' }).eq('id', (await amine.auth.getUser()).data.user.id).select()
console.log('collab promotes self ->', r.error?.code ?? `rows updated: ${r.data.length}`)
r = await amine.from('time_entries').insert({ client_id: cl[0].id, task_id: tk[0].id, exercise_id: ex[0].id, minutes: 1440, work_date: '2026-10-14' })
console.log('day overflow ->', r.error?.hint ?? 'ALLOWED (bad)')
// A client without the payroll category, and a payroll task.
const payroll = allTasks.find((t) => !links.some((l) => l.client_id === cl[0].id && l.category_id === t.category_id))
r = await amine.from('time_entries').insert({ client_id: cl[0].id, task_id: payroll.id, exercise_id: ex[0].id, minutes: 15 })
console.log('task/client mismatch ->', r.error?.hint ?? 'ALLOWED (bad)')
const anon = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
r = await anon.from('time_entries').select('id').limit(1)
console.log('anon reads entries ->', r.error?.code ?? `rows: ${r.data.length}`)
