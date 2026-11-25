import type { Table } from 'dexie'
import { KV_SCHEMAS, type KvKey, type KvValue } from '../model/kv'
import { db } from './db'
import { TABLE_SCHEMAS, type Row, type RowInput, type TableName } from './tables'

/*
 * All writes go through these helpers, which validate rows against the
 * model schemas (and fill defaults) before they reach IndexedDB. Bad data
 * fails loudly at the point it is written, not months later on import.
 */

function tableOf<T extends TableName>(name: T): Table<Row<T>, string> {
  return db[name] as unknown as Table<Row<T>, string>
}

/**
 * Drops keys whose value is undefined (recursively). IndexedDB would keep
 * them but JSON can't, so stored rows never contain them and a backup
 * round-trip is exact.
 */
export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripUndefined) as T
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) if (v !== undefined) out[k] = stripUndefined(v)
    return out as T
  }
  return value
}

export function parseRow<T extends TableName>(name: T, input: unknown): Row<T> {
  return stripUndefined(TABLE_SCHEMAS[name].parse(input)) as Row<T>
}

export async function putRow<T extends TableName>(name: T, input: RowInput<T>): Promise<Row<T>> {
  const row = parseRow(name, input)
  await tableOf(name).put(row)
  return row
}

export async function putRows<T extends TableName>(name: T, inputs: readonly RowInput<T>[]): Promise<Row<T>[]> {
  const rows = inputs.map((input) => parseRow(name, input))
  await tableOf(name).bulkPut(rows)
  return rows
}

export function newId(): string {
  return crypto.randomUUID()
}

/** Reads a singleton; missing or unreadable values fall back to defaults. */
export async function readKv<K extends KvKey>(key: K): Promise<KvValue<K>> {
  const row = await db.kv.get(key)
  const schema = KV_SCHEMAS[key]
  const parsed = schema.safeParse(row?.value ?? {})
  if (parsed.success) return parsed.data as KvValue<K>
  console.error(`Stored "${key}" is invalid; using defaults`, parsed.error)
  return schema.parse({}) as KvValue<K>
}

export async function writeKv<K extends KvKey>(key: K, value: KvValue<K>): Promise<KvValue<K>> {
  const parsed = stripUndefined(KV_SCHEMAS[key].parse(value)) as KvValue<K>
  await db.kv.put({ key, value: parsed })
  return parsed
}

/** Shallow-merges a patch into a singleton and saves it. */
export async function patchKv<K extends KvKey>(key: K, patch: Partial<KvValue<K>>): Promise<KvValue<K>> {
  return db.transaction('rw', db.kv, async () => {
    const current = await readKv(key)
    return writeKv(key, { ...current, ...patch })
  })
}
