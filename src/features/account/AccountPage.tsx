import { clsx } from 'clsx'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useMe } from '@/auth/AuthProvider'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Avatar, Badge, PageHeader } from '@/components/ui/misc'
import { LANGUAGES } from '@/i18n'
import { errorKey } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

export function AccountPage() {
  const { t, i18n } = useTranslation()
  const me = useMe()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)

  const error = password.length < 8 ? t('errors.weakPassword') : password !== confirm ? t('account.mismatch') : null

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (error) return
    setSaving(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (err) return void toast.error(t(errorKey(err)))
    toast.success(t('account.passwordChanged'))
    setPassword('')
    setConfirm('')
    setSubmitted(false)
  }

  return (
    <>
      <PageHeader title={t('account.title')} subtitle={t('account.subtitle')} />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="sheet p-6 animate-rise">
          <h2 className="mb-5 font-display text-xl">{t('account.profile')}</h2>
          <div className="flex items-center gap-4">
            <Avatar name={me.full_name} className="size-14 text-base" />
            <div>
              <p className="text-lg font-medium">{me.full_name}</p>
              <p className="text-sm text-ink-3">{me.email}</p>
            </div>
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-rule pt-5 text-sm">
            <div>
              <dt className="eyebrow">{t('team.role')}</dt>
              <dd className="mt-1"><Badge tone="green">{t(`roles.${me.role}`)}</Badge></dd>
            </div>
            <div className="col-span-2">
              <dt className="eyebrow mb-2">{t('common.language')}</dt>
              <dd className="flex gap-2">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => void i18n.changeLanguage(l.code)}
                    className={clsx(
                      'rounded-lg border px-3 py-1.5 text-sm transition',
                      i18n.resolvedLanguage === l.code ? 'border-ledger bg-ledger text-paper' : 'border-rule-2 hover:border-ink-3',
                    )}
                  >
                    {l.label}
                  </button>
                ))}
              </dd>
            </div>
          </dl>
        </section>

        <section className="sheet p-6 animate-rise" style={{ animationDelay: '80ms' }}>
          <h2 className="mb-5 font-display text-xl">{t('account.changePassword')}</h2>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <Field label={t('team.newPassword')} hint={t('team.passwordHint')}>
              <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Field label={t('account.confirmPassword')} error={submitted && error}>
              <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </Field>
            <div className="flex justify-end">
              <Button type="submit" loading={saving}>{t('common.save')}</Button>
            </div>
          </form>
        </section>
      </div>
    </>
  )
}
