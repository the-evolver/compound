import { describe, expect, it } from 'vitest'
import { zHabit } from '../model'
import { buildHabitContext } from './habits/context'
import { averagePerWeek, complianceByWeek, dailyScores, heatmapRange, perWeek, planWeeks } from './insights'

const habit = zHabit.parse({
  id: 'h',
  areaId: 'a',
  name: 'Habit',
  ifThen: 'x',
  minVersion: 'y',
  timeBlock: 'morning',
  order: 0,
  activeFrom: '2026-12-01',
  rules: [{ from: '2026-12-01', schedule: { kind: 'daily' }, completion: { kind: 'manual' } }],
  createdAt: 0,
})

const ctx = buildHabitContext({
  today: '2026-12-09',
  weekStartsOn: 1,
  habitLogs: [
    { id: '1', habitId: 'h', day: '2026-12-01', status: 'done', at: 0 },
    { id: '2', habitId: 'h', day: '2026-12-02', status: 'min', at: 0 },
    { id: '3', habitId: 'h', day: '2026-12-03', status: 'skip', at: 0 },
  ],
  dayEntries: [],
  logCounts: {},
})

describe('insights', () => {
  it('lists plan weeks up to this week', () => {
    expect(planWeeks('2026-12-01', '2026-12-16', 1)).toEqual(['2026-11-30', '2026-12-07', '2026-12-14'])
    expect(planWeeks('2026-12-01', '2027-08-31', 1, 2)).toEqual(['2027-08-23', '2027-08-30'])
  })

  it('scores compliance per week', () => {
    const weeks = complianceByWeek([habit], ctx, ['2026-11-30', '2026-12-07'], 1)
    // week 1 (from Tue): done 1 + min ½ + 3 misses (Fri–Sun) over 5 due days (skip left out)
    expect(weeks[0]!.ratio).toBeCloseTo(1.5 / 5, 5)
    // week 2: Mon, Tue missed; Wed is today and still open
    expect(weeks[1]!.ratio).toBe(0)
  })

  it('scores each day for the heatmap', () => {
    const cells = dailyScores([habit], ctx, '2026-11-30', '2026-12-10')
    const byDay = Object.fromEntries(cells.map((c) => [c.day, c.score]))
    expect(byDay['2026-11-30']).toBeNull() // before the habit started
    expect(byDay['2026-12-01']).toBe(1)
    expect(byDay['2026-12-02']).toBe(0.5)
    expect(byDay['2026-12-03']).toBeNull() // skipped
    expect(byDay['2026-12-04']).toBe(0)
    expect(byDay['2026-12-09']).toBeNull() // today, still open
    expect(cells.find((c) => c.day === '2026-12-10')?.future).toBe(true)
  })

  it('covers whole weeks for the heatmap, not before the plan', () => {
    expect(heatmapRange('2026-12-01', '2026-12-09', 1)).toEqual({ from: '2026-11-30', to: '2026-12-13' })
  })

  it('counts and averages per week', () => {
    const items = [{ day: '2026-12-01', v: 2 }, { day: '2026-12-02', v: 4 }, { day: '2026-12-08', v: 6 }]
    expect(perWeek(items, ['2026-11-30', '2026-12-07'], 1)).toEqual([
      { weekStart: '2026-11-30', value: 2 },
      { weekStart: '2026-12-07', value: 1 },
    ])
    expect(averagePerWeek(items, ['2026-11-30', '2026-12-07', '2026-12-14'], 1, (i) => i.v).map((x) => x.value)).toEqual([3, 6, null])
  })
})
