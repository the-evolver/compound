import { clock } from '../../domain/time/clock'
import type { DayKey } from '../../domain/time/day'
import { habitLogId, type HabitStatus, type SkipReason } from '../../model/habits'
import { db } from '../db'
import { putRow } from '../repo'

export async function setHabitStatus(habitId: string, day: DayKey, status: HabitStatus, skipReason?: SkipReason): Promise<void> {
  await putRow('habitLogs', {
    id: habitLogId(habitId, day),
    habitId,
    day,
    status,
    skipReason: status === 'skip' ? (skipReason ?? 'other') : undefined,
    at: clock.now(),
  })
}

/** Removes a tap, so the day goes back to what the evidence (or the schedule) says. */
export async function clearHabitStatus(habitId: string, day: DayKey): Promise<void> {
  await db.habitLogs.delete(habitLogId(habitId, day))
}

/** Sets or clears one of the day's numbers (steps, protein, sleep, weight). */
export async function setMetric(day: DayKey, key: string, value: number | undefined): Promise<void> {
  await db.transaction('rw', db.dayEntries, async () => {
    const current = await db.dayEntries.get(day)
    const metrics = { ...(current?.metrics ?? {}) }
    if (value === undefined) delete metrics[key]
    else metrics[key] = value
    await putRow('dayEntries', { day, metrics, note: current?.note ?? '', updatedAt: clock.now() })
  })
}

export async function setDayNote(day: DayKey, note: string): Promise<void> {
  await db.transaction('rw', db.dayEntries, async () => {
    const current = await db.dayEntries.get(day)
    await putRow('dayEntries', { day, metrics: current?.metrics ?? {}, note: note.trim(), updatedAt: clock.now() })
  })
}

/** The most recent value of a metric before a day, used to pre-fill steppers. */
export async function lastMetricBefore(day: DayKey, key: string): Promise<number | undefined> {
  const entries = await db.dayEntries.where('day').below(day).reverse().toArray()
  for (const e of entries) {
    const v = e.metrics[key]
    if (v !== undefined) return v
  }
  return undefined
}
