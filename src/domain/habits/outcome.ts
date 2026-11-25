import type { Completion, Habit } from '../../model/habits'
import { addDays, endOfWeek, startOfWeek, type DayKey } from '../time/day'
import type { Evidence, HabitContext } from './context'
import { isActiveOn, isScheduledOn, resolveAmount, ruleOn } from './rules'

/**
 * What happened with a habit on a day.
 * - done / min / skip: tapped on Today, or (done / min) shown by a log or number.
 * - missed: it was due, the day is over, and nothing was logged.
 * - pending: due today and not logged yet.
 * - open: an N-per-week habit with nothing on this day (not a miss by itself).
 * - not_due: a fixed-schedule habit on a day it isn't scheduled.
 * - upcoming: a future day. inactive: before activation or after it ended.
 */
export type Outcome = 'done' | 'min' | 'skip' | 'missed' | 'pending' | 'open' | 'not_due' | 'upcoming' | 'inactive'

export interface Progress {
  value: number
  target?: number
  min?: number
}

export interface DayResult {
  outcome: Outcome
  /** How done/min/skip was decided. */
  source?: 'tap' | 'evidence'
  progress?: Progress
}

/** Evidence progress for metric/log habits; undefined for manual ones. */
export function progressOn(completion: Completion, day: DayKey, evidence: Evidence): Progress | undefined {
  switch (completion.kind) {
    case 'manual':
      return undefined
    case 'metric': {
      const weight = evidence.bodyweightKg(day)
      return {
        value: evidence.metric(completion.metric, day) ?? 0,
        target: resolveAmount(completion.target, day, weight),
        min: completion.min ? resolveAmount(completion.min, day, weight) : undefined,
      }
    }
    case 'log': {
      const weight = evidence.bodyweightKg(day)
      return {
        value: evidence.logCount(completion.source, day),
        target: resolveAmount(completion.target, day, weight),
        min: completion.min ? resolveAmount(completion.min, day, weight) : undefined,
      }
    }
  }
}

export function dayResult(habit: Habit, day: DayKey, ctx: HabitContext): DayResult {
  if (!isActiveOn(habit, day)) return { outcome: 'inactive' }
  if (day > ctx.today) return { outcome: 'upcoming' }

  const rule = ruleOn(habit, day)
  const progress = progressOn(rule.completion, day, ctx.evidence)

  const log = ctx.log(habit.id, day)
  if (log) return { outcome: log.status, source: 'tap', progress }

  if (progress && progress.value > 0) {
    if (progress.target !== undefined && progress.value >= progress.target) {
      return { outcome: 'done', source: 'evidence', progress }
    }
    if (progress.min !== undefined && progress.value >= progress.min) {
      return { outcome: 'min', source: 'evidence', progress }
    }
  }

  if (rule.schedule.kind === 'perWeek') return { outcome: 'open', progress }
  if (!isScheduledOn(rule.schedule, day)) return { outcome: 'not_due', progress }
  return { outcome: day < ctx.today ? 'missed' : 'pending', progress }
}

/** Credit an outcome earns: 1 for done, ½ for the minimum version. */
export function creditOf(outcome: Outcome): number {
  return outcome === 'done' ? 1 : outcome === 'min' ? 0.5 : 0
}

/**
 * "Never miss twice": today is a due day and the previous due day was
 * missed. Only for fixed schedules; N-per-week habits have no "previous day".
 */
export function needsNeverMissTwice(habit: Habit, ctx: HabitContext): boolean {
  const today = ctx.today
  if (!isActiveOn(habit, today)) return false
  const schedule = ruleOn(habit, today).schedule
  if (schedule.kind === 'perWeek' || !isScheduledOn(schedule, today)) return false
  for (let i = 1; i <= 7; i++) {
    const day = addDays(today, -i)
    const result = dayResult(habit, day, ctx)
    if (result.outcome === 'inactive') return false
    if (result.outcome === 'not_due') continue
    return result.outcome === 'missed'
  }
  return false
}

export function skipsInWeek(habit: Habit, day: DayKey, ctx: HabitContext): number {
  let n = 0
  for (let d = startOfWeek(day, ctx.weekStartsOn); d <= endOfWeek(day, ctx.weekStartsOn); d = addDays(d, 1)) {
    if (ctx.log(habit.id, d)?.status === 'skip') n++
  }
  return n
}

/** Skips allowed per habit per week; an existing skip on the day can always be kept. */
export function canSkip(habit: Habit, day: DayKey, ctx: HabitContext, maxSkipsPerWeek: number): boolean {
  if (ctx.log(habit.id, day)?.status === 'skip') return true
  return skipsInWeek(habit, day, ctx) < maxSkipsPerWeek
}
