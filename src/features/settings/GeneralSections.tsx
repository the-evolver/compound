import { useAppData } from '../../app/AppData'
import { planPosition, totalPlanDays } from '../../domain/plan'
import { formatDay, isDayKey } from '../../domain/time/day'
import { isValidTimeZone } from '../../domain/time/zone'
import { CommitInput, Field, Segmented, Select } from '../../ui/fields'
import { Card, Section } from '../../ui/primitives'
import { Stepper } from '../../ui/Stepper'
import { updateSettings } from './updateSettings'

const HOURS = [0, 1, 2, 3, 4, 5, 6].map((h) => ({ value: h, label: h === 0 ? 'Midnight' : `${h}:00 AM` }))

export function PlanSection() {
  const { settings, today } = useAppData()
  const pos = planPosition(today, settings.planStart, settings.planEnd)
  return (
    <Section title="Plan">
      <Card>
        <Field
          label="Start date"
          hint={`${totalPlanDays(settings.planStart, settings.planEnd)} days in the plan.${pos.kind === 'during' ? ` Today is day ${pos.dayNumber}.` : ''} Changes the day counter; habit start dates stay as they are.`}
        >
          {(id) => (
            <CommitInput
              id={id}
              type="date"
              value={settings.planStart}
              commit={(v) => {
                if (!isDayKey(v)) return 'Pick a date.'
                if (v >= settings.planEnd) return 'The start must be before the end.'
                return updateSettings({ planStart: v })
              }}
            />
          )}
        </Field>
        <Field label="End date" hint={`Ends ${formatDay(settings.planEnd, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}.`}>
          {(id) => (
            <CommitInput
              id={id}
              type="date"
              value={settings.planEnd}
              commit={(v) => {
                if (!isDayKey(v)) return 'Pick a date.'
                if (v <= settings.planStart) return 'The end must be after the start.'
                return updateSettings({ planEnd: v })
              }}
            />
          )}
        </Field>
        <Field label="Weekday time budget">
          {() => (
            <Stepper
              label="Weekday hours"
              value={settings.budget.weekdayHours}
              onChange={(v) => v !== undefined && void updateSettings({ budget: { ...settings.budget, weekdayHours: v } })}
              step={0.25}
              min={0}
              max={12}
              decimals={2}
              unit="h"
            />
          )}
        </Field>
        <Field label="Weekend time budget">
          {() => (
            <Stepper
              label="Weekend hours"
              value={settings.budget.weekendHours}
              onChange={(v) => v !== undefined && void updateSettings({ budget: { ...settings.budget, weekendHours: v } })}
              step={0.25}
              min={0}
              max={16}
              decimals={2}
              unit="h"
            />
          )}
        </Field>
      </Card>
    </Section>
  )
}

export function DaySection() {
  const { settings } = useAppData()
  return (
    <Section title="Day & week">
      <Card>
        <Field label="New day starts at" hint="Anything logged before then counts toward the previous day.">
          {(id) => <Select id={id} value={settings.rolloverHour} options={HOURS} onChange={(v) => void updateSettings({ rolloverHour: v })} />}
        </Field>
        <Field label="Week starts on">
          {() => (
            <Segmented
              label="Week starts on"
              value={settings.weekStartsOn === 0 ? 'sun' : 'mon'}
              options={[
                { value: 'mon', label: 'Monday' },
                { value: 'sun', label: 'Sunday' },
              ]}
              onChange={(v) => void updateSettings({ weekStartsOn: v === 'sun' ? 0 : 1 })}
            />
          )}
        </Field>
        <Field label="Review reminder time" hint="Used in the calendar file for the Sunday and monthly reviews.">
          {(id) => <CommitInput id={id} type="time" value={settings.weeklyReviewTime} commit={(v) => updateSettings({ weeklyReviewTime: v })} />}
        </Field>
        <Field label="Timezone" hint="An IANA name, e.g. Europe/London.">
          {(id) => (
            <CommitInput
              id={id}
              value={settings.timeZone}
              commit={(v) => (isValidTimeZone(v.trim()) ? updateSettings({ timeZone: v.trim() }) : 'Unknown timezone.')}
            />
          )}
        </Field>
      </Card>
    </Section>
  )
}

export function HabitRulesSection() {
  const { settings } = useAppData()
  return (
    <Section title="Habits & logging">
      <Card>
        <Field label="Skips per habit per week" hint="Skips with a reason don't lower strength.">
          {() => (
            <Stepper label="Skips per week" value={settings.maxSkipsPerWeek} onChange={(v) => v !== undefined && void updateSettings({ maxSkipsPerWeek: v })} step={1} min={0} max={7} />
          )}
        </Field>
        <Field label="Items on Today before “+N more”" hint="“Never miss twice” items always show.">
          {() => (
            <Stepper label="Items on Today" value={settings.todayItemCap} onChange={(v) => v !== undefined && void updateSettings({ todayItemCap: v })} step={1} min={3} max={20} />
          )}
        </Field>
        <Field label="Backup reminder after" hint="Days without a backup before Today nudges you.">
          {() => (
            <Stepper label="Backup reminder days" value={settings.backupNudgeDays} onChange={(v) => v !== undefined && void updateSettings({ backupNudgeDays: v })} step={1} min={1} max={60} unit="days" />
          )}
        </Field>
        <Field label="DSA review intervals (days)" hint="Comma-separated, increasing. Failed resets to the first; Easy skips one.">
          {(id) => (
            <CommitInput
              id={id}
              inputMode="numeric"
              value={settings.srsIntervals.join(', ')}
              commit={(v) => {
                const nums = v.split(/[,\s]+/).filter(Boolean).map(Number)
                if (!nums.length || nums.some((n) => !Number.isInteger(n) || n < 1)) return 'Use whole numbers of days, like 1, 3, 7.'
                if (nums.some((n, i) => i > 0 && n <= nums[i - 1]!)) return 'Each interval must be longer than the one before.'
                return updateSettings({ srsIntervals: nums })
              }}
            />
          )}
        </Field>
      </Card>
    </Section>
  )
}

export function ProfileSection() {
  const { settings } = useAppData()
  const p = settings.profile
  const save = (patch: Partial<typeof p>) => updateSettings({ profile: { ...p, ...patch } })
  const text = (label: string, key: 'name' | 'nickname' | 'role' | 'location' | 'stack') => (
    <Field label={label}>{(id) => <CommitInput id={id} value={p[key]} commit={(v) => save({ [key]: v.trim() })} />}</Field>
  )
  return (
    <Section title="Profile">
      <Card>
        {text('Name', 'name')}
        {text('Nickname', 'nickname')}
        {text('Role', 'role')}
        <Field label="Experience (years)">
          {(id) => (
            <CommitInput
              id={id}
              inputMode="decimal"
              value={String(p.experienceYears)}
              commit={(v) => {
                const n = Number(v.replace(',', '.'))
                return Number.isFinite(n) && n >= 0 ? save({ experienceYears: n }) : 'Enter a number of years.'
              }}
            />
          )}
        </Field>
        {text('Stack', 'stack')}
        {text('Location', 'location')}
      </Card>
    </Section>
  )
}

export function DisplaySection() {
  const { settings } = useAppData()
  return (
    <Section title="Display">
      <Card>
        <Field label="Theme">
          {() => (
            <Segmented
              label="Theme"
              value={settings.theme}
              options={[
                { value: 'dark', label: 'Dark' },
                { value: 'light', label: 'Light' },
              ]}
              onChange={(v) => void updateSettings({ theme: v })}
            />
          )}
        </Field>
      </Card>
    </Section>
  )
}
