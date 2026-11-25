import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { useAppData } from '../../app/AppData'
import { acceptHabitChange, deleteHabit, dismissHabitChange, endHabit, resumeHabit, saveHabit, type HabitDraft } from '../../db/actions/plan'
import { db } from '../../db/db'
import { describeSchedule } from '../../domain/habits/describe'
import { earliestQueueDate, proposedRules, queueConflicts } from '../../domain/habits/edit'
import { ruleOn } from '../../domain/habits/rules'
import { LOG_SOURCES, METRICS } from '../../domain/metrics'
import { formatDay, isDayKey, maxDay, type DayKey, type Weekday } from '../../domain/time/day'
import type { Area } from '../../model/core'
import type { Amount, Completion, Habit, Schedule, TimeBlock } from '../../model/habits'
import { Field, inputClass, Segmented, Select, textareaClass } from '../../ui/fields'
import { Badge, Button, Card, Section } from '../../ui/primitives'
import { ScreenHeader } from '../../ui/ScreenHeader'
import { Stepper } from '../../ui/Stepper'
import { WeekdayPicker } from '../../ui/WeekdayPicker'
import { AmountEditor, isValidAmount } from './AmountEditor'

const TIME_BLOCKS: ReadonlyArray<{ value: TimeBlock; label: string }> = [
  { value: 'morning', label: 'Morning' },
  { value: 'daytime', label: 'Day' },
  { value: 'evening', label: 'Evening' },
  { value: 'anytime', label: 'Any' },
]

type ScheduleKind = Schedule['kind']
const SCHEDULE_KINDS: ReadonlyArray<{ value: ScheduleKind; label: string }> = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'days', label: 'Set days' },
  { value: 'perWeek', label: 'N a week' },
]

type CompletionKind = Completion['kind']
const COMPLETION_KINDS: ReadonlyArray<{ value: CompletionKind; label: string }> = [
  { value: 'manual', label: 'I tap Done' },
  { value: 'metric', label: 'A number' },
  { value: 'log', label: 'A log' },
]

const METRIC_OPTIONS = Object.values(METRICS)
  .filter((m) => m.key !== 'weightKg')
  .map((m) => ({ value: m.key as string, label: m.label }))
const LOG_OPTIONS = Object.entries(LOG_SOURCES).map(([k, v]) => ({ value: k, label: v.label }))
const fmt = (d: DayKey) => formatDay(d, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

function unitFor(c: Completion): string {
  if (c.kind === 'metric') return (METRICS as Record<string, { unit: string }>)[c.metric]?.unit ?? ''
  if (c.kind === 'log') return (LOG_SOURCES as Record<string, { unit: string }>)[c.source]?.unit ?? ''
  return ''
}

function scheduleValid(s: Schedule): boolean {
  return s.kind !== 'days' || s.days.length > 0
}

function completionValid(c: Completion): boolean {
  if (c.kind === 'manual') return true
  return isValidAmount(c.target) && (!c.min || isValidAmount(c.min))
}

function HabitForm({ habit, habits, areas, logCount, defaultArea }: { habit?: Habit; habits: Habit[]; areas: Area[]; logCount: number; defaultArea?: string }) {
  const navigate = useNavigate()
  const { settings, today } = useAppData()
  const current = habit ? ruleOn(habit, maxDay(today, habit.activeFrom ?? today)) : undefined

  const [name, setName] = useState(habit?.name ?? '')
  const [areaId, setAreaId] = useState(habit?.areaId ?? defaultArea ?? areas[0]?.id ?? '')
  const [ifThen, setIfThen] = useState(habit?.ifThen ?? '')
  const [obstacle, setObstacle] = useState(habit?.obstacle ?? '')
  const [minVersion, setMinVersion] = useState(habit?.minVersion ?? '')
  const [doneHint, setDoneHint] = useState(habit?.doneHint ?? '')
  const [timeBlock, setTimeBlock] = useState<TimeBlock>(habit?.timeBlock ?? 'anytime')
  const [reminderTime, setReminderTime] = useState(habit?.reminderTime ?? '')
  const [reminderDays, setReminderDays] = useState<Weekday[]>(habit?.reminderDays ?? [])
  const [schedule, setSchedule] = useState<Schedule>(current?.schedule ?? { kind: 'daily' })
  const [completion, setCompletion] = useState<Completion>(current?.completion ?? { kind: 'manual' })
  const [targetText, setTargetText] = useState(current?.targetText ?? '')
  const [activeFrom, setActiveFrom] = useState<DayKey>(habit?.activeFrom ?? '')
  const [changeFrom, setChangeFrom] = useState<DayKey>(today)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const started = !!habit?.activeFrom && habit.activeFrom <= today
  const ruleChanged =
    !!current && JSON.stringify([current.schedule, current.completion, current.targetText]) !== JSON.stringify([schedule, completion, targetText])
  const activationChanged = activeFrom !== (habit?.activeFrom ?? '')
  const conflicts =
    activeFrom && isDayKey(activeFrom) && activationChanged && activeFrom > today
      ? queueConflicts(habits, { id: habit?.id, areaId, activeFrom }, settings.planStart)
      : []
  const suggestion = conflicts.length ? earliestQueueDate(habits, { id: habit?.id, areaId }, activeFrom, settings.planStart) : undefined

  const valid =
    name.trim() &&
    ifThen.trim() &&
    minVersion.trim() &&
    areaId &&
    scheduleValid(schedule) &&
    completionValid(completion) &&
    (!activeFrom || isDayKey(activeFrom)) &&
    isDayKey(changeFrom) &&
    conflicts.length === 0

  const setScheduleKind = (kind: ScheduleKind) => {
    if (kind === 'days') setSchedule({ kind, days: schedule.kind === 'days' ? schedule.days : [1, 3, 5] })
    else if (kind === 'perWeek') setSchedule({ kind, times: schedule.kind === 'perWeek' ? schedule.times : 2 })
    else setSchedule({ kind })
  }
  const setCompletionKind = (kind: CompletionKind) => {
    const target: Amount = completion.kind !== 'manual' ? completion.target : { kind: 'fixed', value: 1 }
    if (kind === 'manual') setCompletion({ kind })
    else if (kind === 'metric') setCompletion({ kind, metric: 'steps', target: target.kind === 'fixed' && target.value > 100 ? target : { kind: 'fixed', value: 7000 } })
    else setCompletion({ kind, source: 'dsa', target: target.kind === 'perKgBodyweight' ? { kind: 'fixed', value: 1 } : target })
  }

  const save = async () => {
    setError(null)
    const draft: HabitDraft = {
      id: habit?.id,
      areaId,
      name: name.trim(),
      ifThen: ifThen.trim(),
      obstacle: obstacle.trim(),
      minVersion: minVersion.trim(),
      doneHint: doneHint.trim(),
      timeBlock,
      reminderTime: reminderTime || undefined,
      reminderDays: schedule.kind === 'perWeek' && reminderDays.length ? reminderDays : undefined,
      order: habit?.order ?? 0,
      activeFrom: activeFrom || undefined,
      endedOn: habit?.endedOn,
    }
    try {
      await saveHabit(draft, { schedule, completion, targetText: targetText.trim(), note: '' }, started ? changeFrom : (activeFrom || today))
      navigate(-1)
    } catch (e) {
      console.error(e)
      setError('Could not save. Check the fields above.')
    }
  }

  const planned = habit ? proposedRules(habit) : []

  return (
    <div className="space-y-6">
      <ScreenHeader title={habit ? habit.name : 'New habit'} subtitle={habit && current ? describeSchedule(current.schedule) : undefined} back="/plan?tab=habits" />

      <Section title="The habit">
        <Card>
          <Field label="Name">{(id) => <input id={id} className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
          <Field label="Area">{(id) => <Select id={id} value={areaId} options={areas.map((a) => ({ value: a.id, label: a.name }))} onChange={setAreaId} />}</Field>
          <Field label="If-then plan" hint="When/After [cue] at [place], I will [action].">
            {(id) => <textarea id={id} className={textareaClass} value={ifThen} onChange={(e) => setIfThen(e.target.value)} />}
          </Field>
          <Field label="If blocked" hint="If [obstacle], then I will [backup].">
            {(id) => <textarea id={id} className={textareaClass} value={obstacle} onChange={(e) => setObstacle(e.target.value)} />}
          </Field>
          <Field label="Minimum version" hint="The bad-day version that keeps it alive.">
            {(id) => <input id={id} className={inputClass} value={minVersion} onChange={(e) => setMinVersion(e.target.value)} />}
          </Field>
          <Field label="Time of day">{() => <Segmented label="Time of day" value={timeBlock} options={TIME_BLOCKS} onChange={setTimeBlock} />}</Field>
        </Card>
      </Section>

      <Section title="Schedule & target">
        <Card>
          <Field label="When">{() => <Segmented label="Schedule" value={schedule.kind} options={SCHEDULE_KINDS} onChange={setScheduleKind} />}</Field>
          {schedule.kind === 'days' && <WeekdayPicker label="Days" value={schedule.days} onChange={(days) => setSchedule({ kind: 'days', days })} />}
          {schedule.kind === 'perWeek' && (
            <Stepper label="Times a week" value={schedule.times} step={1} min={1} max={7} unit="× a week" onChange={(v) => v && setSchedule({ kind: 'perWeek', times: v })} />
          )}
          <Field label="Counts as done when">{() => <Segmented label="Completion" value={completion.kind} options={COMPLETION_KINDS} onChange={setCompletionKind} />}</Field>
          {completion.kind === 'metric' && (
            <div className="space-y-3">
              <Select value={completion.metric} options={METRIC_OPTIONS} onChange={(metric) => setCompletion({ ...completion, metric })} />
              <AmountEditor value={completion.target} unit={unitFor(completion)} allowPerKg onChange={(target) => setCompletion({ ...completion, target })} />
            </div>
          )}
          {completion.kind === 'log' && (
            <div className="space-y-3">
              <Select value={completion.source} options={LOG_OPTIONS} onChange={(source) => setCompletion({ ...completion, source })} />
              <AmountEditor value={completion.target} unit={unitFor(completion)} allowPerKg={false} onChange={(target) => setCompletion({ ...completion, target })} />
            </div>
          )}
          {completion.kind !== 'manual' && (
            <Field label="Minimum-version threshold" hint="Optional. At or above this (but below the target) counts as the minimum version.">
              {() =>
                completion.min ? (
                  <div className="space-y-2">
                    <AmountEditor
                      value={completion.min}
                      unit={unitFor(completion)}
                      allowPerKg={completion.kind === 'metric'}
                      onChange={(min) => setCompletion({ ...completion, min })}
                    />
                    <Button size="sm" variant="ghost" onClick={() => setCompletion({ ...completion, min: undefined })}>
                      Remove threshold
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setCompletion({ ...completion, min: { kind: 'fixed', value: 1 } })}>
                    Add a threshold
                  </Button>
                )
              }
            </Field>
          )}
          <Field label="Target, in words" hint="Shown on the habit, e.g. “Weekdays 45–60 min, weekends 2 h”.">
            {(id) => <input id={id} className={inputClass} value={targetText} onChange={(e) => setTargetText(e.target.value)} />}
          </Field>
          <Field label="Counts as done (optional)" hint="Clarify edge cases, e.g. “or no long time outdoors today”.">
            {(id) => <input id={id} className={inputClass} value={doneHint} onChange={(e) => setDoneHint(e.target.value)} />}
          </Field>
          {started && ruleChanged && (
            <Field label="Schedule change starts on" hint="Earlier days keep the old schedule and target, so your history stays honest.">
              {(id) => <input id={id} type="date" className={inputClass} value={changeFrom} min={habit?.activeFrom} onChange={(e) => setChangeFrom(e.target.value)} />}
            </Field>
          )}
        </Card>
      </Section>

      <Section title="Start & reminder">
        <Card>
          <Field
            label="Start date"
            hint={started ? `Active since ${fmt(habit!.activeFrom!)}.` : activeFrom ? `Starts ${fmt(activeFrom)}.` : 'Leave empty to keep it in the queue without a date.'}
          >
            {(id) => <input id={id} type="date" className={inputClass} value={activeFrom} disabled={started} onChange={(e) => setActiveFrom(e.target.value)} />}
          </Field>
          {conflicts.length > 0 && (
            <div className="rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm">
              <p>
                One new habit per area every two weeks: {conflicts.map((c) => `${c.name} (${fmt(c.activeFrom!)})`).join(', ')} starts too close.
              </p>
              {suggestion && (
                <Button size="sm" className="mt-2" onClick={() => setActiveFrom(suggestion)}>
                  Use {fmt(suggestion)}
                </Button>
              )}
            </div>
          )}
          <Field label="Calendar reminder" hint="Used in the calendar file. Leave empty for no reminder.">
            {(id) => (
              <div className="flex gap-2">
                <input id={id} type="time" className={inputClass} value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} />
                {reminderTime && (
                  <Button variant="ghost" onClick={() => setReminderTime('')}>
                    Clear
                  </Button>
                )}
              </div>
            )}
          </Field>
          {schedule.kind === 'perWeek' && reminderTime && (
            <Field label="Remind me on">{() => <WeekdayPicker label="Reminder days" value={reminderDays} onChange={setReminderDays} />}</Field>
          )}
        </Card>
      </Section>

      {planned.length > 0 && habit && (
        <Section title="Planned changes">
          <Card className="space-y-3">
            {planned.map(({ rule, index }) => (
              <div key={index}>
                <div className="flex items-center gap-2">
                  <Badge>from {fmt(rule.from)}</Badge>
                  <span className="text-sm">{describeSchedule(rule.schedule)}</span>
                </div>
                <p className="mt-1 text-sm text-muted">{rule.targetText}</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Button size="sm" onClick={() => void acceptHabitChange(habit.id, index, maxDay(rule.from, today))}>
                    Accept
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void dismissHabitChange(habit.id, index)}>
                    Dismiss
                  </Button>
                </div>
              </div>
            ))}
          </Card>
        </Section>
      )}

      {error && <p className="text-bad">{error}</p>}
      <Button variant="primary" className="w-full" disabled={!valid} onClick={() => void save()}>
        {habit ? 'Save changes' : 'Add habit'}
      </Button>

      {habit && (
        <Section title="Stop or remove">
          <Card className="space-y-2">
            {habit.endedOn ? (
              <Button className="w-full" onClick={() => void resumeHabit(habit.id)}>
                Resume this habit
              </Button>
            ) : (
              <Button className="w-full" onClick={() => void endHabit(habit.id, today).then(() => navigate(-1))}>
                Stop this habit from today
              </Button>
            )}
            <p className="text-sm text-muted">Stopping keeps its history and strength chart.</p>
            {logCount === 0 &&
              (confirmDelete ? (
                <Button variant="danger" className="w-full" onClick={() => void deleteHabit(habit.id).then(() => navigate(-1))}>
                  Delete permanently
                </Button>
              ) : (
                <Button variant="ghost" className="w-full" onClick={() => setConfirmDelete(true)}>
                  Delete habit…
                </Button>
              ))}
          </Card>
        </Section>
      )}
    </div>
  )
}

export function HabitEditorScreen() {
  const { id = 'new' } = useParams()
  const [params] = useSearchParams()
  const habitId = id === 'new' ? undefined : decodeURIComponent(id)
  const data = useLiveQuery(async () => {
    const [habit, habits, areas, logCount] = await Promise.all([
      habitId ? db.habits.get(habitId) : Promise.resolve(undefined),
      db.habits.toArray(),
      db.areas.orderBy('order').toArray(),
      habitId ? db.habitLogs.where('habitId').equals(habitId).count() : Promise.resolve(0),
    ])
    return { habit, habits, areas, logCount }
  }, [habitId])
  if (!data) return null
  if (!habitId && data.areas.length === 0) {
    return (
      <div className="space-y-4">
        <ScreenHeader title="New habit" back="/plan?tab=habits" />
        <p className="text-muted">Habits belong to an area. Add an area first in Plan → Habits.</p>
      </div>
    )
  }
  if (habitId && !data.habit) {
    return (
      <div className="space-y-4">
        <ScreenHeader title="Habit not found" back="/plan?tab=habits" />
        <p className="text-muted">It may have been deleted.</p>
      </div>
    )
  }
  return (
    <HabitForm
      key={habitId ?? 'new'}
      habit={data.habit}
      habits={data.habits}
      areas={data.areas}
      logCount={data.logCount}
      defaultArea={params.get('area') ?? undefined}
    />
  )
}
