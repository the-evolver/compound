import type { Habit } from '../../model/habits'
import { addDays, daysBetween, endOfWeek, maxDay, minDay, startOfWeek, type DayKey } from '../time/day'
import type { HabitContext } from './context'
import { creditOf, dayResult } from './outcome'
import { ruleOn } from './rules'

/*
 * Habit Strength, 0–1 (shown as 0–100), by exponential smoothing as in Loop
 * Habit Tracker: strength = prev × 0.948 + value × 0.052, where value is 1
 * (done), 0.5 (minimum version) or 0 (missed). A skip leaves it unchanged.
 * One miss barely moves it; repeated misses do. ~66 perfect days reach ~97.
 *
 * N-per-week habits: each completion (up to N) updates strength on its day;
 * when the week ends, every slot still unfilled counts as a miss.
 */
export const STRENGTH_KEEP = 0.948
export const STRENGTH_GAIN = 1 - STRENGTH_KEEP

export function nextStrength(prev: number, value: number): number {
  return prev * STRENGTH_KEEP + value * STRENGTH_GAIN
}

export interface StrengthPoint {
  day: DayKey
  strength: number
}

/** Slots required in a week, prorated when the habit was active for only part of it. */
export function requiredSlots(times: number, activeDaysInWeek: number): number {
  return Math.ceil((times * Math.min(7, activeDaysInWeek)) / 7)
}

/** Strength after every day from activation to `until` (default: today). */
export function strengthSeries(habit: Habit, ctx: HabitContext, until: DayKey = ctx.today): StrengthPoint[] {
  if (!habit.activeFrom || habit.activeFrom > until) return []
  const last = habit.endedOn ? minDay(until, addDays(habit.endedOn, -1)) : until
  const out: StrengthPoint[] = []
  let s = 0
  // Running tallies for the current week of an N-per-week habit.
  let weekCredits = 0
  let weekSkips = 0

  for (let day = habit.activeFrom; day <= last; day = addDays(day, 1)) {
    const schedule = ruleOn(habit, day).schedule
    const result = dayResult(habit, day, ctx)

    if (schedule.kind === 'perWeek') {
      const weekStart = startOfWeek(day, ctx.weekStartsOn)
      if (day === weekStart || day === habit.activeFrom) {
        weekCredits = 0
        weekSkips = 0
      }
      if (result.outcome === 'skip') weekSkips++
      if ((result.outcome === 'done' || result.outcome === 'min') && weekCredits < schedule.times) {
        weekCredits++
        s = nextStrength(s, creditOf(result.outcome))
      }
      const weekEnd = endOfWeek(day, ctx.weekStartsOn)
      if (day === weekEnd && weekEnd < ctx.today) {
        const activeDays = daysBetween(maxDay(weekStart, habit.activeFrom), weekEnd) + 1
        const shortfall = requiredSlots(schedule.times, activeDays) - weekCredits - weekSkips
        for (let i = 0; i < shortfall; i++) s = nextStrength(s, 0)
      }
    } else if (result.outcome === 'done' || result.outcome === 'min') {
      s = nextStrength(s, creditOf(result.outcome))
    } else if (result.outcome === 'missed') {
      s = nextStrength(s, 0)
    }

    out.push({ day, strength: s })
  }
  return out
}

/** Current strength, 0–100. */
export function strengthScore(habit: Habit, ctx: HabitContext): number {
  const series = strengthSeries(habit, ctx)
  return Math.round((series[series.length - 1]?.strength ?? 0) * 100)
}
