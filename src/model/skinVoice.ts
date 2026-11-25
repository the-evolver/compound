import { z } from 'zod'
import { zDay, zId, zScore5, zTimestamp } from './common'

export const zSkinProduct = z.object({
  id: zId,
  name: z.string().min(1),
  role: z.enum(['cleanser', 'sunscreen', 'moisturiser', 'active', 'other']),
  startDay: zDay.optional(),
  stoppedDay: zDay.optional(),
  patchTest: z.enum(['not_done', 'passed', 'failed']).default('not_done'),
  /** Part of the starting routine: exempt from the one-new-product rule. */
  baseline: z.boolean().default(false),
  notes: z.string().default(''),
  createdAt: zTimestamp,
})
export type SkinProduct = z.output<typeof zSkinProduct>

export const zDermVisit = z.object({
  id: zId,
  day: zDay,
  advice: z.string().default(''),
  plan: z.string().default(''),
  nextVisit: zDay.optional(),
  at: zTimestamp,
})
export type DermVisit = z.output<typeof zDermVisit>

export const zDrill = z.object({
  id: zId,
  day: zDay,
  prompt: z.string().min(1),
  promptSource: z.enum(['topic', 'intro', 'behavioural', 'custom']).default('custom'),
  seconds: z.number().int().positive(),
  recorded: z.boolean(),
  fillers: z.number().int().nonnegative(),
  ratings: z.object({
    clarity: zScore5,
    structure: zScore5,
    pace: zScore5,
    confidence: zScore5,
  }),
  fix: z.string().default(''),
  at: zTimestamp,
})
export type Drill = z.output<typeof zDrill>

export const zPeopleLog = z.object({
  id: zId,
  /** First day of the week this entry covers. */
  weekStart: zDay,
  conversationsStarted: z.number().int().nonnegative().default(0),
  followUps: z.number().int().nonnegative().default(0),
  /** Ids of the people quests done this week. */
  quests: z.array(z.string()).default(() => []),
  notes: z.string().default(''),
  at: zTimestamp,
})
export type PeopleLog = z.output<typeof zPeopleLog>
