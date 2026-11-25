import type { Amount, Habit, HabitRule, Schedule } from '../../model/habits'
import { isWeekend, weekday, type DayKey } from '../time/day'

/** Active on a day: on or after activation, and before it ended. */
export function isActiveOn(habit: Habit, day: DayKey): boolean {
  if (!habit.activeFrom || day < habit.activeFrom) return false
  return !habit.endedOn || day < habit.endedOn
}

/** Queued: has no activation date yet, or it is still in the future. */
export function isQueued(habit: Habit, today: DayKey): boolean {
  return !habit.activeFrom || habit.activeFrom > today
}

/**
 * The rule in effect on a day: the last accepted rule starting on or before
 * it. Days before the first rule use the first rule.
 */
export function ruleOn(habit: Habit, day: DayKey): HabitRule {
  const accepted = habit.rules.filter((r) => !r.proposed)
  const pool = accepted.length ? accepted : habit.rules
  let current = pool[0]!
  for (const r of pool) if (r.from <= day && r.from >= current.from) current = r
  return current
}

/** Whether a fixed schedule requires the habit on this day. N-per-week habits are never "due" on a given day. */
export function isScheduledOn(schedule: Schedule, day: DayKey): boolean {
  switch (schedule.kind) {
    case 'daily':
      return true
    case 'weekdays':
      return !isWeekend(day)
    case 'days':
      return schedule.days.includes(weekday(day))
    case 'perWeek':
      return false
  }
}

export function isFixedSchedule(schedule: Schedule): boolean {
  return schedule.kind !== 'perWeek'
}

/** A target amount for a day. Per-kg amounts need a body weight; undefined without one. */
export function resolveAmount(amount: Amount, day: DayKey, bodyweightKg: number | undefined): number | undefined {
  switch (amount.kind) {
    case 'fixed':
      return amount.value
    case 'weekdayWeekend':
      return isWeekend(day) ? amount.weekend : amount.weekday
    case 'perKgBodyweight':
      return bodyweightKg === undefined ? undefined : Math.round(amount.perKg * bodyweightKg)
  }
}
