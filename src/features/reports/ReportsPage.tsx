import { clsx } from 'clsx'
import { Download, FilterX } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { useEntryDetails, type EntryFilters } from '@/api/entries'
import { indexById, useClients, useProfiles, useTasks } from '@/api/reference'
import { useRollup } from '@/api/reports'
import { DailyChart } from '@/components/DailyChart'
import { rangeFromPreset, RangePicker, type RangeValue } from '@/components/RangePicker'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Field'
import { Avatar, Badge, EmptyState, Gauge, PageHeader, Stat } from '@/components/ui/misc'
import { Spinner } from '@/components/ui/Spinner'
import { downloadCSV } from '@/lib/csv'
import { formatDate, todayISO } from '@/lib/dates'
import { fetchAll, supabase } from '@/lib/supabase'
import { formatDecimalHours, formatHM } from '@/lib/time'
import type { TimeEntry } from '@/lib/types'
import { dailySeries, filterRollup, groupRollup, performanceByUser, totalMinutes, type Dimension } from './rollup'
import { UtilizationCell } from './UtilizationCell'

type Tab = Dimension | 'details'
const TABS: Tab[] = ['client', 'user', 'task', 'day', 'details']
const TAB_LABEL: Record<Tab, string> = {
  client: 'reports.byClient',
  user: 'reports.byUser',
  task: 'reports.byTask',
  day: 'reports.byDay',
  details: 'reports.details',
}
const PAGE = 100

export function ReportsPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? 'fr'
  const [params, setParams] = useSearchParams()
  const tab: Tab = TABS.includes(params.get('group') as Tab) ? (params.get('group') as Tab) : 'client'
  const setTab = (next: Tab) => setParams({ group: next }, { replace: true })

  const [range, setRange] = useState<RangeValue>(() => rangeFromPreset('thisMonth'))
  const [filters, setFilters] = useState<EntryFilters>({})
  const [limit, setLimit] = useState(PAGE)
  const [exporting, setExporting] = useState(false)

  const profiles = useProfiles()
  const clients = useClients()
  const tasks = useTasks()
  const rollup = useRollup(range)
  const details = useEntryDetails(range, filters, limit)

  const userById = useMemo(() => indexById(profiles.data), [profiles.data])
  const clientById = useMemo(() => indexById(clients.data), [clients.data])
  const taskById = useMemo(() => indexById(tasks.data), [tasks.data])
  const name = {
    user: (id: string) => userById.get(id)?.full_name ?? t('common.unknown'),
    client: (id: string) => clientById.get(id)?.name ?? t('common.unknown'),
    task: (id: string) => taskById.get(id)?.name ?? t('common.unknown'),
    day: (d: string) => formatDate(d, lang),
  }

  const rows = useMemo(() => filterRollup(rollup.data ?? [], filters), [rollup.data, filters])
  const total = totalMinutes(rows)
  const groups = useMemo(() => (tab === 'details' ? [] : groupRollup(rows, tab)), [rows, tab])
  const perf = useMemo(() => {
    const people = (profiles.data ?? []).filter((p) => !filters.userId || p.id === filters.userId)
    return performanceByUser(rows, people, range, todayISO())
  }, [rows, profiles.data, filters.userId, range])

  const hasFilters = Boolean(filters.userId || filters.clientId || filters.taskId)
  const setFilter = (k: keyof EntryFilters, v: string) => {
    setLimit(PAGE)
    setFilters((f) => ({ ...f, [k]: v || undefined }))
  }

  async function exportCSV() {
    const file = `timeledger_${tab}_${range.from}_${range.to}.csv`
    const dec = (m: number) => formatDecimalHours(m, lang)
    if (tab === 'details') {
      setExporting(true)
      try {
        const all = await fetchAll<TimeEntry>((from, to) => {
          let q = supabase.from('time_entries').select('*').gte('work_date', range.from).lte('work_date', range.to)
          if (filters.userId) q = q.eq('user_id', filters.userId)
          if (filters.clientId) q = q.eq('client_id', filters.clientId)
          if (filters.taskId) q = q.eq('task_id', filters.taskId)
          return q.order('work_date').order('created_at').order('id').range(from, to)
        })
        downloadCSV(
          file,
          [t('reports.date'), t('reports.byUser'), t('reports.byClient'), t('clients.reference'), t('reports.byTask'), t('reports.time'), t('reports.decimalHours'), t('reports.comment')],
          all.map((e) => [e.work_date, name.user(e.user_id), name.client(e.client_id), clientById.get(e.client_id)?.reference ?? '', name.task(e.task_id), formatHM(e.minutes), dec(e.minutes), e.comment ?? '']),
          lang,
        )
      } finally {
        setExporting(false)
      }
      return
    }
    if (tab === 'user') {
      downloadCSV(
        file,
        [t('reports.byUser'), t('reports.time'), t('reports.decimalHours'), t('reports.workedDays'), t('reports.expected'), t('reports.utilization'), t('reports.avgPerDay'), t('reports.clientsCount'), t('reports.missingDays')],
        perf.map((p) => [
          p.profile.full_name,
          formatHM(p.minutes),
          dec(p.minutes),
          `${p.daysWorked}/${p.workingDays}`,
          dec(p.expectedMinutes),
          p.utilization === null ? '' : `${Math.round(p.utilization * 100)}%`,
          formatHM(p.avgPerDay),
          p.clients,
          p.missingDays.join(' '),
        ]),
        lang,
      )
      return
    }
    const header = tab === 'client' ? [t('reports.byClient'), t('clients.reference')] : [t(TAB_LABEL[tab])]
    downloadCSV(
      file,
      [...header, t('reports.time'), t('reports.decimalHours'), t('reports.entries'), t('reports.share')],
      groups.map((g) => [
        ...(tab === 'client' ? [name.client(g.key), clientById.get(g.key)?.reference ?? ''] : [tab === 'day' ? g.key : name[tab](g.key)]),
        formatHM(g.minutes),
        dec(g.minutes),
        g.entries,
        total ? `${((g.minutes / total) * 100).toFixed(1)}%` : '',
      ]),
      lang,
    )
  }

  const loading = rollup.isPending || profiles.isPending || clients.isPending || tasks.isPending
  const showUserFilter = (profiles.data?.length ?? 0) > 1

  return (
    <>
      <PageHeader
        eyebrow={t('nav.sectionManage')}
        title={t('reports.title')}
        subtitle={t('reports.subtitle')}
        actions={
          <Button variant="secondary" icon={<Download className="size-4" />} onClick={exportCSV} loading={exporting} disabled={loading || total === 0}>
            {t('common.exportCsv')}
          </Button>
        }
      />

      {/* Filters */}
      <div className="sheet mb-6 space-y-4 p-4 animate-rise sm:p-5" style={{ animationDelay: '60ms' }}>
        <RangePicker value={range} onChange={(r) => { setLimit(PAGE); setRange(r) }} />
        <div className="flex flex-wrap items-center gap-3">
          {showUserFilter && (
            <Select className="w-full sm:w-56" value={filters.userId ?? ''} onChange={(e) => setFilter('userId', e.target.value)} aria-label={t('reports.filterUser')}>
              <option value="">{t('reports.filterUser')} · {t('common.all')}</option>
              {(profiles.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}{p.active ? '' : ` (${t('common.inactive')})`}</option>
              ))}
            </Select>
          )}
          <Select className="w-full sm:w-56" value={filters.clientId ?? ''} onChange={(e) => setFilter('clientId', e.target.value)} aria-label={t('reports.filterClient')}>
            <option value="">{t('reports.filterClient')} · {t('common.all')}</option>
            {(clients.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.active ? '' : ` (${t('common.inactive')})`}</option>
            ))}
          </Select>
          <Select className="w-full sm:w-56" value={filters.taskId ?? ''} onChange={(e) => setFilter('taskId', e.target.value)} aria-label={t('reports.filterTask')}>
            <option value="">{t('reports.filterTask')} · {t('common.allFem')}</option>
            {(tasks.data ?? []).map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}{x.client_id ? ` — ${name.client(x.client_id)}` : ''}
              </option>
            ))}
          </Select>
          {hasFilters && (
            <Button variant="ghost" size="sm" icon={<FilterX className="size-4" />} onClick={() => { setLimit(PAGE); setFilters({}) }}>
              {t('common.cancel')}
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid h-80 place-items-center text-ledger"><Spinner /></div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat accent label={t('common.total')} value={formatHM(total)} hint={`${formatDecimalHours(total, lang)} ${t('common.hours')}`} />
            <Stat label={t('reports.entries')} value={rows.reduce((s, r) => s + Number(r.entry_count), 0)} delay={50} />
            <Stat label={t('dashboard.clientsServed')} value={new Set(rows.map((r) => r.client_id)).size} delay={100} />
            <Stat label={t('reports.days')} value={new Set(rows.map((r) => r.work_date)).size} delay={150} />
          </div>

          {/* Tabs */}
          <div role="tablist" className="mb-4 flex items-center gap-1 overflow-x-auto overflow-y-hidden border-b border-rule">
            {TABS.map((x) => (
              <button
                key={x}
                role="tab"
                aria-selected={tab === x}
                onClick={() => setTab(x)}
                className={clsx(
                  '-mb-px border-b-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition',
                  tab === x ? 'border-ledger text-ink' : 'border-transparent text-ink-3 hover:text-ink',
                )}
              >
                {t(TAB_LABEL[x])}
              </button>
            ))}
            {rollup.isFetching && <Spinner className="ml-auto size-4 self-center text-ink-3" />}
          </div>

          <section className="sheet overflow-hidden animate-fade">
            {tab === 'details' ? (
              <DetailsTable
                rows={details.data?.rows ?? []}
                total={details.data?.total ?? 0}
                loading={details.isPending}
                fetching={details.isFetching}
                onMore={() => setLimit((l) => l + PAGE)}
                name={name}
                lang={lang}
              />
            ) : total === 0 ? (
              <EmptyState title={t('reports.noData')} />
            ) : tab === 'user' ? (
              <div className="overflow-x-auto">
                <table className="table-ledger">
                  <thead>
                    <tr>
                      <th>{t('reports.byUser')}</th>
                      <th className="text-right">{t('reports.time')}</th>
                      <th className="text-right">{t('reports.workedDays')}</th>
                      <th className="text-right">{t('reports.avgPerDay')}</th>
                      <th className="text-right">{t('reports.clientsCount')}</th>
                      <th className="min-w-44">{t('reports.utilization')}</th>
                      <th>{t('reports.missingDays')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perf.map((p) => (
                      <tr key={p.profile.id}>
                        <td>
                          <button className="flex items-center gap-3 text-left hover:text-ledger" onClick={() => setFilter('userId', p.profile.id)}>
                            <Avatar name={p.profile.full_name} className="size-7" />
                            <span>
                              <span className="block">{p.profile.full_name}</span>
                              <span className="block text-xs text-ink-3">{t(`roles.${p.profile.role}`)} · {t('timesheet.target')} {formatHM(p.profile.daily_target_minutes)}</span>
                            </span>
                          </button>
                        </td>
                        <td className="num text-right font-medium">{formatHM(p.minutes)}</td>
                        <td className="num text-right text-ink-2">{p.daysWorked}/{p.workingDays}</td>
                        <td className="num text-right text-ink-2">{formatHM(p.avgPerDay)}</td>
                        <td className="num text-right text-ink-2">{p.clients}</td>
                        <td><UtilizationCell value={p.utilization} /></td>
                        <td>
                          {p.missingDays.length === 0 ? (
                            <span className="text-ink-3">—</span>
                          ) : (
                            <Badge tone="stamp" className="num cursor-help" >
                              <span title={`${t('reports.missingDaysList')}: ${p.missingDays.map((d) => formatDate(d, lang, 'EEE d MMM')).join(', ')}`}>
                                {p.missingDays.length}
                              </span>
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <>
                {tab === 'day' && (
                  <div className="border-b border-rule p-6">
                    <DailyChart data={dailySeries(rows, range)} lang={lang} height={220} />
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="table-ledger">
                    <thead>
                      <tr>
                        <th>{t(TAB_LABEL[tab])}</th>
                        {tab === 'client' && <th>{t('clients.reference')}</th>}
                        <th className="text-right">{t('reports.time')}</th>
                        <th className="text-right">{t('reports.decimalHours')}</th>
                        <th className="text-right">{t('reports.entries')}</th>
                        <th className="min-w-40">{t('reports.share')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groups.map((g) => (
                        <tr key={g.key}>
                          <td>
                            {tab === 'day' ? (
                              <span className="capitalize">{name.day(g.key)}</span>
                            ) : (
                              <button
                                className="text-left hover:text-ledger"
                                onClick={() => setFilter(tab === 'client' ? 'clientId' : 'taskId', g.key)}
                              >
                                {name[tab](g.key)}
                              </button>
                            )}
                          </td>
                          {tab === 'client' && <td className="num text-xs text-ink-3">{clientById.get(g.key)?.reference ?? '—'}</td>}
                          <td className="num text-right font-medium">{formatHM(g.minutes)}</td>
                          <td className="num text-right text-ink-2">{formatDecimalHours(g.minutes, lang)}</td>
                          <td className="num text-right text-ink-2">{g.entries}</td>
                          <td>
                            <div className="flex items-center gap-3">
                              <Gauge value={g.minutes / total} className="flex-1" />
                              <span className="num w-12 text-right text-xs text-ink-2">{((g.minutes / total) * 100).toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-rule-2 bg-paper/60 font-medium">
                        <td className="px-4 py-3">{t('common.total')}</td>
                        {tab === 'client' && <td />}
                        <td className="num px-4 py-3 text-right">{formatHM(total)}</td>
                        <td className="num px-4 py-3 text-right">{formatDecimalHours(total, lang)}</td>
                        <td className="num px-4 py-3 text-right">{groups.reduce((s, g) => s + g.entries, 0)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </section>
        </>
      )}
    </>
  )
}

function DetailsTable({
  rows,
  total,
  loading,
  fetching,
  onMore,
  name,
  lang,
}: {
  rows: TimeEntry[]
  total: number
  loading: boolean
  fetching: boolean
  onMore: () => void
  name: Record<'user' | 'client' | 'task', (id: string) => string>
  lang: string
}) {
  const { t } = useTranslation()
  if (loading) return <div className="grid h-60 place-items-center text-ledger"><Spinner /></div>
  if (rows.length === 0) return <EmptyState title={t('reports.noData')} />
  return (
    <>
      <div className="overflow-x-auto">
        <table className="table-ledger">
          <thead>
            <tr>
              <th>{t('reports.date')}</th>
              <th>{t('reports.byUser')}</th>
              <th>{t('reports.byClient')}</th>
              <th>{t('reports.byTask')}</th>
              <th className="text-right">{t('reports.time')}</th>
              <th>{t('reports.comment')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id}>
                <td className="num text-xs whitespace-nowrap text-ink-2 capitalize">{formatDate(e.work_date, lang, 'EEE dd/MM/yy')}</td>
                <td className="whitespace-nowrap">{name.user(e.user_id)}</td>
                <td>{name.client(e.client_id)}</td>
                <td className="text-ink-2">{name.task(e.task_id)}</td>
                <td className="num text-right font-medium">{formatHM(e.minutes)}</td>
                <td className="max-w-80 text-sm text-ink-3">{e.comment}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-rule px-4 py-3 text-sm text-ink-3">
        <span className="num">
          {rows.length} / {total}
        </span>
        {rows.length < total && (
          <Button variant="secondary" size="sm" onClick={onMore} loading={fetching}>
            {t('reports.loadMore')}
          </Button>
        )}
      </div>
    </>
  )
}
