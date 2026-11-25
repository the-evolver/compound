import { beforeEach, describe, expect, it } from 'vitest'
import { completeOnboarding } from '../seed/applySeed'
import { sampleInput, samplePlan } from '../../tests/fixtures/samplePlan'
import { setDayNote, setHabitStatus, setMetric } from './actions/daily'
import { buildBackup, isSealedBackup, markBackedUp, openSealedBackup, parseBackup, resetAll, restoreBackup, sealBackup } from './backup'
import { newDataKey, newKdfParams, wrapDataKey } from '../platform/crypto'
import { db } from './db'
import { patchKv, putRow, readKv } from './repo'
import { TABLE_NAMES } from './tables'

const NOW = Date.UTC(2026, 11, 9, 15, 0)

async function dumpAll() {
  const out: Record<string, unknown[]> = {}
  for (const name of TABLE_NAMES) out[name] = await db.table(name).toArray()
  return out
}

async function fillWithData() {
  await completeOnboarding(
    sampleInput({ weightKg: 80.5, weekdayHours: 2.5, weekendHours: 6, workoutTime: "06:45", today: "2026-11-28", now: Date.UTC(2026, 10, 28) }),
    samplePlan,
    { opaqueIds: false },
  )
  await setHabitStatus('habit:dsa-daily', '2026-12-01', 'done')
  await setHabitStatus('habit:study-block', '2026-12-02', 'skip', 'travel')
  await setHabitStatus('habit:sunscreen-am', '2026-12-02', 'min')
  await setMetric('2026-12-02', 'steps', 8450)
  await setMetric('2026-12-02', 'weightKg', 80.2)
  await setDayNote('2026-12-02', 'Long day, "quotes", commas, and ₹ symbols')
  await putRow('dsaProblems', {
    id: 'p1',
    day: '2026-12-02',
    title: 'Two Sum',
    link: 'https://leetcode.com/problems/two-sum/',
    difficulty: 'easy',
    tags: ['hash map', 'array'],
    minutes: 12,
    outcome: 'alone',
    insight: 'Store complements',
    srs: { step: 1, dueDay: '2026-12-05' },
    createdAt: NOW,
  })
  await putRow('dsaReviews', { id: 'r1', problemId: 'p1', day: '2026-12-03', rating: 'ok', stepBefore: 0, at: NOW })
  await putRow('workoutSessions', {
    id: 'w1',
    day: '2026-12-02',
    templateId: 'tpl:full-a',
    entries: [{ exerciseId: 'ex:squat', sets: [{ reps: 10, kg: 40 }, { reps: 9, kg: 40 }] }],
    at: NOW,
  })
  await putRow('measurements', { id: 'm1', day: '2026-12-06', kind: 'waistCm', value: 88.5, at: NOW })
  await putRow('mocks', {
    id: 'k1',
    day: '2026-12-06',
    type: 'dsa',
    scores: { technical: 3, problemSolving: 2, communication: 3 },
    verdict: 'no_hire',
    fixes: ['State brute force first'],
    at: NOW,
  })
  await putRow('tasks', { id: 't1', kind: 'mock-fix', text: 'State brute force first', sourceId: 'k1', createdAt: NOW })
  await patchKv('settings', { rolloverHour: 4, theme: 'light' })
}

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('backup round trip (acceptance test 7)', () => {
  it('export → reset → import gives back identical data', async () => {
    await fillWithData()
    const file = await buildBackup(NOW)
    await markBackedUp(NOW)
    const before = await dumpAll()
    const text = JSON.stringify(file)

    await resetAll()
    for (const name of TABLE_NAMES) expect(await db.table(name).count(), name).toBe(0)

    const parsed = parseBackup(text)
    if (!parsed.ok) throw new Error(parsed.error)
    await restoreBackup(parsed.rows)

    expect(await dumpAll()).toStrictEqual(before)
    expect((await readKv('backup')).lastExportAt).toBe(NOW)
    expect((await readKv('settings')).rolloverHour).toBe(4)
  })

  it('summarises what a file contains before restoring', async () => {
    await fillWithData()
    const parsed = parseBackup(JSON.stringify(await buildBackup(NOW)))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.counts.find((c) => c.table === 'habits')?.count).toBe(16)
    expect(parsed.total).toBeGreaterThan(100)
  })
})

describe('encrypted backup files', () => {
  it('only the account password opens them, and they contain no readable plan', async () => {
    await fillWithData()
    const key = newDataKey()
    const lock = await wrapDataKey(key, 'account password', newKdfParams(1000))
    const text = sealBackup(await buildBackup(NOW), lock, key)
    expect(isSealedBackup(text)).toBe(true)
    expect(text).not.toContain('Two Sum')
    expect(text).not.toContain('DSA practice')
    await expect(openSealedBackup(text, 'wrong password')).rejects.toThrow(/Wrong password/)
    const parsed = parseBackup(await openSealedBackup(text, 'account password'))
    expect(parsed.ok && parsed.rows.dsaProblems[0]?.title).toBe('Two Sum')
  })
})

describe('rejecting bad files', () => {
  it('rejects files that are not Compound backups', () => {
    expect(parseBackup('not json')).toMatchObject({ ok: false })
    expect(parseBackup(JSON.stringify({ hello: 'world' }))).toMatchObject({ ok: false, error: "This isn't a Compound backup file." })
  })

  it('rejects a backup from a newer app version', () => {
    const r = parseBackup(JSON.stringify({ app: 'compound', format: 1, schemaVersion: 999, exportedAt: 0, tables: {} }))
    expect(r).toMatchObject({ ok: false })
    if (!r.ok) expect(r.error).toMatch(/newer version/)
  })

  it('rejects invalid rows and changes nothing', async () => {
    await fillWithData()
    const before = await dumpAll()
    const file = await buildBackup(NOW)
    ;(file.tables.dayEntries as Array<Record<string, unknown>>)[0]!.day = '2026-13-45'
    const r = parseBackup(JSON.stringify(file))
    expect(r).toMatchObject({ ok: false })
    if (!r.ok) expect(r.error).toMatch(/dayEntries #1: day/)
    expect(await dumpAll()).toStrictEqual(before)
  })

  it('upgrades a version-1 backup: old default area colours become the new palette, custom ones stay', () => {
    const r = parseBackup(
      JSON.stringify({
        app: 'compound',
        format: 1,
        schemaVersion: 1,
        exportedAt: 0,
        tables: {
          areas: [
            { id: 'career', name: 'Career', color: '#60a5fa', order: 0 },
            { id: 'skin', name: 'Skin', color: '#123456', order: 2 },
          ],
        },
      }),
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.rows.areas.map((a) => a.color)).toEqual(['#338ced', '#123456'])
  })

  it('fills in settings that did not exist when an old backup was made', () => {
    const r = parseBackup(
      JSON.stringify({ app: 'compound', format: 1, schemaVersion: 1, exportedAt: 0, tables: { kv: [{ key: 'settings', value: { rolloverHour: 2 } }] } }),
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const settings = r.rows.kv[0]!.value as Record<string, unknown>
    expect(settings.rolloverHour).toBe(2)
    expect(settings.timeZone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone)
  })
})
