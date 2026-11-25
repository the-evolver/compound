import { z } from 'zod'
import { zClockTime, zDay, zId, zTimestamp, zWeekday } from './common'

export const zTimeBlock = z.enum(['morning', 'daytime', 'evening', 'anytime'])
export type TimeBlock = z.output<typeof zTimeBlock>

/** When a habit is due. Add a new kind here and handle it in domain/habits. */
export const zSchedule = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('daily') }),
  z.object({ kind: z.literal('weekdays') }),
  z.object({ kind: z.literal('days'), days: z.array(zWeekday).min(1) }),
  z.object({ kind: z.literal('perWeek'), times: z.number().int().min(1).max(7) }),
])
export type Schedule = z.output<typeof zSchedule>

/** A target amount that can differ by day type or follow body weight. */
export const zAmount = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('fixed'), value: z.number().nonnegative() }),
  z.object({
    kind: z.literal('weekdayWeekend'),
    weekday: z.number().nonnegative(),
    weekend: z.number().nonnegative(),
  }),
  z.object({ kind: z.literal('perKgBodyweight'), perKg: z.number().positive() }),
])
export type Amount = z.output<typeof zAmount>

/**
 * How a habit counts as done.
 * - manual: tapped Done / Min / Skip on Today.
 * - metric: a number from the quick numbers row reaches the target (steps,
 *   protein, sleep).
 * - log: enough entries in a log that day (DSA items, a workout, a drill).
 * A tap on Today always overrides what the evidence says.
 */
export const zCompletion = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('manual') }),
  z.object({
    kind: z.literal('metric'),
    metric: z.string().min(1),
    target: zAmount,
    min: zAmount.optional(),
  }),
  z.object({
    kind: z.literal('log'),
    source: z.string().min(1),
    target: zAmount,
    min: zAmount.optional(),
  }),
])
export type Completion = z.output<typeof zCompletion>

/**
 * The schedule and target in effect from a day onward. Editing a habit's
 * schedule or target adds a new rule instead of rewriting the old one, so
 * past days are always judged by the rule that applied then.
 */
export const zHabitRule = z.object({
  from: zDay,
  schedule: zSchedule,
  completion: zCompletion,
  /** Human-readable target, e.g. "Weekdays 2 items, weekends 4". */
  targetText: z.string().default(''),
  /**
   * A planned change (e.g. "4 workouts/week from Phase 2") that is offered in
   * the monthly review and ignored until accepted.
   */
  proposed: z.boolean().default(false),
  note: z.string().default(''),
})
export type HabitRule = z.output<typeof zHabitRule>

export const zHabit = z.object({
  id: zId,
  areaId: zId,
  name: z.string().min(1),
  /** "When/After [cue] at [place], I will [action]." */
  ifThen: z.string().min(1),
  /** "If [obstacle], then I will [backup]." */
  obstacle: z.string().default(''),
  /** The bad-day version that keeps the habit alive. */
  minVersion: z.string().min(1),
  timeBlock: zTimeBlock,
  /** Clock time for the calendar reminder (.ics). No time, no reminder. */
  reminderTime: zClockTime.optional(),
  /**
   * Reminder days for habits without fixed days (N per week). Fixed-day
   * habits are reminded on their scheduled days.
   */
  reminderDays: z.array(zWeekday).optional(),
  /** Clarifies what counts as Done, e.g. "or no long time outdoors today". */
  doneHint: z.string().default(''),
  /** A special meaning some screens use (e.g. "sunscreen" feeds the skin stats). */
  role: z.enum(['sunscreen']).optional(),
  order: z.number(),
  /** First day it is active. Unset = queued with no date yet. */
  activeFrom: zDay.optional(),
  /** Stopped from this day on (kept for history). */
  endedOn: zDay.optional(),
  /** Sorted by `from`. The first rule also covers days before its `from`. */
  rules: z.array(zHabitRule).min(1),
  createdAt: zTimestamp,
})
export type Habit = z.output<typeof zHabit>

export const zHabitStatus = z.enum(['done', 'min', 'skip'])
export type HabitStatus = z.output<typeof zHabitStatus>

export const zSkipReason = z.enum(['sick', 'travel', 'rest', 'other'])
export type SkipReason = z.output<typeof zSkipReason>

/**
 * An explicit Done / Min / Skip for one habit on one day. "Missed" is never
 * stored: it is worked out from the schedule when the day has passed.
 */
export const zHabitLog = z.object({
  /** `${habitId}|${day}`: one record per habit per day. */
  id: zId,
  habitId: zId,
  day: zDay,
  status: zHabitStatus,
  skipReason: zSkipReason.optional(),
  note: z.string().optional(),
  at: zTimestamp,
})
export type HabitLog = z.output<typeof zHabitLog>

export function habitLogId(habitId: string, day: string): string {
  return `${habitId}|${day}`
}

/**
 * Per-day numbers (steps, protein, sleep, weight, …) and the day's note.
 * Metrics are a free-form map keyed by the metric registry, so adding a
 * metric needs no database change.
 */
export const zDayEntry = z.object({
  day: zDay,
  metrics: z.record(z.string(), z.number()).default(() => ({})),
  note: z.string().default(''),
  updatedAt: zTimestamp,
})
export type DayEntry = z.output<typeof zDayEntry>
