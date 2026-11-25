import { describe, expect, it } from 'vitest'
import { zExercise, type Exercise, type WorkoutSession } from '../model/body'
import type { SkinProduct } from '../model/skinVoice'
import { fillersPer2Min, newProductCheck, skinPhotoSchedule, suggestPrompts } from './skinVoice'
import { lastSetsFor, nextTemplate, prefillSets, progression, prsInSession, sessionsInWeek } from './workouts'

const squat: Exercise = zExercise.parse({ id: 'ex:squat', name: 'Back squat', repMin: 8, repMax: 12 })
const pushup: Exercise = zExercise.parse({ id: 'ex:pushup', name: 'Push-ups', repMin: 8, repMax: 25, bodyweight: true })

function session(id: string, day: string, sets: Array<[number, number]>, extra: Partial<WorkoutSession> = {}): WorkoutSession {
  return { id, day, location: 'gym', entries: [{ exerciseId: 'ex:squat', sets: sets.map(([reps, kg]) => ({ reps, kg })) }], note: '', at: Date.parse(day), ...extra }
}

describe('workouts (acceptance test 5)', () => {
  it('pre-fills the next session from the last one', () => {
    const sessions = [session('a', '2026-12-02', [[10, 40], [9, 40], [8, 40]]), session('b', '2026-12-04', [[11, 40], [10, 40], [9, 40]])]
    const last = lastSetsFor('ex:squat', sessions)
    expect(prefillSets(squat, 3, last)).toEqual([
      { reps: 11, kg: 40 },
      { reps: 10, kg: 40 },
      { reps: 9, kg: 40 },
    ])
    expect(prefillSets(squat, 2, undefined)).toEqual([
      { reps: 8, kg: 0 },
      { reps: 8, kg: 0 },
    ])
  })

  it('suggests +2.5 kg once every set hits the top of the rep range', () => {
    expect(progression(squat, [{ reps: 12, kg: 40 }, { reps: 12, kg: 40 }, { reps: 12, kg: 40 }])).toMatchObject({ kind: 'add-weight', kg: 42.5 })
    expect(progression(squat, [{ reps: 12, kg: 40 }, { reps: 11, kg: 40 }])).toMatchObject({ kind: 'add-reps' })
    expect(progression(pushup, [{ reps: 25, kg: 0 }])).toMatchObject({ kind: 'harder' })
    expect(progression(squat, undefined)).toBeUndefined()
  })

  it('detects PRs automatically, but not on the first session', () => {
    const exercises = new Map([[squat.id, squat]])
    const first = session('a', '2026-12-02', [[10, 40]])
    const better = session('b', '2026-12-04', [[12, 40]])
    const worse = session('c', '2026-12-07', [[8, 40]])
    expect(prsInSession(first, [first], exercises)).toEqual([])
    expect(prsInSession(better, [first, better], exercises).map((p) => p.set)).toEqual([{ reps: 12, kg: 40 }])
    expect(prsInSession(worse, [first, better, worse], exercises)).toEqual([])
  })

  it('counts sessions per week, home sessions as half', () => {
    const s = [session('a', '2026-12-07', []), session('b', '2026-12-09', [], { location: 'home' }), session('c', '2026-12-14', [])]
    expect(sessionsInWeek(s, '2026-12-10', 1)).toBe(1.5)
  })

  it('alternates gym templates A/B and skips the home session', () => {
    const templates = [
      { id: 'A', name: 'Full Body A', order: 0, items: [{ exerciseId: 'x', sets: 1 }], archived: false },
      { id: 'B', name: 'Full Body B', order: 1, items: [{ exerciseId: 'x', sets: 1 }], archived: false },
      { id: 'H', name: 'Home session (20 min)', order: 2, items: [{ exerciseId: 'x', sets: 1 }], archived: false },
    ]
    expect(nextTemplate(templates, [])?.id).toBe('A')
    expect(nextTemplate(templates, [session('1', '2026-12-02', [], { templateId: 'A' })])?.id).toBe('B')
    expect(nextTemplate(templates, [session('1', '2026-12-02', [], { templateId: 'A' }), session('2', '2026-12-04', [], { templateId: 'B' })])?.id).toBe('A')
  })
})

describe('skin', () => {
  const product = (id: string, startDay: string, baseline = false): SkinProduct => ({
    id,
    name: id,
    role: 'active',
    startDay,
    patchTest: 'passed',
    baseline,
    notes: '',
    createdAt: 0,
  })

  it('allows one new product at a time, at least 4 weeks apart; the starting routine is exempt', () => {
    const products = [product('sunscreen', '2026-12-01', true), product('niacinamide', '2027-01-05')]
    expect(newProductCheck(products, { startDay: '2027-01-20', baseline: false })).toMatchObject({ ok: false, earliest: '2027-02-02' })
    expect(newProductCheck(products, { startDay: '2027-02-02', baseline: false })).toEqual({ ok: true })
    expect(newProductCheck(products, { startDay: '2026-12-02', baseline: true })).toEqual({ ok: true })
    expect(newProductCheck(products, { id: 'niacinamide', startDay: '2027-01-06', baseline: false })).toEqual({ ok: true })
  })

  it('schedules photos at weeks 0, 4, 8, 12, then monthly', () => {
    const s = skinPhotoSchedule('2026-12-01', '2027-08-31')
    expect(s.slice(0, 6).map((x) => `${x.label} ${x.day}`)).toEqual([
      'Week 0 2026-12-01',
      'Week 4 2026-12-29',
      'Week 8 2027-01-26',
      'Week 12 2027-02-23',
      'Month 4 2027-03-23',
      'Month 5 2027-04-23',
    ])
    expect(s.at(-1)?.day).toBe('2027-08-23')
  })
})

describe('voice', () => {
  it('normalises fillers to a 2-minute rate', () => {
    expect(fillersPer2Min({ fillers: 6, seconds: 180 })).toBe(4)
    expect(fillersPer2Min({ fillers: 3, seconds: 60 })).toBe(6)
  })

  it("suggests today's study topic first, then the intro and a behavioural question", () => {
    const p = suggestPrompts('2026-12-02', 'Strategy')
    expect(p.map((x) => x.source)).toEqual(['topic', 'intro', 'behavioural'])
    expect(p[0]!.text).toBe('Explain Strategy simply, as if to a 12-year-old.')
    expect(suggestPrompts('2026-12-03', undefined)[1]!.text).not.toBe(suggestPrompts('2026-12-04', undefined)[1]!.text)
  })
})
