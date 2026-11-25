import { buildHabitContext, type HabitContext } from '../../domain/habits/context'
import type { DayKey, Weekday } from '../../domain/time/day'
import type { Area } from '../../model/core'
import type { DayEntry, Habit, HabitLog } from '../../model/habits'
import { db } from '../db'
import { loadLogCounts } from '../evidence'

export interface HabitData {
  areas: Area[]
  habits: Habit[]
  habitLogs: HabitLog[]
  dayEntries: DayEntry[]
  ctx: HabitContext
}

/** Everything the habit engine needs, loaded in one go (use inside useLiveQuery). */
export async function loadHabitData(today: DayKey, weekStartsOn: Weekday): Promise<HabitData> {
  const [areas, habits, habitLogs, dayEntries, logCounts] = await Promise.all([
    db.areas.orderBy('order').toArray(),
    db.habits.orderBy('order').toArray(),
    db.habitLogs.toArray(),
    db.dayEntries.orderBy('day').toArray(),
    loadLogCounts(),
  ])
  const ctx = buildHabitContext({ today, weekStartsOn, habitLogs, dayEntries, logCounts })
  return { areas, habits, habitLogs, dayEntries, ctx }
}
