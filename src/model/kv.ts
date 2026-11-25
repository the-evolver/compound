import { z } from 'zod'
import { zSettings } from './core'
import { zTimestamp } from './common'

export const zBackupMeta = z.object({
  /** When the last full backup file was saved. */
  lastExportAt: zTimestamp.optional(),
})

export const zIcsMeta = z.object({
  lastExportAt: zTimestamp.optional(),
  /** Fingerprint of the reminder schedule in the last exported file. */
  scheduleHash: z.string().optional(),
})

export const zSeedMeta = z.object({
  /** Version of the seed content applied; lets later seed additions run once. */
  version: z.number().int().nonnegative().default(0),
  seededAt: zTimestamp.optional(),
})

/**
 * Every singleton stored in the kv table, with its schema. Each schema
 * parses `{}` to valid defaults, so reading a key that was never written is
 * always safe.
 */
export const KV_SCHEMAS = {
  settings: zSettings,
  backup: zBackupMeta,
  ics: zIcsMeta,
  seed: zSeedMeta,
} as const

export type KvKey = keyof typeof KV_SCHEMAS
export type KvValue<K extends KvKey> = z.output<(typeof KV_SCHEMAS)[K]>
