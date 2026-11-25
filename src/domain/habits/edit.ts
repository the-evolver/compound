import type { Habit, HabitRule } from '../../model/habits'
import { addDays, daysBetween, type DayKey } from '../time/day'
import { ruleOn } from './rules'

/*
 * Editing habits without rewriting history, and the habit queue.
 */

function sameRule(a: HabitRule, b: HabitRule): boolean {
  return (
    JSON.stringify([a.schedule, a.completion, a.targetText]) === JSON.stringify([b.schedule, b.completion, b.targetText])
  )
}

/**
 * Applies a schedule/target change from `from` on. Days before keep the
 * rule they had. If the habit hasn't started yet (or the change starts on
 * its first day) there is no history, so the change simply replaces the
 * rules. Proposed (not yet accepted) rules are kept as they are.
 */
export function changeRule(habit: Habit, next: Omit<HabitRule, 'from' | 'proposed'>, from: DayKey): HabitRule[] {
  const proposed = habit.rules.filter((r) => r.proposed)
  const accepted = habit.rules.filter((r) => !r.proposed)
  const current = ruleOn(habit, from)
  const rule: HabitRule = { ...next, from, proposed: false }

  // Not started yet: no history to keep, and the rule starts with the habit.
  const noHistory = !habit.activeFrom || from <= habit.activeFrom
  if (noHistory) {
    return [{ ...rule, from: habit.activeFrom ?? from }, ...proposed]
  }
  if (sameRule(current, rule)) return habit.rules
  const kept = accepted.filter((r) => r.from < from)
  return [...kept, rule, ...proposed].sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0))
}

/** Accepts a planned change, starting on `from` (its own date by default). */
export function acceptProposed(habit: Habit, index: number, from?: DayKey): HabitRule[] {
  const target = habit.rules[index]
  if (!target?.proposed) return habit.rules
  const others = habit.rules.filter((_, i) => i !== index)
  const start = from ?? target.from
  const accepted = others.filter((r) => !r.proposed && r.from < start)
  const stillProposed = others.filter((r) => r.proposed)
  return [...accepted, { ...target, from: start, proposed: false }, ...stillProposed].sort((a, b) =>
    a.from < b.from ? -1 : a.from > b.from ? 1 : 0,
  )
}

export function dismissProposed(habit: Habit, index: number): HabitRule[] {
  if (!habit.rules[index]?.proposed) return habit.rules
  return habit.rules.filter((_, i) => i !== index)
}

/** Planned changes waiting for a decision. */
export function proposedRules(habit: Habit): Array<{ rule: HabitRule; index: number }> {
  return habit.rules.flatMap((rule, index) => (rule.proposed ? [{ rule, index }] : []))
}

/*
 * Habit queue: at most one new habit per area every two weeks. Habits that
 * start on the plan's first day (the week-1 set) don't count.
 */
export const QUEUE_GAP_DAYS = 14

export function queueConflicts(
  habits: readonly Habit[],
  candidate: { id?: string; areaId: string; activeFrom: DayKey },
  planStart: DayKey,
): Habit[] {
  if (candidate.activeFrom <= planStart) return []
  return habits.filter(
    (h) =>
      h.id !== candidate.id &&
      h.areaId === candidate.areaId &&
      h.activeFrom !== undefined &&
      h.activeFrom > planStart &&
      !h.endedOn &&
      Math.abs(daysBetween(h.activeFrom, candidate.activeFrom)) < QUEUE_GAP_DAYS,
  )
}

/** The first day on or after `from` that keeps the two-week gap in the area. */
export function earliestQueueDate(
  habits: readonly Habit[],
  candidate: { id?: string; areaId: string },
  from: DayKey,
  planStart: DayKey,
): DayKey {
  let day = from
  for (let i = 0; i < 400; i++) {
    if (queueConflicts(habits, { ...candidate, activeFrom: day }, planStart).length === 0) return day
    day = addDays(day, 1)
  }
  return day
}
