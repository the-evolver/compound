import { useAppData } from '../../app/AppData'
import { rollingAverage, type DatedValue } from '../../domain/body/weight'
import { funnel, mockAverage, STAGE_LABEL, weakPatterns } from '../../domain/career'
import { averagePerWeek, perWeek, planWeeks, weekLabel } from '../../domain/insights'
import { fillersPer2Min, rubricAverage, skinPhotoSchedule } from '../../domain/skinVoice'
import { TOPIC_STATUS_SHORT } from '../../domain/study'
import { formatDay } from '../../domain/time/day'
import { prsInSession, setScore } from '../../domain/workouts'
import { TOPIC_STATUSES } from '../../model/career'
import { BarTrend, LineTrend } from '../../ui/charts'
import { Badge, Card, Section } from '../../ui/primitives'
import type { InsightsData } from './useInsightsData'

const pct = (v: number) => `${Math.round(v * 100)}%`
const short = (d: string) => formatDay(d, { day: 'numeric', month: 'short' })

function useWeeks() {
  const { settings, today } = useAppData()
  return { weeks: planWeeks(settings.planStart, today, settings.weekStartsOn), weekStartsOn: settings.weekStartsOn }
}

export function CareerCharts({ data, color }: { data: InsightsData; color: `#${string}` }) {
  const { weeks, weekStartsOn } = useWeeks()
  const problems = perWeek(data.problems, weeks, weekStartsOn)
  const passRate = averagePerWeek(data.reviews, weeks, weekStartsOn, (r) => (r.rating === 'failed' ? 0 : 1))
  const patterns = weakPatterns(data.problems, data.reviews).slice(0, 5)
  const f = funnel(data.applications)
  return (
    <>
      <Section title="DSA problems per week">
        <Card>
          <BarTrend ariaLabel="New DSA problems per week" name="Problems" data={problems.map((w) => ({ label: weekLabel(w.weekStart), value: w.value }))} color={color} />
        </Card>
      </Section>
      {data.reviews.length > 0 && (
        <Section title="Review pass rate (retention)">
          <Card>
            <BarTrend
              ariaLabel="Share of DSA reviews passed per week"
              name="Passed"
              data={passRate.map((w) => ({ label: weekLabel(w.weekStart), value: w.value }))}
              color={color}
              yDomain={[0, 1]}
              yTicks={[0, 0.5, 1]}
              format={pct}
            />
          </Card>
        </Section>
      )}
      {patterns.length > 0 && (
        <Section title="Weak patterns">
          <Card>
            <ul className="divide-y divide-line text-sm">
              {patterns.map((p) => (
                <li key={p.tag} className="flex justify-between py-2">
                  <span>{p.tag}</span>
                  <span className="tabular-nums text-muted">
                    {pct(p.rate)} failed · {p.attempts} attempts
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </Section>
      )}
      <Section title="Topics by status">
        <Card>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-faint">
                <th className="py-1 text-left font-normal">Subject</th>
                {TOPIC_STATUSES.map((s) => (
                  <th key={s} className="py-1 text-right font-normal">
                    {TOPIC_STATUS_SHORT[s]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.subjects.map((s) => {
                const mine = data.topics.filter((t) => t.subjectId === s.id)
                return (
                  <tr key={s.id}>
                    <td className="py-2">{s.name}</td>
                    {TOPIC_STATUSES.map((st) => (
                      <td key={st} className="py-2 text-right tabular-nums">
                        {mine.filter((t) => t.status === st).length || '·'}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      </Section>
      {data.mocks.length >= 2 && (
        <Section title="Mock score trend">
          <Card>
            <LineTrend
              ariaLabel="Mock interview scores over time"
              data={data.mocks.map((m) => ({ label: short(m.day), average: Math.round(mockAverage(m) * 10) / 10, communication: m.scores.communication }))}
              series={[
                { key: 'average', label: 'Average score', color: 'series-1' },
                { key: 'communication', label: 'Communication', color: 'series-2' },
              ]}
              yDomain={[1, 4]}
              yTicks={[1, 2, 3, 4]}
              format={(v) => `${v} / 4`}
            />
          </Card>
        </Section>
      )}
      {data.applications.length > 0 && (
        <Section title="Application funnel">
          <Card>
            <ol className="space-y-1.5 text-sm">
              {f.map((x) => (
                <li key={x.stage} className="flex items-center gap-2">
                  <span className="w-32 shrink-0 text-muted">{STAGE_LABEL[x.stage]}</span>
                  <span className="h-2 rounded-full" style={{ width: `${Math.max(2, (x.count / data.applications.length) * 100)}%`, background: color }} aria-hidden="true" />
                  <span className="tabular-nums">{x.count}</span>
                </li>
              ))}
            </ol>
          </Card>
        </Section>
      )}
    </>
  )
}

export function BodyCharts({ data, color }: { data: InsightsData; color: `#${string}` }) {
  const { weeks, weekStartsOn } = useWeeks()
  const weights: DatedValue[] = data.dayEntries.flatMap((e) => (e.metrics.weightKg !== undefined ? [{ day: e.day, value: e.metrics.weightKg }] : []))
  const recent = weights.slice(-60)
  const waists = data.measurements.filter((m) => m.kind === 'waistCm')
  const sessions = perWeek(data.sessions, weeks, weekStartsOn, (s) => (s.location === 'home' ? 0.5 : 1))
  const exById = new Map(data.exercises.map((e) => [e.id, e]))
  const best = new Map<string, { score: number; day: string; text: string }>()
  for (const s of data.sessions)
    for (const e of s.entries) {
      const ex = exById.get(e.exerciseId)
      if (!ex) continue
      for (const set of e.sets) {
        const score = setScore(ex, set)
        if (score > (best.get(ex.id)?.score ?? 0)) best.set(ex.id, { score, day: s.day, text: ex.bodyweight ? `${set.reps}${ex.measure === 'seconds' ? ' s' : ' reps'}` : `${set.reps} × ${set.kg} kg` })
      }
    }
  const prCount = data.sessions.reduce((n, s) => n + prsInSession(s, data.sessions, exById).length, 0)
  return (
    <>
      {recent.length >= 2 && (
        <Section title="Weight">
          <Card>
            <LineTrend
              ariaLabel="Daily weight and 7-day average"
              data={recent.map((w) => ({ label: short(w.day), daily: w.value, average: Math.round((rollingAverage(weights, w.day) ?? w.value) * 10) / 10 }))}
              series={[
                { key: 'average', label: '7-day average', color: 'series-1' },
                { key: 'daily', label: 'Daily weigh-in', color: 'series-2' },
              ]}
              yDomain={['auto', 'auto']}
              format={(v) => `${v} kg`}
            />
          </Card>
        </Section>
      )}
      {waists.length >= 2 && (
        <Section title="Waist">
          <Card>
            <LineTrend ariaLabel="Waist by week" data={waists.map((m) => ({ label: short(m.day), waist: m.value }))} series={[{ key: 'waist', label: 'Waist', color }]} yDomain={['auto', 'auto']} format={(v) => `${v} cm`} />
          </Card>
        </Section>
      )}
      <Section title="Sessions per week">
        <Card>
          <BarTrend ariaLabel="Workout sessions per week" name="Sessions" data={sessions.map((w) => ({ label: weekLabel(w.weekStart), value: w.value }))} color={color} />
        </Card>
      </Section>
      {best.size > 0 && (
        <Section title={`Best sets · ${prCount} PR${prCount === 1 ? '' : 's'} so far`}>
          <Card>
            <ul className="divide-y divide-line text-sm">
              {[...best.entries()].map(([id, b]) => (
                <li key={id} className="flex justify-between py-2">
                  <span>{exById.get(id)?.name}</span>
                  <span className="tabular-nums text-muted">
                    {b.text} · {short(b.day)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </Section>
      )}
    </>
  )
}

export function SkinCharts({ data, color }: { data: InsightsData; color: `#${string}` }) {
  const { settings, today } = useAppData()
  const { weeks, weekStartsOn } = useWeeks()
  const sunscreenId = data.habits.find((h) => h.role === 'sunscreen')?.id
  const sunscreenDays = perWeek(
    data.habitLogs.filter((l) => l.habitId === sunscreenId && (l.status === 'done' || l.status === 'min')),
    weeks,
    weekStartsOn,
  )
  const taken = new Set(data.measurements.filter((m) => m.kind === 'skinPhoto').map((m) => m.id.split('|')[1]))
  const schedule = skinPhotoSchedule(settings.planStart, settings.planEnd)
  return (
    <>
      <Section title="Sunscreen days per week">
        <Card>
          <BarTrend
            ariaLabel="Days with morning sunscreen per week"
            name="Days"
            data={sunscreenDays.map((w) => ({ label: weekLabel(w.weekStart), value: w.value }))}
            color={color}
            yDomain={[0, 7]}
            yTicks={[0, 3, 6, 7]}
          />
        </Card>
      </Section>
      <Section title="Photo checkpoints">
        <Card>
          <ol className="flex flex-wrap gap-2">
            {schedule.map((s) => {
              const done = taken.has(s.day)
              return (
                <li key={s.day}>
                  <Badge tone={done ? 'ok' : s.day <= today ? 'warn' : 'neutral'}>
                    {done ? '✓ ' : s.day <= today ? '! ' : ''}
                    {s.label} · {short(s.day)}
                  </Badge>
                </li>
              )
            })}
          </ol>
        </Card>
      </Section>
    </>
  )
}

export function VoiceCharts({ data, color }: { data: InsightsData; color: `#${string}` }) {
  const { weeks, weekStartsOn } = useWeeks()
  const drillsPerWeek = perWeek(data.drills, weeks, weekStartsOn)
  const fillers = averagePerWeek(data.drills, weeks, weekStartsOn, fillersPer2Min)
  const rubric = averagePerWeek(data.drills, weeks, weekStartsOn, rubricAverage)
  return (
    <>
      <Section title="Drills per week">
        <Card>
          <BarTrend ariaLabel="Speaking drills per week" name="Drills" data={drillsPerWeek.map((w) => ({ label: weekLabel(w.weekStart), value: w.value }))} color={color} />
        </Card>
      </Section>
      {data.drills.length >= 2 && (
        <>
          <Section title="Fillers per 2 minutes">
            <Card>
              <LineTrend
                ariaLabel="Average filler words per 2 minutes, by week"
                data={fillers.map((w) => ({ label: weekLabel(w.weekStart), fillers: w.value }))}
                series={[{ key: 'fillers', label: 'Fillers / 2 min', color }]}
                yDomain={[0, 'auto']}
                format={(v) => `${v}`}
              />
            </Card>
          </Section>
          <Section title="Rubric average">
            <Card>
              <LineTrend
                ariaLabel="Average self-rating (clarity, structure, pace, confidence), by week"
                data={rubric.map((w) => ({ label: weekLabel(w.weekStart), rubric: w.value }))}
                series={[{ key: 'rubric', label: 'Rubric average', color }]}
                yDomain={[1, 5]}
                yTicks={[1, 2, 3, 4, 5]}
                format={(v) => `${v} / 5`}
              />
            </Card>
          </Section>
        </>
      )}
    </>
  )
}
