import type { Area } from '../model/core'
import type { Habit, HabitRule, SkipReason, TimeBlock } from '../model/habits'
import type { HabitContext } from './habits/context'
import { canSkip, dayResult, needsNeverMissTwice, skipsInWeek, type DayResult } from './habits/outcome'
import { isActiveOn, isScheduledOn, ruleOn } from './habits/rules'
import { strengthScore } from './habits/strength'
import { addDays, startOfWeek, type DayKey } from './time/day'

export const TIME_BLOCKS: ReadonlyArray<{ id: TimeBlock; label: string }> = [
  { id: 'morning', label: 'Morning' },
  { id: 'daytime', label: 'Daytime' },
  { id: 'evening', label: 'Evening' },
  { id: 'anytime', label: 'Anytime' },
]

export interface TodayItem {
  habit: Habit
  area: Area
  rule: HabitRule
  result: DayResult
  neverMissTwice: boolean
  /** 0–100 */
  strength: number
  canSkip: boolean
  skipsLeft: number
  skipReason?: SkipReason
  /** N-per-week habits: completions so far this week. */
  week?: { done: number; times: number }
}

export interface TodayModel {
  /** "Never miss twice" items, pinned above everything for the whole day. */
  pinned: TodayItem[]
  groups: Array<{ block: TimeBlock; label: string; items: TodayItem[] }>
  /** Items past the cap, shown behind "+N more". */
  overflow: TodayItem[]
  /** Habits completed by a number (steps, protein, sleep): shown in the numbers row, not as items. */
  numbers: TodayItem[]
  /** Habits scheduled today (excluding numbers), and how many are resolved. */
  total: number
  resolved: number
}

const BLOCK_ORDER = new Map(TIME_BLOCKS.map((b, i) => [b.id, i]))

function isResolved(item: TodayItem): boolean {
  const o = item.result.outcome
  return o === 'done' || o === 'min' || o === 'skip'
}

function weekCompletions(habit: Habit, ctx: HabitContext): number {
  const from = startOfWeek(ctx.today, ctx.weekStartsOn)
  let n = 0
  for (let d = from; d <= ctx.today; d = addDays(d, 1)) {
    const o = dayResult(habit, d, ctx).outcome
    if (o === 'done' || o === 'min') n++
  }
  return n
}

/** Whether a habit belongs on Today: due today, or an N-per-week habit with slots left (or done today). */
function showsToday(rule: HabitRule, result: DayResult, weekDone: number): boolean {
  const o = result.outcome
  if (rule.schedule.kind === 'perWeek') return weekDone < rule.schedule.times || o === 'done' || o === 'min' || o === 'skip'
  return o !== 'not_due' && o !== 'inactive' && o !== 'upcoming'
}

export function buildToday(input: {
  habits: readonly Habit[]
  areas: readonly Area[]
  ctx: HabitContext
  maxSkipsPerWeek: number
  cap: number
}): TodayModel {
  const { ctx } = input
  const areaById = new Map(input.areas.map((a) => [a.id, a]))
  const areaOrder = new Map(input.areas.map((a) => [a.id, a.order]))

  const items: TodayItem[] = []
  const numbers: TodayItem[] = []

  for (const habit of input.habits) {
    if (!isActiveOn(habit, ctx.today)) continue
    const area = areaById.get(habit.areaId)
    if (!area || area.archivedAt) continue
    const rule = ruleOn(habit, ctx.today)
    const result = dayResult(habit, ctx.today, ctx)
    const weekDone = rule.schedule.kind === 'perWeek' ? weekCompletions(habit, ctx) : 0
    const item: TodayItem = {
      habit,
      area,
      rule,
      result,
      neverMissTwice: needsNeverMissTwice(habit, ctx),
      strength: strengthScore(habit, ctx),
      canSkip: canSkip(habit, ctx.today, ctx, input.maxSkipsPerWeek),
      skipsLeft: Math.max(0, input.maxSkipsPerWeek - skipsInWeek(habit, ctx.today, ctx)),
      skipReason: ctx.log(habit.id, ctx.today)?.skipReason,
      week: rule.schedule.kind === 'perWeek' ? { done: weekDone, times: rule.schedule.times } : undefined,
    }
    if (rule.completion.kind === 'metric') {
      numbers.push(item)
      continue
    }
    if (showsToday(rule, result, weekDone)) items.push(item)
  }

  const byPlace = (a: TodayItem, b: TodayItem) =>
    (BLOCK_ORDER.get(a.habit.timeBlock) ?? 9) - (BLOCK_ORDER.get(b.habit.timeBlock) ?? 9) ||
    (areaOrder.get(a.habit.areaId) ?? 0) - (areaOrder.get(b.habit.areaId) ?? 0) ||
    a.habit.order - b.habit.order
  items.sort(byPlace)
  numbers.sort(byPlace)

  // Pinned items stay pinned all day, even once done, so nothing jumps
  // under the user's thumb while they tap through the list.
  const pinned = items.filter((i) => i.neverMissTwice)
  const rest = items.filter((i) => !pinned.includes(i))

  const room = Math.max(0, input.cap - pinned.length)
  const shown = rest.slice(0, room)
  const overflow = rest.slice(room)

  const groups = TIME_BLOCKS.map((b) => ({ block: b.id, label: b.label, items: shown.filter((i) => i.habit.timeBlock === b.id) })).filter(
    (g) => g.items.length > 0,
  )

  return {
    pinned,
    groups,
    overflow,
    numbers,
    total: items.length,
    resolved: items.filter(isResolved).length,
  }
}

/** Habits that start on a given day: for the "your first week" preview before the plan starts. */
export function habitsStartingOn(habits: readonly Habit[], day: DayKey): Habit[] {
  return habits.filter((h) => h.activeFrom === day)
}

/** Whether a fixed-schedule habit is due on a day (used by the preview). */
export function isDueOn(habit: Habit, day: DayKey): boolean {
  const rule = ruleOn(habit, day)
  return rule.schedule.kind === 'perWeek' || isScheduledOn(rule.schedule, day)
}
