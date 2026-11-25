import { z } from 'zod'
import { isDayKey } from '../domain/time/day'

/*
 * How to change the data model without breaking stored data or old backups:
 *
 * 1. A new field: make it .optional(), or give it a .default(). Rows written
 *    before the change are filled in when read through the schema (backup
 *    import always does this).
 * 2. A renamed or reshaped field: add a new version in src/db/versions.ts
 *    with a row migration. The same migration upgrades the live database and
 *    any older backup file being imported.
 * 3. A new table: add its schema to src/db/tables.ts and its indexes to a
 *    new version in src/db/versions.ts. A test keeps the two in step.
 */

export const zId = z.string().min(1)

export const zDay = z.string().refine(isDayKey, { message: 'Expected a day as YYYY-MM-DD' })

/** Epoch milliseconds. */
export const zTimestamp = z.number().int().nonnegative()

/** Clock time as HH:MM (24 h). */
export const zClockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected a time as HH:MM')

/** 0 = Sunday … 6 = Saturday. */
export const zWeekday = z.literal([0, 1, 2, 3, 4, 5, 6])

export const zHexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Expected a colour like #60a5fa')

/** A 1–4 interview rubric score. */
export const zScore4 = z.number().int().min(1).max(4)

/** A 1–5 self-rating. */
export const zScore5 = z.number().int().min(1).max(5)
