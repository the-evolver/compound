import { z } from 'zod'
import { zDay, zId, zTimestamp } from './common'

export const zExercise = z.object({
  id: zId,
  name: z.string().min(1),
  /** Double progression: work in this rep range… */
  repMin: z.number().int().positive(),
  repMax: z.number().int().positive(),
  /** …and add this much once every set reaches repMax. */
  increment: z.number().nonnegative().default(2.5),
  /** Bodyweight moves (push-ups, plank) progress by reps, not kg. */
  bodyweight: z.boolean().default(false),
  /** What a set counts: repetitions, or seconds held (plank). */
  measure: z.enum(['reps', 'seconds']).default('reps'),
  notes: z.string().default(''),
})
export type Exercise = z.output<typeof zExercise>

export const zWorkoutTemplate = z.object({
  id: zId,
  name: z.string().min(1),
  order: z.number(),
  items: z.array(z.object({ exerciseId: zId, sets: z.number().int().positive() })).min(1),
  archived: z.boolean().default(false),
})
export type WorkoutTemplate = z.output<typeof zWorkoutTemplate>

export const zSet = z.object({
  reps: z.number().int().nonnegative(),
  kg: z.number().nonnegative(),
})
export type WorkoutSet = z.output<typeof zSet>

export const zWorkoutSession = z.object({
  id: zId,
  day: zDay,
  templateId: zId.optional(),
  location: z.enum(['gym', 'home']).default('gym'),
  entries: z.array(z.object({ exerciseId: zId, sets: z.array(zSet) })).default(() => []),
  minutes: z.number().int().positive().optional(),
  note: z.string().default(''),
  at: zTimestamp,
})
export type WorkoutSession = z.output<typeof zWorkoutSession>

/**
 * Occasional measurements of any kind: waist, benchmarks, photo checkpoints.
 * `kind` comes from the measurement registry, so new kinds need no database
 * change. Photo checkpoints store 1 (taken); the app never stores photos.
 */
export const zMeasurement = z.object({
  id: zId,
  day: zDay,
  kind: z.string().min(1),
  value: z.number(),
  note: z.string().default(''),
  at: zTimestamp,
})
export type Measurement = z.output<typeof zMeasurement>
