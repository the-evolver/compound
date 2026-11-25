import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useAppData } from '../../app/AppData'
import { setMetric } from '../../db/actions/daily'
import { deleteMeasurement, saveMeasurement } from '../../db/actions/bodySkinVoice'
import { db } from '../../db/db'
import { latestOnOrBefore, rollingAverage, type DatedValue } from '../../domain/body/weight'
import { addDays, formatDay, monthOf, startOfWeek } from '../../domain/time/day'
import type { Measurement } from '../../model/body'
import { inputClass } from '../../ui/fields'
import { Card, Row, Section } from '../../ui/primitives'
import { Stepper } from '../../ui/Stepper'

const fmt1 = (n: number | undefined) => (n === undefined ? '–' : n.toFixed(1))

export function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = Math.round(totalSeconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function parseDuration(text: string): number | undefined {
  const m = /^\s*(\d{1,3})(?::(\d{1,2}))?\s*$/.exec(text)
  if (!m) return undefined
  return m[2] === undefined ? Number(m[1]) * 60 : Number(m[1]) * 60 + Number(m[2])
}

function RunInput({ value, onSave }: { value: number | undefined; onSave: (seconds: number | undefined) => void }) {
  const [text, setText] = useState(value ? formatDuration(value) : '')
  const [error, setError] = useState(false)
  return (
    <div>
      <input
        className={inputClass}
        inputMode="numeric"
        placeholder="mm:ss"
        aria-label="2 km run time (minutes:seconds)"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          if (!text.trim()) return onSave(undefined)
          const s = parseDuration(text)
          setError(s === undefined)
          if (s !== undefined) onSave(s)
        }}
      />
      {error && <p className="mt-1 text-sm text-bad">Use minutes:seconds, e.g. 11:40</p>}
    </div>
  )
}

export function BodyTab() {
  const { settings, today } = useAppData()
  const week = startOfWeek(today, settings.weekStartsOn)
  const month = monthOf(today)
  const data = useLiveQuery(async () => {
    const [entries, measurements] = await Promise.all([db.dayEntries.orderBy('day').toArray(), db.measurements.orderBy('day').toArray()])
    return { entries, measurements }
  }, [])
  if (!data) return null

  const weights: DatedValue[] = data.entries.flatMap((e) => (e.metrics.weightKg !== undefined ? [{ day: e.day, value: e.metrics.weightKg }] : []))
  const avgNow = rollingAverage(weights, today)
  const avg4w = rollingAverage(weights, addDays(today, -28))
  const lastWeigh = latestOnOrBefore(weights, today)
  const todayWeight = data.entries.find((e) => e.day === today)?.metrics.weightKg

  const byKind = (kind: string) => data.measurements.filter((m) => m.kind === kind)
  const get = (kind: string, period: string): Measurement | undefined => data.measurements.find((m) => m.id === `${kind}|${period}`)
  const waists = byKind('waistCm')
  const waistBaseline = waists[0]
  const waistThisWeek = get('waistCm', week)
  const photoThisMonth = get('bodyPhoto', month)

  const months = [...new Set(data.measurements.filter((m) => ['pushupsMax', 'plankSec', 'run2kSec'].includes(m.kind)).map((m) => m.id.split('|')[1]!))].sort().reverse()

  return (
    <div className="space-y-6">
      <Section title="Weight">
        <Card>
          <Row
            label="7-day average"
            value={avgNow !== undefined ? `${fmt1(avgNow)} kg` : '–'}
            hint={
              avgNow !== undefined && avg4w !== undefined
                ? `${avgNow - avg4w >= 0 ? '+' : ''}${(avgNow - avg4w).toFixed(1)} kg vs 4 weeks ago`
                : 'Daily weight is noisy (water, food); the 7-day average shows the trend.'
            }
          />
          {lastWeigh && <p className="text-xs text-faint">Last weigh-in: {fmt1(lastWeigh.value)} kg on {formatDay(lastWeigh.day, { day: 'numeric', month: 'short' })}</p>}
          <div className="mt-3">
            <Stepper label="Today's weight" value={todayWeight} start={lastWeigh?.value} step={0.1} min={30} max={250} decimals={1} unit="kg" onChange={(v) => void setMetric(today, 'weightKg', v)} />
          </div>
        </Card>
      </Section>

      <Section title="Waist (weekly)">
        <Card>
          <Stepper
            label="Waist this week"
            value={waistThisWeek?.value}
            start={waists.at(-1)?.value ?? 85}
            step={0.5}
            min={40}
            max={200}
            decimals={1}
            unit="cm"
            onChange={(v) => void (v === undefined ? deleteMeasurement('waistCm', week) : saveMeasurement('waistCm', week, today, v))}
          />
          <p className="mt-2 text-sm text-muted">
            {waistBaseline
              ? `Baseline ${fmt1(waistBaseline.value)} cm (${formatDay(waistBaseline.day, { day: 'numeric', month: 'short' })}) · latest ${fmt1(waists.at(-1)!.value)} cm`
              : 'Measure at the navel, relaxed, same time of day each week. The first entry becomes your baseline.'}
          </p>
        </Card>
      </Section>

      <Section title={`Monthly benchmarks · ${formatDay(`${month}-01`, { month: 'long' })}`}>
        <Card className="space-y-3">
          <div>
            <div className="mb-1 text-sm text-muted">Max push-ups in one go</div>
            <Stepper
              label="Max push-ups"
              value={get('pushupsMax', month)?.value}
              start={byKind('pushupsMax').at(-1)?.value ?? 10}
              step={1}
              min={0}
              max={200}
              unit="reps"
              onChange={(v) => void (v === undefined ? deleteMeasurement('pushupsMax', month) : saveMeasurement('pushupsMax', month, today, v))}
            />
          </div>
          <div>
            <div className="mb-1 text-sm text-muted">Plank hold</div>
            <Stepper
              label="Plank"
              value={get('plankSec', month)?.value}
              start={byKind('plankSec').at(-1)?.value ?? 60}
              step={5}
              min={0}
              max={1200}
              unit="s"
              onChange={(v) => void (v === undefined ? deleteMeasurement('plankSec', month) : saveMeasurement('plankSec', month, today, v))}
            />
          </div>
          <div>
            <div className="mb-1 text-sm text-muted">2 km run time</div>
            <RunInput
              key={month}
              value={get('run2kSec', month)?.value}
              onSave={(s) => void (s === undefined ? deleteMeasurement('run2kSec', month) : saveMeasurement('run2kSec', month, today, s))}
            />
          </div>
          <label className="flex min-h-12 items-center gap-3">
            <input
              type="checkbox"
              className="size-5 accent-[var(--color-accent)]"
              checked={!!photoThisMonth}
              onChange={(e) => void (e.target.checked ? saveMeasurement('bodyPhoto', month, today, 1) : deleteMeasurement('bodyPhoto', month))}
            />
            <span>Progress photo taken this month</span>
          </label>
          <p className="text-xs text-faint">Photos stay in your phone's gallery; the app stores only the checkmark.</p>
        </Card>
      </Section>

      {months.length > 0 && (
        <Section title="Benchmark history">
          <Card>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-faint">
                  <th className="py-1 font-normal">Month</th>
                  <th className="py-1 text-right font-normal">Push-ups</th>
                  <th className="py-1 text-right font-normal">Plank</th>
                  <th className="py-1 text-right font-normal">2 km</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {months.map((m) => (
                  <tr key={m}>
                    <td className="py-2">{formatDay(`${m}-01`, { month: 'short', year: '2-digit' })}</td>
                    <td className="py-2 text-right tabular-nums">{get('pushupsMax', m)?.value ?? '–'}</td>
                    <td className="py-2 text-right tabular-nums">{get('plankSec', m) ? `${get('plankSec', m)!.value}s` : '–'}</td>
                    <td className="py-2 text-right tabular-nums">{get('run2kSec', m) ? formatDuration(get('run2kSec', m)!.value) : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </Section>
      )}
    </div>
  )
}
