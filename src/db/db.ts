import Dexie, { type Table } from 'dexie'
import { encryptionMiddleware } from './encryption'
import type { Row, TableName } from './tables'
import { DB_VERSIONS } from './versions'

export type CompoundDB = Dexie & { [K in TableName]: Table<Row<K>, string> }

/** The database used before accounts existed (unencrypted). Migrated into the first account. */
export const LEGACY_DB_NAME = 'compound'

export function accountDbName(accountId: string): string {
  return `compound-acct-${accountId}`
}

/** Opens (lazily) a database with the app's schema. With a key, every row is encrypted at rest. */
export function openDb(name: string, options: { key?: Uint8Array } = {}): CompoundDB {
  const db = new Dexie(name) as CompoundDB
  if (options.key) db.use(encryptionMiddleware(options.key))
  for (const v of DB_VERSIONS) {
    const version = db.version(v.version).stores(v.stores)
    const rows = v.rows
    if (rows) {
      version.upgrade(async (tx) => {
        for (const [table, migrate] of Object.entries(rows)) {
          await tx
            .table(table)
            .toCollection()
            .modify((row, ctx) => {
              ctx.value = migrate(row as Record<string, unknown>)
            })
        }
      })
    }
  }
  return db
}

let current: CompoundDB | null = null

/** Switches the app to an account's database (or none, when logged out). */
export function setCurrentDb(next: CompoundDB | null): void {
  current = next
}

export function hasCurrentDb(): boolean {
  return current !== null
}

/**
 * The signed-in account's database. Everything in the app uses this one
 * object; it forwards to whichever account is open.
 */
export const db: CompoundDB = new Proxy({} as CompoundDB, {
  get(_target, prop) {
    if (!current) throw new Error('No account is open')
    const value = Reflect.get(current, prop, current) as unknown
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(current) : value
  },
})
