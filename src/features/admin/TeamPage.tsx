import { clsx } from 'clsx'
import { KeyRound, Pencil, Plus, Power, Users } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { indexById, useProfiles } from '@/api/reference'
import { useCreateUser, useSetPassword, useUpdateUser } from '@/api/users'
import { useMe } from '@/auth/AuthProvider'
import { DurationInput } from '@/components/DurationInput'
import { Button, IconButton } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { Avatar, Badge, EmptyState, PageHeader } from '@/components/ui/misc'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { errorKey } from '@/lib/errors'
import { formatHM } from '@/lib/time'
import { ROLES, type Profile, type Role } from '@/lib/types'
import { Toolbar } from './ClientsPage'

const ROLE_TONE: Record<Role, 'green' | 'brass' | 'neutral'> = { admin: 'green', manager: 'brass', collaborator: 'neutral' }

export function TeamPage() {
  const { t } = useTranslation()
  const me = useMe()
  const profiles = useProfiles()
  const update = useUpdateUser()
  const [query, setQuery] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [editing, setEditing] = useState<Profile | 'new' | null>(null)
  const [resetting, setResetting] = useState<Profile | null>(null)
  const byId = useMemo(() => indexById(profiles.data), [profiles.data])

  const q = query.trim().toLowerCase()
  const list = (profiles.data ?? []).filter(
    (p) => (showArchived || p.active) && (!q || p.full_name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)),
  )
  const managers = (profiles.data ?? []).filter((p) => p.active && (p.role === 'manager' || p.role === 'admin'))

  async function toggleActive(p: Profile) {
    try {
      await update.mutateAsync({ id: p.id, active: !p.active })
      toast.success(t('team.updated'))
    } catch (err) {
      toast.error(t(errorKey(err)))
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={t('nav.sectionSetup')}
        title={t('team.title')}
        subtitle={t('team.subtitle')}
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
            {t('team.add')}
          </Button>
        }
      />

      <Toolbar query={query} setQuery={setQuery} showArchived={showArchived} setShowArchived={setShowArchived} />

      <section className="sheet overflow-hidden animate-rise" style={{ animationDelay: '80ms' }}>
        {profiles.isPending ? (
          <div className="grid h-60 place-items-center text-ledger"><Spinner /></div>
        ) : list.length === 0 ? (
          <EmptyState icon={<Users className="size-5" />} title={t('team.title')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-ledger">
              <thead>
                <tr>
                  <th>{t('team.fullName')}</th>
                  <th>{t('team.role')}</th>
                  <th>{t('team.manager')}</th>
                  <th className="text-right">{t('team.dailyTarget')}</th>
                  <th>{t('team.status')}</th>
                  <th className="w-px" />
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id} className={clsx(!p.active && 'opacity-60')}>
                    <td>
                      <div className="flex items-center gap-3">
                        <Avatar name={p.full_name} />
                        <div className="min-w-0">
                          <p className="font-medium">
                            {p.full_name}
                            {p.id === me.id && <span className="ml-2 text-xs font-normal text-ink-3">({t('team.you')})</span>}
                          </p>
                          <p className="text-xs text-ink-3">{p.email}</p>
                        </div>
                      </div>
                    </td>
                    <td><Badge tone={ROLE_TONE[p.role]}>{t(`roles.${p.role}`)}</Badge></td>
                    <td className="text-sm text-ink-2">{p.manager_id ? byId.get(p.manager_id)?.full_name ?? '—' : '—'}</td>
                    <td className="num text-right text-ink-2">{formatHM(p.daily_target_minutes)}</td>
                    <td>{p.active ? <Badge tone="green">{t('common.active')}</Badge> : <Badge>{t('common.inactive')}</Badge>}</td>
                    <td>
                      <div className="flex justify-end gap-0.5">
                        <IconButton label={t('common.edit')} icon={<Pencil className="size-3.5" />} onClick={() => setEditing(p)} />
                        <IconButton label={t('team.resetPassword')} icon={<KeyRound className="size-3.5" />} onClick={() => setResetting(p)} />
                        {p.id !== me.id && (
                          <IconButton
                            label={p.active ? t('team.deactivate') : t('team.activate')}
                            icon={<Power className="size-3.5" />}
                            onClick={() => toggleActive(p)}
                            className={p.active ? 'hover:bg-stamp-soft hover:text-stamp' : ''}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing && editing !== 'new' ? t('team.edit') : t('team.add')}>
        {editing !== null && (
          <UserForm
            key={editing === 'new' ? 'new' : editing.id}
            user={editing === 'new' ? null : editing}
            managers={managers.filter((m) => editing === 'new' || m.id !== editing.id)}
            onDone={() => setEditing(null)}
          />
        )}
      </Modal>

      <Modal open={resetting !== null} onClose={() => setResetting(null)} title={t('team.resetPassword')} width="max-w-sm">
        {resetting && <PasswordForm key={resetting.id} user={resetting} onDone={() => setResetting(null)} />}
      </Modal>
    </>
  )
}

function UserForm({ user, managers, onDone }: { user: Profile | null; managers: Profile[]; onDone: () => void }) {
  const { t } = useTranslation()
  const create = useCreateUser()
  const update = useUpdateUser()
  const [fullName, setFullName] = useState(user?.full_name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>(user?.role ?? 'collaborator')
  const [managerId, setManagerId] = useState(user?.manager_id ?? '')
  const [target, setTarget] = useState<number | null>(user?.daily_target_minutes ?? 480)
  const [submitted, setSubmitted] = useState(false)

  const errors = {
    fullName: !fullName.trim() ? t('errors.required') : null,
    email: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? t('errors.invalidEmail') : null,
    password: !user && password.length < 8 ? t('errors.weakPassword') : null,
    target: target === null || target < 0 || target > 1440 ? t('errors.invalidDuration') : null,
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (Object.values(errors).some(Boolean)) return
    const common = { full_name: fullName.trim(), role, manager_id: managerId || null, daily_target_minutes: target! }
    try {
      if (user) {
        await update.mutateAsync({ id: user.id, ...common, ...(email.trim().toLowerCase() !== user.email ? { email: email.trim() } : {}) })
        toast.success(t('team.updated'))
      } else {
        await create.mutateAsync({ ...common, email: email.trim(), password })
        toast.success(t('team.created'))
      }
      onDone()
    } catch (err) {
      toast.error(t(errorKey(err)))
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label={t('team.fullName')} error={submitted && errors.fullName}>
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus />
      </Field>
      <Field label={t('team.email')} error={submitted && errors.email}>
        <Input type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      {!user && (
        <Field label={t('team.password')} hint={t('team.passwordHint')} error={submitted && errors.password}>
          <Input type="text" autoComplete="new-password" className="num" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
      )}

      <fieldset>
        <legend className="mb-1.5 text-[13px] font-medium text-ink-2">{t('team.role')}</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {ROLES.map((r) => (
            <label
              key={r}
              className={clsx(
                'cursor-pointer rounded-lg border p-3 transition',
                role === r ? 'border-ledger bg-ledger-soft' : 'border-rule-2 hover:border-ink-3',
              )}
            >
              <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="sr-only" />
              <span className="block text-sm font-medium">{t(`roles.${r}`)}</span>
              <span className="mt-1 block text-xs leading-snug text-ink-3">{t(`team.roleHelp.${r}`)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('team.manager')} optional={t('common.optional')}>
          <Select value={managerId} onChange={(e) => setManagerId(e.target.value)}>
            <option value="">{t('team.noManager')}</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>{m.full_name}</option>
            ))}
          </Select>
        </Field>
        <Field label={t('team.dailyTarget')} hint={t('team.dailyTargetHint')} error={submitted && errors.target}>
          <DurationInput value={target} onChange={setTarget} presets={[0, 240, 420, 450, 480]} />
        </Field>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onDone}>{t('common.cancel')}</Button>
        <Button type="submit" loading={create.isPending || update.isPending}>{t('common.save')}</Button>
      </div>
    </form>
  )
}

function PasswordForm({ user, onDone }: { user: Profile; onDone: () => void }) {
  const { t } = useTranslation()
  const setPassword = useSetPassword()
  const [password, setPw] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const error = password.length < 8 ? t('errors.weakPassword') : null

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (error) return
    try {
      await setPassword.mutateAsync({ id: user.id, password })
      toast.success(t('team.passwordReset'))
      onDone()
    } catch (err) {
      toast.error(t(errorKey(err)))
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <p className="text-sm text-ink-2">{user.full_name} · {user.email}</p>
      <Field label={t('team.newPassword')} hint={t('team.passwordHint')} error={submitted && error}>
        <Input type="text" autoComplete="new-password" className="num" value={password} onChange={(e) => setPw(e.target.value)} autoFocus />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>{t('common.cancel')}</Button>
        <Button type="submit" loading={setPassword.isPending}>{t('common.save')}</Button>
      </div>
    </form>
  )
}
