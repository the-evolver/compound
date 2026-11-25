import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { useAppData } from '../../app/AppData'
import { acceptHabitChange, dismissHabitChange, saveCheckpoint, setHabitActivation } from '../../db/actions/plan'
import { completeMonthlyReview, ensureMonthlyReview, recordMonthlyDecision, saveMonthlyDraft } from '../../db/actions/review'
import { db } from '../../db/db'
import { loadHabitData } from '../../db/queries/habitData'
import { rollingAverage, type DatedValue } from '../../domain/body/weight'
import { groupCompliance, ratio, trackStatus } from '../../domain/habits/compliance'
import { describeSchedule } from '../../domain/habits/describe'
import { earliestQueueDate, proposedRules, queueConflicts } from '../../domain/habits/edit'
import { checkpointsInMonth } from '../../domain/review'
import { addDays, formatDay, maxDay, type DayKey } from '../../domain/time/day'
import type { Checkpoint, CheckpointResult } from '../../model/core'
import { Segmented, textareaClass } from '../../ui/fields'
import { Badge, Button, Card, Section } from '../../ui/primitives'
import { ScreenHeader } from '../../ui/ScreenHeader'
import { StatusBadge } from './ScoreboardView'

const fmt = (d: DayKey) => formatDay(d, { day: 'numeric', month: 'short' })
const pct = (r: number | null) => (r === null ? '–' : `${Math.round(r * 100)}%`)

function lastDayOfMonth(month: string): DayKey {
  return addDays(`${addDays(`${month}-01`, 31).slice(0, 7)}-01`, -1)
}

function CheckpointRow({ cp }: { cp: Checkpoint }) {
  const [notes, setNotes] = useState(cp.notes)
  const save = (result: CheckpointResult, n = notes) => void saveCheckpoint({ id: cp.id, areaId: cp.areaId, day: cp.day, title: cp.title, result, notes: n.trim() })
  return (
    <div className="space-y-2 py-3">
      <div>
        <div>{cp.title}</div>
        <div className="text-xs text-faint">{fmt(cp.day)}</div>
      </div>
      <Segmented
        label={`Result: ${cp.title}`}
        value={cp.result}
        options={[
          { value: 'pending', label: 'Not yet' },
          { value: 'pass', label: 'Passed' },
          { value: 'fail', label: 'Missed' },
        ]}
        onChange={(r) => save(r)}
      />
      <textarea className={textareaClass} value={notes} placeholder="What happened?" aria-label={`Notes: ${cp.title}`} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== cp.notes && save(cp.result)} />
    </div>
  )
}

export function MonthlyReviewScreen() {
  const { month = '' } = useParams()
  const { settings, today } = useAppData()
  const valid = /^\d{4}-\d{2}$/.test(month)
  const [ready, setReady] = useState(false)
  const [notes, setNotes] = useState<string | null>(null)
  useEffect(() => {
    if (valid) void ensureMonthlyReview(month).then(() => setReady(true))
  }, [valid, month])

  const data = useLiveQuery(async () => {
    if (!ready) return undefined
    const from = `${month}-01`
    const to = lastDayOfMonth(month)
    const [review, habitData, checkpoints, measurements, sessions] = await Promise.all([
      db.monthlyReviews.get(month),
      loadHabitData(today, settings.weekStartsOn),
      db.checkpoints.toArray(),
      db.measurements.toArray(),
      db.workoutSessions.toArray(),
    ])
    const { areas, habits, ctx, dayEntries } = habitData
    const weights: DatedValue[] = dayEntries.flatMap((e) => (e.metrics.weightKg !== undefined ? [{ day: e.day, value: e.metrics.weightKg }] : []))
    const sunscreen = habits.find((h) => h.role === 'sunscreen')
    const inMonth = (d: DayKey) => d >= from && d <= to
    const waists = measurements.filter((m) => m.kind === 'waistCm').sort((a, b) => (a.day < b.day ? -1 : 1))
    return {
      review,
      from,
      to,
      habits,
      areas: areas.filter((a) => !a.archivedAt).map((a) => {
        const r = ratio(groupCompliance(habits.filter((h) => h.areaId === a.id), ctx, from, to))
        return { area: a, ratio: r, status: trackStatus(r) }
      }),
      weightStart: rollingAverage(weights, addDays(from, 6)),
      weightEnd: rollingAverage(weights, to),
      waistFirst: waists[0],
      waistLatest: waists.filter((w) => w.day <= to).at(-1),
      workouts: sessions.filter((s) => inMonth(s.day)).length,
      sunscreen: sunscreen ? ratio(groupCompliance([sunscreen], ctx, from, to)) : null,
      checkpoints: checkpointsInMonth(checkpoints, month),
      planned: habits.flatMap((h) => proposedRules(h).filter((p) => p.rule.from <= addDays(to, 62)).map((p) => ({ habit: h, ...p }))),
      upcoming: habits.filter((h) => !h.endedOn && h.activeFrom && h.activeFrom > today && h.activeFrom <= addDays(today, 31)),
    }
  }, [ready, month, today, settings.weekStartsOn])

  if (!valid) return <ScreenHeader title="Monthly review" back="/review" />
  if (!data?.review) return <ScreenHeader title="Monthly review" back="/review" />
  const review = data.review
  const monthName = formatDay(`${month}-01`, { month: 'long', year: 'numeric' })
  const delta = data.weightStart !== undefined && data.weightEnd !== undefined ? data.weightEnd - data.weightStart : undefined

  return (
    <div className="space-y-6">
      <ScreenHeader title="Monthly review" subtitle={monthName} back="/review" />

      <Section title="Lead measures">
        <Card className="divide-y divide-line">
          {data.areas.map(({ area, ratio: r, status }) => (
            <div key={area.id} className="flex items-center gap-2 py-2.5">
              <span className="size-2.5 rounded-full" style={{ background: area.color }} aria-hidden="true" />
              <span className="flex-1">{area.name}</span>
              <span className="tabular-nums">{pct(r)}</span>
              <StatusBadge status={status} />
            </div>
          ))}
        </Card>
      </Section>

      <Section title="Results vs plan">
        <Card className="divide-y divide-line text-sm">
          <div className="flex justify-between py-2.5">
            <span>Weight, 7-day avg</span>
            <span className="tabular-nums">
              {data.weightEnd !== undefined ? `${data.weightEnd.toFixed(1)} kg` : '–'}
              {delta !== undefined && ` (${delta >= 0 ? '+' : ''}${delta.toFixed(1)} this month)`}
            </span>
          </div>
          <div className="flex justify-between py-2.5">
            <span>Waist</span>
            <span className="tabular-nums">
              {data.waistLatest ? `${data.waistLatest.value} cm` : '–'}
              {data.waistFirst && data.waistLatest && data.waistFirst.id !== data.waistLatest.id && ` (baseline ${data.waistFirst.value})`}
            </span>
          </div>
          <div className="flex justify-between py-2.5">
            <span>Workouts this month</span>
            <span className="tabular-nums">{data.workouts}</span>
          </div>
          <div className="flex justify-between py-2.5">
            <span>Sunscreen days</span>
            <span className="tabular-nums">{pct(data.sunscreen)}</span>
          </div>
        </Card>
      </Section>

      {data.checkpoints.length > 0 && (
        <Section title="Checkpoints this month">
          <Card className="divide-y divide-line">
            {data.checkpoints.map((cp) => (
              <CheckpointRow key={cp.id} cp={cp} />
            ))}
          </Card>
        </Section>
      )}

      <Section title="Keep, adjust or add">
        <Card className="space-y-4">
          {data.planned.length === 0 && data.upcoming.length === 0 && <p className="text-sm text-muted">No planned changes or new habits due. Keep going; adjust targets in Plan → Habits if something isn't working.</p>}
          {data.planned.map(({ habit, rule, index }) => (
            <div key={`${habit.id}-${index}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{habit.name}</span>
                <Badge>planned from {fmt(rule.from)}</Badge>
              </div>
              <p className="text-sm text-muted">{rule.targetText || describeSchedule(rule.schedule)}</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    void acceptHabitChange(habit.id, index, maxDay(rule.from, today)).then(() =>
                      recordMonthlyDecision(review.id, { habitId: habit.id, action: 'adjust', detail: `Accepted: ${rule.targetText}` }),
                    )
                  }
                >
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void dismissHabitChange(habit.id, index).then(() => recordMonthlyDecision(review.id, { habitId: habit.id, action: 'keep', detail: `Kept current target; dismissed: ${rule.targetText}` }))
                  }
                >
                  Keep current
                </Button>
              </div>
            </div>
          ))}
          {data.upcoming.map((h) => {
            const clash = queueConflicts(data.habits, { id: h.id, areaId: h.areaId, activeFrom: today }, settings.planStart)
            const postponeTo = earliestQueueDate(data.habits, { id: h.id, areaId: h.areaId }, addDays(h.activeFrom!, 14), settings.planStart)
            return (
              <div key={h.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{h.name}</span>
                  <Badge>starts {fmt(h.activeFrom!)}</Badge>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    disabled={clash.length > 0}
                    title={clash.length ? `Too close to ${clash[0]!.name}` : undefined}
                    onClick={() => void setHabitActivation(h.id, today).then(() => recordMonthlyDecision(review.id, { habitId: h.id, action: 'activate', detail: `Started ${h.name}` }))}
                  >
                    {clash.length ? 'Too soon to start' : 'Start now'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      void setHabitActivation(h.id, postponeTo).then(() => recordMonthlyDecision(review.id, { habitId: h.id, action: 'postpone', detail: `Postponed ${h.name} to ${postponeTo}` }))
                    }
                  >
                    Postpone to {fmt(postponeTo)}
                  </Button>
                </div>
              </div>
            )
          })}
        </Card>
      </Section>

      <Section title="Notes">
        <textarea
          className={textareaClass}
          value={notes ?? review.notes}
          aria-label="Monthly notes"
          placeholder="What to keep, what to change next month"
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => {
            if (notes !== null) void saveMonthlyDraft(review.id, { notes: notes.trim() })
          }}
        />
      </Section>

      {review.decisions.length > 0 && (
        <ul className="space-y-1 px-1 text-sm text-muted">
          {review.decisions.map((d, i) => (
            <li key={i}>• {d.detail}</li>
          ))}
        </ul>
      )}

      {review.completedAt ? (
        <p className="text-center text-sm text-ok">Monthly review done.</p>
      ) : (
        <Button
          variant="primary"
          className="w-full"
          onClick={() =>
            void saveMonthlyDraft(review.id, { notes: (notes ?? review.notes).trim() }).then(() =>
              completeMonthlyReview(review.id, { weightEnd: data.weightEnd, workouts: data.workouts, sunscreen: data.sunscreen }),
            )
          }
        >
          Finish monthly review
        </Button>
      )}
    </div>
  )
}
