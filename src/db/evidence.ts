import type { LogCounts } from '../domain/habits/context'
import type { LogSourceKey } from '../domain/metrics'
import type { DayKey } from '../domain/time/day'
import { db } from './db'

function tally(entries: Iterable<[DayKey, number]>): Map<DayKey, number> {
  const out = new Map<DayKey, number>()
  for (const [day, n] of entries) out.set(day, (out.get(day) ?? 0) + n)
  return out
}

/**
 * Per-day counts for every log that can complete a habit. To make a new log
 * complete habits, add its key to LOG_SOURCES (domain/metrics.ts) and a
 * counter here; the type below makes sure none is forgotten.
 */
const COUNTERS: Record<LogSourceKey, () => Promise<Map<DayKey, number>>> = {
  dsa: async () => {
    const [problems, reviews] = await Promise.all([db.dsaProblems.toArray(), db.dsaReviews.toArray()])
    return tally([...problems, ...reviews].map((r) => [r.day, 1]))
  },
  study: async () => tally((await db.studySessions.toArray()).filter((s) => s.outcome === 'done').map((s) => [s.day, 1])),
  // A home session is the workout's minimum version: half a session.
  workout: async () => tally((await db.workoutSessions.toArray()).map((s) => [s.day, s.location === 'home' ? 0.5 : 1])),
  drill: async () => tally((await db.drills.toArray()).map((d) => [d.day, 1])),
  mock: async () => tally((await db.mocks.toArray()).map((m) => [m.day, 1])),
  applicationMoves: async () =>
    tally(
      (await db.applications.toArray()).flatMap((a) =>
        a.history.filter((h) => h.stage !== 'target').map((h): [DayKey, number] => [h.day, 1]),
      ),
    ),
}

export async function loadLogCounts(): Promise<LogCounts> {
  const keys = Object.keys(COUNTERS) as LogSourceKey[]
  const maps = await Promise.all(keys.map((k) => COUNTERS[k]()))
  return Object.fromEntries(keys.map((k, i) => [k, maps[i]!]))
}
