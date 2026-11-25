import { z } from 'zod'
import { formatDay } from '../domain/time/day'
import { wallClock } from '../domain/time/zone'
import { KV_SCHEMAS } from '../model/kv'
import { fromBase64, sealJson, toBase64, unsealJson, unwrapDataKey, type KdfParams } from '../platform/crypto'
import { db } from './db'
import { parseRow, patchKv, stripUndefined } from './repo'
import { TABLE_NAMES, type Row, type TableName } from './tables'
import { LATEST_DB_VERSION, migrateTables } from './versions'

/*
 * Full backup: every table, as JSON. Exporting and importing the same file
 * gives back exactly the same data (acceptance test 7). Files from older app
 * versions are upgraded with the same migrations as the live database.
 */

export const BACKUP_APP = 'compound'
export const BACKUP_FORMAT = 1

export interface BackupFile {
  app: typeof BACKUP_APP
  format: typeof BACKUP_FORMAT
  schemaVersion: number
  exportedAt: number
  tables: Record<string, unknown[]>
}

const zEnvelope = z.object({
  app: z.literal(BACKUP_APP),
  format: z.literal(BACKUP_FORMAT),
  schemaVersion: z.number().int().positive(),
  exportedAt: z.number().int().nonnegative(),
  tables: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))),
})

/** Reads every table into a backup. The file records itself as the latest backup. */
export async function buildBackup(now: number): Promise<BackupFile> {
  const tables: Record<string, unknown[]> = {}
  await db.transaction('r', db.tables, async () => {
    for (const name of TABLE_NAMES) tables[name] = await db.table(name).toArray()
  })
  // Store the export time inside the file, so restoring it brings back an
  // accurate "last backup" too. The same value is saved to the database
  // once the file has actually been saved (markBackedUp).
  const kv = (tables.kv ?? []) as Array<{ key: string; value: unknown }>
  const others = kv.filter((r) => r.key !== 'backup')
  const current = kv.find((r) => r.key === 'backup')?.value as Record<string, unknown> | undefined
  tables.kv = [...others, { key: 'backup', value: { ...(current ?? {}), lastExportAt: now } }].sort((a, b) =>
    a.key < b.key ? -1 : 1,
  )
  return { app: BACKUP_APP, format: BACKUP_FORMAT, schemaVersion: LATEST_DB_VERSION, exportedAt: now, tables }
}

// ── Encrypted backup files ──────────────────────────────────

const zSealed = z.object({
  app: z.literal(BACKUP_APP),
  format: z.literal(2),
  encrypted: z.literal(true),
  exportedAt: z.number(),
  /** The account's data key, wrapped with the password it had at export time. */
  lock: z.object({ kdf: z.object({ salt: z.string(), iterations: z.number().int().positive() }), wrappedKey: z.string() }),
  data: z.string(),
})

/** Seals a backup with the account's data key; only the account password opens it. */
export function sealBackup(file: BackupFile, lock: { kdf: KdfParams; wrappedKey: string }, key: Uint8Array): string {
  return JSON.stringify({ app: BACKUP_APP, format: 2, encrypted: true, exportedAt: file.exportedAt, lock, data: toBase64(sealJson(key, file)) })
}

export function isSealedBackup(text: string): boolean {
  try {
    return zSealed.safeParse(JSON.parse(text)).success
  } catch {
    return false
  }
}

/** Opens an encrypted backup with the password the account had when it was made. */
export async function openSealedBackup(text: string, password: string): Promise<string> {
  const sealed = zSealed.parse(JSON.parse(text))
  let key: Uint8Array
  try {
    key = await unwrapDataKey(sealed.lock.wrappedKey, password, sealed.lock.kdf)
  } catch {
    throw new Error('Wrong password for this backup. Use the password the account had when the backup was made.')
  }
  return JSON.stringify(unsealJson(key, fromBase64(sealed.data)))
}

export async function markBackedUp(at: number): Promise<void> {
  await patchKv('backup', { lastExportAt: at })
}

export function backupFileName(file: BackupFile, timeZone: string): string {
  return `compound-backup-${wallClock(file.exportedAt, timeZone).day}.json`
}

export type ParsedBackup =
  | {
      ok: true
      exportedAt: number
      schemaVersion: number
      rows: { [K in TableName]: Row<K>[] }
      counts: Array<{ table: TableName; count: number }>
      total: number
    }
  | { ok: false; error: string }

/** Checks a backup file and validates every row before anything is changed. */
export function parseBackup(text: string): ParsedBackup {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, error: "This file isn't valid JSON." }
  }
  const env = zEnvelope.safeParse(json)
  if (!env.success) return { ok: false, error: "This isn't a Compound backup file." }
  const file = env.data
  if (file.schemaVersion > LATEST_DB_VERSION) {
    return { ok: false, error: 'This backup was made by a newer version of Compound. Update the app (reload it), then try again.' }
  }

  const migrated = migrateTables(file.tables, file.schemaVersion)
  const rows = {} as { [K in TableName]: Row<K>[] }
  const errors: string[] = []
  for (const name of TABLE_NAMES) {
    const input = migrated[name] ?? []
    const parsed: unknown[] = []
    input.forEach((row, i) => {
      try {
        const r = parseRow(name, row)
        // Singletons (settings, …) are checked against their own schemas,
        // which also fills in settings added since the backup was made.
        if (name === 'kv') {
          const kv = r as Row<'kv'>
          const schema = (KV_SCHEMAS as Record<string, z.ZodType>)[kv.key]
          if (schema) kv.value = stripUndefined(schema.parse(kv.value))
        }
        parsed.push(r)
      } catch (e) {
        const issue = e instanceof z.ZodError ? e.issues[0] : undefined
        errors.push(`${name} #${i + 1}${issue ? `: ${issue.path.join('.')} ${issue.message}` : ''}`)
      }
    })
    ;(rows as Record<string, unknown[]>)[name] = parsed
  }
  if (errors.length) {
    const more = errors.length > 3 ? ` (and ${errors.length - 3} more)` : ''
    return { ok: false, error: `Some records in this file are invalid: ${errors.slice(0, 3).join('; ')}${more}. Nothing was changed.` }
  }

  const counts = TABLE_NAMES.map((table) => ({ table, count: rows[table].length })).filter((c) => c.count > 0)
  return {
    ok: true,
    exportedAt: file.exportedAt,
    schemaVersion: file.schemaVersion,
    rows,
    counts,
    total: counts.reduce((n, c) => n + c.count, 0),
  }
}

/** Replaces everything on this device with the backup, in one transaction. */
export async function restoreBackup(rows: { [K in TableName]: Row<K>[] }): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const name of TABLE_NAMES) {
      const table = db.table(name)
      await table.clear()
      await table.bulkAdd(stripUndefined(rows[name]))
    }
  })
}

/** Deletes all data on this device. The app returns to onboarding. */
export async function resetAll(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) await table.clear()
  })
}

export function describeBackupDate(exportedAt: number, timeZone: string): string {
  const { day, hour, minute } = wallClock(exportedAt, timeZone)
  return `${formatDay(day, { day: 'numeric', month: 'short', year: 'numeric' })}, ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}
