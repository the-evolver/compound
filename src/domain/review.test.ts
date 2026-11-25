import { describe, expect, it } from 'vitest'
import { zArea, zHabit } from '../model'
import { buildSeed } from '../../tests/fixtures/samplePlan'
import { buildHabitContext } from './habits/context'
import { dueMonthlyReview, dueWeeklyReview, reviewMonth, reviewWeekStart, weeklyScoreboard, weeklyShareText } from './review'

describe('which review is due', () => {
  it('reviews this week on Sunday, and last week until it is done', () => {
    expect(reviewWeekStart('2026-12-06', 1)).toBe('2026-11-30') // Sunday
    expect(reviewWeekStart('2026-12-07', 1)).toBe('2026-11-30') // Monday: still last week
    expect(reviewWeekStart('2026-12-05', 1)).toBe('2026-11-23') // Saturday: the week before
  })

  it('is due from the first Sunday of the plan, until finished', () => {
    expect(dueWeeklyReview('2026-11-29', '2026-12-01', 1, new Set())).toBeNull()
    expect(dueWeeklyReview('2026-12-06', '2026-12-01', 1, new Set())).toBe('2026-11-30')
    expect(dueWeeklyReview('2026-12-06', '2026-12-01', 1, new Set(['2026-11-30']))).toBeNull()
  })

  it('reviews the previous month from the 1st', () => {
    expect(reviewMonth('2027-01-01')).toBe('2026-12')
    expect(reviewMonth('2027-01-20')).toBe('2026-12')
    expect(dueMonthlyReview('2026-12-05', '2026-12-01', new Set())).toBeNull()
    expect(dueMonthlyReview('2027-01-01', '2026-12-01', new Set())).toBe('2026-12')
    expect(dueMonthlyReview('2027-01-01', '2026-12-01', new Set(['2026-12']))).toBeNull()
  })
})

describe('weekly scoreboard', () => {
  const seed = buildSeed({
    startDay: '2026-12-01',
    weightKg: 80,
    weekdayHours: 2.75,
    weekendHours: 5.5,
    workoutDays: [1, 3, 5],
    workoutTime: '07:00',
    today: '2026-11-30',
    now: 0,
  })
  const habits = seed.habits.map((h) => zHabit.parse(h))
  const areas = seed.areas.map((a) => zArea.parse(a))

  it('scores each area, counts DSA and topics, and writes a share text', () => {
    const habitLogs = ['2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05', '2026-12-06'].map((day) => ({
      id: `habit:sunscreen-am|${day}`,
      habitId: 'habit:sunscreen-am',
      day,
      status: 'done' as const,
      at: 0,
    }))
    const ctx = buildHabitContext({ today: '2026-12-06', weekStartsOn: 1, habitLogs, dayEntries: [], logCounts: {} })
    const board = weeklyScoreboard({
      weekStart: '2026-11-30',
      weekStartsOn: 1,
      areas,
      habits,
      ctx,
      problems: [],
      reviews: [],
      topicEvents: [
        { id: 'e1', topicId: 't', subjectId: 's', day: '2026-12-02', from: 'not_started', to: 'learning', at: 0 },
        { id: 'e2', topicId: 't', subjectId: 's', day: '2026-12-03', from: 'learning', to: 'not_started', at: 0 },
      ],
      dayEntries: [
        { day: '2026-11-30', metrics: { weightKg: 80 }, note: '', updatedAt: 0 },
        { day: '2026-12-06', metrics: { weightKg: 79 }, note: '', updatedAt: 0 },
      ],
      mocks: [],
      applications: [],
    })
    const skin = board.areas.find((a) => a.areaId === 'skin')!
    // AM sunscreen: 6 of 6 (Sunday counts because it's done). Reapply: missed Tue–Sat (5);
    // Sunday is still open when reviewing on Sunday, so it isn't counted yet. 6 of 11.
    expect(skin.compliance).toBeCloseTo(6 / 11, 5)
    expect(skin.status).toBe('slipping')
    expect(board.topicsMoved).toBe(1)
    expect(board.lag.weightAvg).toBeCloseTo(79.5, 5)

    const text = weeklyShareText(
      { wins: ['Sunscreen every day'], misses: [{ text: 'Skipped DSA twice', cause: 'energy' }], change: 'After dinner, I open the review queue before my phone.', commitments: [{ areaId: 'career', text: '10 DSA items' }] },
      board,
      areas,
    )
    expect(text).toContain('Compound weekly review · 30 Nov – 6 Dec')
    expect(text).toContain('Skin: 55% (slipping)')
    expect(text).toContain('• Skipped DSA twice (energy)')
    expect(text).toContain('• Career: 10 DSA items')
  })
})
