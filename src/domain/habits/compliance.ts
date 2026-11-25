import type { Habit } from '../../model/habits'
import { addDays, daysBetween, endOfWeek, maxDay, minDay, startOfWeek, type DayKey } from '../time/day'
import type { HabitContext } from './context'
import { creditOf, dayResult } from './outcome'
import { isActiveOn, isScheduledOn, ruleOn } from './rules'
import { requiredSlots } from './strength'

/*
 * Lead compliance: credit earned / credit expected over a window.
 * - Done earns 1, the minimum version ½, a miss 0. Skips are left out.
 * - Fixed schedules are tallied per week: a session moved to another day
 *   that week (gym on Tuesday instead of Monday) still counts.
 * - Today only counts once it is done (it isn't over yet).
 * - N-per-week habits count only weeks that have ended (or end today).
 */
export interface Tally {
  earned: number
  expected: number
}

export function addTally(a: Tally, b: Tally): Tally {
  return { earned: a.earned + b.earned, expected: a.expected + b.expected }
}

export function ratio(t: Tally): number | null {
  return t.expected > 0 ? t.earned / t.expected : null
}

export function habitCompliance(habit: Habit, ctx: HabitContext, from: DayKey, to: DayKey): Tally {
  const total: Tally = { earned: 0, expected: 0 }
  if (!habit.activeFrom) return total
  const start = maxDay(from, habit.activeFrom)
  const end = minDay(to, ctx.today)
  if (start > end) return total

  for (let weekStart = startOfWeek(start, ctx.weekStartsOn); weekStart <= end; weekStart = addDays(weekStart, 7)) {
    const weekEnd = endOfWeek(weekStart, ctx.weekStartsOn)
    const lo = maxDay(start, weekStart)
    const hi = minDay(end, weekEnd)
    const schedule = ruleOn(habit, hi).schedule

    let credits = 0
    let completions = 0
    let due = 0
    let skips = 0
    for (let day = lo; day <= hi; day = addDays(day, 1)) {
      if (!isActiveOn(habit, day)) continue
      const result = dayResult(habit, day, ctx)
      if (result.outcome === 'skip') skips++
      if (result.outcome === 'done' || result.outcome === 'min') {
        credits += creditOf(result.outcome)
        completions++
      }
      const rule = ruleOn(habit, day)
      const final = day < ctx.today || result.outcome === 'done' || result.outcome === 'min'
      if (rule.schedule.kind !== 'perWeek' && isScheduledOn(rule.schedule, day) && final && result.outcome !== 'skip') due++
    }

    if (schedule.kind === 'perWeek') {
      if (weekEnd > ctx.today || weekEnd > to) continue
      const activeDays = daysBetween(maxDay(weekStart, habit.activeFrom), weekEnd) + 1
      const expected = Math.max(0, requiredSlots(schedule.times, activeDays) - skips)
      // Credit for the best `expected` completions, ½ each for minimum versions.
      const earned = completions ? Math.min(expected, (credits / completions) * Math.min(completions, expected)) : 0
      total.expected += expected
      total.earned += earned
    } else {
      total.expected += due
      total.earned += Math.min(credits, due)
    }
  }
  return total
}

export function groupCompliance(habits: readonly Habit[], ctx: HabitContext, from: DayKey, to: DayKey): Tally {
  return habits.reduce<Tally>((acc, h) => addTally(acc, habitCompliance(h, ctx, from, to)), { earned: 0, expected: 0 })
}

export type TrackStatus = 'on_track' | 'slipping' | 'off_track' | 'no_data'

/** On track ≥ 80%, slipping 50–79%, off track < 50%. */
export function trackStatus(r: number | null): TrackStatus {
  if (r === null) return 'no_data'
  if (r >= 0.8) return 'on_track'
  if (r >= 0.5) return 'slipping'
  return 'off_track'
}

/** Honest status from the last 14 complete days (today excluded). */
export function recentStatus(habits: readonly Habit[], ctx: HabitContext): { status: TrackStatus; ratio: number | null } {
  const to = addDays(ctx.today, -1)
  const r = ratio(groupCompliance(habits, ctx, addDays(to, -13), to))
  return { status: trackStatus(r), ratio: r }
}
