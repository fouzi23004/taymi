import { clsx } from 'clsx'
import { ArrowUpRight, CheckCircle2, Clock } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { indexById, useClients, useProfiles } from '@/api/reference'
import { useRollup } from '@/api/reports'
import { DailyChart } from '@/components/DailyChart'
import { rangeFromPreset, RangePicker, type RangeValue } from '@/components/RangePicker'
import { Avatar, EmptyState, Gauge, PageHeader, Stat } from '@/components/ui/misc'
import { Spinner } from '@/components/ui/Spinner'
import { todayISO } from '@/lib/dates'
import { formatHM } from '@/lib/time'
import { dailySeries, groupRollup, performanceByUser, totalMinutes } from '../reports/rollup'
import { UtilizationCell } from '../reports/UtilizationCell'

export function DashboardPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? 'fr'
  const [range, setRange] = useState<RangeValue>(() => rangeFromPreset('thisMonth'))
  const today = todayISO()

  const rollup = useRollup(range)
  const todayRollup = useRollup({ from: today, to: today })
  const profiles = useProfiles()
  const clients = useClients()

  const rows = useMemo(() => rollup.data ?? [], [rollup.data])
  const clientById = useMemo(() => indexById(clients.data), [clients.data])
  const people = useMemo(() => (profiles.data ?? []).filter((p) => p.active), [profiles.data])

  const total = totalMinutes(rows)
  const series = useMemo(() => dailySeries(rows, range), [rows, range])
  const byClient = useMemo(() => groupRollup(rows, 'client'), [rows])
  const perf = useMemo(() => performanceByUser(rows, profiles.data ?? [], range, today), [rows, profiles.data, range, today])
  const activeCount = new Set(rows.map((r) => r.user_id)).size

  const expectedDays = perf.reduce((s, p) => s + p.workingDays, 0)
  const filledDays = perf.reduce((s, p) => s + p.workingDays - p.missingDays.length, 0)
  const fillRate = expectedDays ? filledDays / expectedDays : null

  const loggedToday = new Set((todayRollup.data ?? []).map((r) => r.user_id))
  const missingToday = people.filter((p) => !loggedToday.has(p.id) && p.daily_target_minutes > 0)

  const loading = rollup.isPending || profiles.isPending || clients.isPending

  return (
    <>
      <PageHeader
        eyebrow={t('nav.sectionManage')}
        title={t('dashboard.title')}
        subtitle={t('dashboard.subtitle')}
        actions={<RangePicker value={range} onChange={setRange} presets={['thisWeek', 'lastWeek', 'thisMonth', 'lastMonth', 'thisYear']} />}
      />

      {loading ? (
        <div className="grid h-80 place-items-center text-ledger"><Spinner /></div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat accent label={t('dashboard.totalTime')} value={formatHM(total)} hint={`${(total / 60).toFixed(1)} ${t('common.hours')}`} />
            <Stat label={t('dashboard.activeCollaborators')} value={`${activeCount}/${people.length}`} delay={50} />
            <Stat label={t('dashboard.clientsServed')} value={byClient.length} delay={100} />
            <Stat
              label={t('dashboard.fillRate')}
              value={fillRate === null ? '—' : `${Math.round(fillRate * 100)}%`}
              hint={t('dashboard.fillRateHint')}
              delay={150}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
            <section className="sheet p-6 animate-rise" style={{ animationDelay: '120ms' }}>
              <div className="mb-4 flex items-baseline justify-between">
                <h2 className="font-display text-xl">{t('dashboard.perDay')}</h2>
                {rollup.isFetching && <Spinner className="size-4 text-ink-3" />}
              </div>
              {total === 0 ? <EmptyState title={t('dashboard.noData')} /> : <DailyChart data={series} lang={lang} />}
            </section>

            <section className="sheet p-6 animate-rise" style={{ animationDelay: '160ms' }}>
              <h2 className="mb-1 flex items-center gap-2 font-display text-xl">
                <Clock className="size-4 text-brass" />
                {t('dashboard.missingToday')}
              </h2>
              {missingToday.length === 0 ? (
                <p className="mt-4 flex items-center gap-2 text-sm text-ledger">
                  <CheckCircle2 className="size-4" /> {t('dashboard.allFilled')}
                </p>
              ) : (
                <ul className="mt-4 space-y-2.5">
                  {missingToday.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 text-sm">
                      <Avatar name={p.full_name} className="size-7" />
                      <span className="flex-1 truncate">{p.full_name}</span>
                      <span className="text-xs text-ink-3">{t(`roles.${p.role}`)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
            <section className="sheet p-6 animate-rise" style={{ animationDelay: '200ms' }}>
              <div className="mb-5 flex items-baseline justify-between">
                <h2 className="font-display text-xl">{t('dashboard.topClients')}</h2>
                <Link to="/reports?group=client" className="text-xs text-ledger hover:underline">
                  {t('dashboard.viewReport')}
                </Link>
              </div>
              {byClient.length === 0 ? (
                <p className="text-sm text-ink-3">{t('dashboard.noData')}</p>
              ) : (
                <ol className="space-y-4">
                  {byClient.slice(0, 8).map((g, i) => (
                    <li key={g.key}>
                      <div className="mb-1.5 flex items-baseline gap-3 text-sm">
                        <span className="num w-4 text-xs text-ink-3">{i + 1}</span>
                        <span className="flex-1 truncate">{clientById.get(g.key)?.name ?? t('common.unknown')}</span>
                        <span className="num font-medium">{formatHM(g.minutes)}</span>
                      </div>
                      <Gauge className="ml-7 w-[calc(100%-1.75rem)]" value={g.minutes / byClient[0].minutes} />
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section className="sheet overflow-hidden animate-rise" style={{ animationDelay: '240ms' }}>
              <div className="flex items-baseline justify-between px-6 pt-6 pb-3">
                <h2 className="font-display text-xl">{t('reports.performance')}</h2>
                <Link to="/reports?group=user" className="inline-flex items-center gap-1 text-xs text-ledger hover:underline">
                  {t('dashboard.viewReport')} <ArrowUpRight className="size-3" />
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="table-ledger">
                  <thead>
                    <tr>
                      <th>{t('reports.byUser')}</th>
                      <th className="text-right">{t('reports.time')}</th>
                      <th className="text-right">{t('reports.workedDays')}</th>
                      <th className="min-w-40">{t('reports.utilization')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perf.map((p) => (
                      <tr key={p.profile.id} className={clsx(!p.profile.active && 'opacity-60')}>
                        <td>
                          <div className="flex items-center gap-3">
                            <Avatar name={p.profile.full_name} className="size-7" />
                            <span className="truncate">{p.profile.full_name}</span>
                          </div>
                        </td>
                        <td className="num text-right font-medium">{formatHM(p.minutes)}</td>
                        <td className="num text-right text-ink-2">
                          {p.daysWorked}/{p.workingDays}
                        </td>
                        <td>
                          <UtilizationCell value={p.utilization} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      )}
    </>
  )
}
