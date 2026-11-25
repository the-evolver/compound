import { beforeEach, describe, expect, it } from 'vitest'
import { buildSeed, sampleInput, samplePlan } from '../../tests/fixtures/samplePlan'
import { db } from '../db/db'
import { readKv } from '../db/repo'
import { buildHabitContext } from '../domain/habits/context'
import { describeDays } from '../domain/habits/describe'
import { dayResult } from '../domain/habits/outcome'
import { isActiveOn, isQueued } from '../domain/habits/rules'
import { addDays } from '../domain/time/day'
import { completeOnboarding } from './applySeed'
import { parsePlanFile, templateNeeds } from './template'

const input = sampleInput()

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('plan files', () => {
  it('reads a valid plan file and rejects anything else', () => {
    expect(parsePlanFile(JSON.stringify(samplePlan))).toMatchObject({ ok: true })
    expect(parsePlanFile('nope')).toMatchObject({ ok: false })
    expect(parsePlanFile(JSON.stringify({ kind: 'something-else' }))).toMatchObject({ ok: false })
  })

  it('knows which onboarding answers a plan needs', () => {
    expect(templateNeeds(samplePlan)).toEqual({ workout: true, weight: true })
    expect(templateNeeds({ ...samplePlan, habits: [] })).toEqual({ workout: false, weight: false })
  })

  it('has unique ids in every table', () => {
    const seed = buildSeed()
    for (const [name, rows] of Object.entries(seed)) {
      const ids = (rows as Array<{ id?: string; day?: string }>).map((r) => r.id ?? r.day)
      expect(new Set(ids).size, name).toBe(ids.length)
    }
  })

  it('starts blank without a plan file', async () => {
    await completeOnboarding(input)
    expect(await db.areas.count()).toBe(0)
    expect(await db.habits.count()).toBe(0)
    const settings = await readKv('settings')
    expect(settings.onboardedAt).toBe(input.now)
    expect(settings.planEnd).toBe('2027-08-31')
    expect(settings.profile.name).toBe('')
    expect((await db.dayEntries.get(input.today))?.metrics.weightKg).toBe(80)
  })

  it('writes a plan file and records onboarding', async () => {
    await completeOnboarding(input, samplePlan, { opaqueIds: false })
    expect(await db.areas.count()).toBe(4)
    expect(await db.phases.count()).toBe(3)
    expect(await db.topics.where('subjectId').equals('subject:lld').count()).toBe(21)
    expect(await db.topics.where('subjectId').equals('subject:hld').count()).toBe(20)
    expect((await db.subjects.where('status').equals('active').toArray()).map((s) => s.name)).toEqual(['LLD'])
    expect((await readKv('settings')).planStart).toBe('2026-12-01')
  })

  it('starts only the week-1 habits on day 1 (acceptance test 1)', async () => {
    await completeOnboarding(input, samplePlan, { opaqueIds: false })
    const habits = await db.habits.toArray()
    const active = habits.filter((h) => isActiveOn(h, '2026-12-01')).map((h) => h.id).sort()
    expect(active).toEqual(
      ['habit:dsa-daily', 'habit:study-block', 'habit:workout', 'habit:steps', 'habit:sunscreen-am', 'habit:sunscreen-reapply', 'habit:speaking-drill'].sort(),
    )
    expect(habits.filter((h) => isQueued(h, '2026-12-01')).length).toBe(habits.length - 7)
  })

  it('rolls habits out gradually: week 3, week 5, fixed dates', async () => {
    await completeOnboarding(input, samplePlan, { opaqueIds: false })
    const byId = new Map((await db.habits.toArray()).map((h) => [h.id, h]))
    expect(byId.get('habit:protein')?.activeFrom).toBe('2026-12-15')
    expect(byId.get('habit:lc-contest')?.activeFrom).toBe('2026-12-15')
    expect(byId.get('habit:sleep')?.activeFrom).toBe('2026-12-29')
    expect(byId.get('habit:mock-weekly')?.activeFrom).toBe('2027-03-01')
    expect(byId.get('habit:applications')?.activeFrom).toBe('2027-05-01')
  })

  it('keeps at most one new habit per area in any two weeks after week 1', () => {
    const later = buildSeed().habits.filter((h) => h.activeFrom! > input.startDay)
    for (const h of later) {
      const clash = later.filter(
        (o) => o !== h && o.areaId === h.areaId && Math.abs(Date.parse(o.activeFrom!) - Date.parse(h.activeFrom!)) < 14 * 864e5,
      )
      expect(clash.map((c) => c.id), h.id).toEqual([])
    }
  })

  it('fills in the chosen workout days and alarm time', async () => {
    await completeOnboarding({ ...input, workoutDays: [2, 4, 6], workoutTime: '06:30' }, samplePlan, { opaqueIds: false })
    const workout = await db.habits.get('habit:workout')
    expect(workout?.rules[0]?.schedule).toEqual({ kind: 'days', days: [2, 4, 6] })
    expect(workout?.rules[1]?.schedule).toEqual({ kind: 'days', days: [0, 2, 4, 6] })
    expect(workout?.rules[1]?.proposed).toBe(true)
    expect(workout?.ifThen).toContain('Tue/Thu/Sat')
    expect(workout?.reminderTime).toBe('06:30')
  })

  it('computes the protein target from the onboarding weight', async () => {
    await completeOnboarding(input, samplePlan, { opaqueIds: false })
    const protein = (await db.habits.get('habit:protein'))!
    const ctx = buildHabitContext({ today: '2026-12-16', weekStartsOn: 1, habitLogs: [], dayEntries: await db.dayEntries.toArray(), logCounts: {} })
    expect(dayResult(protein, '2026-12-15', ctx).progress?.target).toBe(128)
  })

  it('dates relative items from the start date', () => {
    const seed = buildSeed({ startDay: '2027-01-04' })
    expect(seed.tasks.find((t) => t.id === 'task:skin-week12')?.dueDay).toBe(addDays('2027-01-04', 84))
    expect(seed.phases[0]?.start).toBe('2027-01-04')
  })

  it('gives every record a random id by default, keeping references intact', async () => {
    await completeOnboarding(input, samplePlan)
    const [areas, habits, topics, templates, exercises] = await Promise.all([
      db.areas.toArray(),
      db.habits.toArray(),
      db.topics.toArray(),
      db.workoutTemplates.toArray(),
      db.exercises.toArray(),
    ])
    const uuid = /^[0-9a-f-]{36}$/
    expect([...areas, ...habits, ...topics, ...templates, ...exercises].every((r) => uuid.test(r.id))).toBe(true)
    const areaIds = new Set(areas.map((a) => a.id))
    expect(habits.every((h) => areaIds.has(h.areaId))).toBe(true)
    const exerciseIds = new Set(exercises.map((e) => e.id))
    expect(templates.flatMap((t) => t.items).every((i) => exerciseIds.has(i.exerciseId))).toBe(true)
    expect(areas.find((a) => a.name === 'Skin')?.charts).toBe('skin')
    expect(habits.find((h) => h.name === 'AM: cleanser + sunscreen')?.role).toBe('sunscreen')
  })

  it('describes days Monday-first', () => {
    expect(describeDays([5, 1, 3])).toBe('Mon/Wed/Fri')
    expect(describeDays([0, 6])).toBe('Sat/Sun')
  })
})
