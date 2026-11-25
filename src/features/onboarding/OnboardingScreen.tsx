import { useState } from 'react'
import { useAppData } from '../../app/AppData'
import { useAuth } from '../../app/Auth'
import { clock } from '../../domain/time/clock'
import { addDays, formatDay, isDayKey, type DayKey, type Weekday } from '../../domain/time/day'
import { totalPlanDays } from '../../domain/plan'
import { pickTextFile } from '../../platform/files'
import { completeOnboarding } from '../../seed/applySeed'
import { DEFAULT_WORKOUT_DAYS, parsePlanFile, templateNeeds, type PlanTemplate } from '../../seed/template'
import { inputClass } from '../../ui/fields'
import { Button, Card, cx, Section } from '../../ui/primitives'
import { Stepper } from '../../ui/Stepper'
import { WeekdayPicker } from '../../ui/WeekdayPicker'
import { RestoreButton } from '../backup/RestoreButton'

type Mode = { kind: 'choose' } | { kind: 'blank' } | { kind: 'plan'; plan: PlanTemplate }

const DEFAULT_LENGTH_DAYS = 274 // about 9 months

function SetupForm({ plan, onBack }: { plan?: PlanTemplate; onBack: () => void }) {
  const { settings, today } = useAppData()
  const needs = plan ? templateNeeds(plan) : { workout: false, weight: false }
  const suggested = plan?.suggestedStart && plan.suggestedStart >= today ? plan.suggestedStart : today
  const [startDay, setStartDay] = useState<DayKey>(suggested)
  const [endDay, setEndDay] = useState<DayKey>(plan?.planEnd && plan.planEnd > suggested ? plan.planEnd : addDays(suggested, DEFAULT_LENGTH_DAYS - 1))
  const [weightKg, setWeightKg] = useState<number | undefined>()
  const [weekdayHours, setWeekdayHours] = useState<number | undefined>(settings.budget.weekdayHours)
  const [weekendHours, setWeekendHours] = useState<number | undefined>(settings.budget.weekendHours)
  const [workoutDays, setWorkoutDays] = useState<Weekday[]>(DEFAULT_WORKOUT_DAYS)
  const [workoutTime, setWorkoutTime] = useState('07:00')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const datesValid = isDayKey(startDay) && isDayKey(endDay) && startDay < endDay
  const ready =
    datesValid &&
    weekdayHours !== undefined &&
    weekendHours !== undefined &&
    (!needs.weight || weightKg !== undefined) &&
    (!needs.workout || (workoutDays.length > 0 && /^\d{2}:\d{2}$/.test(workoutTime)))

  const start = async () => {
    if (!ready || weekdayHours === undefined || weekendHours === undefined) return
    setSaving(true)
    setError(null)
    try {
      await completeOnboarding({ startDay, endDay, weightKg, weekdayHours, weekendHours, workoutDays, workoutTime, today, now: clock.now() }, plan)
    } catch (e) {
      console.error(e)
      setError('Could not save. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {plan && (
        <Card>
          <div className="font-semibold">{plan.name}</div>
          {plan.description && <p className="mt-1 text-sm text-muted">{plan.description}</p>}
          <p className="mt-2 text-sm text-muted">
            {plan.areas.length} areas, {plan.habits.length} habits. You start with only the first habits; the rest are added gradually.
          </p>
        </Card>
      )}

      <Section title="Plan dates">
        <Card className="space-y-3">
          <label className="block text-sm">
            <span className="text-muted">Start date</span>
            <input type="date" className={`${inputClass} mt-1`} value={startDay} onChange={(e) => setStartDay(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="text-muted">End date</span>
            <input type="date" className={`${inputClass} mt-1`} value={endDay} onChange={(e) => setEndDay(e.target.value)} />
          </label>
          <p className="text-sm text-muted">
            {datesValid ? `${totalPlanDays(startDay, endDay)} days, ending ${formatDay(endDay, { day: 'numeric', month: 'long', year: 'numeric' })}.` : 'The end must be after the start.'}
          </p>
        </Card>
      </Section>

      {needs.weight && (
        <Section title="Body weight">
          <Card>
            <Stepper label="Weight" value={weightKg} onChange={setWeightKg} step={0.5} min={30} max={250} decimals={1} start={75} unit="kg" />
            <p className="mt-2 text-sm text-muted">Sets per-kg targets (like protein). Shown later as a 7-day average.</p>
          </Card>
        </Section>
      )}

      <Section title="Time budget">
        <Card className="space-y-3">
          <div>
            <div className="mb-1 text-sm text-muted">Weekdays</div>
            <Stepper label="Weekday hours" value={weekdayHours} onChange={setWeekdayHours} step={0.25} min={0} max={12} decimals={2} unit="h" />
          </div>
          <div>
            <div className="mb-1 text-sm text-muted">Weekends</div>
            <Stepper label="Weekend hours" value={weekendHours} onChange={setWeekendHours} step={0.25} min={0} max={16} decimals={2} unit="h" />
          </div>
        </Card>
      </Section>

      {needs.workout && (
        <Section title="Workout days">
          <Card className="space-y-3">
            <WeekdayPicker label="Workout days" value={workoutDays} onChange={setWorkoutDays} />
            <label className="flex items-center justify-between gap-3">
              <span className="text-muted">Alarm time</span>
              <input type="time" aria-label="Alarm time" className="min-h-12 rounded-xl bg-surface-2 px-3 text-base text-text" value={workoutTime} onChange={(e) => setWorkoutTime(e.target.value)} />
            </label>
            <p className="text-sm text-muted">{workoutDays.length}× a week to start.</p>
          </Card>
        </Section>
      )}

      {error && <p className="text-bad">{error}</p>}
      <Button variant="primary" className="w-full" disabled={!ready || saving} onClick={() => void start()}>
        {saving ? 'Setting up…' : plan ? 'Start my plan' : 'Start with a blank plan'}
      </Button>
      {needs.weight && weightKg === undefined && <p className="-mt-3 text-center text-sm text-faint">Enter your weight to continue.</p>}
      <Button variant="ghost" className="w-full" onClick={onBack}>
        Back
      </Button>
    </div>
  )
}

export function OnboardingScreen() {
  const { account, logout } = useAuth()
  const [mode, setMode] = useState<Mode>({ kind: 'choose' })
  const [error, setError] = useState<string | null>(null)

  const loadPlan = async () => {
    setError(null)
    const file = await pickTextFile('application/json,.json')
    if (!file) return
    const parsed = parsePlanFile(file.text)
    if (!parsed.ok) return setError(parsed.error)
    setMode({ kind: 'plan', plan: parsed.plan })
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Set up your plan</h1>
        <p className="text-sm text-muted">
          Signed in as {account.username}.{' '}
          <button type="button" className="text-accent underline" onClick={() => void logout()}>
            Log out
          </button>
        </p>
      </header>

      {mode.kind === 'choose' && (
        <div className="space-y-3">
          <button type="button" className={cx('block w-full rounded-2xl bg-surface p-4 text-left active:bg-surface-2')} onClick={() => setMode({ kind: 'blank' })}>
            <div className="font-semibold">Start with a blank plan</div>
            <div className="text-sm text-muted">Add your own areas, habits, study subjects and checkpoints in Plan.</div>
          </button>
          <button type="button" className="block w-full rounded-2xl bg-surface p-4 text-left active:bg-surface-2" onClick={() => void loadPlan()}>
            <div className="font-semibold">Load a plan file</div>
            <div className="text-sm text-muted">A .compound.json plan someone gave you, or your own. It stays on this device.</div>
          </button>
          {error && <p className="text-sm text-bad">{error}</p>}
          <div className="rounded-2xl bg-surface p-4">
            <div className="font-semibold">Restore from a backup</div>
            <p className="mb-3 text-sm text-muted">Moving from another phone? Bring everything back from a backup file.</p>
            <RestoreButton variant="outline" hasData={false} />
          </div>
        </div>
      )}

      {mode.kind === 'blank' && <SetupForm onBack={() => setMode({ kind: 'choose' })} />}
      {mode.kind === 'plan' && <SetupForm plan={mode.plan} onBack={() => setMode({ kind: 'choose' })} />}
    </div>
  )
}
