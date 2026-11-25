import { daysBetween, type DayKey } from './time/day'

export type PlanPosition =
  | { kind: 'before'; daysUntilStart: number; totalDays: number }
  | { kind: 'during'; dayNumber: number; totalDays: number }
  | { kind: 'after'; daysSinceEnd: number; totalDays: number }

/** Days in the plan, counting both the first and the last day. */
export function totalPlanDays(start: DayKey, end: DayKey): number {
  return daysBetween(start, end) + 1
}

/** Where a day sits in the plan: "Day 37 of 274", or before/after it. */
export function planPosition(day: DayKey, start: DayKey, end: DayKey): PlanPosition {
  const totalDays = totalPlanDays(start, end)
  if (day < start) return { kind: 'before', daysUntilStart: daysBetween(day, start), totalDays }
  if (day > end) return { kind: 'after', daysSinceEnd: daysBetween(end, day), totalDays }
  return { kind: 'during', dayNumber: daysBetween(start, day) + 1, totalDays }
}

/** 1-based plan week: days 1–7 are week 1. Days before the start return 0. */
export function planWeek(day: DayKey, start: DayKey): number {
  if (day < start) return 0
  return Math.floor(daysBetween(start, day) / 7) + 1
}

export interface DatedSpan {
  start: DayKey
  end: DayKey
}

/** The span (e.g. phase) that contains the day, if any. */
export function spanOn<T extends DatedSpan>(day: DayKey, spans: readonly T[]): T | undefined {
  return spans.find((s) => day >= s.start && day <= s.end)
}
