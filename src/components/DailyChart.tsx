import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts'
import { formatDate, todayISO, type ISODate } from '@/lib/dates'
import { formatHM } from '@/lib/time'

interface Point {
  date: ISODate
  minutes: number
}

const INK_3 = '#8a8478'
const RULE = '#e7e0d1'
const BAR = '#2b6a50'
const BAR_TODAY = '#b9822a'

function ChartTooltip({ active, payload, lang }: TooltipContentProps & { lang: string }) {
  const p = payload?.[0]?.payload as Point | undefined
  if (!active || !p) return null
  return (
    <div className="rounded-lg border border-rule bg-card px-3 py-2 text-sm shadow-[var(--shadow-pop)]">
      <p className="text-xs text-ink-3 capitalize">{formatDate(p.date, lang, 'EEEE d MMM')}</p>
      <p className="num mt-0.5 font-medium text-ink">{formatHM(p.minutes)}</p>
    </div>
  )
}

/** Single-series column chart of time per day. Today is picked out in brass. */
export function DailyChart({ data, lang, height = 240 }: { data: Point[]; lang: string; height?: number }) {
  const today = todayISO()
  const dense = data.length > 31
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -12 }} barCategoryGap="20%">
        <CartesianGrid vertical={false} stroke={RULE} strokeWidth={1} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={{ stroke: RULE }}
          tick={{ fill: INK_3, fontSize: 11, fontFamily: 'IBM Plex Mono' }}
          tickFormatter={(d: string) => formatDate(d, lang, data.length <= 7 ? 'EEE d' : dense ? 'MMM' : 'd')}
          interval={dense ? 'preserveStartEnd' : data.length > 16 ? 1 : 0}
          minTickGap={dense ? 24 : 4}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={44}
          tick={{ fill: INK_3, fontSize: 11, fontFamily: 'IBM Plex Mono' }}
          tickFormatter={(m: number) => `${Math.round(m / 60)}h`}
          allowDecimals={false}
        />
        <Tooltip cursor={{ fill: 'rgb(27 26 23 / 0.04)' }} content={(props) => <ChartTooltip {...props} lang={lang} />} />
        <Bar dataKey="minutes" maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false}>
          {data.map((p) => (
            <Cell key={p.date} fill={p.date === today ? BAR_TODAY : BAR} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
