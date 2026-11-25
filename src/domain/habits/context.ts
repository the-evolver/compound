import type { DayEntry, HabitLog } from '../../model/habits'
import { referenceWeight, type DatedValue } from '../body/weight'
import type { DayKey, Weekday } from '../time/day'

/** Where evidence for "metric" and "log" completions comes from. */
export interface Evidence {
  metric(key: string, day: DayKey): number | undefined
  logCount(source: string, day: DayKey): number
  bodyweightKg(day: DayKey): number | undefined
}

/** Everything the habit engine needs to judge a day. */
export interface HabitContext {
  today: DayKey
  weekStartsOn: Weekday
  log(habitId: string, day: DayKey): HabitLog | undefined
  evidence: Evidence
}

export type LogCounts = Record<string, ReadonlyMap<DayKey, number>>

export function buildEvidence(dayEntries: readonly DayEntry[], logCounts: LogCounts): Evidence {
  const byDay = new Map(dayEntries.map((e) => [e.day, e]))
  const weights: DatedValue[] = []
  for (const e of dayEntries) {
    const w = e.metrics.weightKg
    if (w !== undefined) weights.push({ day: e.day, value: w })
  }
  return {
    metric: (key, day) => byDay.get(day)?.metrics[key],
    logCount: (source, day) => logCounts[source]?.get(day) ?? 0,
    bodyweightKg: (day) => referenceWeight(weights, day),
  }
}

export function buildHabitContext(input: {
  today: DayKey
  weekStartsOn: Weekday
  habitLogs: readonly HabitLog[]
  dayEntries: readonly DayEntry[]
  logCounts: LogCounts
}): HabitContext {
  const logs = new Map(input.habitLogs.map((l) => [`${l.habitId}|${l.day}`, l]))
  return {
    today: input.today,
    weekStartsOn: input.weekStartsOn,
    log: (habitId, day) => logs.get(`${habitId}|${day}`),
    evidence: buildEvidence(input.dayEntries, input.logCounts),
  }
}
