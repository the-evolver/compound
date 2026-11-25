import type { DBCore, DBCoreCursor, DBCoreTable, Middleware } from 'dexie'
import { sealJson, unsealJson } from '../platform/crypto'

/*
 * Encrypts every row at rest (Dexie DBCore middleware). A stored row keeps
 * only the fields IndexedDB needs for its keys and indexes (ids, days,
 * kinds…) in plain text; everything else, including those fields, is in
 * `__enc`: AES-256-GCM ciphertext of the whole row. Reads decrypt
 * transparently, including through cursors (so filter() and modify() work).
 * Rows without `__enc` (written before encryption) are read as they are.
 */

const ENC = '__enc'

function keyPathsOf(table: DBCoreTable): string[] {
  const paths = new Set<string>()
  for (const index of [table.schema.primaryKey, ...table.schema.indexes]) {
    const kp = index.keyPath
    if (typeof kp === 'string') paths.add(kp)
    else if (Array.isArray(kp)) kp.forEach((p) => paths.add(p))
  }
  return [...paths]
}

function getPath(obj: unknown, path: string): unknown {
  let cur = obj as Record<string, unknown> | undefined
  for (const part of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined
    cur = cur[part] as Record<string, unknown> | undefined
  }
  return cur
}

function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.')
  let cur = obj
  for (const part of parts.slice(0, -1)) {
    if (typeof cur[part] !== 'object' || cur[part] === null) cur[part] = {}
    cur = cur[part] as Record<string, unknown>
  }
  cur[parts[parts.length - 1]!] = value
}

export function encryptRow(value: unknown, paths: readonly string[], key: Uint8Array): unknown {
  if (value === null || typeof value !== 'object') return value
  const stored: Record<string, unknown> = {}
  for (const p of paths) {
    const v = getPath(value, p)
    if (v !== undefined) setPath(stored, p, v)
  }
  stored[ENC] = sealJson(key, value)
  return stored
}

export function decryptRow(value: unknown, key: Uint8Array): unknown {
  if (value && typeof value === 'object' && ENC in value) return unsealJson(key, (value as Record<string, Uint8Array>)[ENC]!)
  return value
}

function wrapCursor(cursor: DBCoreCursor, dec: (v: unknown) => unknown): DBCoreCursor {
  return Object.create(cursor, {
    value: { get: () => dec(cursor.value) },
    next: { value: () => cursor.next().then((c) => (c ? wrapCursor(c, dec) : c)) },
  }) as DBCoreCursor
}

export function encryptionMiddleware(key: Uint8Array): Middleware<DBCore> {
  return {
    stack: 'dbcore',
    name: 'encryption',
    // Closest to IndexedDB: Dexie's own middlewares (observability, hooks) see plain rows.
    level: 0,
    create(down) {
      return {
        ...down,
        table(name) {
          const table = down.table(name)
          const paths = keyPathsOf(table)
          const enc = (v: unknown) => encryptRow(v, paths, key)
          const dec = (v: unknown) => decryptRow(v, key)
          return {
            ...table,
            mutate(req) {
              if (req.type === 'add' || req.type === 'put') return table.mutate({ ...req, values: req.values.map(enc) })
              return table.mutate(req)
            },
            get: (req) => table.get(req).then(dec),
            getMany: (req) => table.getMany(req).then((values) => values.map(dec)),
            query: (req) => table.query(req).then((res) => (req.values ? { ...res, result: res.result.map(dec) } : res)),
            openCursor: (req) => table.openCursor(req).then((cursor) => (cursor ? wrapCursor(cursor, dec) : cursor)),
          }
        },
      }
    },
  }
}
