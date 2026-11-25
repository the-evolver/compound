import { beforeEach, describe, expect, it } from 'vitest'
import { ruleOn } from '../../domain/habits/rules'
import { parseTopicLines } from '../../domain/study'
import { completeOnboarding } from '../../seed/applySeed'
import { sampleInput, samplePlan } from '../../../tests/fixtures/samplePlan'
import { db } from '../db'
import { loadLogCounts } from '../evidence'
import { activateSubject, addTopics, completeSubject, logStudy, saveCheckpoint, saveHabit, setTopicStatus } from './plan'

beforeEach(async () => {
  await db.delete()
  await db.open()
  await completeOnboarding(sampleInput(), samplePlan, { opaqueIds: false })
})

describe('subjects and topics', () => {
  it('keeps exactly one active subject', async () => {
    await activateSubject('subject:hld')
    const active = await db.subjects.where('status').equals('active').toArray()
    expect(active.map((s) => s.id)).toEqual(['subject:hld'])
    expect((await db.subjects.get('subject:lld'))?.status).toBe('queued')
  })

  it('completing the active subject starts the next one in the queue', async () => {
    await completeSubject('subject:lld')
    expect((await db.subjects.get('subject:lld'))?.status).toBe('done')
    expect((await db.subjects.get('subject:hld'))?.status).toBe('active')
  })

  it('appends pasted topics after the existing ones', async () => {
    const added = await addTopics('subject:java', parseTopicLines('Concurrency:\n- volatile\n- CompletableFuture'))
    expect(added).toBe(2)
    const topics = await db.topics.where('subjectId').equals('subject:java').sortBy('order')
    expect(topics.map((t) => [t.title, t.group, t.order])).toEqual([
      ['volatile', 'Concurrency', 0],
      ['CompletableFuture', 'Concurrency', 1],
    ])
  })

  it('records every status change, for "topics moved this week"', async () => {
    await setTopicStatus('topic:lld:0', 'learning', '2026-12-02')
    await setTopicStatus('topic:lld:0', 'can_explain', '2026-12-04')
    const events = await db.topicEvents.where('topicId').equals('topic:lld:0').sortBy('day')
    expect(events.map((e) => `${e.from}->${e.to}`)).toEqual(['not_started->learning', 'learning->can_explain'])
  })
})

describe('study card', () => {
  it('logs the session, starts the topic and completes the study habit', async () => {
    await logStudy('2026-12-02', 'subject:lld', 'done', 'topic:lld:0')
    expect((await db.topics.get('topic:lld:0'))?.status).toBe('learning')
    expect((await loadLogCounts()).study?.get('2026-12-02')).toBe(1)
  })

  it('"Not today" does not count as studying', async () => {
    await logStudy('2026-12-02', 'subject:lld', 'not_today')
    expect((await loadLogCounts()).study?.get('2026-12-02')).toBeUndefined()
  })
})

describe('habit edits', () => {
  it('a mid-plan schedule change keeps earlier days on the old schedule', async () => {
    const workout = (await db.habits.get('habit:workout'))!
    const { id: _id, rules, createdAt: _c, ...draft } = workout
    await saveHabit({ ...draft, id: workout.id }, { ...rules[0]!, schedule: { kind: 'days', days: [2, 4, 6] } }, '2027-01-12')
    const saved = (await db.habits.get('habit:workout'))!
    expect(ruleOn(saved, '2027-01-11').schedule).toEqual({ kind: 'days', days: [1, 3, 5] })
    expect(ruleOn(saved, '2027-01-12').schedule).toEqual({ kind: 'days', days: [2, 4, 6] })
  })

  it('creates a new habit with its first rule starting on its start date', async () => {
    const id = await saveHabit(
      {
        areaId: 'voice',
        name: 'Read aloud',
        ifThen: 'After breakfast, at the table, I read one page aloud.',
        minVersion: 'One paragraph.',
        timeBlock: 'morning',
        order: 0,
        activeFrom: '2027-01-26',
      },
      { schedule: { kind: 'daily' }, completion: { kind: 'manual' }, targetText: '', note: '' },
      '2026-12-02',
    )
    const h = (await db.habits.get(id))!
    expect(h.rules).toEqual([{ from: '2027-01-26', schedule: { kind: 'daily' }, completion: { kind: 'manual' }, targetText: '', note: '', proposed: false }])
    expect(h.order).toBeGreaterThan(0)
  })
})

describe('checkpoints', () => {
  it('stamps the decision time only when the result changes', async () => {
    await saveCheckpoint({ id: 'cp:career:2026-12-31:0', areaId: 'career', day: '2026-12-31', title: 'Mediums', result: 'pass', notes: 'Both in 52 min' })
    const first = (await db.checkpoints.get('cp:career:2026-12-31:0'))!
    expect(first.decidedAt).toBeTypeOf('number')
    await saveCheckpoint({ ...first, notes: 'Both in 52 min, clean code' })
    expect((await db.checkpoints.get(first.id))!.decidedAt).toBe(first.decidedAt)
    await saveCheckpoint({ ...first, result: 'pending' })
    expect((await db.checkpoints.get(first.id))!.decidedAt).toBeUndefined()
  })
})
