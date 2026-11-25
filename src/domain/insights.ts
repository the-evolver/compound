import type { Habit } from '../model/habits'
import type { HabitContext } from './habits/context'
import { groupCompliance, ratio } from './habits/compliance'
import { creditOf, dayResult } from './habits/outcome'
import { isActiveOn, isScheduledOn, ruleOn } from './habits/rules'
import { addDays, eachDay, endOfWeek, formatDay, maxDay, startOfWeek, type DayKey, type Weekday } from './time/day'

/** Week starts from the plan's first week to the current one (the last `max` of them). */
export function planWeeks(planStart: DayKey, today: DayKey, weekStartsOn: Weekday, max = 12): DayKey[] {
  const first = startOfWeek(planStart, weekStartsOn)
  const last = startOfWeek(today, weekStartsOn)
  const out: DayKey[] = []
  for (let w = first; w <= last; w = addDays(w, 7)) out.push(w)
  return out.slice(-max)
}

export const weekLabel = (weekStart: DayKey) => formatDay(weekStart, { day: 'numeric', month: 'short' })

/** Lead compliance per week for a set of habits (null where nothing was due). */
export function complianceByWeek(habits: readonly Habit[], ctx: HabitContext, weeks: readonly DayKey[], weekStartsOn: Weekday) {
  return weeks.map((w) => ({ weekStart: w, ratio: ratio(groupCompliance(habits, ctx, w, endOfWeek(w, weekStartsOn))) }))
}

export interface HeatCell {
  day: DayKey
  /** 0–1 share of the day's due habits that were done (min counts ½); null when nothing was due. */
  score: number | null
  future: boolean
}

/** Per-day completion for the heatmap calendar. Skips are left out; N-per-week habits count when done. */
export function dailyScores(habits: readonly Habit[], ctx: HabitContext, from: DayKey, to: DayKey): HeatCell[] {
  return eachDay(from, to).map((day) => {
    if (day > ctx.today) return { day, score: null, future: true }
    let due = 0
    let earned = 0
    for (const h of habits) {
      if (!isActiveOn(h, day)) continue
      const schedule = ruleOn(h, day).schedule
      const r = dayResult(h, day, ctx)
      if (r.outcome === 'skip') continue
      const credit = creditOf(r.outcome)
      const scheduled = schedule.kind !== 'perWeek' && isScheduledOn(schedule, day)
      const final = day < ctx.today || credit > 0
      if ((scheduled && final) || credit > 0) {
        due += 1
        earned += credit
      }
    }
    return { day, score: due ? Math.min(1, earned / due) : null, future: false }
  })
}

/** Heatmap range: whole weeks, from the plan start (or `weeks` back) to the end of this week. */
export function heatmapRange(planStart: DayKey, today: DayKey, weekStartsOn: Weekday, weeks = 16): { from: DayKey; to: DayKey } {
  const to = endOfWeek(today, weekStartsOn)
  const from = maxDay(startOfWeek(planStart, weekStartsOn), addDays(startOfWeek(today, weekStartsOn), -(weeks - 1) * 7))
  return { from, to }
}

/** Counts (or sums) dated items per week. */
export function perWeek<T extends { day: DayKey }>(
  items: readonly T[],
  weeks: readonly DayKey[],
  weekStartsOn: Weekday,
  value: (item: T) => number = () => 1,
): Array<{ weekStart: DayKey; value: number }> {
  const totals = new Map(weeks.map((w) => [w, 0]))
  for (const item of items) {
    const w = startOfWeek(item.day, weekStartsOn)
    if (totals.has(w)) totals.set(w, totals.get(w)! + value(item))
  }
  return weeks.map((w) => ({ weekStart: w, value: totals.get(w)! }))
}

/** Average of a value per week (null where there were no items). */
export function averagePerWeek<T extends { day: DayKey }>(
  items: readonly T[],
  weeks: readonly DayKey[],
  weekStartsOn: Weekday,
  value: (item: T) => number,
): Array<{ weekStart: DayKey; value: number | null }> {
  const sums = perWeek(items, weeks, weekStartsOn, value)
  const counts = perWeek(items, weeks, weekStartsOn)
  return sums.map((s, i) => ({ weekStart: s.weekStart, value: counts[i]!.value ? Math.round((s.value / counts[i]!.value) * 100) / 100 : null }))
}
