import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import { zHabit, type Habit, type HabitLog, type HabitStatus } from '../../model/habits'
import { addDays, eachDay, type DayKey } from '../time/day'
import { buildHabitContext, type HabitContext, type LogCounts } from './context'
import { groupCompliance, habitCompliance, ratio, recentStatus, trackStatus } from './compliance'
import { canSkip, dayResult, needsNeverMissTwice } from './outcome'
import { isActiveOn, ruleOn } from './rules'
import { nextStrength, STRENGTH_KEEP, strengthScore, strengthSeries } from './strength'

const START = '2026-12-01' // a Tuesday

function makeHabit(over: Partial<z.input<typeof zHabit>> = {}): Habit {
  return zHabit.parse({
    id: 'h',
    areaId: 'a',
    name: 'Habit',
    ifThen: 'After X, at Y, I will Z.',
    minVersion: 'Tiny version',
    timeBlock: 'morning',
    order: 0,
    activeFrom: START,
    rules: [{ from: START, schedule: { kind: 'daily' }, completion: { kind: 'manual' } }],
    createdAt: 0,
    ...over,
  })
}

function makeCtx(
  today: DayKey,
  logs: Array<[string, DayKey, HabitStatus]> = [],
  metrics: Record<DayKey, Record<string, number>> = {},
  logCounts: LogCounts = {},
): HabitContext {
  const habitLogs: HabitLog[] = logs.map(([habitId, day, status]) => ({
    id: `${habitId}|${day}`,
    habitId,
    day,
    status,
    skipReason: status === 'skip' ? 'rest' : undefined,
    at: 0,
  }))
  const dayEntries = Object.entries(metrics).map(([day, m]) => ({ day, metrics: m, note: '', updatedAt: 0 }))
  return buildHabitContext({ today, weekStartsOn: 1, habitLogs, dayEntries, logCounts })
}

function doneEvery(habitId: string, from: DayKey, to: DayKey): Array<[string, DayKey, HabitStatus]> {
  return eachDay(from, to).map((d) => [habitId, d, 'done'])
}

describe('activation and rules', () => {
  it('is inactive before its activation date and while queued', () => {
    const queued = makeHabit({ activeFrom: '2026-12-15' })
    expect(isActiveOn(queued, '2026-12-14')).toBe(false)
    expect(isActiveOn(queued, '2026-12-15')).toBe(true)
    expect(dayResult(queued, '2026-12-10', makeCtx('2026-12-10')).outcome).toBe('inactive')
  })

  it('judges each day by the rule in effect then, ignoring proposed rules', () => {
    const h = makeHabit({
      rules: [
        { from: START, schedule: { kind: 'days', days: [1, 3, 5] }, completion: { kind: 'manual' } },
        { from: '2027-03-01', schedule: { kind: 'days', days: [1, 3, 5, 6] }, completion: { kind: 'manual' }, proposed: true },
      ],
    })
    expect(ruleOn(h, '2027-03-06').schedule).toEqual({ kind: 'days', days: [1, 3, 5] })
    const accepted = makeHabit({ rules: h.rules.map((r) => ({ ...r, proposed: false })) })
    expect(ruleOn(accepted, '2027-02-27').schedule).toEqual({ kind: 'days', days: [1, 3, 5] })
    expect(ruleOn(accepted, '2027-03-06').schedule).toEqual({ kind: 'days', days: [1, 3, 5, 6] })
  })
})

describe('day outcomes', () => {
  it('is pending today, missed once the day is over, and never stores "missed"', () => {
    const h = makeHabit()
    expect(dayResult(h, '2026-12-02', makeCtx('2026-12-02')).outcome).toBe('pending')
    expect(dayResult(h, '2026-12-02', makeCtx('2026-12-03')).outcome).toBe('missed')
  })

  it('completes from a number: done at target, minimum at the min threshold', () => {
    const h = makeHabit({
      rules: [
        {
          from: START,
          schedule: { kind: 'daily' },
          completion: { kind: 'metric', metric: 'steps', target: { kind: 'fixed', value: 7000 }, min: { kind: 'fixed', value: 4000 } },
        },
      ],
    })
    const ctx = makeCtx('2026-12-04', [], { '2026-12-01': { steps: 7200 }, '2026-12-02': { steps: 4500 }, '2026-12-03': { steps: 2000 } })
    expect(dayResult(h, '2026-12-01', ctx)).toMatchObject({ outcome: 'done', source: 'evidence' })
    expect(dayResult(h, '2026-12-02', ctx).outcome).toBe('min')
    expect(dayResult(h, '2026-12-03', ctx).outcome).toBe('missed')
  })

  it('uses weekday/weekend log targets (DSA: 2 on weekdays, 4 on weekends)', () => {
    const h = makeHabit({
      rules: [
        {
          from: START,
          schedule: { kind: 'daily' },
          completion: { kind: 'log', source: 'dsa', target: { kind: 'weekdayWeekend', weekday: 2, weekend: 4 }, min: { kind: 'fixed', value: 1 } },
        },
      ],
    })
    const dsa = new Map([
      ['2026-12-04', 2], // Friday
      ['2026-12-05', 2], // Saturday: only the minimum
    ])
    const ctx = makeCtx('2026-12-06', [], {}, { dsa })
    expect(dayResult(h, '2026-12-04', ctx).outcome).toBe('done')
    expect(dayResult(h, '2026-12-05', ctx)).toMatchObject({ outcome: 'min', progress: { value: 2, target: 4, min: 1 } })
  })

  it('computes per-kg targets from the 7-day average weight', () => {
    const h = makeHabit({
      rules: [
        {
          from: START,
          schedule: { kind: 'daily' },
          completion: { kind: 'metric', metric: 'proteinG', target: { kind: 'perKgBodyweight', perKg: 1.6 } },
        },
      ],
    })
    const ctx = makeCtx('2026-12-03', [], { '2026-12-01': { weightKg: 79 }, '2026-12-02': { weightKg: 81, proteinG: 120 } })
    expect(dayResult(h, '2026-12-02', ctx).progress).toEqual({ value: 120, target: 128, min: undefined })
  })

  it('lets a tap override the evidence', () => {
    const h = makeHabit({
      rules: [{ from: START, schedule: { kind: 'daily' }, completion: { kind: 'log', source: 'drill', target: { kind: 'fixed', value: 1 } } }],
    })
    const ctx = makeCtx('2026-12-03', [['h', '2026-12-02', 'min']], {}, { drill: new Map([['2026-12-02', 1]]) })
    expect(dayResult(h, '2026-12-02', ctx)).toMatchObject({ outcome: 'min', source: 'tap' })
  })
})

describe('habit strength', () => {
  it('rises toward 100 with consistent days (~97 after 66 days)', () => {
    const h = makeHabit()
    const end = addDays(START, 65)
    const ctx = makeCtx(addDays(end, 1), doneEvery('h', START, end))
    const series = strengthSeries(h, ctx, end)
    expect(series).toHaveLength(66)
    expect(series.at(-1)!.strength).toBeCloseTo(1 - STRENGTH_KEEP ** 66, 10)
    expect(Math.round(series.at(-1)!.strength * 100)).toBe(97)
  })

  it('dips only slightly for one miss, and a skip changes nothing', () => {
    const h = makeHabit()
    const lastDone = addDays(START, 29)
    const missDay = addDays(START, 30)
    const base = doneEvery('h', START, lastDone)
    const before = strengthSeries(h, makeCtx(missDay, base), lastDone).at(-1)!.strength

    const afterMiss = strengthSeries(h, makeCtx(addDays(missDay, 1), base), missDay).at(-1)!.strength
    expect(afterMiss).toBeCloseTo(before * STRENGTH_KEEP, 10)
    expect(before - afterMiss).toBeLessThan(0.05)

    const afterSkip = strengthSeries(h, makeCtx(addDays(missDay, 1), [...base, ['h', missDay, 'skip']]), missDay).at(-1)!.strength
    expect(afterSkip).toBeCloseTo(before, 10)
  })

  it('gives the minimum version half credit', () => {
    const h = makeHabit()
    const ctx = makeCtx('2026-12-02', [['h', START, 'min']])
    expect(strengthSeries(h, ctx, START)[0]!.strength).toBeCloseTo(nextStrength(0, 0.5), 10)
  })

  it('does not count today until it is logged', () => {
    const h = makeHabit()
    expect(strengthScore(h, makeCtx(START))).toBe(0)
    expect(strengthScore(h, makeCtx(START, [['h', START, 'done']]))).toBe(5)
  })

  it('counts unfilled N-per-week slots as misses only once the week ends', () => {
    const h = makeHabit({
      activeFrom: '2026-12-07', // a Monday
      rules: [{ from: '2026-12-07', schedule: { kind: 'perWeek', times: 2 }, completion: { kind: 'manual' } }],
    })
    const logs: Array<[string, DayKey, HabitStatus]> = [['h', '2026-12-08', 'done']]
    // Mid-week: one completion, no penalty yet.
    const mid = strengthSeries(h, makeCtx('2026-12-10', logs)).at(-1)!.strength
    expect(mid).toBeCloseTo(nextStrength(0, 1), 10)
    // After the week: the missing second slot counts as a miss.
    const after = strengthSeries(h, makeCtx('2026-12-14', logs), '2026-12-13').at(-1)!.strength
    expect(after).toBeCloseTo(nextStrength(nextStrength(0, 1), 0), 10)
  })
})

describe('never miss twice', () => {
  it('flags a daily habit missed yesterday, and not one done yesterday', () => {
    const h = makeHabit()
    expect(needsNeverMissTwice(h, makeCtx('2026-12-03', [['h', '2026-12-01', 'done']]))).toBe(true)
    expect(needsNeverMissTwice(h, makeCtx('2026-12-03', [['h', '2026-12-02', 'done']]))).toBe(false)
  })

  it('does not flag after a skip', () => {
    const h = makeHabit()
    expect(needsNeverMissTwice(h, makeCtx('2026-12-03', [['h', '2026-12-02', 'skip']]))).toBe(false)
  })

  it('looks back to the previous scheduled day for fixed-day habits', () => {
    const h = makeHabit({ rules: [{ from: START, schedule: { kind: 'days', days: [1, 3, 5] }, completion: { kind: 'manual' } }] })
    // Mon 7 Dec missed → flagged on Wed 9 Dec (Tue is not a workout day)
    expect(needsNeverMissTwice(h, makeCtx('2026-12-09'))).toBe(true)
    expect(needsNeverMissTwice(h, makeCtx('2026-12-08'))).toBe(false)
    // Trained Tuesday instead: no flag on Wednesday
    expect(needsNeverMissTwice(h, makeCtx('2026-12-09', [['h', '2026-12-08', 'done']]))).toBe(false)
  })

  it('never flags on the first day', () => {
    expect(needsNeverMissTwice(makeHabit(), makeCtx(START))).toBe(false)
  })
})

describe('skips', () => {
  it('allows two skips per habit per week', () => {
    const h = makeHabit()
    const ctx = makeCtx('2026-12-10', [
      ['h', '2026-12-08', 'skip'],
      ['h', '2026-12-09', 'skip'],
    ])
    expect(canSkip(h, '2026-12-10', ctx, 2)).toBe(false)
    expect(canSkip(h, '2026-12-09', ctx, 2)).toBe(true) // keeping an existing skip
    expect(canSkip(h, '2026-12-14', makeCtx('2026-12-14', [['h', '2026-12-08', 'skip'], ['h', '2026-12-09', 'skip']]), 2)).toBe(true)
  })
})

describe('compliance', () => {
  it('scores done 1, minimum ½, missed 0, and leaves skips out', () => {
    const h = makeHabit()
    const ctx = makeCtx('2026-12-05', [
      ['h', '2026-12-01', 'done'],
      ['h', '2026-12-02', 'min'],
      ['h', '2026-12-03', 'skip'],
      // 4 Dec missed; 5 Dec is today and still pending
    ])
    expect(habitCompliance(h, ctx, START, '2026-12-05')).toEqual({ earned: 1.5, expected: 3 })
  })

  it('credits a workout moved to another day of the same week', () => {
    const h = makeHabit({ rules: [{ from: START, schedule: { kind: 'days', days: [1, 3, 5] }, completion: { kind: 'manual' } }] })
    const ctx = makeCtx('2026-12-14', [
      ['h', '2026-12-08', 'done'], // Tue instead of Mon
      ['h', '2026-12-09', 'done'],
      ['h', '2026-12-11', 'done'],
    ])
    expect(habitCompliance(h, ctx, '2026-12-07', '2026-12-13')).toEqual({ earned: 3, expected: 3 })
  })

  it('maps compliance to an honest status', () => {
    expect(trackStatus(0.8)).toBe('on_track')
    expect(trackStatus(0.79)).toBe('slipping')
    expect(trackStatus(0.5)).toBe('slipping')
    expect(trackStatus(0.49)).toBe('off_track')
    expect(trackStatus(null)).toBe('no_data')
  })

  it('reports the last 14 complete days for an area', () => {
    const a = makeHabit({ id: 'a1' })
    const b = makeHabit({ id: 'b1' })
    const today = addDays(START, 14)
    const logs = [...doneEvery('a1', START, addDays(START, 13)), ...doneEvery('b1', START, addDays(START, 6))]
    const ctx = makeCtx(today, logs)
    expect(ratio(groupCompliance([a, b], ctx, START, addDays(START, 13)))).toBeCloseTo(21 / 28, 10)
    expect(recentStatus([a, b], ctx).status).toBe('slipping')
  })
})
