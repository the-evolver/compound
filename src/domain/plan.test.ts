import { describe, expect, it } from 'vitest'
import { planPosition, planWeek, spanOn, totalPlanDays } from './plan'

const START = '2026-12-01'
const END = '2027-08-31'

describe('plan position', () => {
  it('counts 274 days from 1 Dec 2026 to 31 Aug 2027, both included', () => {
    expect(totalPlanDays(START, END)).toBe(274)
  })

  it('numbers days inside the plan from 1', () => {
    expect(planPosition(START, START, END)).toEqual({ kind: 'during', dayNumber: 1, totalDays: 274 })
    expect(planPosition('2027-01-06', START, END)).toEqual({ kind: 'during', dayNumber: 37, totalDays: 274 })
    expect(planPosition(END, START, END)).toEqual({ kind: 'during', dayNumber: 274, totalDays: 274 })
  })

  it('reports days before the start and after the end', () => {
    expect(planPosition('2026-11-25', START, END)).toEqual({ kind: 'before', daysUntilStart: 6, totalDays: 274 })
    expect(planPosition('2027-09-02', START, END)).toEqual({ kind: 'after', daysSinceEnd: 2, totalDays: 274 })
  })

  it('numbers plan weeks from the start date', () => {
    expect(planWeek('2026-11-30', START)).toBe(0)
    expect(planWeek(START, START)).toBe(1)
    expect(planWeek('2026-12-07', START)).toBe(1)
    expect(planWeek('2026-12-08', START)).toBe(2)
    expect(planWeek('2026-12-15', START)).toBe(3)
  })

  it('finds the span containing a day', () => {
    const phases = [
      { id: 'p1', start: '2026-12-01', end: '2027-02-28' },
      { id: 'p2', start: '2027-03-01', end: '2027-05-31' },
    ]
    expect(spanOn('2027-02-28', phases)?.id).toBe('p1')
    expect(spanOn('2027-03-01', phases)?.id).toBe('p2')
    expect(spanOn('2027-06-01', phases)).toBeUndefined()
  })
})
