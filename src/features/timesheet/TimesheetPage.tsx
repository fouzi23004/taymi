import { clsx } from 'clsx'
import { endOfWeek, isWeekend, startOfWeek } from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight, NotebookPen, Pencil, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { useDeleteEntry, useMyEntries } from '@/api/entries'
import { categoriesByClient, indexById, useCategories, useClientCategories, useClients, useExercises, useTasks } from '@/api/reference'
import { useMe } from '@/auth/AuthProvider'
import { Button, IconButton } from '@/components/ui/Button'
import { Badge, EmptyState, PageHeader } from '@/components/ui/misc'
import { ConfirmModal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { daysInRange, formatDate, fromISODate, shiftISODate, todayISO, toISODate, type ISODate } from '@/lib/dates'
import { errorKey } from '@/lib/errors'
import { formatHM } from '@/lib/time'
import type { TimeEntry } from '@/lib/types'
import { EntryForm } from './EntryForm'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function TimesheetPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? 'fr'
  const me = useMe()
  const [params, setParams] = useSearchParams()
  const today = todayISO()
  const date: ISODate = DATE_RE.test(params.get('date') ?? '') ? params.get('date')! : today
  const setDate = (d: ISODate) => {
    setEditing(null)
    setParams(d === today ? {} : { date: d }, { replace: true })
  }

  const week = useMemo(() => {
    const d = fromISODate(date)
    return {
      from: toISODate(startOfWeek(d, { weekStartsOn: 1 })),
      to: toISODate(endOfWeek(d, { weekStartsOn: 1 })),
    }
  }, [date])

  const clients = useClients()
  const tasks = useTasks()
  const categories = useCategories()
  const clientCategories = useClientCategories()
  const exercises = useExercises()
  const entries = useMyEntries(me.id, week)
  const del = useDeleteEntry()
  const [editing, setEditing] = useState<TimeEntry | null>(null)
  const [deleting, setDeleting] = useState<TimeEntry | null>(null)
  // Bumped after each save so the form remounts empty for the next line.
  const [formNonce, setFormNonce] = useState(0)

  const clientById = useMemo(() => indexById(clients.data), [clients.data])
  const taskById = useMemo(() => indexById(tasks.data), [tasks.data])

  const weekEntries = useMemo(() => entries.data ?? [], [entries.data])
  const dayEntries = weekEntries.filter((e) => e.work_date === date)
  const dayTotal = dayEntries.reduce((s, e) => s + e.minutes, 0)
  const totalsByDay = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of weekEntries) m.set(e.work_date, (m.get(e.work_date) ?? 0) + e.minutes)
    return m
  }, [weekEntries])
  const weekTotal = weekEntries.reduce((s, e) => s + e.minutes, 0)

  const loadingRefs =
    clients.isPending || tasks.isPending || categories.isPending || clientCategories.isPending || exercises.isPending
  const categoriesOfClient = useMemo(() => categoriesByClient(clientCategories.data), [clientCategories.data])
  const exerciseById = useMemo(() => indexById(exercises.data), [exercises.data])
  const noClients = !loadingRefs && !(clients.data ?? []).some((c) => c.active)

  async function confirmDelete() {
    if (!deleting) return
    try {
      await del.mutateAsync(deleting.id)
      toast.success(t('timesheet.deleted'))
      if (editing?.id === deleting.id) setEditing(null)
    } catch (err) {
      toast.error(t(errorKey(err)))
    }
    setDeleting(null)
  }

  return (
    <>
      <PageHeader
        eyebrow={formatDate(date, lang, 'EEEE d MMMM yyyy')}
        title={t('timesheet.title')}
        subtitle={t('timesheet.subtitle')}
        actions={
          <>
            <IconButton label={t('timesheet.previousDay')} icon={<ChevronLeft className="size-4" />} onClick={() => setDate(shiftISODate(date, -1))} className="border border-rule-2 bg-card" />
            <label className="relative">
              <span className="sr-only">{t('reports.date')}</span>
              <CalendarDays className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
              <input
                type="date"
                className="input num h-8 w-auto py-0 pl-9 text-[13px]"
                value={date}
                onChange={(e) => e.target.value && setDate(e.target.value)}
              />
            </label>
            <IconButton label={t('timesheet.nextDay')} icon={<ChevronRight className="size-4" />} onClick={() => setDate(shiftISODate(date, 1))} className="border border-rule-2 bg-card" />
            {date !== today && (
              <Button variant="secondary" size="sm" onClick={() => setDate(today)}>
                {t('timesheet.backToToday')}
              </Button>
            )}
          </>
        }
      />

      {/* Week strip */}
      <div className="mb-8 grid grid-cols-7 gap-1.5 animate-rise sm:gap-2" style={{ animationDelay: '60ms' }}>
        {daysInRange(week).map((d) => {
          const total = totalsByDay.get(d) ?? 0
          const weekend = isWeekend(fromISODate(d))
          const selected = d === date
          return (
            <button
              key={d}
              onClick={() => setDate(d)}
              aria-pressed={selected}
              aria-label={`${formatDate(d, lang, 'EEEE d MMMM')} · ${total ? formatHM(total) : '—'}`}
              className={clsx(
                'group flex flex-col items-start rounded-xl border px-2.5 py-2.5 text-left transition sm:px-3',
                selected
                  ? 'border-ledger bg-ledger text-paper shadow-[var(--shadow-sheet)]'
                  : 'border-rule bg-card/70 hover:border-rule-2 hover:bg-card',
                weekend && !selected && 'opacity-60',
              )}
            >
              <span className={clsx('font-mono text-[10.5px] tracking-[0.12em] uppercase', selected ? 'text-paper/60' : 'text-ink-3')}>
                {formatDate(d, lang, 'EEE')}
              </span>
              <span className="flex w-full items-baseline justify-between gap-1">
                <span className="font-display text-xl leading-tight">{formatDate(d, lang, 'd')}</span>
                {d === today && <span className={clsx('size-1.5 rounded-full', selected ? 'bg-[#e3c486]' : 'bg-brass')} />}
              </span>
              <span className={clsx('num mt-1 text-xs', total ? (selected ? 'text-paper' : 'text-ink-2') : selected ? 'text-paper/40' : 'text-ink-3/60')}>
                {total ? formatHM(total) : '—'}
              </span>
            </button>
          )
        })}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[380px_1fr]">
        {/* Form */}
        <section className="sheet p-6 animate-rise lg:sticky lg:top-8" style={{ animationDelay: '120ms' }}>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-display text-xl">{editing ? t('timesheet.editEntry') : t('timesheet.newEntry')}</h2>
            <Badge tone="neutral" className="num">{formatDate(date, lang, 'dd/MM')}</Badge>
          </div>
          {loadingRefs ? (
            <div className="grid h-60 place-items-center text-ledger"><Spinner /></div>
          ) : noClients ? (
            <p className="rounded-lg bg-brass-soft p-4 text-sm text-[#7a5410]">{t('timesheet.noClients')}</p>
          ) : (
            <EntryForm
              key={`${date}-${editing?.id ?? 'new'}-${formNonce}`}
              date={date}
              clients={clients.data ?? []}
              categories={categories.data ?? []}
              clientCategories={categoriesOfClient}
              exercises={exercises.data ?? []}
              tasks={tasks.data ?? []}
              entry={editing}
              onDone={() => {
                setEditing(null)
                setFormNonce((n) => n + 1)
              }}
            />
          )}
        </section>

        {/* Day sheet */}
        <section className="sheet overflow-hidden animate-rise" style={{ animationDelay: '180ms' }}>
          <header className="flex items-center justify-between border-b border-rule px-6 py-4">
            <div className="flex items-baseline gap-3">
              <h2 className="font-display text-xl capitalize">{formatDate(date, lang, 'EEEE d MMMM')}</h2>
              <span className="text-sm text-ink-3">{t('timesheet.entries', { count: dayEntries.length })}</span>
            </div>
            {entries.isFetching && <Spinner className="size-4 text-ink-3" />}
          </header>

          {entries.isPending ? (
            <div className="grid h-60 place-items-center text-ledger"><Spinner /></div>
          ) : dayEntries.length === 0 ? (
            <EmptyState icon={<NotebookPen className="size-5" />} title={t('timesheet.empty')} hint={t('timesheet.emptyHint')} />
          ) : (
            <ul className="ruled">
              {dayEntries.map((e, i) => {
                const client = clientById.get(e.client_id)
                const task = taskById.get(e.task_id)
                return (
                  <li
                    key={e.id}
                    className={clsx(
                      'group grid grid-cols-[1fr_auto] gap-x-4 border-b border-rule/70 px-6 py-4 transition animate-fade last:border-b-0',
                      editing?.id === e.id ? 'bg-brass-soft/50' : 'hover:bg-paper/50',
                    )}
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-2">
                        <span className="truncate font-medium text-ink">{client?.name ?? t('common.unknown')}</span>
                        <Badge className="num">{exerciseById.get(e.exercise_id)?.name ?? '—'}</Badge>
                      </p>
                      <p className="mt-0.5 text-sm text-ink-2">{task?.name ?? t('common.unknown')}</p>
                      {e.comment && <p className="mt-2 border-l-2 border-rule-2 pl-3 text-sm whitespace-pre-line text-ink-3 italic">{e.comment}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="num text-lg font-medium text-ink">{formatHM(e.minutes)}</span>
                      <div className="flex gap-0.5 opacity-100 transition sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                        <IconButton label={t('common.edit')} icon={<Pencil className="size-3.5" />} onClick={() => setEditing(e)} />
                        <IconButton label={t('common.delete')} icon={<Trash2 className="size-3.5" />} onClick={() => setDeleting(e)} className="hover:bg-stamp-soft hover:text-stamp" />
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          <footer className="border-t border-rule-2 bg-paper/60 px-6 py-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow">{t('timesheet.dayTotal')}</p>
                <p className="num mt-1 text-3xl font-medium">{formatHM(dayTotal)}</p>
              </div>
              <div className="text-right text-sm">
                <p className="text-ink-3">
                  {t('timesheet.week')} <span className="num text-ink-2">{formatHM(weekTotal)}</span>
                </p>
              </div>
            </div>
          </footer>
        </section>
      </div>

      <ConfirmModal
        open={Boolean(deleting)}
        message={t('timesheet.deleteConfirm')}
        loading={del.isPending}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </>
  )
}
