import { describe, expect, it } from 'vitest'
import { zHabit, type Habit } from '../model'
import { buildSeed } from '../../tests/fixtures/samplePlan'
import { describeCompletion, describeSchedule } from './habits/describe'
import { acceptProposed, changeRule, dismissProposed, earliestQueueDate, queueConflicts } from './habits/edit'
import { ruleOn } from './habits/rules'
import { nextTopic, parseTopicLines } from './study'

const seed = buildSeed({
  startDay: '2026-12-01',
  weightKg: 80,
  weekdayHours: 2.75,
  weekendHours: 5.5,
  workoutDays: [1, 3, 5],
  workoutTime: '07:00',
  today: '2026-11-25',
  now: 0,
})
const habits = seed.habits.map((h) => zHabit.parse(h))
const byId = (id: string) => habits.find((h) => h.id === id)!

describe('paste-to-import', () => {
  it('strips bullets, numbering and checkboxes, and reads group headings', () => {
    const text = `
## Patterns
- Strategy
* Observer
1. Factory
2) Builder
[ ] Singleton
Machine coding:
• Parking Lot

a) LRU Cache`
    expect(parseTopicLines(text)).toEqual([
      { title: 'Strategy', group: 'Patterns' },
      { title: 'Observer', group: 'Patterns' },
      { title: 'Factory', group: 'Patterns' },
      { title: 'Builder', group: 'Patterns' },
      { title: 'Singleton', group: 'Patterns' },
      { title: 'Parking Lot', group: 'Machine coding' },
      { title: 'LRU Cache', group: 'Machine coding' },
    ])
  })

  it('keeps titles that merely contain numbers', () => {
    expect(parseTopicLines('Java 21 virtual threads\n2PC vs Saga').map((t) => t.title)).toEqual(['Java 21 virtual threads', '2PC vs Saga'])
  })
})

describe('next topic', () => {
  it('continues the topic being learned, else the first not started', () => {
    const topics = [
      { order: 0, status: 'can_explain' as const, title: 'SOLID' },
      { order: 1, status: 'not_started' as const, title: 'Strategy' },
      { order: 2, status: 'learning' as const, title: 'Observer' },
    ]
    expect(nextTopic(topics)?.title).toBe('Observer')
    expect(nextTopic(topics.map((t) => (t.status === 'learning' ? { ...t, status: 'can_explain' as const } : t)))?.title).toBe('Strategy')
    expect(nextTopic([{ order: 0, status: 'under_pressure' as const }])).toBeUndefined()
  })
})

describe('editing habit rules', () => {
  const workout = byId('habit:workout')

  it('keeps past days on the old rule when a change starts mid-plan', () => {
    const rules = changeRule(
      workout,
      { schedule: { kind: 'days', days: [2, 4, 6] }, completion: workout.rules[0]!.completion, targetText: 'Tue/Thu/Sat', note: '' },
      '2027-01-10',
    )
    const edited: Habit = { ...workout, rules }
    expect(ruleOn(edited, '2027-01-09').schedule).toEqual({ kind: 'days', days: [1, 3, 5] })
    expect(ruleOn(edited, '2027-01-10').schedule).toEqual({ kind: 'days', days: [2, 4, 6] })
    // the planned Phase 2 change is still there, still proposed
    expect(rules.filter((r) => r.proposed)).toHaveLength(1)
  })

  it('replaces the rule outright before the habit has started', () => {
    const sleep = byId('habit:sleep')
    const rules = changeRule(sleep, { ...sleep.rules[0]!, targetText: '7.5 h' }, '2026-12-01')
    expect(rules).toHaveLength(1)
    expect(rules[0]).toMatchObject({ from: '2026-12-29', targetText: '7.5 h' })
  })

  it('does nothing when nothing changed', () => {
    expect(changeRule(workout, workout.rules[0]!, '2027-01-10')).toBe(workout.rules)
  })

  it('moves the first rule with the start date of a habit that has not started', () => {
    const protein = { ...byId('habit:protein'), activeFrom: '2027-01-12' }
    expect(changeRule(protein, protein.rules[0]!, '2027-01-12')[0]?.from).toBe('2027-01-12')
  })

  it('accepts or dismisses a planned change', () => {
    const index = workout.rules.findIndex((r) => r.proposed)
    const accepted: Habit = { ...workout, rules: acceptProposed(workout, index, '2027-03-08') }
    expect(accepted.rules.every((r) => !r.proposed)).toBe(true)
    expect(ruleOn(accepted, '2027-03-07').schedule).toEqual({ kind: 'days', days: [1, 3, 5] })
    expect(ruleOn(accepted, '2027-03-08').schedule).toEqual({ kind: 'days', days: [1, 3, 5, 6] })
    expect(dismissProposed(workout, index)).toHaveLength(1)
  })
})

describe('habit queue', () => {
  it('allows one new habit per area every two weeks, ignoring the week-1 set', () => {
    expect(queueConflicts(habits, { areaId: 'body', activeFrom: '2026-12-01' }, '2026-12-01')).toEqual([])
    // protein starts 15 Dec, sleep 29 Dec: 20 Dec is within two weeks of both
    expect(queueConflicts(habits, { areaId: 'body', activeFrom: '2026-12-20' }, '2026-12-01').map((h) => h.id)).toEqual([
      'habit:protein',
      'habit:sleep',
    ])
    expect(earliestQueueDate(habits, { areaId: 'body' }, '2026-12-20', '2026-12-01')).toBe('2027-01-12')
  })

  it('does not count the habit against itself', () => {
    expect(queueConflicts(habits, { id: 'habit:protein', areaId: 'body', activeFrom: '2026-12-15' }, '2026-12-01')).toEqual([])
    // …but moving it one day later brings it within two weeks of sleep
    expect(queueConflicts(habits, { id: 'habit:protein', areaId: 'body', activeFrom: '2026-12-16' }, '2026-12-01').map((h) => h.id)).toEqual([
      'habit:sleep',
    ])
  })
})

describe('descriptions', () => {
  it('describes schedules and completions in plain words', () => {
    expect(describeSchedule({ kind: 'days', days: [5, 1, 3] })).toBe('Mon/Wed/Fri')
    expect(describeSchedule({ kind: 'perWeek', times: 2 })).toBe('2× a week')
    expect(describeCompletion(byId('habit:steps').rules[0]!.completion)).toBe('Steps reaches 7,000')
    expect(describeCompletion(byId('habit:dsa-daily').rules[0]!.completion)).toMatch(/2 items on weekdays, 4 items on weekends/)
  })
})
