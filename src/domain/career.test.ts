import { describe, expect, it } from 'vitest'
import type { Application, DsaProblem, DsaReview } from '../model/career'
import { applyReview, dueFollowUps, dueReviews, funnel, initialSrs, nextStage, reviewPassRate, weakPatterns } from './career'

const INTERVALS = [1, 3, 7, 14, 30, 60]

describe('spaced reviews (acceptance test 4)', () => {
  it('puts a new problem in the review queue the next day', () => {
    const srs = initialSrs('2026-12-02', INTERVALS)
    expect(srs).toEqual({ step: 0, dueDay: '2026-12-03', graduated: false })
    expect(dueReviews([{ day: '2026-12-02', srs }], '2026-12-02')).toHaveLength(0)
    expect(dueReviews([{ day: '2026-12-02', srs }], '2026-12-03')).toHaveLength(1)
  })

  it('reschedules a failed review for the following day', () => {
    const after = applyReview({ step: 3, dueDay: '2026-12-20', graduated: false }, 'failed', '2026-12-20', INTERVALS)
    expect(after).toEqual({ step: 0, dueDay: '2026-12-21', graduated: false })
  })

  it('walks 1, 3, 7, 14, 30, 60 days on OK, then graduates', () => {
    let srs = initialSrs('2026-12-01', INTERVALS)
    const dues = [srs.dueDay]
    for (let i = 0; i < 5; i++) {
      srs = applyReview(srs, 'ok', srs.dueDay, INTERVALS)
      dues.push(srs.dueDay)
    }
    expect(dues).toEqual(['2026-12-02', '2026-12-05', '2026-12-12', '2026-12-26', '2027-01-25', '2027-03-26'])
    expect(applyReview(srs, 'ok', srs.dueDay, INTERVALS).graduated).toBe(true)
  })

  it('skips a step on Easy', () => {
    expect(applyReview({ step: 0, dueDay: '2026-12-02', graduated: false }, 'easy', '2026-12-02', INTERVALS)).toEqual({
      step: 2,
      dueDay: '2026-12-09',
      graduated: false,
    })
  })

  it('lists overdue reviews first and leaves out graduated ones', () => {
    const ps = [
      { day: 'a', srs: { step: 1, dueDay: '2026-12-05', graduated: false } },
      { day: 'b', srs: { step: 1, dueDay: '2026-12-03', graduated: false } },
      { day: 'c', srs: { step: 6, dueDay: '2026-12-01', graduated: true } },
    ]
    expect(dueReviews(ps, '2026-12-05').map((p) => p.day)).toEqual(['b', 'a'])
  })
})

describe('weak patterns', () => {
  const p = (id: string, tags: string[], outcome: DsaProblem['outcome']): DsaProblem => ({
    id,
    day: '2026-12-01',
    title: id,
    link: '',
    difficulty: 'medium',
    tags,
    outcome,
    insight: '',
    srs: { step: 0, dueDay: '2026-12-02', graduated: false },
    createdAt: 0,
  })
  const r = (problemId: string, rating: DsaReview['rating']): DsaReview => ({ id: `${problemId}-${rating}`, problemId, day: '2026-12-03', rating, stepBefore: 0, at: 0 })

  it('sorts patterns by failure rate, counting first solves and reviews', () => {
    const problems = [p('1', ['DP', 'arrays'], 'solution'), p('2', ['Two Pointers'], 'alone'), p('3', ['dp'], 'alone')]
    const reviews = [r('3', 'failed'), r('2', 'ok')]
    const stats = weakPatterns(problems, reviews)
    expect(stats[0]).toEqual({ tag: 'arrays', attempts: 1, failures: 1, rate: 1 })
    expect(stats.find((s) => s.tag === 'dp')).toEqual({ tag: 'dp', attempts: 3, failures: 2, rate: 2 / 3 })
    expect(stats.at(-1)?.tag).toBe('two pointers')
    expect(reviewPassRate(reviews)).toBe(0.5)
  })
})

describe('applications', () => {
  const app = (company: string, stage: Application['stage'], history: Application['history'], nextActionDay?: string): Application => ({
    id: company,
    company,
    role: 'Engineer II',
    source: 'referral',
    referrer: '',
    stage,
    history,
    nextAction: 'Follow up',
    nextActionDay,
    notes: '',
    createdAt: 0,
    updatedAt: 0,
  })

  it('moves forward one stage at a time and ends at an offer', () => {
    expect(nextStage('target')).toBe('referral_asked')
    expect(nextStage('onsite')).toBe('offer')
    expect(nextStage('offer')).toBeUndefined()
  })

  it('lists follow-ups due today or overdue, only for open applications', () => {
    const apps = [
      app('A', 'applied', [], '2027-05-03'),
      app('B', 'phone', [], '2027-05-01'),
      app('C', 'rejected', [], '2027-04-01'),
      app('D', 'applied', [], '2027-05-09'),
    ]
    expect(dueFollowUps(apps, '2027-05-03').map((a) => a.company)).toEqual(['B', 'A'])
  })

  it('counts how far each application got, even after a rejection', () => {
    const apps = [
      app('A', 'rejected', [
        { stage: 'target', day: '2027-05-01' },
        { stage: 'applied', day: '2027-05-02' },
        { stage: 'phone', day: '2027-05-10' },
        { stage: 'rejected', day: '2027-05-12' },
      ]),
      app('B', 'applied', [{ stage: 'applied', day: '2027-05-02' }]),
    ]
    const f = Object.fromEntries(funnel(apps).map((x) => [x.stage, x.count]))
    expect(f).toMatchObject({ target: 2, applied: 2, oa: 1, phone: 1, onsite: 0, offer: 0 })
  })
})
