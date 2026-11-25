import { z } from 'zod'
import { zClockTime, zDay, zHexColor, zId, zTimestamp, zWeekday } from './common'

/** Generic key/value store for singletons (settings, backup status, …). */
export const zKv = z.object({
  key: z.string().min(1),
  value: z.unknown(),
})
export type Kv = z.output<typeof zKv>

/** Personal details: blank by default; a plan file may fill them in. */
export const zProfile = z.object({
  name: z.string().default(''),
  nickname: z.string().default(''),
  role: z.string().default(''),
  experienceYears: z.number().nonnegative().default(0),
  stack: z.string().default(''),
  location: z.string().default(''),
})

/**
 * App settings, stored under kv key "settings". Every field has a default,
 * so new settings never need a migration: older stored values parse fine.
 */
export const zSettings = z.object({
  profile: zProfile.default(() => zProfile.parse({})),
  /** Defaults to the device's own timezone. */
  timeZone: z.string().default(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'),
  /** The day rolls over at this hour, so late nights count toward the previous day. */
  rolloverHour: z.number().int().min(0).max(6).default(3),
  weekStartsOn: zWeekday.default(1),
  planStart: zDay.default('2026-12-01'),
  planEnd: zDay.default('2027-08-31'),
  budget: z
    .object({
      weekdayHours: z.number().nonnegative().default(2.75),
      weekendHours: z.number().nonnegative().default(5.5),
    })
    .default(() => ({ weekdayHours: 2.75, weekendHours: 5.5 })),
  /** Spaced-review intervals in days for DSA problems. */
  srsIntervals: z.array(z.number().int().positive()).min(1).default(() => [1, 3, 7, 14, 30, 60]),
  maxSkipsPerWeek: z.number().int().min(0).max(7).default(2),
  /** Today shows at most this many habit items before folding the rest. */
  todayItemCap: z.number().int().min(3).max(20).default(7),
  backupNudgeDays: z.number().int().min(1).default(7),
  weeklyReviewTime: zClockTime.default('10:00'),
  theme: z.enum(['dark', 'light']).default('dark'),
  onboardedAt: zTimestamp.optional(),
})
export type Settings = z.output<typeof zSettings>

export const zAreaNote = z.object({
  id: zId,
  kind: z.enum(['note', 'safety']),
  title: z.string().default(''),
  body: z.string().min(1),
})
export type AreaNote = z.output<typeof zAreaNote>

export const zArea = z.object({
  id: zId,
  name: z.string().min(1),
  goal: z.string().default(''),
  color: zHexColor,
  order: z.number(),
  notes: z.array(zAreaNote).default(() => []),
  leadMeasures: z.array(z.string()).default(() => []),
  lagMeasures: z.array(z.string()).default(() => []),
  /** Which extra chart pack Insights shows for this area, if any. */
  charts: z.enum(['career', 'body', 'skin', 'voice']).optional(),
  archivedAt: zTimestamp.optional(),
})
export type Area = z.output<typeof zArea>

export const zPhase = z.object({
  id: zId,
  name: z.string().min(1),
  start: zDay,
  end: zDay,
  goal: z.string().default(''),
  order: z.number(),
})
export type Phase = z.output<typeof zPhase>

export const zCheckpointResult = z.enum(['pending', 'pass', 'fail'])
export type CheckpointResult = z.output<typeof zCheckpointResult>

export const zCheckpoint = z.object({
  id: zId,
  areaId: zId,
  day: zDay,
  title: z.string().min(1),
  result: zCheckpointResult.default('pending'),
  notes: z.string().default(''),
  decidedAt: zTimestamp.optional(),
})
export type Checkpoint = z.output<typeof zCheckpoint>

/**
 * One checklist for every kind of to-do: weekly commitments, mock-interview
 * fixes, and one-off tasks such as "book a dermatologist". New kinds can be
 * added without a new table.
 */
export const zTaskKind = z.enum(['commitment', 'mock-fix', 'todo'])
export type TaskKind = z.output<typeof zTaskKind>

export const zTask = z.object({
  id: zId,
  kind: zTaskKind,
  text: z.string().min(1),
  areaId: zId.optional(),
  /** The record that created it: a weekly review, a mock, … */
  sourceId: zId.optional(),
  /** For commitments: the week (its first day) they belong to. */
  weekStart: zDay.optional(),
  dueDay: zDay.optional(),
  doneAt: zTimestamp.optional(),
  createdAt: zTimestamp,
})
export type Task = z.output<typeof zTask>
