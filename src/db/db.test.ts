import Dexie from 'dexie'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, openDb } from './db'
import { patchKv, putRow, readKv } from './repo'
import { TABLE_NAMES, TABLE_SCHEMAS } from './tables'
import { LATEST_DB_VERSION, migrateTables, primaryKeyOf, storesAt, type DbVersion } from './versions'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('schema registry', () => {
  it('has indexes for exactly the tables that have row schemas', () => {
    expect(Object.keys(storesAt(LATEST_DB_VERSION)).sort()).toEqual([...TABLE_NAMES].sort())
  })

  it("has every table's primary key as a field of its row schema", () => {
    for (const name of TABLE_NAMES) {
      const pk = primaryKeyOf(name)
      expect(Object.keys(TABLE_SCHEMAS[name].shape), `${name}.${pk}`).toContain(pk)
    }
  })

  it('opens the database with every table', () => {
    expect(db.tables.map((t) => t.name).sort()).toEqual([...TABLE_NAMES].sort())
  })
})

describe('writes', () => {
  it('fills defaults and rejects invalid rows', async () => {
    const phase = await putRow('phases', { id: 'p1', name: 'Foundation', start: '2026-12-01', end: '2027-02-28', order: 0 })
    expect(phase.goal).toBe('')
    expect(await db.phases.get('p1')).toEqual(phase)
    await expect(putRow('phases', { id: 'p2', name: 'Bad', start: '2027-02-30', end: '2027-03-01', order: 1 })).rejects.toThrow()
  })

  it('reads settings as defaults before anything is saved, then merges patches', async () => {
    const defaults = await readKv('settings')
    expect(defaults.timeZone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone)
    expect(defaults.rolloverHour).toBe(3)
    expect(defaults.planStart).toBe('2026-12-01')
    const next = await patchKv('settings', { rolloverHour: 4 })
    expect(next.rolloverHour).toBe(4)
    expect((await readKv('settings')).planEnd).toBe('2027-08-31')
  })
})

describe('live database upgrades', () => {
  it('upgrades a version-1 database in place when the new app opens it', async () => {
    const name = 'compound-upgrade-test'
    const v1 = new Dexie(name)
    v1.version(1).stores(storesAt(1))
    await v1.open()
    await v1.table('areas').bulkPut([
      { id: 'career', name: 'Career', color: '#60a5fa', order: 0, goal: '', notes: [], leadMeasures: [], lagMeasures: [] },
      { id: 'mine', name: 'Mine', color: '#123456', order: 4, goal: '', notes: [], leadMeasures: [], lagMeasures: [] },
    ])
    v1.close()

    const upgraded = openDb(name)
    await upgraded.open()
    expect(upgraded.verno).toBe(LATEST_DB_VERSION)
    expect((await upgraded.areas.get('career'))?.color).toBe('#338ced')
    expect((await upgraded.areas.get('mine'))?.color).toBe('#123456')
    upgraded.close()
    await Dexie.delete(name)
  })
})

describe('backup migrations', () => {
  const versions: DbVersion[] = [
    { version: 1, stores: { notes: 'id', old: 'id' } },
    {
      version: 2,
      stores: { old: null, tags: 'id' },
      rows: { notes: (row) => ({ ...row, title: String(row.text ?? '').toUpperCase() }) },
    },
  ]

  it('runs later versions in order and adds or removes tables', () => {
    const out = migrateTables({ notes: [{ id: 'n1', text: 'hi' }], old: [{ id: 'o1' }] }, 1, versions)
    expect(out).toEqual({ notes: [{ id: 'n1', text: 'hi', title: 'HI' }], tags: [] })
  })

  it('leaves a backup from the latest version untouched', () => {
    const tables = { notes: [{ id: 'n1', text: 'hi', title: 'HI' }], tags: [] }
    expect(migrateTables(tables, 2, versions)).toEqual(tables)
  })
})
