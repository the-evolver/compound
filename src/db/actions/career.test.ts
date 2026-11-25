import { beforeEach, describe, expect, it } from 'vitest'
import { dueReviews } from '../../domain/career'
import { db } from '../db'
import { loadLogCounts } from '../evidence'
import { moveApplication, reviewProblem, saveApplication, saveMock, saveProblem } from './career'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

const problem = {
  day: '2026-12-02',
  title: 'Longest Substring Without Repeating Characters',
  difficulty: 'medium' as const,
  tags: ['Sliding Window', ' hash map ', 'sliding window'],
  outcome: 'hint' as const,
}

describe('DSA log (acceptance test 4)', () => {
  it('a logged problem is in the review queue the next day', async () => {
    const id = await saveProblem(problem)
    const p = (await db.dsaProblems.get(id))!
    expect(p.tags).toEqual(['sliding window', 'hash map'])
    expect(dueReviews(await db.dsaProblems.toArray(), '2026-12-02')).toHaveLength(0)
    expect(dueReviews(await db.dsaProblems.toArray(), '2026-12-03').map((x) => x.id)).toEqual([id])
  })

  it('marking a review Failed reschedules it for the following day', async () => {
    const id = await saveProblem(problem)
    await reviewProblem(id, 'ok', '2026-12-03')
    expect((await db.dsaProblems.get(id))!.srs.dueDay).toBe('2026-12-06')
    await reviewProblem(id, 'failed', '2026-12-06')
    expect((await db.dsaProblems.get(id))!.srs).toEqual({ step: 0, dueDay: '2026-12-07', graduated: false })
    expect(await db.dsaReviews.where('problemId').equals(id).count()).toBe(2)
  })

  it('new problems and reviews both count as DSA items for the habit', async () => {
    const id = await saveProblem(problem)
    await saveProblem({ ...problem, title: 'Two Sum', day: '2026-12-03' })
    await reviewProblem(id, 'easy', '2026-12-03')
    expect((await loadLogCounts()).dsa?.get('2026-12-03')).toBe(2)
  })
})

describe('mocks', () => {
  it('turns the top fixes into checklist items once', async () => {
    const id = await saveMock({
      day: '2027-03-06',
      type: 'dsa',
      scores: { technical: 3, problemSolving: 2, communication: 2 },
      verdict: 'no_hire',
      fixes: ['State brute force first', '  ', 'Talk while coding'],
    })
    const fixes = (await db.tasks.where('sourceId').equals(id).toArray()).sort((a, b) => a.createdAt - b.createdAt)
    expect(fixes.map((t) => t.text)).toEqual(['State brute force first', 'Talk while coding'])
    await saveMock({ ...(await db.mocks.get(id))!, notes: 'edited' })
    expect(await db.tasks.where('sourceId').equals(id).count()).toBe(2)
    expect((await loadLogCounts()).mock?.get('2027-03-06')).toBe(1)
  })
})

describe('applications', () => {
  it('records every stage change with its day and counts moves for the habit', async () => {
    const id = await saveApplication({ company: 'Acme', role: 'Engineer II', source: 'referral', stage: 'target' }, '2027-05-01')
    await moveApplication(id, 'referral_asked', '2027-05-03')
    await saveApplication({ ...(await db.applications.get(id))!, stage: 'applied' }, '2027-05-05')
    await saveApplication({ ...(await db.applications.get(id))!, notes: 'no stage change' }, '2027-05-06')
    const a = (await db.applications.get(id))!
    expect(a.history).toEqual([
      { stage: 'target', day: '2027-05-01' },
      { stage: 'referral_asked', day: '2027-05-03' },
      { stage: 'applied', day: '2027-05-05' },
    ])
    const moves = (await loadLogCounts()).applicationMoves
    expect([moves?.get('2027-05-01'), moves?.get('2027-05-03'), moves?.get('2027-05-05')]).toEqual([undefined, 1, 1])
  })
})
