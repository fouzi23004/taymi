import { clsx } from 'clsx'
import { ArrowRight } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '@/auth/AuthProvider'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { FullPageSpinner } from '@/components/ui/Spinner'
import { LANGUAGES } from '@/i18n'

const LEDGER_LINES = [
  ['09:00', 'Saisie comptable', '2h15'],
  ['11:15', 'Déclaration TVA', '1h30'],
  ['14:00', 'Conseil / rendez-vous', '0h45'],
  ['14:45', 'Paie', '2h00'],
  ['16:45', 'Administratif', '0h30'],
]

export function LoginPage() {
  const { t, i18n } = useTranslation()
  const { session, loading, signIn } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (loading) return <FullPageSpinner />
  if (session) return <Navigate to={(location.state as { from?: string } | null)?.from ?? '/'} replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const res = await signIn(email.trim(), password)
    setSubmitting(false)
    if (res.error) setError(t(res.error === 'deactivated' ? 'login.deactivated' : 'login.invalid'))
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Cover */}
      <section className="relative hidden overflow-hidden bg-cover p-12 text-paper lg:flex lg:flex-col">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(to bottom, transparent 0 47px, #f3efe6 47px 48px), linear-gradient(to right, transparent 0 88px, #e3c486 88px 89px, transparent 89px)',
          }}
        />
        <div className="relative flex items-center gap-2.5">
          <span className="font-display text-2xl font-medium">
            Time<span className="italic text-[#e3c486]">Ledger</span>
          </span>
        </div>

        <div className="relative my-auto max-w-lg">
          <p className="font-display text-[44px] leading-[1.08] font-light tracking-[-0.015em]">
            {t('login.quote')}
          </p>
          <div className="mt-12 space-y-0 font-mono text-[13px]">
            {LEDGER_LINES.map(([time, task, dur], i) => (
              <div
                key={time}
                className="flex h-12 items-center gap-6 border-b border-paper/10 animate-rise"
                style={{ animationDelay: `${300 + i * 110}ms` }}
              >
                <span className="w-12 text-paper/40">{time}</span>
                <span className="flex-1 font-sans text-[15px] text-paper/85">{task}</span>
                <span className="text-[#e3c486]">{dur}</span>
              </div>
            ))}
            <div className="flex h-12 items-center justify-end gap-3 animate-rise" style={{ animationDelay: '900ms' }}>
              <span className="text-paper/40 uppercase tracking-[0.14em] text-[11px]">{t('timesheet.dayTotal')}</span>
              <span className="text-lg text-paper">7h00</span>
            </div>
          </div>
        </div>

        <p className="relative text-xs text-paper/40">© {new Date().getFullYear()} TimeLedger</p>
      </section>

      {/* Form */}
      <section className="flex flex-col p-6 sm:p-12">
        <div className="flex justify-end gap-1">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => void i18n.changeLanguage(l.code)}
              className={clsx(
                'rounded-md px-2.5 py-1 font-mono text-xs uppercase transition',
                i18n.resolvedLanguage === l.code ? 'bg-ink text-paper' : 'text-ink-3 hover:text-ink',
              )}
            >
              {l.code}
            </button>
          ))}
        </div>

        <div className="m-auto w-full max-w-sm py-12 animate-rise">
          <p className="mb-8 font-display text-2xl lg:hidden">
            Time<span className="italic text-ledger">Ledger</span>
          </p>
          <h1 className="font-display text-4xl font-medium tracking-tight">{t('login.title')}</h1>
          <p className="mt-2 text-ink-2">{t('login.subtitle')}</p>

          <form onSubmit={onSubmit} className="mt-10 space-y-5" noValidate>
            <Field label={t('login.email')}>
              <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            </Field>
            <Field label={t('login.password')}>
              <Input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>

            {error && (
              <p role="alert" className="rounded-lg bg-stamp-soft px-3 py-2 text-sm text-stamp">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" loading={submitting} disabled={!email || !password}>
              {t('login.submit')}
              {!submitting && <ArrowRight className="size-4" />}
            </Button>
          </form>

          <p className="mt-8 border-t border-rule pt-6 text-sm text-ink-3">{t('login.noAccount')}</p>
        </div>
      </section>
    </div>
  )
}
