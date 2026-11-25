import { z } from 'zod'
import { zDay, zId, zTimestamp } from './common'

export const zMissCause = z.enum(['time', 'energy', 'forgot', 'too_hard', 'unclear_plan'])
export type MissCause = z.output<typeof zMissCause>

export const zWeeklyReview = z.object({
  /** The first day of the week reviewed. */
  id: zId,
  weekStart: zDay,
  /** Which step the guided review is on, so it can be resumed. */
  step: z.number().int().nonnegative().default(0),
  /** Numbers frozen at the time of the review (scoreboard, lag check). */
  snapshot: z.record(z.string(), z.unknown()).default(() => ({})),
  wins: z.array(z.string()).max(3).default(() => []),
  misses: z.array(z.object({ text: z.string(), cause: zMissCause })).default(() => []),
  /** One change for next week, written as an if-then. */
  change: z.string().default(''),
  /** 1–2 commitments per area for next week; become tasks on Today when the review is finished. */
  commitments: z.array(z.object({ areaId: zId, text: z.string() })).default(() => []),
  startedAt: zTimestamp,
  completedAt: zTimestamp.optional(),
})
export type WeeklyReview = z.output<typeof zWeeklyReview>

export const zMonthlyDecision = z.object({
  habitId: zId.optional(),
  action: z.enum(['keep', 'adjust', 'activate', 'postpone', 'note']),
  detail: z.string().default(''),
})

export const zMonthlyReview = z.object({
  /** 'YYYY-MM' of the month reviewed. */
  id: zId,
  month: z.string().regex(/^\d{4}-\d{2}$/),
  step: z.number().int().nonnegative().default(0),
  snapshot: z.record(z.string(), z.unknown()).default(() => ({})),
  decisions: z.array(zMonthlyDecision).default(() => []),
  notes: z.string().default(''),
  startedAt: zTimestamp,
  completedAt: zTimestamp.optional(),
})
export type MonthlyReview = z.output<typeof zMonthlyReview>
