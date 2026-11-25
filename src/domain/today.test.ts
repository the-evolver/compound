import { describe, expect, it } from 'vitest'
import type { HabitLog, HabitStatus } from '../model/habits'
import { zArea, zHabit } from '../model'
import { buildSeed } from '../../tests/fixtures/samplePlan'
import { buildHabitContext } from './habits/context'
import { buildToday } from './today'
import type { DayKey } from './time/day'

const seed = buildSeed({
  startDay: '2026-12-01',
  weightKg: 80,
  weekdayHours: 2.75,
  weekendHours: 5.5,
  workoutDays: [1, 3, 5],
  workoutTime: '07:00',
  today: '2026-12-01',
  now: 0,
})
const habits = seed.habits.map((h) => zHabit.parse(h))
const areas = seed.areas.map((a) => zArea.parse(a))

function today(day: DayKey, logs: Array<[string, DayKey, HabitStatus]> = [], cap = 7) {
  const habitLogs: HabitLog[] = logs.map(([habitId, d, status]) => ({ id: `${habitId}|${d}`, habitId, day: d, status, at: 0 }))
  const ctx = buildHabitContext({ today: day, weekStartsOn: 1, habitLogs, dayEntries: [], logCounts: {} })
  return buildToday({ habits, areas, ctx, maxSkipsPerWeek: 2, cap })
}

/** Every habit marked done on a day, so nothing is pinned the day after. */
const allDone = (day: DayKey): Array<[string, DayKey, HabitStatus]> => habits.map((h) => [h.id, day, 'done'])

const ids = (m: ReturnType<typeof today>) => [...m.pinned, ...m.groups.flatMap((g) => g.items), ...m.overflow].map((i) => i.habit.id)

describe('Today', () => {
  it('shows only week-1 habits on day 1, with steps in the numbers row', () => {
    const m = today('2026-12-01') // Tuesday: no workout
    expect(ids(m).sort()).toEqual(
      ['habit:dsa-daily', 'habit:study-block', 'habit:sunscreen-am', 'habit:sunscreen-reapply', 'habit:speaking-drill'].sort(),
    )
    expect(m.numbers.map((i) => i.habit.id)).toEqual(['habit:steps'])
    expect(m.total).toBe(5)
  })

  it('adds the workout on workout days, grouped by time block in order', () => {
    const m = today('2026-12-02', allDone('2026-12-01')) // Wednesday
    expect(m.pinned).toEqual([])
    expect(m.groups.map((g) => g.block)).toEqual(['morning', 'daytime', 'evening'])
    expect(m.groups[0]!.items.map((i) => i.habit.id)).toEqual(['habit:workout', 'habit:sunscreen-am'])
  })

  it('pins "never miss twice" items to the top', () => {
    const m = today('2026-12-02', [['habit:dsa-daily', '2026-12-01', 'done']])
    expect(m.pinned.map((i) => i.habit.id).sort()).toEqual(
      ['habit:study-block', 'habit:sunscreen-am', 'habit:sunscreen-reapply', 'habit:speaking-drill'].sort(),
    )
  })

  it('keeps every item in place once it is done, so the list never jumps', () => {
    const before = today('2026-12-02', [['habit:dsa-daily', '2026-12-01', 'done']])
    const after = today('2026-12-02', [
      ['habit:dsa-daily', '2026-12-01', 'done'],
      ['habit:study-block', '2026-12-02', 'done'],
      ['habit:dsa-daily', '2026-12-02', 'min'],
    ])
    expect(ids(after)).toEqual(ids(before))
  })

  it('caps the list and folds the rest behind "+N more"', () => {
    const m = today('2026-12-16', allDone('2026-12-15'), 7) // week 3, Wednesday: more habits are active
    expect(m.total).toBeGreaterThan(7)
    expect(m.pinned.length + m.groups.flatMap((g) => g.items).length).toBe(7)
    expect(m.overflow.length).toBe(m.total - 7)
  })

  it('never hides a pinned item behind the cap', () => {
    const m = today('2026-12-16', [], 3) // everything was missed yesterday
    expect(m.pinned.length).toBe(m.total)
    expect(m.overflow).toEqual([])
  })

  it('counts resolved items', () => {
    const m = today('2026-12-01', [
      ['habit:dsa-daily', '2026-12-01', 'done'],
      ['habit:sunscreen-am', '2026-12-01', 'min'],
      ['habit:sunscreen-reapply', '2026-12-01', 'skip'],
    ])
    expect(m.resolved).toBe(3)
  })
})
